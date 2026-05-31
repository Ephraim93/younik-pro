/*
 * Serveur YOUNIK — backend sécurisé.
 *   - Site public servi depuis /public
 *   - API publique : contenu, produits, création de commande
 *   - API admin (protégée par session) : réglages, produits, commandes, mot de passe
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Dossier des images téléversées
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, 'img_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 Mo max
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Format d\u2019image non accepté (JPEG, PNG, WebP ou GIF).'));
  }
});

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // exige HTTPS en production
    maxAge: 1000 * 60 * 60 * 8 // 8 h
  }
}));

// --- Authentification ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: 'Non autorisé' });
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password === 'string' && db.checkPassword(password)) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Mot de passe incorrect' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ auth: !!(req.session && req.session.admin) });
});

// --- API publique ---
app.get('/api/content', (req, res) => {
  res.json({
    settings: db.getPublicSettings(),
    products: db.getProducts(true),
    treatments: db.getTreatments(),
    booking: db.getBooking(),
    reviews: db.getReviews(true),
    reviewStats: db.reviewStats()
  });
});

// Avis client (public)
app.post('/api/reviews', (req, res) => {
  const { productId, name, rating, comment } = req.body || {};
  const r = db.addReview({ productId, name, rating, comment });
  if (!r) return res.status(400).json({ error: 'Nom, note et commentaire requis' });
  res.json({ ok: true, review: r });
});

// Créneaux disponibles pour une date
app.get('/api/availability', (req, res) => {
  res.json({ date: req.query.date || '', times: db.availableTimes(req.query.date || '') });
});

// Réserver un rendez-vous
app.post('/api/appointments', (req, res) => {
  const { treatmentId, date, time, name, phone, note } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Nom et téléphone requis' });
  if (!date || !time) return res.status(400).json({ error: 'Date et heure requises' });
  const appt = db.addAppointment({ treatmentId, date, time, name, phone, note });
  if (!appt) return res.status(409).json({ error: 'Ce créneau vient d\u2019être réservé. Choisissez-en un autre.' });
  res.json({ ok: true, appointment: { id: appt.id, date: appt.date, time: appt.time, treatmentName: appt.treatmentName } });
});

app.post('/api/orders', async (req, res) => {
  const { name, phone, note, items, payment } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Nom et téléphone requis' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Aucun article' });
  const order = db.addOrder({ name, phone, note, items });

  // Paiement en ligne (Flutterwave) : vérification côté serveur si configuré
  const settings = db.getSettings();
  if (settings.paymentMode === 'online' && settings.flwSecretKey && payment && payment.transactionId) {
    try {
      const v = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(payment.transactionId) + '/verify', {
        headers: { Authorization: 'Bearer ' + settings.flwSecretKey }
      });
      const data = await v.json();
      const ok = data && data.status === 'success' && data.data && data.data.status === 'successful' && Number(data.data.amount) >= order.total;
      if (ok) db.markOrderPaid(order.id, String(payment.transactionId));
    } catch (e) { /* la commande reste « non payée » et sera vérifiée manuellement */ }
  }

  const fresh = db.getOrders().find(o => o.id === order.id) || order;
  res.json({ ok: true, order: { id: order.id, total: order.total, paid: !!fresh.paid } });
});

// --- API admin (protégée) ---
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(db.getSettings()));
app.put('/api/admin/settings', requireAdmin, (req, res) => res.json(db.saveSettings(req.body || {})));

// Image d'accueil (hero)
app.post('/api/admin/settings/hero-image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue' });
    const settings = db.saveSettings({ heroImageUrl: '/uploads/' + req.file.filename });
    res.json(settings);
  });
});
app.delete('/api/admin/settings/hero-image', requireAdmin, (req, res) => {
  res.json(db.saveSettings({ heroImageUrl: '' }));
});

app.get('/api/admin/products', requireAdmin, (req, res) => res.json(db.getProducts(false)));
app.post('/api/admin/products', requireAdmin, (req, res) => res.json(db.addProduct(req.body || {})));
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.updateProduct(req.params.id, req.body || {});
  if (!p) return res.status(404).json({ error: 'Introuvable' });
  res.json(p);
});
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  res.json({ ok: db.deleteProduct(req.params.id) });
});

// Téléversement d'une image produit
app.post('/api/admin/products/:id/image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue' });
    const url = '/uploads/' + req.file.filename;
    const prod = db.setProductImage(req.params.id, url);
    if (!prod) {
      fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    res.json(prod);
  });
});

// Retirer l'image d'un produit
app.delete('/api/admin/products/:id/image', requireAdmin, (req, res) => {
  const prod = db.setProductImage(req.params.id, '');
  if (!prod) return res.status(404).json({ error: 'Introuvable' });
  res.json(prod);
});

app.get('/api/admin/orders', requireAdmin, (req, res) => res.json(db.getOrders()));
app.put('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const o = db.updateOrderStatus(req.params.id, (req.body || {}).status || 'nouvelle');
  if (!o) return res.status(404).json({ error: 'Introuvable' });
  res.json(o);
});

// Rendez-vous (admin)
app.get('/api/admin/booking', requireAdmin, (req, res) => res.json(db.getBooking()));
app.put('/api/admin/booking', requireAdmin, (req, res) => res.json(db.saveBooking(req.body || {})));
app.get('/api/admin/appointments', requireAdmin, (req, res) => res.json(db.getAppointments()));
app.put('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  const a = db.updateAppointmentStatus(req.params.id, (req.body || {}).status || 'confirmé');
  if (!a) return res.status(404).json({ error: 'Introuvable' });
  res.json(a);
});

// Tableau de bord
app.get('/api/admin/stats', requireAdmin, (req, res) => res.json(db.stats()));

// Avis (admin)
app.get('/api/admin/reviews', requireAdmin, (req, res) => res.json(db.getReviews(false)));
app.put('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const r = db.setReviewStatus(req.params.id, (req.body || {}).status || 'publié');
  if (!r) return res.status(404).json({ error: 'Introuvable' });
  res.json(r);
});
app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => res.json({ ok: db.deleteReview(req.params.id) }));

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: '6 caractères minimum' });
  }
  db.setPassword(newPassword);
  res.json({ ok: true });
});

// --- Fichiers statiques ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`YOUNIK en ligne sur http://localhost:${PORT}`);
  if (!process.env.SESSION_SECRET) {
    console.log('Astuce : définissez SESSION_SECRET en production pour garder les sessions stables.');
  }
});

/*
 * Couche de données YOUNIK.
 * Stockage simple dans un fichier JSON (data/db.json).
 * Toutes les lectures/écritures passent par ici, ce qui permet de remplacer
 * facilement ce fichier par une vraie base (PostgreSQL, MySQL...) plus tard.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function defaults() {
  return {
    settings: {
      brand: 'YOUNIK',
      tagline: 'Advanced Skin Therapy',
      announcement: 'Soin signature offert pour toute première consultation diagnostique · Sur rendez-vous',
      heroEyebrow: 'Clinique de soin de la peau · Premium',
      heroTitle: 'La science au service de votre peau.',
      heroLead: 'Chez YOUNIK, chaque protocole est unique. Diagnostic de précision, technologies avancées et gestes experts se conjuguent dans un écrin pensé pour révéler le meilleur de votre peau.',
      aboutTitle: 'Une approche du soin réinventée',
      aboutText: 'YOUNIK marie la rigueur dermo-scientifique à l\u2019élégance d\u2019un véritable lieu de bien-être. Chaque visite commence par l\u2019écoute, et se poursuit par un protocole conçu pour vous.',
      contactAddress: 'Cocody, Boulevard de la Paix, Abidjan, Côte d\u2019Ivoire',
      contactPhone: '+225 07 00 00 00 00',
      contactEmail: 'contact@younik.com',
      hours: 'Lun \u2013 Sam · 9h00 \u2013 19h00',
      mapLat: '5.3536',
      mapLng: '-3.9869',
      mapZoom: '15',
      currency: 'F',
      heroImageUrl: '/assets/hero-bg.png',   // image de fond de la page d'accueil (modifiable dans l'admin)
      whatsapp: '2250700000000',
      paymentMode: 'mobile',  // 'place' = sur place/livraison · 'mobile' = mobile money/virement · 'online' = en ligne (Flutterwave)
      mobileInstructions: 'Réglez par Wave, Orange Money ou MTN MoMo au +225 07 00 00 00 00, puis envoyez la preuve par WhatsApp pour confirmer votre commande.',
      flwPublicKey: '',       // clé publique Flutterwave (paiement en ligne)
      flwSecretKey: ''        // clé secrète Flutterwave (jamais exposée au public)
    },
    products: [
      { id: 'p1', name: 'Sérum N°1 — Éclat', category: 'Sérum', description: 'Vitamine C stabilisée & acide hyaluronique pour un teint unifié et lumineux.', price: 32000, stock: 25, active: true, imageUrl: '' },
      { id: 'p2', name: 'Crème Réparatrice Nuit', category: 'Crème', description: 'Régénération nocturne, peptides et beurres précieux pour une peau repulpée au réveil.', price: 28000, stock: 18, active: true, imageUrl: '' },
      { id: 'p3', name: 'Mousse Purifiante Douce', category: 'Nettoyant', description: 'Nettoie en profondeur sans agresser la barrière cutanée. Pour tous types de peaux.', price: 19000, stock: 40, active: true, imageUrl: '' },
      { id: 'p4', name: 'Écran Solaire SPF 50', category: 'Protection', description: 'Protection haute, fini invisible. Le geste indispensable au quotidien.', price: 22000, stock: 30, active: true, imageUrl: '' }
    ],
    treatments: [
      { id: 't1', name: 'Diagnostic YOUNIK', duration: '45 min', description: 'Bilan instrumental complet, conseils personnalisés et feuille de route pour votre peau.' },
      { id: 't2', name: 'Soin Éclat', duration: '60 min', description: 'Exfoliation douce et boost d\u2019hydratation pour un teint lumineux et reposé.' },
      { id: 't3', name: 'Protocole Anti-âge', duration: '75 min', description: 'Stimulation du collagène et lissage des traits par associations d\u2019actifs et de technologies.' },
      { id: 't4', name: 'Luminothérapie LED', duration: '30 min', description: 'Apaisement, régénération et lutte contre les imperfections grâce à la lumière médicale.' }
    ],
    orders: [],
    booking: {
      enabled: true,
      days: [1, 2, 3, 4, 5, 6],          // 0 = dimanche … 6 = samedi
      startTime: '09:00',
      endTime: '18:00',
      slotMinutes: 60,
      leadHours: 2,                       // délai minimum avant un RDV
      horizonDays: 21                     // réservable jusqu'à X jours à l'avance
    },
    appointments: [],
    reviews: [
      { id: 'r1', productId: '', productName: '', name: 'Amina K.', rating: 5, comment: 'Le diagnostic a tout changé : on m\u2019a enfin expliqué ma peau. Résultats visibles dès le premier soin.', status: 'publié', createdAt: '2026-04-12T10:00:00.000Z' },
      { id: 'r2', productId: 'p1', productName: 'Sérum N°1 — Éclat', name: 'Sarah M.', rating: 5, comment: 'Mon teint est plus lumineux et unifié en quelques semaines. Je recommande les yeux fermés.', status: 'publié', createdAt: '2026-04-20T14:30:00.000Z' },
      { id: 'r3', productId: '', productName: '', name: 'Léa D.', rating: 4, comment: 'Accueil parfait, lieu magnifique. J\u2019aurais aimé un peu plus de créneaux le week-end.', status: 'publié', createdAt: '2026-05-02T09:15:00.000Z' }
    ],
    admin: { passwordHash: bcrypt.hashSync('younik2026', 10) }
  };
}

let cache = null;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaults(), null, 2));
  }
}

function read() {
  if (cache) return cache;
  ensure();
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    cache = defaults();
    write();
  }
  // Compléter les clés manquantes (bases créées avant l'ajout de fonctions)
  const d = defaults();
  if (!cache.booking) cache.booking = d.booking;
  if (!Array.isArray(cache.appointments)) cache.appointments = [];
  if (!Array.isArray(cache.reviews)) cache.reviews = d.reviews;
  Object.keys(d.settings).forEach(k => { if (cache.settings[k] === undefined) cache.settings[k] = d.settings[k]; });
  return cache;
}

// --- Utilitaires de créneaux ---
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function fromMin(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

function computeAvailable(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return [];
  const db = read();
  const b = db.booking;
  if (!b || !b.enabled) return [];
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return [];
  if (!b.days.includes(d.getDay())) return [];
  // Horizon
  const today = new Date(todayStr() + 'T00:00:00');
  const max = new Date(today); max.setDate(max.getDate() + (b.horizonDays || 21));
  if (d < today || d > max) return [];
  // Génération des créneaux
  const slots = [];
  for (let m = toMin(b.startTime); m + (b.slotMinutes || 60) <= toMin(b.endTime); m += (b.slotMinutes || 60)) {
    slots.push(fromMin(m));
  }
  // Créneaux déjà pris
  const taken = new Set(db.appointments
    .filter(a => a.date === dateStr && a.status !== 'annulé')
    .map(a => a.time));
  // Délai minimum si c'est aujourd'hui
  const now = new Date();
  const isToday = dateStr === todayStr();
  const minMin = now.getHours() * 60 + now.getMinutes() + (b.leadHours || 0) * 60;
  return slots.filter(t => !taken.has(t) && (!isToday || toMin(t) >= minMin));
}

function write() {
  ensure();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

module.exports = {
  defaults,
  reset() { cache = defaults(); write(); return cache; },
  getSettings() { return read().settings; },
  getPublicSettings() {
    const s = Object.assign({}, read().settings);
    delete s.flwSecretKey; // ne jamais exposer la clé secrète
    return s;
  },
  saveSettings(patch) { Object.assign(read().settings, patch); write(); return read().settings; },

  getProducts(activeOnly) {
    const all = read().products;
    return activeOnly ? all.filter(p => p.active) : all;
  },
  addProduct(p) {
    const db = read();
    const id = 'p' + Date.now().toString(36);
    const prod = { id, name: p.name || 'Nouveau produit', category: p.category || '', description: p.description || '', price: Number(p.price) || 0, stock: Number(p.stock) || 0, active: p.active !== false, imageUrl: p.imageUrl || '' };
    db.products.push(prod); write(); return prod;
  },
  updateProduct(id, patch) {
    const db = read();
    const prod = db.products.find(p => p.id === id);
    if (!prod) return null;
    ['name', 'category', 'description'].forEach(k => { if (patch[k] != null) prod[k] = patch[k]; });
    if (patch.price != null) prod.price = Number(patch.price) || 0;
    if (patch.stock != null) prod.stock = Number(patch.stock) || 0;
    if (patch.active != null) prod.active = !!patch.active;
    if (patch.imageUrl != null) prod.imageUrl = patch.imageUrl;
    write(); return prod;
  },
  setProductImage(id, url) {
    const prod = read().products.find(p => p.id === id);
    if (!prod) return null;
    prod.imageUrl = url; write(); return prod;
  },
  deleteProduct(id) {
    const db = read();
    const i = db.products.findIndex(p => p.id === id);
    if (i === -1) return false;
    db.products.splice(i, 1); write(); return true;
  },

  getTreatments() { return read().treatments; },

  getOrders() { return read().orders; },
  addOrder(o) {
    const db = read();
    const items = (o.items || []).map(it => {
      const prod = db.products.find(p => p.id === it.productId);
      const price = prod ? prod.price : 0;
      const name = prod ? prod.name : (it.name || 'Article');
      const qty = Math.max(1, Number(it.qty) || 1);
      if (prod && typeof prod.stock === 'number') prod.stock = Math.max(0, prod.stock - qty);
      return { productId: it.productId, name, price, qty };
    });
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const order = {
      id: 'o' + Date.now().toString(36),
      name: o.name || '', phone: o.phone || '', note: o.note || '',
      items, total, status: 'nouvelle',
      paymentMethod: read().settings.paymentMode || 'mobile',
      paid: false, paymentRef: '',
      createdAt: new Date().toISOString()
    };
    db.orders.unshift(order); write(); return order;
  },
  markOrderPaid(id, ref) {
    const o = read().orders.find(x => x.id === id);
    if (!o) return null;
    o.paid = true; o.paymentRef = ref || ''; write(); return o;
  },
  updateOrderStatus(id, status) {
    const db = read();
    const ord = db.orders.find(o => o.id === id);
    if (!ord) return null;
    ord.status = status; write(); return ord;
  },

  checkPassword(pw) { return bcrypt.compareSync(pw, read().admin.passwordHash); },
  setPassword(pw) { read().admin.passwordHash = bcrypt.hashSync(pw, 10); write(); },

  getBooking() { return read().booking; },
  saveBooking(patch) {
    const b = read().booking;
    if (patch.enabled != null) b.enabled = !!patch.enabled;
    if (Array.isArray(patch.days)) b.days = patch.days.map(Number).filter(n => n >= 0 && n <= 6);
    if (patch.startTime) b.startTime = patch.startTime;
    if (patch.endTime) b.endTime = patch.endTime;
    if (patch.slotMinutes != null) b.slotMinutes = Math.max(15, Number(patch.slotMinutes) || 60);
    if (patch.leadHours != null) b.leadHours = Math.max(0, Number(patch.leadHours) || 0);
    if (patch.horizonDays != null) b.horizonDays = Math.max(1, Number(patch.horizonDays) || 21);
    write(); return b;
  },
  availableTimes(dateStr) { return computeAvailable(dateStr); },

  getAppointments() { return read().appointments; },
  addAppointment(o) {
    const db = read();
    if (!computeAvailable(o.date).includes(o.time)) return null; // créneau plus disponible
    const treat = db.treatments.find(t => t.id === o.treatmentId);
    const appt = {
      id: 'a' + Date.now().toString(36),
      treatmentId: o.treatmentId || '',
      treatmentName: treat ? treat.name : (o.treatmentName || 'Soin'),
      date: o.date, time: o.time,
      name: o.name || '', phone: o.phone || '', note: o.note || '',
      status: 'confirmé', createdAt: new Date().toISOString()
    };
    db.appointments.push(appt); write(); return appt;
  },
  updateAppointmentStatus(id, status) {
    const a = read().appointments.find(x => x.id === id);
    if (!a) return null;
    a.status = status; write(); return a;
  },

  getReviews(publishedOnly) {
    const all = read().reviews.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return publishedOnly ? all.filter(r => r.status === 'publié') : all;
  },
  addReview(o) {
    const db = read();
    const rating = Math.min(5, Math.max(1, Math.round(Number(o.rating) || 0)));
    if (!rating || !o.name || !o.comment) return null;
    const prod = o.productId ? db.products.find(p => p.id === o.productId) : null;
    const review = {
      id: 'r' + Date.now().toString(36),
      productId: prod ? prod.id : '',
      productName: prod ? prod.name : '',
      name: String(o.name).slice(0, 60),
      rating,
      comment: String(o.comment).slice(0, 600),
      status: 'publié',
      createdAt: new Date().toISOString()
    };
    db.reviews.unshift(review); write(); return review;
  },
  setReviewStatus(id, status) {
    const r = read().reviews.find(x => x.id === id);
    if (!r) return null;
    r.status = status; write(); return r;
  },
  deleteReview(id) {
    const db = read();
    const i = db.reviews.findIndex(r => r.id === id);
    if (i === -1) return false;
    db.reviews.splice(i, 1); write(); return true;
  },
  reviewStats() {
    const pub = read().reviews.filter(r => r.status === 'publié');
    const count = pub.length;
    const avg = count ? pub.reduce((s, r) => s + r.rating, 0) / count : 0;
    return { count, avg: Math.round(avg * 10) / 10 };
  },

  stats() {
    const db = read();
    const orders = db.orders;
    const paidish = orders.filter(o => o.status !== 'annulée');
    const revenue = paidish.reduce((s, o) => s + (o.total || 0), 0);
    // Top produits par quantité commandée
    const qty = {};
    orders.forEach(o => (o.items || []).forEach(it => { qty[it.name] = (qty[it.name] || 0) + (it.qty || 0); }));
    const topProducts = Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, q]) => ({ name, qty: q }));
    // RDV à venir
    const today = todayStr();
    const upcoming = db.appointments.filter(a => a.status !== 'annulé' && a.date >= today).length;
    // Stock bas
    const lowStock = db.products.filter(p => p.active && p.stock <= 5).map(p => ({ name: p.name, stock: p.stock }));
    const rs = (() => { const pub = db.reviews.filter(r => r.status === 'publié'); const c = pub.length; return { count: c, avg: c ? Math.round((pub.reduce((s, r) => s + r.rating, 0) / c) * 10) / 10 : 0 }; })();
    return {
      ordersCount: orders.length,
      ordersNew: orders.filter(o => o.status === 'nouvelle').length,
      revenue,
      currency: db.settings.currency || 'F',
      upcomingAppointments: upcoming,
      productsActive: db.products.filter(p => p.active).length,
      lowStock,
      topProducts,
      reviews: rs
    };
  }
};

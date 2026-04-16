'use strict';
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── Premier démarrage : génère .env automatiquement ──────────────────────────
// Sur Render/production, les vars d'env sont injectées directement → on saute la génération
const ENV_PATH = path.join(__dirname, '.env');
if (!fs.existsSync(ENV_PATH) && !process.env.ADMIN_PASS_HASH) {
  const bcrypt = require('bcryptjs');
  const pass   = crypto.randomBytes(8).toString('hex');
  const hash   = bcrypt.hashSync(pass, 12);
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(ENV_PATH, [
    'ADMIN_USERNAME=admin',
    `ADMIN_PASS_HASH=${hash}`,
    `SESSION_SECRET=${secret}`,
    'PORT=3000'
  ].join('\n'), 'utf8');
  console.log('\n  ╔═══════════════════════════════════════╗');
  console.log('  ║   PREMIER DÉMARRAGE – Identifiants    ║');
  console.log('  ╠═══════════════════════════════════════╣');
  console.log(`  ║  Utilisateur : admin                  ║`);
  console.log(`  ║  Mot de passe : ${pass.padEnd(21)}║`);
  console.log('  ║  ⚠  Notez-le, il ne réapparaîtra pas ║');
  console.log('  ╚═══════════════════════════════════════╝\n');
}

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const bcrypt  = require('bcryptjs');

const app  = express();
const PORT = process.env.PORT || 3000;

const GALLERY_PATH     = path.join(__dirname, 'data', 'gallery.json');
const SPECIALITES_PATH = path.join(__dirname, 'data', 'specialites.json');
const PRODUITS_PATH    = path.join(__dirname, 'data', 'produits.json');
const UPLOADS_DIR      = path.join(__dirname, 'assets', 'img', 'galerie');
const UPLOADS_SPEC_DIR = path.join(__dirname, 'assets', 'img', 'specialites');
const UPLOADS_PROD_DIR = path.join(__dirname, 'assets', 'img', 'produits');

// Crée les dossiers d'upload s'ils n'existent pas (nécessaire sur Render)
fs.mkdirSync(UPLOADS_DIR,      { recursive: true });
fs.mkdirSync(UPLOADS_SPEC_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_PROD_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────
function readGallery()     { return JSON.parse(fs.readFileSync(GALLERY_PATH,     'utf8')); }
function writeGallery(d)   { fs.writeFileSync(GALLERY_PATH,     JSON.stringify(d, null, 2), 'utf8'); }
function readSpecialites()  { return JSON.parse(fs.readFileSync(SPECIALITES_PATH, 'utf8')); }
function writeSpecialites(d){ fs.writeFileSync(SPECIALITES_PATH, JSON.stringify(d, null, 2), 'utf8'); }
function readProduits()     { return JSON.parse(fs.readFileSync(PRODUITS_PATH,    'utf8')); }
function writeProduits(d)   { fs.writeFileSync(PRODUITS_PATH,    JSON.stringify(d, null, 2), 'utf8'); }

// ── Multer (upload images) ────────────────────────────────────────────────────
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, ALLOWED_MIMES.has(file.mimetype));
  }
});

// ── Rate limiter (login brute-force) ──────────────────────────────────────────
const loginAttempts = new Map();
function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) return false;
  if (entry.count >= 10) {
    entry.lockedUntil = now + 15 * 60 * 1000;
    entry.count = 0;
    loginAttempts.set(ip, entry);
    return false;
  }
  return true;
}
function recordFail(ip) {
  const e = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  e.count++;
  loginAttempts.set(ip, e);
}
function resetAttempts(ip) { loginAttempts.delete(ip); }

// ── Middleware global ─────────────────────────────────────────────────────────
app.set('trust proxy', 1); // Render / reverse-proxy HTTPS

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Fichiers statiques (jamais .env, jamais server.js)
app.use('/css',    express.static(path.join(__dirname, 'css')));
app.use('/js',     express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Routes publiques ──────────────────────────────────────────────────────────
app.get('/api/gallery',     (_req, res) => { try { res.json(readGallery());     } catch { res.status(500).json({ error: 'Erreur lecture galerie' });     } });
app.get('/api/specialites', (_req, res) => { try { res.json(readSpecialites()); } catch { res.status(500).json({ error: 'Erreur lecture spécialités' }); } });
app.get('/api/produits',    (_req, res) => { try { res.json(readProduits());    } catch { res.status(500).json({ error: 'Erreur lecture produits' });    } });

app.get('/',      (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  const ip = req.ip;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = validUser && await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);
  if (!validUser || !validPass) {
    recordFail(ip);
    await new Promise(r => setTimeout(r, 300));
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  resetAttempts(ip);
  req.session.authenticated = true;
  req.session.save(() => res.json({ ok: true }));
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── Middleware auth ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Non authentifié' });
}

// ── Routes admin galerie ──────────────────────────────────────────────────────
app.get('/api/admin/gallery', requireAuth, (_req, res) => {
  try { res.json(readGallery()); } catch(err) { res.status(500).json({ error: err.message }); }
});

// Upload une nouvelle photo pour un item
app.post('/api/admin/gallery/:id/image', requireAuth, (req, res) => {
  upload.single('image')(req, res, err => {
    if (err || !req.file) {
      return res.status(400).json({ error: err?.message || 'Fichier invalide (JPEG, PNG ou WebP, max 5 Mo)' });
    }
    const id  = parseInt(req.params.id, 10);
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const filename = `photo-${id}-${Date.now()}${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);
    fs.renameSync(req.file.path, dest);

    const gallery = readGallery();
    const item = gallery.items.find(i => i.id === id);
    if (!item) {
      fs.unlinkSync(dest);
      return res.status(404).json({ error: 'Photo introuvable' });
    }

    // Supprime l'ancienne image uploadée si elle existait
    if (item.src.startsWith('/assets/img/galerie/photo-')) {
      const old = path.join(__dirname, item.src.slice(1));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    item.src = `/assets/img/galerie/${filename}`;
    writeGallery(gallery);
    res.json({ ok: true, src: item.src, item });
  });
});

// Modifie le texte (alt, ariaLabel) d'un item
app.patch('/api/admin/gallery/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { alt, ariaLabel, colorClass } = req.body;
  const gallery = readGallery();
  const item = gallery.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Photo introuvable' });

  if (alt !== undefined)       item.alt = String(alt).slice(0, 200);
  if (ariaLabel !== undefined) item.ariaLabel = String(ariaLabel).slice(0, 100);
  if (colorClass !== undefined && /^gal-[1-5]$/.test(colorClass)) item.colorClass = colorClass;

  writeGallery(gallery);
  res.json({ ok: true, item });
});

// Réordonne les items : [{id, order}, ...]
app.put('/api/admin/gallery/reorder', requireAuth, (req, res) => {
  const updates = req.body.items;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Format invalide' });
  const gallery = readGallery();
  updates.forEach(({ id, order }) => {
    const item = gallery.items.find(i => i.id === id);
    if (item) item.order = order;
  });
  writeGallery(gallery);
  res.json({ ok: true });
});

// Revert un item vers l'image Unsplash d'origine
app.delete('/api/admin/gallery/:id/image', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const gallery = readGallery();
  const item = gallery.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Photo introuvable' });

  if (item.src.startsWith('/assets/img/galerie/photo-')) {
    const old = path.join(__dirname, item.src.slice(1));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  item.src = item.seedSrc;
  writeGallery(gallery);
  res.json({ ok: true, item });
});

// ── Routes admin : Spécialités ────────────────────────────────────────────────
const uploadSpec = multer({
  dest: UPLOADS_SPEC_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) { cb(null, ALLOWED_MIMES.has(file.mimetype)); }
});

app.get('/api/admin/specialites', requireAuth, (_req, res) => {
  try { res.json(readSpecialites()); } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/specialites/:id/image', requireAuth, (req, res) => {
  uploadSpec.single('image')(req, res, err => {
    if (err || !req.file) return res.status(400).json({ error: err?.message || 'Fichier invalide' });
    const id  = parseInt(req.params.id, 10);
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const filename = `spec-${id}-${Date.now()}${ext}`;
    const dest = path.join(UPLOADS_SPEC_DIR, filename);
    fs.renameSync(req.file.path, dest);

    const data = readSpecialites();
    const item = data.items.find(i => i.id === id);
    if (!item) { fs.unlinkSync(dest); return res.status(404).json({ error: 'Spécialité introuvable' }); }

    if (item.src.startsWith('/assets/img/specialites/spec-')) {
      const old = path.join(__dirname, item.src.slice(1));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    item.src = `/assets/img/specialites/${filename}`;
    writeSpecialites(data);
    res.json({ ok: true, src: item.src, item });
  });
});

app.patch('/api/admin/specialites/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { tag, name, description, price, ariaLabel } = req.body;
  const data = readSpecialites();
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Spécialité introuvable' });

  if (tag         !== undefined) item.tag         = String(tag).slice(0, 50);
  if (name        !== undefined) item.name        = String(name).slice(0, 100);
  if (description !== undefined) item.description = String(description).slice(0, 500);
  if (price       !== undefined) item.price       = String(price).slice(0, 30);
  if (ariaLabel   !== undefined) item.ariaLabel   = String(ariaLabel).slice(0, 100);

  writeSpecialites(data);
  res.json({ ok: true, item });
});

app.put('/api/admin/specialites/reorder', requireAuth, (req, res) => {
  const updates = req.body.items;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Format invalide' });
  const data = readSpecialites();
  updates.forEach(({ id, order }) => {
    const item = data.items.find(i => i.id === id);
    if (item) item.order = order;
  });
  writeSpecialites(data);
  res.json({ ok: true });
});

app.delete('/api/admin/specialites/:id/image', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readSpecialites();
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Spécialité introuvable' });

  if (item.src.startsWith('/assets/img/specialites/spec-')) {
    const old = path.join(__dirname, item.src.slice(1));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  item.src = item.seedSrc;
  writeSpecialites(data);
  res.json({ ok: true, item });
});

// ── Routes admin : Produits ───────────────────────────────────────────────────
app.get('/api/admin/produits', requireAuth, (_req, res) => {
  try { res.json(readProduits()); } catch(err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/produits/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { emoji, name, description, price, category, visible } = req.body;
  const data = readProduits();
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Produit introuvable' });

  const validCats = data.categories.map(c => c.id).filter(c => c !== 'all');
  if (emoji       !== undefined) item.emoji       = String(emoji).slice(0, 8);
  if (name        !== undefined) item.name        = String(name).slice(0, 100);
  if (description !== undefined) item.description = String(description).slice(0, 300);
  if (price       !== undefined) item.price       = String(price).slice(0, 30);
  if (category    !== undefined && validCats.includes(category)) item.category = category;
  if (visible     !== undefined) item.visible = Boolean(visible);

  writeProduits(data);
  res.json({ ok: true, item });
});

app.post('/api/admin/produits', requireAuth, (req, res) => {
  const { emoji, name, description, price, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Nom et catégorie requis' });
  const data    = readProduits();
  const maxId   = data.items.reduce((m, i) => Math.max(m, i.id), 0);
  const maxOrd  = data.items.reduce((m, i) => Math.max(m, i.order), 0);
  const newItem = {
    id: maxId + 1,
    emoji:       String(emoji || '🍞').slice(0, 8),
    name:        String(name).slice(0, 100),
    description: String(description || '').slice(0, 300),
    price:       String(price || '').slice(0, 30),
    category:    String(category),
    visible:     true,
    order:       maxOrd + 1
  };
  data.items.push(newItem);
  writeProduits(data);
  res.status(201).json({ ok: true, item: newItem });
});

app.delete('/api/admin/produits/:id', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readProduits();
  const idx  = data.items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' });
  data.items.splice(idx, 1);
  writeProduits(data);
  res.json({ ok: true });
});

// ── Routes admin : Images produits ────────────────────────────────────────────
const uploadProd = multer({
  dest: UPLOADS_PROD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) { cb(null, ALLOWED_MIMES.has(file.mimetype)); }
});

app.post('/api/admin/produits/:id/image', requireAuth, (req, res) => {
  uploadProd.single('image')(req, res, err => {
    if (err || !req.file) return res.status(400).json({ error: err?.message || 'Fichier invalide (JPEG, PNG ou WebP, max 5 Mo)' });
    const id  = parseInt(req.params.id, 10);
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const filename = `prod-${id}-${Date.now()}${ext}`;
    const dest = path.join(UPLOADS_PROD_DIR, filename);
    fs.renameSync(req.file.path, dest);

    const data = readProduits();
    const item = data.items.find(i => i.id === id);
    if (!item) { fs.unlinkSync(dest); return res.status(404).json({ error: 'Produit introuvable' }); }

    if (item.imageSrc && item.imageSrc.startsWith('/assets/img/produits/')) {
      const old = path.join(__dirname, item.imageSrc.slice(1));
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    item.imageSrc = `/assets/img/produits/${filename}`;
    writeProduits(data);
    res.json({ ok: true, src: item.imageSrc });
  });
});

app.delete('/api/admin/produits/:id/image', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readProduits();
  const item = data.items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Produit introuvable' });

  if (item.imageSrc && item.imageSrc.startsWith('/assets/img/produits/')) {
    const old = path.join(__dirname, item.imageSrc.slice(1));
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  item.imageSrc = null;
  writeProduits(data);
  res.json({ ok: true });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`  Serveur démarré → http://localhost:${PORT}`);
  console.log(`  Panel admin    → http://localhost:${PORT}/admin\n`);
});

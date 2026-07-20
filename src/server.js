const express = require('express');
const path = require('path');
const db = require('./db_json');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const ADMIN_HASH = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'changeme').digest('hex');
const sessions = new Map();
const SESSION_TTL = Number(process.env.SESSION_TTL_SECONDS || 3600); // seconds

function createToken() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now());
  return token;
}

function pruneSessions() {
  const now = Date.now();
  for (const [k, created] of sessions.entries()) {
    if ((now - created) / 1000 > SESSION_TTL) sessions.delete(k);
  }
}
setInterval(pruneSessions, 60 * 1000);

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  const created = sessions.get(token);
  if (!created) return res.status(401).json({ error: 'Unauthorized' });
  if ((Date.now() - created) / 1000 > SESSION_TTL) { sessions.delete(token); return res.status(401).json({ error: 'Session expired' }); }
  // refresh session timestamp
  sessions.set(token, Date.now());
  next();
}

// simple in-memory rate limiter per IP
const rateWindows = new Map();
function rateLimit(keyFn, windowMs, max) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = rateWindows.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count += 1;
    rateWindows.set(key, entry);
    if (entry.count > max) return res.status(429).json({ error: 'Rate limit exceeded' });
    next();
  };
}

const guides = [
  {
    id: 'documentation-creation-guide',
    name: 'Documentation Creation Guide',
    description: 'A comprehensive guide for planning, writing, designing, reviewing, publishing, and maintaining documentation.',
    url: '/guides/documentation_creation_guide.html'
  },
  {
    id: 'swift-6-for-java-kotlin',
    name: 'Swift 6 for Java/Kotlin Programmers',
    description: 'A porting and language-features guide for Java and Kotlin developers moving to Swift 6.',
    url: '/guides/swift_6_for_java_kotlin_programmers.html'
  },
  {
    id: 'c-cpp-learning-guide',
    name: 'C / C++ Learning Guide',
    description: 'Core concepts, build tools, and examples to get started with C and C++ development.',
    url: '/guides/c_cpp_learning_guide.html'
  }
];

// Ensure DB has initial guides if empty
try {
  const existing = db.getGuides();
  if (!existing || existing.length === 0) {
    guides.forEach(g => db.addGuide(g));
  }
} catch (err) {
  console.error('Failed to seed guides', err);
}

app.get('/api/guides', (req, res) => {
  try {
    const guides = db.getGuides();
    res.json(guides || []);
  } catch (err) {
    console.error('Failed to load guides', err);
    res.json([]);
  }
});

// admin login: client sends SHA256 hash of password
app.post('/api/admin/login', (req, res) => {
  const { hash } = req.body || {};
  if (!hash) return res.status(400).json({ error: 'Missing hash' });
  if (hash === ADMIN_HASH) {
    const token = createToken();
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Rate limit guide requests: 10 per hour per IP
app.post('/api/request-guide', rateLimit(req => req.ip, 60 * 60 * 1000, 10), async (req, res) => {
  try {
    const { name, email, topic, details } = req.body || {};
    if (!topic || !name) return res.status(400).json({ error: 'Missing required fields' });
    // basic validation lengths
    if (topic.length > 200 || (details && details.length > 2000)) return res.status(400).json({ error: 'Input too long' });
    const id = db.insertRequest({ name, email, topic, details });

    // optional email notification
    try {
      const SMTP_HOST = process.env.SMTP_HOST;
      if (SMTP_HOST) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        const to = process.env.ADMIN_EMAIL || process.env.SMTP_TO;
        if (to) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'no-reply@example.test',
            to,
            subject: `New guide request: ${topic}`,
            text: `Name: ${name}\nEmail: ${email || ''}\nTopic: ${topic}\n\n${details || ''}`
          });
        }
      }
    } catch (mailErr) {
      console.error('Email notification failed', mailErr);
    }

    res.json({ ok: true, id });
  } catch (err) {
    console.error('DB insert failed', err);
    res.status(500).json({ error: 'Failed to save request' });
  }
});

// list requests (admin only)
app.get('/api/requests', requireAuth, (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const per_page = Number(req.query.per_page) || 20;
    const result = db.listRequests({ page, per_page });
    res.json(result);
  } catch (err) {
    console.error('DB select failed', err);
    res.status(500).json({ error: 'Failed to retrieve requests' });
  }
});

// CSV export (admin)
app.get('/api/requests.csv', requireAuth, (req, res) => {
  try {
    const all = db.listRequests({ page: 1, per_page: 100000 }).data.reverse(); // get oldest-first
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="requests.csv"');
    const header = 'id,name,email,topic,details,created_at\n';
    const rows = all.map(r => `"${String(r.id).replace(/"/g,'""')}","${(r.name||'').replace(/"/g,'""')}","${(r.email||'').replace(/"/g,'""')}","${(r.topic||'').replace(/"/g,'""')}","${(r.details||'').replace(/"/g,'""')}","${r.created_at}"`).join('\n');
    res.send(header + rows);
  } catch (err) {
    console.error('CSV export failed', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

app.delete('/api/guides/:id', requireAuth, (req, res) => {
  try {
    const ok = db.deleteGuide(req.params.id);
    res.json({ ok });
  } catch (err) {
    console.error('delete guide failed', err);
    res.status(500).json({ error: 'Failed to delete guide' });
  }
});

app.delete('/api/requests/:id', requireAuth, (req, res) => {
  try {
    const ok = db.deleteRequest(req.params.id);
    res.json({ ok });
  } catch (err) {
    console.error('delete failed', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.post('/api/guides', requireAuth, (req, res) => {
  try {
    const { id, name, description, url } = req.body || {};
    if (!name || !url) return res.status(400).json({ error: 'Missing fields' });
    const g = db.addGuide({ id, name, description, url });
    res.json({ ok: true, guide: g });
  } catch (err) {
    console.error('add guide failed', err);
    res.status(500).json({ error: 'Failed to add guide' });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// fallback to index for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Documentation guides server running on http://localhost:${port}`);
});

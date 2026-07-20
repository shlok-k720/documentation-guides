const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const FILE = path.join(DB_DIR, 'guides.json');

function load() {
  try {
    if (!fs.existsSync(FILE)) {
      const init = { requests: [], guides: [] };
      fs.writeFileSync(FILE, JSON.stringify(init, null, 2));
      return init;
    }
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw || '{"requests":[],"guides":[]}');
  } catch (err) {
    return { requests: [], guides: [] };
  }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function insertRequest({ name, email, topic, details }) {
  const data = load();
  const last = data.requests.length ? data.requests[data.requests.length - 1].id : 0;
  const id = last + 1;
  const rec = { id, name: name || null, email: email || null, topic, details: details || null, created_at: new Date().toISOString() };
  data.requests.push(rec);
  save(data);
  return id;
}

function listRequests({ page = 1, per_page = 20 } = {}) {
  const data = load();
  const all = (data.requests || []).slice().reverse();
  const total = all.length;
  const p = Math.max(1, Number(page) || 1);
  const per = Math.max(1, Math.min(200, Number(per_page) || 20));
  const start = (p - 1) * per;
  const items = all.slice(start, start + per);
  return { total, page: p, per_page: per, data: items };
}

function deleteRequest(id) {
  const data = load();
  const nid = Number(id);
  const before = data.requests.length;
  data.requests = data.requests.filter(r => r.id !== nid);
  save(data);
  return data.requests.length < before;
}

function deleteGuide(id) {
  const data = load();
  const gid = String(id);
  const before = data.guides.length;
  data.guides = (data.guides || []).filter(g => String(g.id) !== gid);
  save(data);
  return data.guides.length < before;
}

function getGuides() {
  const data = load();
  return data.guides || [];
}

function addGuide({ id, name, description, url }) {
  const data = load();
  const gid = id || (name || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + (Date.now() % 10000);
  const g = { id: gid, name, description, url };
  data.guides = data.guides || [];
  data.guides.push(g);
  save(data);
  return g;
}

module.exports = { insertRequest, listRequests, deleteRequest, getGuides, addGuide, deleteGuide };

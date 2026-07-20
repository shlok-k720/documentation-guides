async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function setToken(t) { localStorage.setItem('adminToken', t); }
function getToken() { return localStorage.getItem('adminToken'); }
function clearToken() { localStorage.removeItem('adminToken'); }

async function login() {
  const pass = document.getElementById('adminPass').value || '';
  const msg = document.getElementById('loginMessage');
  msg.textContent = '';
  const hash = await sha256Hex(pass);
  try {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }) });
    const body = await res.json();
    if (!res.ok) {
      msg.textContent = body.error || 'Login failed';
      return;
    }
    setToken(body.token);
    showAdminUI();
  } catch (err) {
    msg.textContent = 'Login error';
  }
}

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

let currentPage = 1;
const perPage = 10;

async function fetchRequests(page = 1) {
  const el = document.getElementById('requestsList');
  el.textContent = 'Loading…';
  try {
    const res = await fetch(`/api/requests?page=${page}&per_page=${perPage}`, { headers: { Authorization: 'Bearer ' + getToken() } });
    if (!res.ok) throw new Error('Unauthorized');
    const payload = await res.json();
    const rows = payload.data || [];
    currentPage = payload.page || page;
    const total = payload.total || 0;
    if (!rows.length) { el.textContent = 'No requests.'; document.getElementById('pageInfo').textContent = `Page ${currentPage}`; return; }
    const list = document.createElement('div');
    rows.forEach(r => {
      const item = document.createElement('div');
      item.style.borderBottom = '1px solid #eee';
      item.style.padding = '8px 0';
      item.innerHTML = `<strong>${escapeHtml(r.topic)}</strong> — ${escapeHtml(r.name)} <br/><small>${escapeHtml(r.email || '')} • ${escapeHtml(r.created_at)}</small><div style="margin-top:6px;"><button data-id="${r.id}" class="btn">Delete</button></div>`;
      list.appendChild(item);
    });
    el.innerHTML = '';
    el.appendChild(list);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} • ${total} total`;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage * perPage >= total;

    el.querySelectorAll('button[data-id]').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (!confirm('Delete request #' + id + '?')) return;
      const res = await fetch('/api/requests/' + id, { method: 'DELETE', headers: authHeaders() });
      const body = await res.json();
      if (body.ok) fetchRequests(currentPage); else alert('Delete failed');
    }));
  } catch (err) {
    el.textContent = 'Failed to load requests (unauthorized?).';
  }
}

async function exportCsv() {
  try {
    const res = await fetch('/api/requests.csv', { headers: { Authorization: 'Bearer ' + getToken() } });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'requests.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) { alert('CSV export failed'); }
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }

async function fetchGuides() {
  const el = document.getElementById('guidesList');
  el.textContent = 'Loading…';
  try {
    const res = await fetch('/api/guides');
    const guides = await res.json();
    if (!guides.length) { el.textContent = 'No guides.'; return; }
    const list = document.createElement('div');
    guides.forEach(g => {
      const item = document.createElement('div');
      item.style.borderBottom = '1px solid #eee';
      item.style.padding = '8px 0';
      item.innerHTML = `<strong>${escapeHtml(g.name)}</strong> <div style="color:#666">${escapeHtml(g.description || '')}</div><div style="margin-top:6px;"><a class="btn secondary" href="${escapeHtml(g.url)}">Open</a></div>`;
      list.appendChild(item);
    });
    el.innerHTML = '';
    el.appendChild(list);
  } catch (err) {
    el.textContent = 'Failed to load guides.';
  }
}

function showAdminUI() {
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('adminUI').style.display = 'block';
  // default to requests tab
  showTab('requests');
  fetchRequests();
  fetchGuides();
}

function showTab(name) {
  document.getElementById('requestsTab').style.display = name === 'requests' ? 'block' : 'none';
  document.getElementById('guidesTab').style.display = name === 'guides' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (token) showAdminUI();

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', () => { clearToken(); location.reload(); });
  document.getElementById('tabRequests').addEventListener('click', () => showTab('requests'));
  document.getElementById('tabGuides').addEventListener('click', () => showTab('guides'));

  document.getElementById('prevPage').addEventListener('click', () => fetchRequests(Math.max(1, currentPage - 1)));
  document.getElementById('nextPage').addEventListener('click', () => fetchRequests(currentPage + 1));
  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  document.getElementById('addGuideForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = { name: f.name.value.trim(), url: f.url.value.trim(), description: f.description.value.trim() };
    const msg = document.getElementById('addGuideMsg');
    msg.textContent = '';
    try {
      const res = await fetch('/api/guides', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
      const body = await res.json();
      if (!res.ok) { msg.textContent = body.error || 'Failed'; return; }
      msg.textContent = 'Added';
      f.reset();
      fetchGuides();
    } catch (err) { msg.textContent = 'Failed to add guide'; }
  });
});

// enhance fetchGuides to include delete buttons for guides when logged in
async function deleteGuide(id) {
  if (!confirm('Delete guide ' + id + '?')) return;
  try {
    const res = await fetch('/api/guides/' + encodeURIComponent(id), { method: 'DELETE', headers: authHeaders() });
    const body = await res.json();
    if (body.ok) fetchGuides(); else alert('Delete failed');
  } catch (err) { alert('Delete failed'); }
}

// rewrite fetchGuides to attach delete when admin token present
const _oldFetchGuides = fetchGuides;
fetchGuides = async function() {
  const el = document.getElementById('guidesList');
  el.textContent = 'Loading…';
  try {
    const res = await fetch('/api/guides');
    const guides = await res.json();
    if (!guides.length) { el.textContent = 'No guides.'; return; }
    const list = document.createElement('div');
    const isAdmin = !!getToken();
    guides.forEach(g => {
      const item = document.createElement('div');
      item.style.borderBottom = '1px solid #eee';
      item.style.padding = '8px 0';
      const deleteBtn = isAdmin ? `<button data-id="${g.id}" class="btn danger" style="margin-left:8px">Delete</button>` : '';
      item.innerHTML = `<strong>${escapeHtml(g.name)}</strong> <div style="color:#666">${escapeHtml(g.description || '')}</div><div style="margin-top:6px;"><a class="btn secondary" href="${escapeHtml(g.url)}">Open</a>${deleteBtn}</div>`;
      list.appendChild(item);
    });
    el.innerHTML = '';
    el.appendChild(list);
    if (isAdmin) {
      el.querySelectorAll('button[data-id]').forEach(btn => btn.addEventListener('click', () => deleteGuide(btn.dataset.id)));
    }
  } catch (err) {
    el.textContent = 'Failed to load guides.';
  }
};

async function loadGuides() {
  const container = document.getElementById('cards');
  container.innerHTML = '';
  // Try dynamic API first, fall back to static guides.json for GitHub Pages
  let guides = null;
  try {
    const res = await fetch('/guides');
    if (res.ok) {
      guides = await res.json();
    } else if (res.status === 404) {
      guides = null;
    }
  } catch (err) {
    // network error — likely no server on GH Pages
    guides = null;
  }

  if (!guides) {
    try {
      const r2 = await fetch('/guides.json');
      if (r2.ok) {
        const j = await r2.json();
        // accept either { guides: [...] } or [...]
        guides = Array.isArray(j) ? j : (j.guides || []);
      }
    } catch (err) {
      console.error('Fallback guides.json failed', err);
    }
  }

  if (!guides || !guides.length) {
    container.textContent = 'No guides available.';
    return;
  }

  guides.forEach(g => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h3>${escapeHtml(g.name)}</h3>
      <p class="desc">${escapeHtml(g.description)}</p>
      <p><a class="btn" href="${g.url}">Open guide</a></p>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', loadGuides);

// Request form submission
async function submitRequest(event) {
  event.preventDefault();
  const form = event.target;
  const msg = document.getElementById('requestMessage');
  msg.textContent = '';
  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    topic: form.topic.value.trim(),
    details: form.details.value.trim()
  };
  if (!data.name || !data.topic) {
    msg.textContent = 'Please provide your name and topic.';
    return;
  }

  try {
    const res = await fetch('/api/request-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Server error');
    msg.textContent = 'Request submitted — thank you!';
    form.reset();
  } catch (err) {
    console.error('request failed', err);
    msg.textContent = 'Failed to submit request.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('requestForm');
  if (form) form.addEventListener('submit', submitRequest);
});

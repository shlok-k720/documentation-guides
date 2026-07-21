async function loadGuides() {
  const container = document.getElementById('cards');
  container.innerHTML = '';

  try {
    const response = await fetch('guides.json');
    if (!response.ok) throw new Error(`Unable to load guides (${response.status})`);
    const manifest = await response.json();
    const guides = Array.isArray(manifest) ? manifest : manifest.guides;

    if (!Array.isArray(guides) || !guides.length) {
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
  } catch (err) {
    console.error('Failed to load guides', err);
    container.textContent = 'Guides could not be loaded.';
  }
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
  if (!form.reportValidity()) return;
  if (!form.name.value.trim() || !form.topic.value.trim()) {
    msg.textContent = 'Please provide your name and topic.';
    return;
  }

  try {
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.errors?.[0]?.message || 'Submission failed');
    msg.textContent = 'Request submitted — thank you!';
    form.reset();
  } catch (err) {
    console.error('request failed', err);
    msg.textContent = err.message || 'Failed to submit request.';
  } finally {
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('requestForm');
  if (form) form.addEventListener('submit', submitRequest);
});

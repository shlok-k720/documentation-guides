async function loadGuides() {
  try {
    const res = await fetch('/api/guides');
    const guides = await res.json();
    const container = document.getElementById('cards');
    container.innerHTML = '';

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
    document.getElementById('cards').textContent = 'Failed to load guides.';
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

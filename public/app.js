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

    const categories = ['Category 1', 'Category 2'];
    const groupedGuides = new Map(categories.map(category => [category, []]));

    guides.forEach(guide => {
      const category = groupedGuides.has(guide.category) ? guide.category : 'Category 1';
      groupedGuides.get(category).push(guide);
    });

    categories.forEach((category, index) => {
      const categoryGuides = groupedGuides.get(category);
      if (!categoryGuides.length) return;

      if (index > 0 && container.children.length) {
        const divider = document.createElement('div');
        divider.className = 'category-divider';
        divider.setAttribute('aria-hidden', 'true');
        container.appendChild(divider);
      }

      const section = document.createElement('section');
      section.className = 'guide-category';
      section.innerHTML = `<h2 class="category-title">${escapeHtml(category)}</h2>`;

      const grid = document.createElement('div');
      grid.className = 'card-grid';
      categoryGuides.forEach(guide => {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <h3>${escapeHtml(guide.name)}</h3>
          <p class="desc">${escapeHtml(guide.description)}</p>
          <p><a class="btn" href="${guide.url}">Open guide</a></p>
        `;
        grid.appendChild(card);
      });

      section.appendChild(grid);
      container.appendChild(section);
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

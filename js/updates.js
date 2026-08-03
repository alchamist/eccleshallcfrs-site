/* updates.js — load & render published updates via the cached /api/public-updates endpoint */

async function fetchUpdates() {
  var res = await fetch('/api/public-updates');
  if (!res.ok) throw new Error('API error ' + res.status);
  var data = await res.json();
  if (!data.ok) throw new Error('API error');
  return data.updates;
}

function fmtDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) { return s; }
}

function stripMd(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/\r?\n+/g, ' ')
    .trim();
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(update) {
  var imgHtml = update.image
    ? '<img class="news-card-img" src="' + esc(update.image) + '" alt="" loading="lazy">'
    : '<div class="news-card-placeholder">📰</div>';
  var excerpt = update.summary || (update.body ? stripMd(update.body).slice(0, 160) : '');
  return '<div class="news-card">'
    + imgHtml
    + '<div class="news-card-body">'
    + (update.date ? '<div class="news-date">' + esc(fmtDate(update.date)) + '</div>' : '')
    + '<h3>' + esc(update.title) + '</h3>'
    + (excerpt ? '<p>' + esc(excerpt) + (excerpt.length >= 160 ? '…' : '') + '</p>' : '')
    + '<a class="read-more" href="update.html?f=' + encodeURIComponent(update.filename) + '">Read more →</a>'
    + '</div></div>';
}

async function initUpdatesList(containerId, limit) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading updates…</p></div>';
  try {
    var updates = await fetchUpdates();
    if (!updates.length) {
      el.innerHTML = '<div class="empty-state"><p>No updates yet — check back soon.</p></div>';
      return;
    }
    var slice = (limit && limit < updates.length) ? updates.slice(0, limit) : updates;
    var grid = document.createElement('div');
    grid.className = 'grid grid-3';
    grid.innerHTML = slice.map(buildCard).join('');
    el.innerHTML = '';
    el.appendChild(grid);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p>Updates couldn\'t be loaded right now. <a href="https://www.facebook.com/131270403575068" target="_blank" rel="noopener">Visit our Facebook page</a> for the latest news.</p></div>';
    console.error(e);
  }
}

async function initSingleUpdate(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var params = new URLSearchParams(window.location.search);
  var filename = params.get('f');
  if (!filename) {
    el.innerHTML = '<div class="empty-state"><p>Update not found. <a href="updates.html">Back to updates</a></p></div>';
    return;
  }
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
  try {
    var updates = await fetchUpdates();
    var update = updates.filter(function(u) { return u.filename === filename; })[0];
    if (!update) {
      el.innerHTML = '<div class="empty-state"><p>This update is no longer available. <a href="updates.html">Back to updates</a></p></div>';
      return;
    }
    document.title = (update.title || 'Update') + ' – Eccleshall CFRs';
    var imgHtml = update.image ? '<img src="' + esc(update.image) + '" alt="" style="border-radius:var(--radius);margin-bottom:1.5rem;width:100%;" loading="lazy">' : '';
    el.innerHTML = '<article class="prose">'
      + imgHtml
      + (update.date ? '<div class="news-date">' + esc(fmtDate(update.date)) + '</div>' : '')
      + '<h1 style="margin-top:0.4rem;margin-bottom:1.5rem;">' + esc(update.title || filename) + '</h1>'
      + '<div id="update-body"></div>'
      + '<div style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">'
      + '<a href="updates.html" class="btn btn-outline">← Back to updates</a>'
      + '</div></article>';
    var bodyEl = document.getElementById('update-body');
    if (window.marked && window.DOMPurify) {
      bodyEl.innerHTML = DOMPurify.sanitize(marked.parse(update.body));
    } else {
      // No sanitizer available — render as plain text rather than risk unsanitized HTML.
      bodyEl.textContent = update.body;
    }
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p>This update couldn\'t be found. <a href="updates.html">Back to updates</a></p></div>';
  }
}

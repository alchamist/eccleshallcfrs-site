/* updates.js — load & render markdown updates from GitHub */

var REPO   = 'alchamist/eccleshallcfrs-site';
var BRANCH = 'main';
var FOLDER = 'updates';

function apiUrl(path) {
  return 'https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH;
}

async function fetchFileList() {
  var res = await fetch(apiUrl(FOLDER), { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!res.ok) throw new Error('GitHub API ' + res.status);
  var files = await res.json();
  return files
    .filter(function(f) { return f.name.endsWith('.md'); })
    .sort(function(a, b) { return b.name.localeCompare(a.name); });
}

async function fetchFile(path) {
  var res = await fetch(apiUrl(path), { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!res.ok) throw new Error('Not found: ' + path);
  var data = await res.json();
  return atob(data.content.replace(/\s/g, ''));
}

function parseFrontmatter(raw) {
  var m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  var meta = {};
  m[1].split('\n').forEach(function(line) {
    var i = line.indexOf(':');
    if (i < 0) return;
    var k = line.slice(0, i).trim();
    var v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    meta[k] = v;
  });
  return { meta: meta, body: m[2].trim() };
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

function isVisible(meta) {
  var status = meta.status || 'published';
  if (status !== 'published') return false;
  if (meta.end_date) {
    var today = new Date().toISOString().slice(0, 10);
    if (today >= meta.end_date) return false;
  }
  return true;
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
    var files = await fetchFileList();
    if (!files || !files.length) {
      el.innerHTML = '<div class="empty-state"><p>No updates yet — check back soon.</p></div>';
      return;
    }
    var slice = (limit && limit < files.length) ? files.slice(0, limit) : files;
    var updates = await Promise.all(slice.map(async function(f) {
      try {
        var raw = await fetchFile(f.path);
        var parsed = parseFrontmatter(raw);
        if (!isVisible(parsed.meta)) return null;
        return {
          filename: f.name,
          title: parsed.meta.title || f.name.replace(/\.md$/, ''),
          date:  parsed.meta.date  || '',
          image: parsed.meta.image || '',
          summary: parsed.meta.summary || '',
          body:  parsed.body
        };
      } catch(e) { return null; }
    }));
    var valid = updates.filter(Boolean);
    if (!valid.length) {
      el.innerHTML = '<div class="empty-state"><p>No updates yet — check back soon.</p></div>';
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'grid grid-3';
    grid.innerHTML = valid.map(buildCard).join('');
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
    var raw = await fetchFile(FOLDER + '/' + filename);
    var parsed = parseFrontmatter(raw);
    var meta = parsed.meta;
    if (!isVisible(meta)) {
      el.innerHTML = '<div class="empty-state"><p>This update is no longer available. <a href="updates.html">Back to updates</a></p></div>';
      return;
    }
    document.title = (meta.title || 'Update') + ' – Eccleshall CFRs';
    var imgHtml = meta.image ? '<img src="' + esc(meta.image) + '" alt="" style="border-radius:var(--radius);margin-bottom:1.5rem;width:100%;" loading="lazy">' : '';
    el.innerHTML = '<article class="prose">'
      + imgHtml
      + (meta.date ? '<div class="news-date">' + esc(fmtDate(meta.date)) + '</div>' : '')
      + '<h1 style="margin-top:0.4rem;margin-bottom:1.5rem;">' + esc(meta.title || filename) + '</h1>'
      + '<div id="update-body"></div>'
      + '<div style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border);">'
      + '<a href="updates.html" class="btn btn-outline">← Back to updates</a>'
      + '</div></article>';
    var bodyEl = document.getElementById('update-body');
    if (window.marked) {
      bodyEl.innerHTML = marked.parse(parsed.body);
    } else {
      bodyEl.textContent = parsed.body;
    }
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><p>This update couldn\'t be found. <a href="updates.html">Back to updates</a></p></div>';
  }
}

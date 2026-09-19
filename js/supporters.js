/* supporters.js — load & render the supporters grid from /api/supporters */

async function initSupporters(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  try {
    var res = await fetch('/api/supporters');
    if (!res.ok) throw new Error('API error ' + res.status);
    var data = await res.json();
    if (!data.ok || !Array.isArray(data.supporters)) throw new Error('API error');

    el.innerHTML = '';
    if (!data.supporters.length) {
      el.innerHTML = '<p>Our supporters will be listed here soon.</p>';
      return;
    }
    data.supporters.forEach(function(s) { el.appendChild(buildSupporterCard(s)); });
  } catch(e) {
    el.innerHTML = '<p>Our supporters couldn\'t be loaded right now — please try again shortly.</p>';
    console.error(e);
  }
}

// Built with DOM APIs (not innerHTML) so supporter names/captions can never inject markup.
function buildSupporterCard(s) {
  var linked = /^https?:\/\//i.test(s.url || '');
  var card = document.createElement(linked ? 'a' : 'div');
  card.className = 'sponsor-card' + (s.dark ? ' sponsor-card-dark' : '');
  if (linked) {
    card.href = s.url;
    card.target = '_blank';
    card.rel = 'noopener';
    card.style.textDecoration = 'none';
  }

  var img = document.createElement('img');
  img.src = s.logo;
  img.alt = s.name;
  img.loading = 'lazy';
  card.appendChild(img);

  if (s.caption) {
    var cap = document.createElement('p');
    cap.className = 'sponsor-card-desc';
    cap.textContent = s.caption;
    card.appendChild(cap);
  }
  return card;
}

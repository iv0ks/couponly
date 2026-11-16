// couponly front-end.
//
// The wallet lists your own coupons (each rendered as a ticket showing its
// public hashids code). You can also "open a coupon by code". The UI only ever
// asks the server for a coupon by that short code — it never sees other users'
// coupons on its own. Reaching bob's premium coupon is the lab: recover the
// hashids salt from GET /api/config, forge the victim's code, and feed it to
// GET /api/coupons/:code (e.g. from Burp). The redeem/modify writes work the
// same way on a forged code.
const $ = (sel) => document.querySelector(sel);

const loginCard = $('#login-card');
const wallet = $('#wallet');
const who = $('#who');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function ticket(c) {
  const state = c.redeemed
    ? '<span class="badge redeemed">redeemed</span>'
    : '<span class="badge active">active</span>';
  return (
    `<div class="ticket" data-code="${c.code}">` +
    `<div class="t-main"><span class="t-title">${c.title} ${state}</span>` +
    `<span class="t-code">code: ${c.code}</span></div>` +
    `<span class="t-pct">${c.discountPct}%</span></div>`
  );
}

function renderMine(rows) {
  $('#my-coupons').innerHTML = rows.map(ticket).join('');
  document.querySelectorAll('.ticket').forEach((el) => {
    el.addEventListener('click', () => openCode(el.dataset.code));
  });
}

function renderDetail(c) {
  const d = new Date(c.expiresAt).toISOString().slice(0, 10);
  $('#viewer').innerHTML =
    `<div class="detail">` +
    `<div class="row"><span class="k">title</span><span class="v">${c.title}</span></div>` +
    `<div class="row"><span class="k">coupon code</span><span class="v">${c.couponCode}</span></div>` +
    `<div class="row"><span class="k">discount</span><span class="v">${c.discountPct}%</span></div>` +
    `<div class="row"><span class="k">redeemed</span><span class="v">${c.redeemed}</span></div>` +
    `<div class="row"><span class="k">expires</span><span class="v">${d}</span></div>` +
    `</div>`;
}

async function openCode(code) {
  if (!code) return;
  const { status, body } = await api(`/api/coupons/${encodeURIComponent(code)}`);
  if (status !== 200) {
    $('#viewer').innerHTML = `<p class="error">${body.message || 'could not open coupon'}</p>`;
    return;
  }
  renderDetail(body.coupon);
}

async function loadWallet() {
  const me = await api('/api/coupons');
  if (me.status !== 200) return false;
  renderMine(me.body.coupons);
  loginCard.classList.add('hidden');
  wallet.classList.remove('hidden');
  return true;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const f = e.target;
  const { status, body } = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: f.username.value, password: f.password.value }),
  });
  if (status !== 200) {
    $('#login-error').textContent = body.message || 'login failed';
    return;
  }
  who.textContent = `@${body.user.username}`;
  await loadWallet();
});

$('#open-form').addEventListener('submit', (e) => {
  e.preventDefault();
  openCode(e.target.code.value.trim());
});

$('#logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  wallet.classList.add('hidden');
  loginCard.classList.remove('hidden');
  who.textContent = '';
});

// Resume an existing session on load.
api('/api/coupons').then(({ status, body }) => {
  if (status === 200) {
    renderMine(body.coupons);
    loginCard.classList.add('hidden');
    wallet.classList.remove('hidden');
  }
});

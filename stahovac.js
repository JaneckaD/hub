// Stahovač: video a hudba z YouTube, TikToku, Instagramu a Spotify.
// Stahuje přímo v hubu přes malý program v počítači (pc/stahovac.py, adresa 127.0.0.1:8766),
// protože tyhle služby prohlížeči samotnému stahovat nedovolí. Kde program neběží (třeba na telefonu),
// pošle hub odkaz do hotového stahovače na webu (SERVICES).
const PC = 'http://127.0.0.1:8766';
const SERVICES = {
  cobalt: { name: 'cobalt.tools', open: (link) => 'https://cobalt.tools/#' + link },
  spotify: { name: 'SpotiDownloader', open: () => 'https://spotidownloader.com/' },
};
const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], svc: 'cobalt', video: true, color: '#e5484d' },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], svc: 'cobalt', video: true, color: '#111827' },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'], svc: 'cobalt', video: true, color: '#d63384' },
  { id: 'spotify', label: 'Spotify', hosts: ['spotify.com'], svc: 'spotify', video: false, color: '#16a34a' },
];
const OTHER = { id: 'other', label: 'Jiný web', svc: 'cobalt', video: true, color: '#475569' };
const QUALITIES = [['best', 'Nejlepší'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']];

const ICONS = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  download: '<path d="M12 4v11.5M7 10.5l5 5 5-5"/><path d="M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  paste: '<rect x="6" y="4.5" width="12" height="16" rx="2.5"/><path d="M9.5 4.5V3.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v.7M9.5 11h5M9.5 14.5h3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  music: '<path d="M9 18V5.5l10.5-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
  pc: '<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M8.5 20h7M12 16.5V20"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
};
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const size = (b) => !b ? '' : b < 1048576 ? Math.round(b / 1024) + ' kB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

function parse(text) {
  const t = text.trim().match(/\S+/)?.[0] || '';
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    const p = PLATFORMS.find((x) => x.hosts.some((h) => host === h || host.endsWith('.' + h))) || OTHER;
    return { url: u.href, platform: p };
  } catch { return null; }
}

/* ---------- spojení s programem v počítači ---------- */
async function pcFetch(path, opts = {}, ms = 4000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(PC + path, { ...opts, signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Chyba ' + res.status);
    return res;
  } finally { clearTimeout(t); }
}

let mode = 'video', quality = 'best', lastLink = '';
let pc = null; // null = zjišťuji, true = program běží, false = neběží
let jobs = [], pollTimer = null, host = null, ctx = null;
const saved = new Set(), saving = new Set();
const $ = (s) => host.querySelector(s);

export function reset() { lastLink = ''; jobs = []; stopPoll(); }

export function mount(el, context) {
  host = el; ctx = context;
  host.innerHTML = `
  <div class="kv st">
    <div class="kv-title">
      <button class="ghost" id="stback">${icon('back')}<span>Hub</span></button>
      <div><h1>Stahovač</h1><p>Video nebo hudba z YouTube, TikToku, Instagramu a Spotify.</p></div>
    </div>
    <div class="st-pc" id="stpc"></div>
    <form class="st-card" id="stform" novalidate>
      <div class="st-input">
        ${icon('link', 'ico st-link')}
        <input id="sturl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Vlož odkaz na video nebo písničku" aria-label="Odkaz" />
        <button type="button" class="ghost st-clear" id="stclear" aria-label="Smazat odkaz" hidden>${icon('x')}</button>
        <button type="button" class="ghost" id="stpaste">${icon('paste')}<span>Vložit</span></button>
      </div>
      <div class="st-row">
        <span class="st-plat" id="stplat"></span>
        <select class="st-q" id="stq" aria-label="Kvalita videa">${QUALITIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <div class="st-seg" role="radiogroup" aria-label="Co stáhnout">
          <button type="button" role="radio" data-m="video">${icon('video')}<span>Video</span></button>
          <button type="button" role="radio" data-m="audio">${icon('music')}<span>Hudba</span></button>
        </div>
      </div>
      <button class="primary st-go" id="stgo" disabled>${icon('download')}<span>Stáhnout</span></button>
      <p class="st-hint" id="sthint"></p>
    </form>
    <ul class="kv-list st-jobs" id="stjobs" role="list"></ul>
  </div>`;
  $('#stback').onclick = () => ctx.back();
  const inp = $('#sturl');
  inp.value = lastLink;
  inp.addEventListener('input', update);
  $('#stclear').onclick = () => { inp.value = ''; update(); inp.focus(); };
  if (!navigator.clipboard?.readText) $('#stpaste').hidden = true;
  $('#stpaste').onclick = async () => {
    try { inp.value = (await navigator.clipboard.readText()).trim(); update(); }
    catch { ctx.toast('Prohlížeč nedovolil číst schránku. Vlož odkaz ručně.'); inp.focus(); }
  };
  $('#stq').value = quality;
  $('#stq').onchange = (e) => { quality = e.target.value; };
  host.querySelectorAll('.st-seg button').forEach((b) => (b.onclick = () => { if (!b.disabled) { mode = b.dataset.m; update(); } }));
  $('#stform').onsubmit = (e) => { e.preventDefault(); go(); };
  update(); renderPc(); renderJobs();
  if (!lastLink) inp.focus();
  checkPc();
}

async function checkPc() {
  try {
    await pcFetch('/api/ping', {}, 1500);
    pc = true; await refreshJobs();
  } catch { pc = false; stopPoll(); }
  if (host?.isConnected) { renderPc(); update(); }
}

function renderPc() {
  const box = $('#stpc'); if (!box) return;
  box.className = 'st-pc ' + (pc ? 'ok' : pc === false ? 'off' : '');
  box.innerHTML = pc === null ? `${icon('pc')}<span>Hledám stahovací program v počítači…</span>`
    : pc ? `${icon('pc')}<span><b>Stahuje se přímo tady.</b> Program v počítači běží.</span>`
    : `${icon('pc')}<span><b>Program v počítači tu neběží</b>, takže odkaz otevřu ve stahovači na webu.</span><button class="ghost" id="stretry">${icon('refresh')}<span>Zkusit znovu</span></button>`;
  const r = $('#stretry'); if (r) r.onclick = () => { pc = null; renderPc(); checkPc(); };
}

function update() {
  const inp = $('#sturl'), r = parse(inp.value);
  lastLink = inp.value;
  $('#stclear').hidden = !inp.value;
  const plat = $('#stplat');
  if (r) { plat.innerHTML = `<i></i>${esc(r.platform.label)}`; plat.querySelector('i').style.setProperty('--c', r.platform.color); }
  else plat.innerHTML = inp.value.trim() ? '<span class="st-bad">Tohle není odkaz</span>' : '';
  const videoOk = !r || r.platform.video;
  const m = videoOk ? mode : 'audio';
  host.querySelectorAll('.st-seg button').forEach((b) => {
    b.disabled = b.dataset.m === 'video' && !videoOk;
    b.setAttribute('aria-checked', String(b.dataset.m === m));
    b.classList.toggle('on', b.dataset.m === m);
  });
  $('#stq').hidden = !(pc && m === 'video');
  $('#stgo').disabled = !r;
  const svc = r && SERVICES[r.platform.svc];
  $('#sthint').innerHTML = !r ? 'Odkaz zkopíruješ v aplikaci přes Sdílet → Kopírovat odkaz.'
    : pc ? (m === 'audio' ? 'Stáhne se jako MP3.' : 'Stáhne se jako MP4.') + (r.platform.id === 'spotify' ? ' Písničku ze Spotify najdu podle názvu na YouTube.' : '') + ' Hotový soubor uložíš tlačítkem Uložit.'
    : r.platform.id === 'spotify' ? `Otevře se <b>${svc.name}</b> a odkaz bude ve schránce. Vlož ho tam a stáhni písničku.`
    : `Otevře se <b>${svc.name}</b> s tvým odkazem. Tam ${m === 'audio' ? 'dole přepni na <b>audio</b> a ' : ''}klikni na stáhnout. Kdyby tam odkaz nebyl, je ve schránce, stačí ho vložit.`;
}

async function go() {
  const r = parse($('#sturl').value);
  if (!r) return;
  ctx.alive();
  const m = r.platform.video ? mode : 'audio';
  if (pc) {
    const btn = $('#stgo'); btn.disabled = true;
    try {
      const job = await (await pcFetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: r.url, mode: m, quality }) })).json();
      jobs = [job, ...jobs.filter((j) => j.id !== job.id)];
      if (parse($('#sturl').value)?.url === r.url) $('#sturl').value = '';
      update(); renderJobs(); startPoll();
    } catch {
      pc = false; renderPc(); update(); ctx.toast('Program v počítači neodpovídá. Zkus ho spustit znovu.');
    } finally { btn.disabled = !parse($('#sturl').value); }
    return;
  }
  const svc = SERVICES[r.platform.svc];
  navigator.clipboard?.writeText(r.url).catch(() => {});
  const a = document.createElement('a'); a.href = svc.open(r.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.append(a); a.click(); a.remove();
}

/* ---------- seznam stahování ---------- */
async function refreshJobs() {
  try { jobs = await (await pcFetch('/api/jobs')).json(); }
  catch { pc = false; stopPoll(); renderPc(); update(); }
  renderJobs();
  if (jobs.some((j) => j.status === 'running')) startPoll(); else stopPoll();
}
function startPoll() { if (!pollTimer) pollTimer = setInterval(() => { if (!host?.isConnected) return stopPoll(); ctx.alive(); refreshJobs(); }, 1000); }
function stopPoll() { clearInterval(pollTimer); pollTimer = null; }

function renderJobs() {
  const list = $('#stjobs'); if (!list) return;
  list.innerHTML = jobs.map((j) => `
    <li class="kv-row st-job" data-status="${j.status === 'running' ? 'busy' : j.status}" data-id="${j.id}">
      <span class="kv-kind">${icon(j.mode === 'audio' ? 'music' : 'video')}</span>
      <div class="kv-info">
        <b title="${esc(j.title || j.url)}">${esc(j.title || j.url)}</b>
        <small class="kv-meta">${esc(j.status === 'running' ? `${j.phase || 'Stahuji'}${j.progress != null ? ' · ' + Math.round(j.progress * 100) + ' %' : '…'}`
          : j.status === 'error' ? j.error : `${saved.has(j.id) ? 'Uloženo' : 'Hotovo'} · ${j.mode === 'audio' ? 'MP3' : 'MP4'} · ${size(j.size)}`)}</small>
        <div class="kv-prog"><i></i></div>
      </div>
      <div class="kv-ctrl">
        ${j.status === 'done' ? `<button class="primary st-save" ${saving.has(j.id) ? 'disabled' : ''}>${icon('download')}<span>${saving.has(j.id) ? 'Ukládám…' : 'Uložit'}</span></button>` : ''}
        ${j.status !== 'running' ? `<button class="kv-rm" aria-label="Odebrat">${icon('x')}</button>` : ''}
      </div>
    </li>`).join('');
  list.querySelectorAll('.st-job').forEach((row) => {
    const j = jobs.find((x) => x.id === row.dataset.id);
    row.querySelector('.kv-kind').style.setProperty('--c', j.mode === 'audio' ? '#d63384' : '#7c4ddb');
    row.querySelector('.kv-prog i').style.width = (j.status === 'running' ? (j.progress != null ? Math.max(3, j.progress * 100) : 100) : 0) + '%';
    row.querySelector('.kv-prog').classList.toggle('indet', j.status === 'running' && j.progress == null);
    const sv = row.querySelector('.st-save'); if (sv) sv.onclick = () => save(j, sv);
    const rm = row.querySelector('.kv-rm'); if (rm) rm.onclick = async () => {
      jobs = jobs.filter((x) => x.id !== j.id); renderJobs();
      pcFetch('/api/jobs/' + j.id, { method: 'DELETE' }).catch(() => {});
    };
  });
}

async function save(j, btn) {
  saving.add(j.id); renderJobs();
  try {
    const blob = await (await pcFetch(`/api/jobs/${j.id}/file`, {}, 10 * 60e3)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = j.filename || 'stazeno'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60e3);
    saved.add(j.id);
  } catch (e) { ctx.toast('Soubor se nepodařilo uložit: ' + (e?.message || 'chyba')); }
  saving.delete(j.id); renderJobs();
}

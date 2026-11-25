// Stahovač: vezme odkaz z YouTube, TikToku, Instagramu nebo Spotify a pošle ho do hotového stahovače
// (statická stránka sama stahovat nemůže, ty služby to prohlížeči nedovolí).
// Když některá služba přestane fungovat, stačí ji vyměnit v SERVICES.
const SERVICES = {
  cobalt: { name: 'cobalt.tools', open: (link) => 'https://cobalt.tools/#' + link, paste: false },
  spotify: { name: 'SpotiDownloader', open: () => 'https://spotidownloader.com/', paste: true },
};
const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], svc: 'cobalt', video: true, color: '#e5484d' },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], svc: 'cobalt', video: true, color: '#111827' },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'], svc: 'cobalt', video: true, color: '#d63384' },
  { id: 'spotify', label: 'Spotify', hosts: ['spotify.com'], svc: 'spotify', video: false, color: '#16a34a' },
];
const OTHER = { id: 'other', label: 'Jiný web', svc: 'cobalt', video: true, color: '#475569' };

const ICONS = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  download: '<path d="M12 4v11.5M7 10.5l5 5 5-5"/><path d="M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  paste: '<rect x="6" y="4.5" width="12" height="16" rx="2.5"/><path d="M9.5 4.5V3.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v.7M9.5 11h5M9.5 14.5h3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  music: '<path d="M9 18V5.5l10.5-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
};
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

let mode = 'video', lastLink = '';
let host = null, ctx = null;
const $ = (s) => host.querySelector(s);

export function reset() { lastLink = ''; }

export function mount(el, context) {
  host = el; ctx = context;
  host.innerHTML = `
  <div class="kv st">
    <div class="kv-title">
      <button class="ghost" id="stback">${icon('back')}<span>Hub</span></button>
      <div><h1>Stahovač</h1><p>Video nebo hudba z YouTube, TikToku, Instagramu a Spotify.</p></div>
    </div>
    <form class="st-card" id="stform" novalidate>
      <div class="st-input">
        ${icon('link', 'ico st-link')}
        <input id="sturl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="Vlož odkaz na video nebo písničku" aria-label="Odkaz" />
        <button type="button" class="ghost st-clear" id="stclear" aria-label="Smazat odkaz" hidden>${icon('x')}</button>
        <button type="button" class="ghost" id="stpaste">${icon('paste')}<span>Vložit</span></button>
      </div>
      <div class="st-row">
        <span class="st-plat" id="stplat"></span>
        <div class="st-seg" role="radiogroup" aria-label="Co stáhnout">
          <button type="button" role="radio" data-m="video">${icon('video')}<span>Video</span></button>
          <button type="button" role="radio" data-m="audio">${icon('music')}<span>Hudba</span></button>
        </div>
      </div>
      <button class="primary st-go" id="stgo" disabled>${icon('download')}<span>Stáhnout</span></button>
      <p class="st-hint" id="sthint"></p>
    </form>
  </div>`;
  $('#stback').onclick = () => ctx.back();
  const inp = $('#sturl');
  inp.value = lastLink;
  inp.addEventListener('input', update);
  $('#stclear').onclick = () => { inp.value = ''; update(); inp.focus(); };
  if (!navigator.clipboard?.readText) $('#stpaste').hidden = true;
  $('#stpaste').onclick = async () => {
    try { inp.value = (await navigator.clipboard.readText()).trim(); update(); }
    catch { ctx.toast('Prohlížeč nedovolil číst schránku. Vlož odkaz ručně (Ctrl+V).'); inp.focus(); }
  };
  host.querySelectorAll('.st-seg button').forEach((b) => (b.onclick = () => { if (!b.disabled) { mode = b.dataset.m; update(); } }));
  $('#stform').onsubmit = (e) => { e.preventDefault(); go(); };
  update();
  if (!lastLink) inp.focus();
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
  $('#stgo').disabled = !r;
  const svc = r && SERVICES[r.platform.svc];
  $('#sthint').innerHTML = !r ? 'Odkaz zkopíruješ v aplikaci přes Sdílet → Kopírovat odkaz.'
    : r.platform.id === 'spotify' ? `Otevře se <b>${svc.name}</b> a odkaz bude ve schránce. Vlož ho tam a stáhni písničku. Ze Spotify jde jen hudba.`
    : `Otevře se <b>${svc.name}</b> s tvým odkazem. Tam ${m === 'audio' ? 'dole přepni na <b>audio</b> a ' : ''}klikni na stáhnout. Kdyby tam odkaz nebyl, je ve schránce, stačí ho vložit.`;
}

function go() {
  const r = parse($('#sturl').value);
  if (!r) return;
  const svc = SERVICES[r.platform.svc];
  navigator.clipboard?.writeText(r.url).catch(() => {});
  const a = document.createElement('a'); a.href = svc.open(r.url); a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.append(a); a.click(); a.remove();
  ctx.alive();
}

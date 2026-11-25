// Osobní hub Davida Janečky. Přihlášení i data řeší Firebase (projekt flashcards-663fd):
// heslo ověřuje server Firebase a dlaždice leží v databázi, kterou pravidla pustí jen k účtu hubu.
// V tomhle souboru proto nejsou žádná tajemství (konfigurace Firebase je veřejná z principu).
import {
  initializeApp, initializeAuth, browserSessionPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential, connectAuthEmulator,
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc,
} from './firebase.js?v=1.1';

const VERSION = '1.1'; // při změně uprav i ?v= v index.html (3×) a v importu výše
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA3zzb5ZmReIpOK5tq6jfiIC_EF-3IId6A', authDomain: 'flashcards-663fd.firebaseapp.com', projectId: 'flashcards-663fd',
  storageBucket: 'flashcards-663fd.firebasestorage.app', messagingSenderId: '804475670634', appId: '1:804475670634:web:6f851aa49f3909c613ba13',
};
// Jediný účet hubu. Stejný e-mail je ve firestore.rules. E-maily se na něj nikam neposílají.
const HUB_EMAIL = 'hub@hub.davidjanecka.cz';
// Firebase chce heslo aspoň o 6 znacích, proto se před to, co napíšeš, přidá "hub:".
// Bezpečnost to nepřidává ani neubírá: o síle rozhoduje jen heslo, které píšeš ty.
const secret = (pw) => 'hub:' + pw;
const MIN_NEW = 8;            // nové heslo musí mít aspoň tolik znaků
const LOCK_AFTER = 30 * 60e3; // po 30 minutách bez pohybu se hub sám zamkne

const EMU = new URLSearchParams(location.search).has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const app = initializeApp(EMU ? { apiKey: 'demo-key', authDomain: 'demo-hub.firebaseapp.com', projectId: 'demo-hub', appId: 'demo' } : FIREBASE_CONFIG);
// Přihlášení platí jen do zavření prohlížeče (karty). Nic se neukládá natrvalo.
const auth = initializeAuth(app, { persistence: browserSessionPersistence });
const db = getFirestore(app);
if (EMU) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }

/* ---------- ikonky (vlastní, tahy 24×24) ---------- */
const ICONS = {
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.2 2.8 2.8L16.5 9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/>',
  note: '<path d="M14.5 3.5H7a2.5 2.5 0 0 0-2.5 2.5v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V8.5z"/><path d="M14.5 3.5v5h5M8.5 13h7M8.5 16.5h4.5"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 13h18M11 13v2h2v-2"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 19.5a6.3 6.3 0 0 1 12.4 0"/><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.8 14.3a6 6 0 0 1 3.4 5.2"/>',
  receipt: '<path d="M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  wallet: '<path d="M18.5 7.5V5.8A1.8 1.8 0 0 0 16.7 4H6a2.5 2.5 0 0 0 0 5h13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 20H6a2.5 2.5 0 0 1-2.5-2.5V6.5"/><circle cx="16.3" cy="14.5" r="1.2"/>',
  bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.7 10.7c.5.4.7 1 .7 1.6v1.7h6v-1.7c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.5z"/>',
  school: '<path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11.6v4.6c1.5 1.6 3.4 2.3 5.5 2.3s4-.7 5.5-2.3v-4.6M21.5 9.5v5"/>',
  camera: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="16.9" cy="7.1" r=".6" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  flame: '<path d="M12 20.5a6 6 0 0 0 6-6c0-3.6-2.5-5.6-3.5-8.5-.4 1.9-1.4 3-2.5 3.5.2-2.4-.6-4.6-2.5-6C9.6 7.4 6 9.5 6 14.5a6 6 0 0 0 6 6z"/><path d="M12 20.5a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.3-2.4 2.5-4 1.2 1.6 2.5 2.4 2.5 4a2.5 2.5 0 0 1-2.5 2.5z"/>',
  cart: '<path d="M3 4h2.2l2.2 11h10.4l2-7.5H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  plane: '<path d="M10.5 13.5 4 11.3l1.4-1.4 7 .7 4.3-4.3a1.9 1.9 0 0 1 2.7 2.7l-4.3 4.3.7 7-1.4 1.4-2.2-6.5-3.4 3.4.3 2.2-1.1 1.1-1.5-3-3-1.5 1.1-1.1 2.2.3z"/>',
  chart: '<path d="M4 20.5h16.5"/><rect x="5.5" y="12" width="3" height="6" rx="1"/><rect x="10.8" y="7.5" width="3" height="10.5" rx="1"/><rect x="16" y="4" width="3" height="14" rx="1"/>',
  link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1"/>',
  cards: '<rect x="7.5" y="6.5" width="13" height="14" rx="2.5"/><path d="M16.5 6.5V5.8a2.3 2.3 0 0 0-2.7-2.2l-8.1 1.5a2.3 2.3 0 0 0-1.8 2.7l2 10.4"/><path d="M11 12h6M11 15.5h4"/>',
  gamepad: '<path d="M7.5 7h9a5 5 0 0 1 4.9 6l-.8 4.2a2.3 2.3 0 0 1-4 1L14.7 16H9.3l-1.9 2.2a2.3 2.3 0 0 1-4-1L2.6 13a5 5 0 0 1 4.9-6z"/><path d="M8 10v4M6 12h4"/><circle cx="15.5" cy="11" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".9" fill="currentColor"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  // ikonky rozhraní
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.9 12.1 8.6-8.6M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3.5 3.5l17 17M10 5.7a9.7 9.7 0 0 1 2-.2c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
const icon = (name, cls = 'ico') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.folder}</svg>`;

/* ---------- dlaždice: Flashcards a Hry vedou na web, ostatní jsou zatím jen ukázka ---------- */
const COLORS = {
  orange: '#ea6a1f', red: '#dc3545', pink: '#d63384', purple: '#7c4ddb', indigo: '#4f46e5', blue: '#2563eb',
  sky: '#0284c7', teal: '#0f8f83', green: '#16a34a', olive: '#5f8f0f', brown: '#9a5b13', slate: '#475569',
};
// Když se tenhle seznam změní, zvyš TILES_VERSION: uložené dlaždice v databázi se pak nahradí novými.
const TILES_VERSION = 2;
const EXAMPLE_TILES = [
  { id: 'flashcards', label: 'Flashcards', icon: 'cards', color: 'blue', url: 'https://davix.cz/flashcards/' },
  { id: 'hry', label: 'Hry', icon: 'gamepad', color: 'purple', url: 'https://davix.cz/games/' },
  { id: 'ukoly', label: 'Úkoly', icon: 'check', color: 'orange' },
  { id: 'kalendar', label: 'Kalendář', icon: 'calendar', color: 'red' },
  { id: 'poznamky', label: 'Poznámky', icon: 'note', color: 'indigo' },
  { id: 'zakazky', label: 'Zakázky', icon: 'briefcase', color: 'blue' },
  { id: 'klienti', label: 'Klienti', icon: 'users', color: 'teal' },
  { id: 'faktury', label: 'Faktury', icon: 'receipt', color: 'green' },
  { id: 'finance', label: 'Finance', icon: 'wallet', color: 'purple' },
  { id: 'napady', label: 'Nápady', icon: 'bulb', color: 'orange' },
  { id: 'skola', label: 'Škola', icon: 'school', color: 'indigo' },
  { id: 'instagram', label: 'Instagram', icon: 'camera', color: 'pink' },
  { id: 'web', label: 'Web', icon: 'globe', color: 'sky' },
  { id: 'soubory', label: 'Soubory', icon: 'folder', color: 'brown' },
  { id: 'navyky', label: 'Návyky', icon: 'flame', color: 'red' },
  { id: 'nakupy', label: 'Nákupy', icon: 'cart', color: 'olive' },
  { id: 'cesty', label: 'Cesty', icon: 'plane', color: 'sky' },
  { id: 'statistiky', label: 'Statistiky', icon: 'chart', color: 'slate' },
  { id: 'odkazy', label: 'Odkazy', icon: 'link', color: 'teal' },
  { id: 'zdravi', label: 'Zdraví', icon: 'heart', color: 'pink' },
];

/* ---------- pomocníci ---------- */
const $ = (s, el = document) => el.querySelector(s);
const root = $('#root'), dlg = $('#dlg');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// odkaz z dlaždice smí vést jen na https (nic jako javascript:)
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function authError(e) {
  const c = e?.code || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'Špatné heslo.';
  if (c.includes('too-many-requests')) return 'Moc pokusů za sebou. Firebase přihlášení na chvíli zablokoval, zkus to za pár minut.';
  if (c.includes('network-request-failed')) return 'Nejde připojení k internetu.';
  if (c.includes('user-disabled')) return 'Účet hubu je ve Firebase vypnutý.';
  if (c.includes('weak-password')) return 'Heslo je moc slabé.';
  if (c.includes('requires-recent-login')) return 'Odemkni hub znovu a pak heslo změň.';
  return 'Něco se pokazilo (' + (c || e?.message || 'neznámá chyba') + ').';
}

/* ---------- přihlášení ---------- */
let fails = 0, waitUntil = 0;
function renderLogin(msg = '') {
  document.body.className = 'is-login';
  root.innerHTML = `
  <main class="login">
    <form class="login-card" id="lf" autocomplete="on" novalidate>
      <div class="lock-badge">${icon('lock')}</div>
      <h1 class="mark">hub<span>.</span></h1>
      <p class="sub">Soukromý prostor. Zadej heslo.</p>
      <input class="sr" type="text" name="username" autocomplete="username" value="hub" tabindex="-1" aria-hidden="true" readonly />
      <div class="pw">
        <input id="pw" type="password" name="password" autocomplete="current-password" placeholder="Heslo" aria-label="Heslo" required autofocus />
        <button type="button" class="eye" id="eye" aria-label="Ukázat heslo">${icon('eye')}</button>
        <button class="go" id="go" aria-label="Odemknout">${icon('arrow')}</button>
      </div>
      <p class="err" id="err" role="alert">${esc(msg)}</p>
    </form>
  </main>`;
  const f = $('#lf'), pw = $('#pw'), err = $('#err'), go = $('#go');
  $('#eye').onclick = () => {
    const show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
    $('#eye').innerHTML = icon(show ? 'eyeOff' : 'eye'); $('#eye').setAttribute('aria-label', show ? 'Skrýt heslo' : 'Ukázat heslo'); pw.focus();
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!pw.value) { pw.focus(); return; }
    const left = Math.ceil((waitUntil - Date.now()) / 1000);
    if (left > 0) { err.textContent = `Počkej ještě ${left} s.`; return; }
    go.disabled = true; f.classList.add('busy'); err.textContent = '';
    try {
      await signInWithEmailAndPassword(auth, HUB_EMAIL, secret(pw.value));
      fails = 0;
    } catch (e) {
      fails++;
      // po pár chybách se další pokus odkládá čím dál déle (Firebase navíc blokuje opakované pokusy na serveru)
      if (fails >= 3) waitUntil = Date.now() + Math.min(60, 2 ** (fails - 2)) * 1000;
      err.textContent = authError(e); pw.select();
      f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    } finally { go.disabled = false; f.classList.remove('busy'); }
  };
}

/* ---------- hub ---------- */
let tiles = EXAMPLE_TILES, rulesMissing = false;
async function loadTiles() {
  const ref = doc(db, 'hub', 'tiles');
  try {
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : null;
    if (d && Array.isArray(d.tiles) && (d.version || 1) >= TILES_VERSION) tiles = d.tiles;
    else { tiles = EXAMPLE_TILES; await setDoc(ref, { tiles, version: TILES_VERSION, updated: Date.now() }); }
    rulesMissing = false;
  } catch (e) {
    // bez pravidel ve Firebase databáze hub nepustí; ukážou se aspoň ukázkové dlaždice
    tiles = EXAMPLE_TILES; rulesMissing = e?.code === 'permission-denied';
    if (!rulesMissing) toast('Dlaždice se nepodařilo načíst z databáze.');
  }
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Dobrou noc' : h < 10 ? 'Dobré ráno' : h < 12 ? 'Dobré dopoledne' : h < 18 ? 'Dobré odpoledne' : 'Dobrý večer';
}
function renderHub() {
  document.body.className = 'is-hub';
  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
  root.innerHTML = `
  <header class="top">
    <div class="mark small">hub<span>.</span></div>
    <div class="actions">
      <button class="ghost" id="chpw" title="Změnit heslo">${icon('key')}<span>Heslo</span></button>
      <button class="ghost" id="lock" title="Zamknout">${icon('lock')}<span>Zamknout</span></button>
    </div>
  </header>
  <main class="hub">
    <div class="hello">
      <h1>${greeting()}, Davide.</h1>
      <p>${esc(today.charAt(0).toUpperCase() + today.slice(1))}</p>
    </div>
    ${rulesMissing ? `<p class="notice">Hub je odemčený, ale ve Firebase ještě chybí pravidla pro hub, takže se dlaždice zatím neukládají. Stačí vložit nová pravidla (návod, krok 2).</p>` : ''}
    <ul class="grid" role="list">
      ${tiles.map((t) => `
      <li>${safeUrl(t.url)
        ? `<a class="tile" href="${esc(safeUrl(t.url))}" data-id="${esc(t.id)}">${icon(t.icon, 'tico')}<span>${esc(t.label)}</span></a>`
        : `<button class="tile" data-id="${esc(t.id)}">${icon(t.icon, 'tico')}<span>${esc(t.label)}</span></button>`}</li>`).join('')}
    </ul>
  </main>`;
  // barvy se nastavují přes JS, protože bezpečnostní pravidla stránky (CSP) zakazují vložené styly
  root.querySelectorAll('.tile').forEach((b, i) => {
    const t = tiles[i]; b.style.setProperty('--c', COLORS[t.color] || (/^#[0-9a-f]{3,8}$/i.test(t.color) ? t.color : COLORS.slate)); b.style.setProperty('--i', i);
    if (b.tagName === 'BUTTON') b.onclick = () => toast(`${t.label || 'Tahle dlaždice'}: zatím tu nic není.`);
  });
  $('#lock').onclick = () => signOut(auth);
  $('#chpw').onclick = openPasswordDialog;
}

/* ---------- změna hesla ---------- */
function openPasswordDialog() {
  dlg.innerHTML = `
  <form class="pwform" id="pf" novalidate>
    <h2>Změnit heslo</h2>
    <p class="hint">Nové heslo musí mít aspoň ${MIN_NEW} znaků. Nejbezpečnější je pár náhodných slov, třeba <i>kolo-mrak-tužka-74</i>.</p>
    <input class="sr" type="text" autocomplete="username" value="hub" tabindex="-1" aria-hidden="true" readonly />
    <label>Současné heslo<input id="p0" type="password" autocomplete="current-password" required /></label>
    <label>Nové heslo<input id="p1" type="password" autocomplete="new-password" minlength="${MIN_NEW}" required /></label>
    <label>Nové heslo znovu<input id="p2" type="password" autocomplete="new-password" required /></label>
    <p class="err" id="perr" role="alert"></p>
    <div class="row"><button type="button" class="ghost" id="pc">Zrušit</button><button class="primary" id="ps">Uložit heslo</button></div>
  </form>`;
  dlg.showModal();
  const err = $('#perr');
  $('#pc').onclick = () => dlg.close();
  $('#pf').onsubmit = async (ev) => {
    ev.preventDefault();
    const p0 = $('#p0').value, p1 = $('#p1').value, p2 = $('#p2').value;
    if (p1.length < MIN_NEW) { err.textContent = `Nové heslo je moc krátké (aspoň ${MIN_NEW} znaků).`; return; }
    if (p1 !== p2) { err.textContent = 'Nová hesla se neshodují.'; return; }
    if (p1 === p0) { err.textContent = 'Nové heslo je stejné jako to současné.'; return; }
    $('#ps').disabled = true; err.textContent = '';
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(HUB_EMAIL, secret(p0)));
      await updatePassword(auth.currentUser, secret(p1));
      dlg.close(); toast('Heslo je změněné.');
    } catch (e) { err.textContent = authError(e); }
    finally { $('#ps').disabled = false; }
  };
}

/* ---------- automatické zamčení po nečinnosti ---------- */
let idleTimer;
function armIdle() { clearTimeout(idleTimer); if (auth.currentUser) idleTimer = setTimeout(() => { signOut(auth); }, LOCK_AFTER); }
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, armIdle, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') armIdle(); });

/* ---------- start ---------- */
let wasIn = false;
onAuthStateChanged(auth, async (user) => {
  if (dlg.open) dlg.close();
  // jiný účet než hub (např. z flashcards) sem nepatří
  if (user && user.email !== HUB_EMAIL) { await signOut(auth); return; }
  if (!user) { clearTimeout(idleTimer); tiles = EXAMPLE_TILES; renderLogin(wasIn ? 'Hub je zamčený.' : ''); wasIn = false; return; }
  wasIn = true;
  root.innerHTML = '<div class="boot"><div class="spin"></div></div>';
  await loadTiles();
  renderHub(); armIdle();
});

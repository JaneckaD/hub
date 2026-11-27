// Finance: jednoduchý přehled příjmů a výdajů, měsíční plán (rozpočet) pro kategorie,
// pravidelné platby a grafy. Data leží v soukromé databázi hubu (dokument hub/finance).
const DOC = 'finance';

/* ---------- barvy kategorií: pevné pořadí, světlý a tmavý režim zvlášť (ověřeno nástrojem dataviz) ---------- */
const SLOTS_LIGHT = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'];
const SLOTS_DARK = ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'];
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const slotColor = (i) => (i >= 0 && i < 8 ? (dark() ? SLOTS_DARK : SLOTS_LIGHT)[i] : dark() ? '#8a92a1' : '#7b8494');
const INCOME = () => slotColor(0), EXPENSE = () => slotColor(1); // příjmy modře, výdaje oranžově

/* ---------- ikonky ---------- */
const P = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  repeat: '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 11.5V10a4 4 0 0 1 4-4h13M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  // ikonky kategorií
  cart: '<path d="M3 4h2.2l2.2 11h10.4l2-7.5H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
  home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  bus: '<rect x="5" y="3.5" width="14" height="14" rx="3"/><path d="M5 11h14M8 20.5v-3M16 20.5v-3"/><circle cx="8.5" cy="14.3" r=".6" fill="currentColor"/><circle cx="15.5" cy="14.3" r=".6" fill="currentColor"/>',
  ticket: '<path d="M3.5 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14.5 5v14" stroke-dasharray="2 2.2"/>',
  shirt: '<path d="m8.5 3.5-5 3 2 4 2-1V20.5h9V9.5l2 1 2-4-5-3a3.5 3.5 0 0 1-7 0z"/>',
  sub: '<rect x="3.5" y="5" width="17" height="12" rx="2.5"/><path d="m10 8.5 4.5 2.5-4.5 2.5zM8 20.5h8"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  school: '<path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11.6v4.6c1.5 1.6 3.4 2.3 5.5 2.3s4-.7 5.5-2.3v-4.6"/>',
  gift: '<rect x="4" y="8.5" width="16" height="4" rx="1"/><path d="M5.5 12.5v8h13v-8M12 8.5v12M12 8.5S10.5 4 8.3 4.3c-2 .3-1.6 3.6 3.7 4.2zM12 8.5S13.5 4 15.7 4.3c2 .3 1.6 3.6-3.7 4.2z"/>',
  dots: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  wallet: '<path d="M18.5 7.5V5.8A1.8 1.8 0 0 0 16.7 4H6a2.5 2.5 0 0 0 0 5h13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 20H6a2.5 2.5 0 0 1-2.5-2.5V6.5"/><circle cx="16.3" cy="14.5" r="1.2"/>',
  brief: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 13h18"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.3c.9.2 2 .2 3 .2 3 0 5.5-1.1 5.5-2.5v-4c0-1-1.3-1.9-3.2-2.3M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  plane: '<path d="M10.5 13.5 4 11.3l1.4-1.4 7 .7 4.3-4.3a1.9 1.9 0 0 1 2.7 2.7l-4.3 4.3.7 7-1.4 1.4-2.2-6.5-3.4 3.4.3 2.2-1.1 1.1-1.5-3-3-1.5 1.1-1.1 2.2.3z"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M12 11.5c-3 0-5.5 3.5-5.5 6 0 1.5 1.2 2.5 2.7 2.2 1-.2 1.8-.7 2.8-.7s1.8.5 2.8.7c1.5.3 2.7-.7 2.7-2.2 0-2.5-2.5-6-5.5-6z"/>',
};
const CAT_ICONS = ['cart', 'home', 'bus', 'ticket', 'shirt', 'sub', 'heart', 'school', 'gift', 'plane', 'phone', 'paw', 'wallet', 'brief', 'coins', 'star', 'dots'];
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.dots}</svg>`;

/* ---------- výchozí kategorie ---------- */
const DEFAULT_CATS = [
  ['jidlo', 'out', 'Jídlo', 'cart', 0], ['bydleni', 'out', 'Bydlení', 'home', 1], ['doprava', 'out', 'Doprava', 'bus', 2],
  ['zabava', 'out', 'Zábava', 'ticket', 3], ['obleceni', 'out', 'Oblečení', 'shirt', 4], ['predplatne', 'out', 'Předplatné', 'sub', 5],
  ['zdravi', 'out', 'Zdraví', 'heart', 6], ['ostatni-out', 'out', 'Ostatní', 'dots', 7],
  ['vyplata', 'in', 'Výplata', 'wallet', 0], ['zakazky', 'in', 'Zakázky', 'brief', 1], ['brigada', 'in', 'Brigáda', 'coins', 2],
  ['darky', 'in', 'Dárky', 'gift', 3], ['ostatni-in', 'in', 'Ostatní', 'dots', 4],
].map(([id, t, name, ic, slot]) => ({ id, t, name, icon: ic, slot }));

/* ---------- pomocníci ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const KC = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
const KC2 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kc = (n) => { const r = Math.round(n * 100) / 100; return (Number.isInteger(r) ? KC.format(r) : KC2.format(r)) + ' Kč'; };
const kcShort = (n) => Math.abs(n) >= 1e6 ? KC.format(Math.round(n / 1e5) / 10) + ' mil.' : Math.abs(n) >= 1e4 ? KC.format(Math.round(n / 100) / 10) + ' tis.' : KC.format(Math.round(n));
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const MONTHS_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const pad = (n) => String(n).padStart(2, '0');
const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const todayStr = () => { const d = new Date(); return `${ymOf(d)}-${pad(d.getDate())}`; };
const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return ymOf(d); };
const daysIn = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return MONTHS[m - 1][0].toUpperCase() + MONTHS[m - 1].slice(1) + ' ' + y; };
const dayLabel = (d) => { const dt = new Date(d + 'T12:00'); const t = todayStr(); if (d === t) return 'Dnes'; const y = new Date(); y.setDate(y.getDate() - 1); if (d === `${ymOf(y)}-${pad(y.getDate())}`) return 'Včera'; return dt.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase()); };
const parseAmount = (s) => { const n = Number(String(s).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };

/* ---------- stav ---------- */
let resizeBound = false, data = null, month = ymOf(new Date()), host = null, ctx = null, saveTimer = null, loading = null;
const $ = (s) => host.querySelector(s);
const cat = (id) => data.cats.find((c) => c.id === id) || { id, t: 'out', name: 'Smazaná kategorie', icon: 'dots', slot: -1 };
const cats = (t) => data.cats.filter((c) => c.t === t);

export function reset() { data = null; loading = null; month = ymOf(new Date()); clearTimeout(saveTimer); }

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    v: 1,
    cats: Array.isArray(d.cats) && d.cats.length ? d.cats : DEFAULT_CATS.map((c) => ({ ...c })),
    tx: Array.isArray(d.tx) ? d.tx : [],
    budgets: d.budgets && typeof d.budgets === 'object' ? d.budgets : {},
    rec: Array.isArray(d.rec) ? d.rec : [],
  };
}
// pravidelné platby se do pohybů zapíšou za každý měsíc až do toho aktuálního
function materialize() {
  const now = ymOf(new Date()); let changed = false;
  for (const r of data.rec) {
    let m = r.last ? addMonths(r.last, 1) : r.from;
    while (m <= now) {
      data.tx.push({ id: uid(), t: r.t, a: r.a, c: r.c, d: `${m}-${pad(Math.min(r.day, daysIn(m)))}`, n: r.n || '', r: r.id });
      r.last = m; m = addMonths(m, 1); changed = true;
    }
  }
  return changed;
}
// pro budoucí měsíce se pravidelné platby jen ukážou jako naplánované
function txOf(ym) {
  const real = data.tx.filter((t) => t.d.startsWith(ym));
  if (ym <= ymOf(new Date())) return real;
  const planned = data.rec.filter((r) => r.from <= ym).map((r) => ({ id: 'plan-' + r.id, t: r.t, a: r.a, c: r.c, d: `${ym}-${pad(Math.min(r.day, daysIn(ym)))}`, n: r.n || '', r: r.id, plan: true }));
  return [...real, ...planned];
}
const sum = (list, t) => list.filter((x) => x.t === t).reduce((s, x) => s + x.a, 0);

function save() {
  clearTimeout(saveTimer);
  setStatus('Ukládám…');
  saveTimer = setTimeout(async () => {
    try { await ctx.saveDoc(DOC, data); setStatus('Uloženo'); }
    catch (e) { console.error(e); setStatus('Neuloženo'); ctx.toast('Změny se nepodařilo uložit. Zkontroluj internet.'); }
  }, 500);
}
function setStatus(s) { const el = host?.querySelector('#fistat'); if (el) { el.textContent = s; el.dataset.s = s; } }

/* ---------- vykreslení ---------- */
export async function mount(el, context) {
  host = el; ctx = context;
  if (!resizeBound) { resizeBound = true; let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (host?.isConnected && host.querySelector('#fichart')) drawChart(); }, 150); }); }
  host.innerHTML = `<div class="boot small"><div class="spin"></div></div>`;
  try {
    if (!data) {
      loading ||= ctx.loadDoc(DOC).then((d) => { data = normalize(d); if (materialize()) save(); });
      await loading;
    }
  } catch (e) {
    console.error(e); loading = null;
    host.innerHTML = '<p class="notice">Finance se nepodařilo načíst z databáze. Zkus obnovit stránku.</p>';
    return;
  }
  if (!host.isConnected) return;
  render();
}

function render() {
  const list = txOf(month);
  const inc = sum(list, 'in'), out = sum(list, 'out'), bal = inc - out;
  const budgetTotal = cats('out').reduce((s, c) => s + (+data.budgets[c.id] || 0), 0);
  host.innerHTML = `
  <div class="fi">
    <div class="kv-title fi-head">
      <button class="ghost" id="fiback">${icon('back')}<span>Hub</span></button>
      <div class="fi-titles"><h1>Finance</h1><p><span id="fistat" class="fi-stat">Uloženo</span></p></div>
      <button class="ghost icon-only" id="ficats" title="Kategorie a nastavení" aria-label="Kategorie a nastavení">${icon('gear')}</button>
    </div>

    <div class="fi-month">
      <button class="ghost icon-only" id="fiprev" aria-label="Předchozí měsíc">${icon('left')}</button>
      <b>${monthLabel(month)}</b>
      <button class="ghost icon-only" id="finext" aria-label="Další měsíc">${icon('right')}</button>
      ${month !== ymOf(new Date()) ? `<button class="ghost fi-today" id="fitoday">Tento měsíc</button>` : ''}
    </div>

    <div class="fi-stats">
      <div class="fi-stat-card"><span class="fi-k"><i class="fi-dot in"></i>Příjmy</span><b>${kc(inc)}</b></div>
      <div class="fi-stat-card"><span class="fi-k"><i class="fi-dot out"></i>Výdaje</span><b>${kc(out)}</b></div>
      <div class="fi-stat-card big"><span class="fi-k">Zůstatek</span><b class="${bal < 0 ? 'neg' : ''}">${bal < 0 ? '−' : ''}${kc(Math.abs(bal))}</b>
        <small>${inc > 0 ? (bal >= 0 ? `Ušetřeno ${Math.round((bal / inc) * 100)} % příjmů` : `Utraceno o ${kc(-bal)} víc, než přišlo`) : out > 0 ? 'Tento měsíc zatím bez příjmů' : 'Zatím žádné pohyby'}</small></div>
    </div>

    <div class="fi-add">
      <button class="primary" id="fiaddout">${icon('plus')}<span>Výdaj</span></button>
      <button class="ghost" id="fiaddin">${icon('plus')}<span>Příjem</span></button>
    </div>

    <section class="fi-card fi-chart-card">
      <div class="fi-card-h"><h2>Posledních 6 měsíců</h2>
        <div class="fi-legend"><span><i class="fi-dot in"></i>Příjmy</span><span><i class="fi-dot out"></i>Výdaje</span></div></div>
      <div class="fi-chart" id="fichart"></div>
      <details class="fi-table"><summary>Zobrazit jako tabulku</summary><div id="fitable"></div></details>
    </section>

    <div class="fi-grid">
      <div class="fi-col">
        <section class="fi-card">
          <div class="fi-card-h"><h2>Plán výdajů</h2><button class="ghost" id="fiplan">${icon('target')}<span>Upravit plán</span></button></div>
          ${budgetTotal ? planSummary(out, budgetTotal) : '<p class="fi-empty">Nastav si, kolik chceš měsíčně utratit za jednotlivé kategorie. Hub pak hlídá, kolik ti zbývá.</p>'}
          <ul class="fi-cats" role="list">${catRows(list)}</ul>
        </section>
        <section class="fi-card fi-rec-card">
          <div class="fi-card-h"><h2>Pravidelné platby</h2><button class="ghost" id="firecadd">${icon('plus')}<span>Přidat</span></button></div>
          ${recList()}
        </section>
      </div>
      <section class="fi-card">
        <div class="fi-card-h"><h2>Pohyby</h2><span class="fi-muted">${list.length ? list.length + ' za měsíc' : ''}</span></div>
        ${txList(list)}
      </section>
    </div>
  </div>`;
  paintDots();
  drawChart();
  bind();
}

function planSummary(out, total) {
  const left = total - out, pct = Math.min(100, (out / total) * 100);
  return `<div class="fi-plan">
    <div class="fi-plan-top"><span>Utraceno <b>${kc(out)}</b> z ${kc(total)}</span>
      <span class="${left < 0 ? 'over' : ''}">${left < 0 ? `${icon('warn')} Přes plán o ${kc(-left)}` : `Zbývá ${kc(left)}`}</span></div>
    <div class="fi-bar big ${left < 0 ? 'over' : ''}"><i data-w="${pct}"></i></div>
  </div>`;
}

function catRows(list) {
  const rows = cats('out').map((c) => ({ c, spent: list.filter((t) => t.t === 'out' && t.c === c.id).reduce((s, t) => s + t.a, 0), plan: +data.budgets[c.id] || 0 }))
    .concat(list.filter((t) => t.t === 'out' && !data.cats.some((c) => c.id === t.c)).length ? [{ c: cat('?'), spent: list.filter((t) => t.t === 'out' && !data.cats.some((c) => c.id === t.c)).reduce((s, t) => s + t.a, 0), plan: 0 }] : [])
    .filter((r) => r.spent || r.plan)
    .sort((a, b) => b.spent - a.spent || b.plan - a.plan);
  if (!rows.length) return '<li class="fi-empty">Tento měsíc zatím žádné výdaje.</li>';
  const max = Math.max(...rows.map((r) => Math.max(r.spent, r.plan)));
  return rows.map(({ c, spent, plan }) => {
    const over = plan && spent > plan;
    const w = plan ? Math.min(100, (spent / plan) * 100) : (spent / max) * 100;
    return `<li class="fi-cat" data-slot="${c.slot}">
      <span class="fi-ci">${icon(c.icon)}</span>
      <div class="fi-cb">
        <div class="fi-cl"><b>${esc(c.name)}</b><span>${kc(spent)}${plan ? ` <small>z ${kc(plan)}</small>` : ''}</span></div>
        <div class="fi-bar ${over ? 'over' : ''} ${plan ? '' : 'noplan'}"><i data-w="${w}"></i></div>
        ${over ? `<small class="fi-over">${icon('warn')} Přes plán o ${kc(spent - plan)}</small>` : plan ? `<small class="fi-muted">Zbývá ${kc(plan - spent)}</small>` : ''}
      </div>
    </li>`;
  }).join('');
}

function txList(list) {
  if (!list.length) return `<p class="fi-empty">Žádné pohyby. Přidej první výdaj nebo příjem tlačítkem nahoře.</p>`;
  const byDay = {};
  [...list].sort((a, b) => b.d.localeCompare(a.d)).forEach((t) => (byDay[t.d] ||= []).push(t));
  return `<div class="fi-days">${Object.entries(byDay).map(([d, items]) => `
    <div class="fi-day"><h3>${dayLabel(d)}</h3>
      <ul role="list">${items.map((t) => { const c = cat(t.c); return `
        <li><button class="fi-tx ${t.plan ? 'plan' : ''}" data-id="${t.id}" data-slot="${c.slot}">
          <span class="fi-ci sm">${icon(c.icon)}</span>
          <span class="fi-tx-m"><b>${esc(t.n || c.name)}</b><small>${esc(c.name)}${t.r ? ` · ${icon('repeat', 'ico tiny')} pravidelná` : ''}${t.plan ? ' · naplánováno' : ''}</small></span>
          <span class="fi-amt ${t.t}">${t.t === 'in' ? '+' : '−'}${kc(t.a)}</span>
        </button></li>`; }).join('')}</ul>
    </div>`).join('')}</div>`;
}

function recList() {
  if (!data.rec.length) return '<p class="fi-empty">Nájem, předplatné nebo výplata, které se opakují každý měsíc. Zapíšou se samy.</p>';
  return `<ul class="fi-recs" role="list">${data.rec.map((r) => { const c = cat(r.c); return `
    <li data-slot="${c.slot}"><span class="fi-ci sm">${icon(c.icon)}</span>
      <span class="fi-tx-m"><b>${esc(r.n || c.name)}</b><small>Každý měsíc ${r.day}. den · ${esc(c.name)}</small></span>
      <span class="fi-amt ${r.t}">${r.t === 'in' ? '+' : '−'}${kc(r.a)}</span>
      <button class="kv-rm" data-rec="${r.id}" aria-label="Zrušit pravidelnou platbu">${icon('x')}</button></li>`; }).join('')}</ul>`;
}

function paintDots() {
  host.querySelectorAll('[data-slot]').forEach((el) => el.style.setProperty('--c', slotColor(+el.dataset.slot)));
  host.querySelectorAll('.fi-dot.in').forEach((el) => el.style.setProperty('--c', INCOME()));
  host.querySelectorAll('.fi-dot.out').forEach((el) => el.style.setProperty('--c', EXPENSE()));
  host.querySelectorAll('.fi-bar i').forEach((el) => el.style.width = Math.max(0, +el.dataset.w) + '%');
}

/* ---------- graf: příjmy a výdaje za 6 měsíců (seskupené sloupce, jedna osa) ---------- */
function drawChart() {
  const box = $('#fichart');
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const vals = months.map((m) => { const l = txOf(m); return { m, inc: sum(l, 'in'), out: sum(l, 'out') }; });
  const maxV = Math.max(...vals.flatMap((v) => [v.inc, v.out]), 0);
  $('#fitable').innerHTML = `<table><thead><tr><th>Měsíc</th><th>Příjmy</th><th>Výdaje</th><th>Zůstatek</th></tr></thead><tbody>${vals.map((v) => `<tr><td>${monthLabel(v.m)}</td><td>${kc(v.inc)}</td><td>${kc(v.out)}</td><td>${kc(v.inc - v.out)}</td></tr>`).join('')}</tbody></table>`;
  if (!maxV) { box.innerHTML = '<p class="fi-empty">Graf se ukáže, až přidáš první pohyby.</p>'; return; }
  // „hezké“ dělení osy
  const step = (() => { const raw = maxV / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; })();
  const top = Math.ceil(maxV / step) * step;
  const W = Math.max(280, Math.round(box.clientWidth || 600)), H = W < 500 ? 200 : 230, L = 48, R = 4, T = 10, B = 28, iw = W - L - R, ih = H - T - B;
  const gw = iw / 6, bw = Math.max(6, Math.min(30, (gw - 16) / 2)), y = (v) => T + ih - (v / top) * ih;
  const bar = (x, v, cls) => {
    if (!v) return '';
    const h = Math.max(2, ih - (y(v) - T)), r = Math.min(4, h, bw / 2), yy = T + ih - h;
    return `<path class="fi-b ${cls}" d="M${x},${T + ih} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${T + ih} Z"/>`;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Příjmy a výdaje za posledních 6 měsíců">`;
  for (let v = 0; v <= top + 1e-9; v += step) svg += `<line class="fi-grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="fi-ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${kcShort(v)}</text>`;
  vals.forEach((v, i) => {
    const cx = L + gw * i + gw / 2, x1 = cx - bw - 1, x2 = cx + 1;
    svg += `<g class="fi-g${v.m === month ? ' cur' : ''}" data-i="${i}"><rect class="fi-hit" x="${L + gw * i}" y="${T}" width="${gw}" height="${ih + B}"/>${bar(x1, v.inc, 'in')}${bar(x2, v.out, 'out')}
      <text class="fi-ax${v.m === month ? ' cur' : ''}" x="${cx}" y="${H - 8}" text-anchor="middle">${MONTHS_SHORT[+v.m.slice(5) - 1]}</text></g>`;
  });
  svg += `<line class="fi-base" x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/></svg><div class="fi-tip" id="fitip" hidden></div>`;
  box.innerHTML = svg;
  box.querySelectorAll('.fi-b.in').forEach((el) => el.style.fill = INCOME());
  box.querySelectorAll('.fi-b.out').forEach((el) => el.style.fill = EXPENSE());
  const tip = $('#fitip');
  box.querySelectorAll('.fi-g').forEach((g) => {
    const show = () => {
      const v = vals[+g.dataset.i], r = g.querySelector('.fi-hit').getBoundingClientRect(), br = box.getBoundingClientRect();
      tip.innerHTML = `<b>${monthLabel(v.m)}</b><span><i class="fi-dot in"></i>Příjmy <em>${kc(v.inc)}</em></span><span><i class="fi-dot out"></i>Výdaje <em>${kc(v.out)}</em></span><span class="fi-tip-sum">Zůstatek <em>${v.inc - v.out < 0 ? '−' : ''}${kc(Math.abs(v.inc - v.out))}</em></span>`;
      tip.querySelector('.fi-dot.in').style.setProperty('--c', INCOME()); tip.querySelector('.fi-dot.out').style.setProperty('--c', EXPENSE());
      tip.hidden = false;
      const tw = tip.offsetWidth; let left = r.right - br.left + 6; // vedle sloupců, ať je nezakrývá
      if (left + tw > br.width) left = r.left - br.left - tw - 6;
      left = Math.max(0, Math.min(br.width - tw, left));
      tip.style.left = left + 'px'; tip.style.top = '4px';
      box.querySelectorAll('.fi-g').forEach((x) => x.classList.toggle('hover', x === g));
    };
    g.addEventListener('pointerenter', show); g.addEventListener('click', () => { month = vals[+g.dataset.i].m; render(); });
  });
  box.addEventListener('pointerleave', () => { tip.hidden = true; box.querySelectorAll('.fi-g').forEach((x) => x.classList.remove('hover')); });
}

/* ---------- ovládání ---------- */
function bind() {
  $('#fiback').onclick = () => ctx.back();
  $('#fiprev').onclick = () => { month = addMonths(month, -1); render(); };
  $('#finext').onclick = () => { month = addMonths(month, 1); render(); };
  $('#fitoday')?.addEventListener('click', () => { month = ymOf(new Date()); render(); });
  $('#fiaddout').onclick = () => openTx({ t: 'out' });
  $('#fiaddin').onclick = () => openTx({ t: 'in' });
  $('#fiplan').onclick = openPlan;
  $('#ficats').onclick = openCats;
  $('#firecadd').onclick = () => openTx({ t: 'out', recurring: true });
  host.querySelectorAll('.fi-tx').forEach((b) => (b.onclick = () => {
    const t = data.tx.find((x) => x.id === b.dataset.id);
    if (t) openTx(t); else ctx.toast('Tohle je jen naplánovaná pravidelná platba. Upravíš ji v Pravidelných platbách.');
  }));
  host.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = () => {
    const r = data.rec.find((x) => x.id === b.dataset.rec); if (!r) return;
    if (!confirmInline(b, 'Zrušit?')) return;
    data.rec = data.rec.filter((x) => x !== r); save(); render(); ctx.toast('Pravidelná platba zrušená. Už zapsané pohyby zůstaly.');
  }));
}
// potvrzení druhým klepnutím (bez systémových oken)
function confirmInline(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const old = btn.innerHTML; btn.classList.add('armed'); btn.innerHTML = `<span>${label}</span>`;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('armed'); btn.innerHTML = old; } }, 2500);
  return false;
}

/* ---------- dialogy ---------- */
function dialog(html, onMount) {
  const d = document.createElement('dialog'); d.className = 'fi-dlg'; d.innerHTML = html;
  document.body.append(d); d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  onMount(d); d.showModal(); return d;
}

function openTx(src) {
  const editing = !!src.id && !src.recurring;
  let t = src.t, c = src.c || null;
  const defDate = month === ymOf(new Date()) ? todayStr() : `${month}-01`;
  dialog(`<form class="fi-form" novalidate>
    <div class="fi-form-h"><h2>${editing ? 'Upravit pohyb' : src.recurring ? 'Nová pravidelná platba' : 'Nový pohyb'}</h2><button type="button" class="kv-x" data-close aria-label="Zavřít">${icon('x')}</button></div>
    <div class="st-seg fi-type"><button type="button" data-t="out">Výdaj</button><button type="button" data-t="in">Příjem</button></div>
    <label class="fi-amount"><span>Částka</span><div><input name="a" inputmode="decimal" autocomplete="off" placeholder="0" value="${src.a ?? ''}" required /><em>Kč</em></div></label>
    <div class="fi-field"><span>Kategorie</span><div class="fi-chips" data-chips></div></div>
    <label class="fi-field"><span>Poznámka <small>(nepovinné)</small></span><input name="n" maxlength="80" placeholder="Např. nákup v Lidlu" value="${esc(src.n || '')}" /></label>
    <div class="fi-row2">
      ${src.recurring ? `<label class="fi-field"><span>Den v měsíci</span><input name="day" type="number" min="1" max="31" value="${new Date().getDate()}" /></label>`
        : `<label class="fi-field"><span>Datum</span><input name="d" type="date" value="${src.d || defDate}" /></label>`}
      ${!editing && !src.recurring ? `<label class="fi-check"><input type="checkbox" name="rep" /> <span>Opakovat každý měsíc</span></label>` : ''}
    </div>
    <p class="err" data-err></p>
    <div class="row">${editing ? `<button type="button" class="ghost fi-del" data-del>Smazat</button>` : ''}<span class="fi-sp"></span>
      <button type="button" class="ghost" data-close>Zrušit</button><button class="primary">${editing ? 'Uložit' : 'Přidat'}</button></div>
  </form>`, (d) => {
    const f = d.querySelector('form'), chips = d.querySelector('[data-chips]');
    const paint = () => {
      d.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      if (!c || cat(c).t !== t) c = null;
      chips.innerHTML = cats(t).map((k) => `<button type="button" class="fi-chip${k.id === c ? ' on' : ''}" data-c="${k.id}" data-slot="${k.slot}"><span class="fi-ci sm">${icon(k.icon)}</span>${esc(k.name)}</button>`).join('');
      chips.querySelectorAll('[data-slot]').forEach((el) => el.style.setProperty('--c', slotColor(+el.dataset.slot)));
      chips.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { c = b.dataset.c; paint(); }));
    };
    d.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { t = b.dataset.t; paint(); }));
    d.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => d.close()));
    paint();
    setTimeout(() => f.a.focus(), 50);
    d.querySelector('[data-del]')?.addEventListener('click', (e) => {
      if (!confirmInline(e.currentTarget, 'Opravdu smazat?')) return;
      data.tx = data.tx.filter((x) => x.id !== src.id); save(); d.close(); render(); ctx.toast('Pohyb smazán.');
    });
    f.onsubmit = (e) => {
      e.preventDefault();
      const a = parseAmount(f.a.value), err = d.querySelector('[data-err]');
      if (!(a > 0)) { err.textContent = 'Zadej částku větší než nula.'; f.a.focus(); return; }
      if (!c) { err.textContent = 'Vyber kategorii.'; return; }
      const n = f.n.value.trim().slice(0, 80);
      if (src.recurring || f.rep?.checked) {
        const day = src.recurring ? Math.min(31, Math.max(1, parseInt(f.day.value, 10) || 1)) : +(f.d.value || defDate).slice(8, 10);
        const from = src.recurring ? ymOf(new Date()) : (f.d.value || defDate).slice(0, 7);
        const r = { id: uid(), t, a, c, n, day, from, last: null };
        if (!src.recurring) { data.tx.push({ id: uid(), t, a, c, d: f.d.value || defDate, n, r: r.id }); r.last = from; }
        data.rec.push(r); materialize();
      } else if (editing) {
        Object.assign(data.tx.find((x) => x.id === src.id), { t, a, c, n, d: f.d.value || src.d });
      } else {
        data.tx.push({ id: uid(), t, a, c, d: f.d.value || defDate, n });
      }
      const dm = (f.d?.value || '').slice(0, 7); if (dm && dm !== month) month = dm;
      save(); d.close(); render(); ctx.alive();
    };
  });
}

function openPlan() {
  dialog(`<form class="fi-form" novalidate>
    <div class="fi-form-h"><h2>Plán výdajů na měsíc</h2><button type="button" class="kv-x" data-close aria-label="Zavřít">${icon('x')}</button></div>
    <p class="fi-muted">Kolik chceš každý měsíc nejvýš utratit. Prázdné pole = bez plánu.</p>
    <div class="fi-plan-list">${cats('out').map((c) => `<label class="fi-plan-row" data-slot="${c.slot}"><span class="fi-ci sm">${icon(c.icon)}</span><b>${esc(c.name)}</b>
      <div><input inputmode="decimal" name="${c.id}" placeholder="—" value="${data.budgets[c.id] || ''}" /><em>Kč</em></div></label>`).join('')}</div>
    <p class="fi-total" data-total></p>
    <div class="row"><button type="button" class="ghost" data-close>Zrušit</button><button class="primary">Uložit plán</button></div>
  </form>`, (d) => {
    const f = d.querySelector('form');
    d.querySelectorAll('[data-slot]').forEach((el) => el.style.setProperty('--c', slotColor(+el.dataset.slot)));
    d.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => d.close()));
    const total = () => { d.querySelector('[data-total]').textContent = 'Celkem ' + kc(cats('out').reduce((s, c) => s + (parseAmount(f[c.id].value) || 0), 0)); };
    f.addEventListener('input', total); total();
    f.onsubmit = (e) => {
      e.preventDefault();
      const b = {}; cats('out').forEach((c) => { const v = parseAmount(f[c.id].value); if (v > 0) b[c.id] = v; });
      data.budgets = b; save(); d.close(); render();
    };
  });
}

function openCats() {
  let t = 'out';
  dialog(`<div class="fi-form">
    <div class="fi-form-h"><h2>Kategorie</h2><button type="button" class="kv-x" data-close aria-label="Zavřít">${icon('x')}</button></div>
    <div class="st-seg fi-type"><button type="button" data-t="out">Výdaje</button><button type="button" data-t="in">Příjmy</button></div>
    <ul class="fi-catlist" role="list" data-list></ul>
    <button type="button" class="ghost fi-newcat" data-new>${icon('plus')}<span>Nová kategorie</span></button>
    <p class="fi-muted">Když kategorii smažeš, její pohyby se přesunou do Ostatní.</p>
  </div>`, (d) => {
    d.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => d.close()));
    const list = d.querySelector('[data-list]');
    const paint = () => {
      d.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      list.innerHTML = cats(t).map((c) => `<li data-id="${c.id}" data-slot="${c.slot}">
        <button type="button" class="fi-ci" data-icon title="Změnit ikonku">${icon(c.icon)}</button>
        <input value="${esc(c.name)}" maxlength="24" aria-label="Název kategorie" />
        <div class="fi-swatches">${SLOTS_LIGHT.map((_, i) => `<button type="button" class="fi-sw${i === c.slot ? ' on' : ''}" data-sw="${i}" aria-label="Barva ${i + 1}"></button>`).join('')}</div>
        ${c.id.startsWith('ostatni') ? '' : `<button type="button" class="kv-rm" data-del aria-label="Smazat kategorii">${icon('x')}</button>`}
      </li>`).join('');
      list.querySelectorAll('[data-slot]').forEach((el) => el.style.setProperty('--c', slotColor(+el.dataset.slot)));
      list.querySelectorAll('[data-sw]').forEach((el) => el.style.setProperty('--c', slotColor(+el.dataset.sw)));
      list.querySelectorAll('li').forEach((li) => {
        const c = data.cats.find((x) => x.id === li.dataset.id);
        li.querySelector('input').onchange = (e) => { const v = e.target.value.trim(); if (v) { c.name = v; save(); render(); } else e.target.value = c.name; };
        li.querySelectorAll('[data-sw]').forEach((b) => (b.onclick = () => { c.slot = +b.dataset.sw; save(); paint(); render(); }));
        li.querySelector('[data-icon]').onclick = () => { c.icon = CAT_ICONS[(CAT_ICONS.indexOf(c.icon) + 1) % CAT_ICONS.length]; save(); paint(); render(); };
        li.querySelector('[data-del]')?.addEventListener('click', (e) => {
          if (!confirmInline(e.currentTarget, 'Smazat?')) return;
          const other = data.cats.find((x) => x.t === c.t && x.id.startsWith('ostatni'))?.id;
          data.tx.forEach((x) => { if (x.c === c.id) x.c = other; });
          data.rec.forEach((x) => { if (x.c === c.id) x.c = other; });
          delete data.budgets[c.id];
          data.cats = data.cats.filter((x) => x !== c); save(); paint(); render();
        });
      });
    };
    d.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { t = b.dataset.t; paint(); }));
    d.querySelector('[data-new]').onclick = () => {
      const used = new Set(cats(t).map((c) => c.slot)); const slot = [...Array(8).keys()].find((i) => !used.has(i)) ?? -1;
      const c = { id: 'k' + uid(), t, name: 'Nová kategorie', icon: 'star', slot };
      const i = data.cats.findIndex((x) => x.t === t && x.id.startsWith('ostatni'));
      data.cats.splice(i >= 0 ? i : data.cats.length, 0, c); save(); paint(); render();
      const inp = list.querySelector(`[data-id="${c.id}"] input`); inp?.focus(); inp?.select();
    };
    paint();
  });
}

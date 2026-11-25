// Konvertor souborů. Všechno se převádí přímo v prohlížeči, nic se nikam neposílá.
// Video a zvuk (a pár obrázkových formátů) převádí ffmpeg ve WebAssembly (lib/ffmpeg*),
// obrázky canvas (fotky HEIC z iPhonu heic-to), PDF pdf.js a pdf-lib, Word mammoth, Markdown marked, tabulky SheetJS, ZIP fflate.
// Knihovny se načítají až ve chvíli, kdy jsou potřeba.
const L = (p) => new URL(p, import.meta.url).href;

/* ---------- formáty ---------- */
const CATS = [
  { id: 'img', label: 'Obrázky', icon: 'image', color: '#ea6a1f' },
  { id: 'video', label: 'Video', icon: 'video', color: '#7c4ddb' },
  { id: 'audio', label: 'Hudba a zvuk', icon: 'music', color: '#d63384' },
  { id: 'doc', label: 'Dokumenty', icon: 'doc', color: '#2563eb' },
  { id: 'data', label: 'Tabulky a data', icon: 'table', color: '#16a34a' },
];
// id formátu → kategorie, popisek, přípona, MIME
const F = {};
const def = (cat, list) => list.forEach(([id, label, ext, mime, hint]) => (F[id] = { id, cat, label, ext, mime, hint }));
def('img', [
  ['png', 'PNG', 'png', 'image/png'], ['jpg', 'JPG', 'jpg', 'image/jpeg'], ['webp', 'WEBP', 'webp', 'image/webp'],
  ['gif', 'GIF', 'gif', 'image/gif'], ['bmp', 'BMP', 'bmp', 'image/bmp'], ['tiff', 'TIFF', 'tiff', 'image/tiff'],
  ['ico', 'ICO', 'ico', 'image/x-icon', 'ikona, max 256 px'],
]);
def('video', [
  ['mp4', 'MP4', 'mp4', 'video/mp4'], ['webm', 'WEBM', 'webm', 'video/webm'], ['mov', 'MOV', 'mov', 'video/quicktime'],
  ['mkv', 'MKV', 'mkv', 'video/x-matroska'], ['avi', 'AVI', 'avi', 'video/x-msvideo'], ['gifanim', 'GIF', 'gif', 'image/gif', 'animace'],
]);
def('audio', [
  ['mp3', 'MP3', 'mp3', 'audio/mpeg'], ['wav', 'WAV', 'wav', 'audio/wav'], ['m4a', 'M4A', 'm4a', 'audio/mp4'],
  ['aac', 'AAC', 'aac', 'audio/aac'], ['ogg', 'OGG', 'ogg', 'audio/ogg'], ['opus', 'OPUS', 'opus', 'audio/ogg'],
  ['flac', 'FLAC', 'flac', 'audio/flac'], ['aiff', 'AIFF', 'aiff', 'audio/aiff'], ['wma', 'WMA', 'wma', 'audio/x-ms-wma'],
]);
def('doc', [
  ['pdf', 'PDF', 'pdf', 'application/pdf'], ['txt', 'TXT', 'txt', 'text/plain;charset=utf-8'],
  ['html', 'HTML', 'html', 'text/html;charset=utf-8'], ['md', 'Markdown', 'md', 'text/markdown;charset=utf-8'],
]);
def('data', [
  ['xlsx', 'XLSX', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['xls', 'XLS', 'xls', 'application/vnd.ms-excel'], ['ods', 'ODS', 'ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['csv', 'CSV', 'csv', 'text/csv;charset=utf-8'], ['tsv', 'TSV', 'tsv', 'text/tab-separated-values;charset=utf-8'],
  ['json', 'JSON', 'json', 'application/json'],
]);
const AUDIO_OUT = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'aiff', 'wma'];

// druh vstupního souboru podle přípony (a když chybí, podle MIME)
const KINDS = {
  img: 'png jpg jpeg jfif pjpeg webp gif bmp ico svg avif tif tiff heic heif',
  video: 'mp4 m4v mov qt webm mkv avi flv wmv asf mpg mpeg m2v 3gp 3g2 ts mts m2ts ogv vob',
  audio: 'mp3 wav ogg oga opus flac aac m4a m4b wma aif aiff aifc amr weba mka ac3 caf',
  pdf: 'pdf', docx: 'docx', md: 'md markdown', html: 'html htm xhtml', txt: 'txt text log',
  data: 'csv tsv xlsx xlsm xls ods json',
};
const EXT_KIND = {};
for (const [k, v] of Object.entries(KINDS)) v.split(' ').forEach((e) => (EXT_KIND[e] = k));
const extOf = (name) => (name.match(/\.([a-z0-9]{1,6})$/i)?.[1] || '').toLowerCase();
function kindOf(file) {
  const e = extOf(file.name);
  if (EXT_KIND[e]) return EXT_KIND[e];
  const t = file.type || '';
  if (t.startsWith('image/')) return 'img';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('text/')) return 'txt';
  return null;
}
// do čeho jde který druh převést
function targetsFor(item) {
  const same = { jpeg: 'jpg', jfif: 'jpg', pjpeg: 'jpg', tif: 'tiff', htm: 'html', markdown: 'md', m4b: 'm4a', oga: 'ogg', aif: 'aiff', aifc: 'aiff', xlsm: 'xlsx' }[item.ext] || item.ext;
  let list = [];
  switch (item.kind) {
    case 'img': list = ['png', 'jpg', 'webp', 'gif', 'bmp', 'tiff', 'ico', 'pdf']; if (item.ext === 'gif') list.push('mp4', 'webm'); break;
    case 'video': list = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'gifanim', ...AUDIO_OUT]; break;
    case 'audio': list = [...AUDIO_OUT]; break;
    case 'pdf': list = ['png', 'jpg', 'txt']; break;
    case 'docx': list = ['pdf', 'html', 'txt', 'md']; break;
    case 'md': list = ['html', 'pdf', 'txt']; break;
    case 'html': list = ['txt', 'pdf']; break;
    case 'txt': list = ['pdf', 'html']; break;
    case 'data': list = ['xlsx', 'xls', 'ods', 'csv', 'tsv', 'json', 'html', 'pdf']; break;
  }
  return list.filter((id) => F[id].ext !== same);
}

/* ---------- pomocníci ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseOf = (name) => name.replace(/\.[^.]+$/, '') || 'soubor';
const souboru = (n) => n === 1 ? '1 soubor' : n < 5 ? n + ' soubory' : n + ' souborů';
const size = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' kB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
const ICONS = {
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17.5 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  music: '<path d="M9 18V5.5l10.5-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  doc: '<path d="M14.5 3.5H7a2.5 2.5 0 0 0-2.5 2.5v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V8.5z"/><path d="M14.5 3.5v5h5M8.5 13h7M8.5 16.5h4.5"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
  upload: '<path d="M12 15.5V4M7 8.5l5-5 5 5"/><path d="M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  download: '<path d="M12 4v11.5M7 10.5l5 5 5-5"/><path d="M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m7 10 5 5 5-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M7 5.5v13l11-6.5z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  file: '<path d="M14.5 3.5H7a2.5 2.5 0 0 0-2.5 2.5v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V8.5z"/><path d="M14.5 3.5v5h5"/>',
};
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const KIND_ICON = { img: 'image', video: 'video', audio: 'music', pdf: 'doc', docx: 'doc', md: 'doc', html: 'doc', txt: 'doc', data: 'table' };
const KIND_CAT = { img: 'img', video: 'video', audio: 'audio', pdf: 'doc', docx: 'doc', md: 'doc', html: 'doc', txt: 'doc', data: 'data' };
const catColor = (id) => CATS.find((c) => c.id === id)?.color || '#475569';

/* ---------- ffmpeg (video, zvuk, některé obrázky) ---------- */
let ff = null, ffLoading = null, ffQueue = Promise.resolve();
async function fetchWithProgress(url, type, onP) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Nepodařilo se stáhnout převodník (' + res.status + ').');
  const total = +res.headers.get('content-length') || 32e6;
  const reader = res.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onP(Math.min(1, got / total)); }
  return URL.createObjectURL(new Blob(parts, { type }));
}
async function getFF(onLoad) {
  if (ff) return ff;
  ffLoading ||= (async () => {
    const { FFmpeg } = await import('./lib/ffmpeg/index.js');
    const f = new FFmpeg();
    const wasmURL = await fetchWithProgress(L('./lib/ffmpeg-core/ffmpeg-core.wasm'), 'application/wasm', onLoad);
    await f.load({ coreURL: L('./lib/ffmpeg-core/ffmpeg-core.js'), wasmURL });
    URL.revokeObjectURL(wasmURL);
    ff = f; return f;
  })().catch((e) => { ffLoading = null; throw e; });
  return ffLoading;
}
// převody přes ffmpeg běží jeden po druhém (ffmpeg má jen jedno „pracoviště“)
function ffRun(blob, inExt, outFmt, args, cb) {
  const job = ffQueue.then(async () => {
    const f = await getFF((p) => cb.status(`Načítám převodník videa a zvuku (31 MB, jen poprvé) ${Math.round(p * 100)} %`, p));
    cb.status('Převádím…', 0);
    const id = Math.random().toString(36).slice(2, 8);
    const inName = `in_${id}.${(inExt || 'bin').replace(/[^a-z0-9]/g, '')}`, outName = `out_${id}.${outFmt.ext}`;
    const logs = [];
    const onLog = ({ message }) => { logs.push(message); if (logs.length > 40) logs.shift(); };
    const onProg = ({ progress }) => { if (progress >= 0 && progress <= 1) cb.status('Převádím…', progress); cb.alive(); };
    await f.writeFile(inName, new Uint8Array(await blob.arrayBuffer()));
    f.on('log', onLog); f.on('progress', onProg);
    try {
      const code = await f.exec(['-hide_banner', '-i', inName, ...args, '-y', outName]);
      if (code !== 0) throw new Error(ffError(logs));
      const data = await f.readFile(outName);
      if (!data?.length) throw new Error(ffError(logs));
      return new Blob([data], { type: outFmt.mime });
    } finally {
      f.off('log', onLog); f.off('progress', onProg);
      await f.deleteFile(inName).catch(() => {}); await f.deleteFile(outName).catch(() => {});
    }
  });
  ffQueue = job.catch(() => {});
  return job;
}
function ffError(logs) {
  const t = logs.join('\n');
  if (/does not contain any stream|Output file .* does not contain|matches no streams/i.test(t)) return 'V souboru není žádná stopa, kterou by šlo převést (třeba video bez zvuku).';
  if (/Invalid data found|could not find codec|Unknown format/i.test(t)) return 'Tenhle soubor se nedá přečíst. Může být poškozený nebo v nepodporovaném kódování.';
  if (/memory|OOM|Aborted/i.test(t)) return 'Soubor je na převod v prohlížeči moc velký.';
  return 'Převod se nepovedl.';
}
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
const H264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', EVEN, '-c:a', 'aac', '-b:a', '160k'];
const AV_ARGS = {
  mp4: [...H264, '-movflags', '+faststart'], mov: [...H264, '-movflags', '+faststart'], mkv: H264,
  webm: ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2M', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-b:a', '128k'],
  avi: ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame', '-q:a', '3'],
  gifanim: ['-an', '-vf', "fps=12,scale='min(640,iw)':-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", '-loop', '0'],
  mp3: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'], wav: ['-vn', '-c:a', 'pcm_s16le'],
  m4a: ['-vn', '-c:a', 'aac', '-b:a', '192k'], aac: ['-vn', '-c:a', 'aac', '-b:a', '192k'],
  ogg: ['-vn', '-c:a', 'libvorbis', '-q:a', '5'], opus: ['-vn', '-c:a', 'libopus', '-b:a', '128k'],
  flac: ['-vn', '-c:a', 'flac'], aiff: ['-vn', '-c:a', 'pcm_s16be'], wma: ['-vn', '-c:a', 'wmav2', '-b:a', '192k'],
};
const IMG_FF_ARGS = {
  gif: ['-frames:v', '1', '-vf', 'split[a][b];[a]palettegen[p];[b][p]paletteuse'],
  bmp: ['-frames:v', '1'], tiff: ['-frames:v', '1'],
  ico: ['-frames:v', '1', '-vf', "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease"],
};

/* ---------- obrázky ---------- */
async function toDrawable(item, cb) {
  let blob = item.file;
  if (item.ext === 'heic' || item.ext === 'heif') {
    cb.status('Čtu fotku HEIC…', 0);
    const { heicTo } = await import('./lib/heic.js');
    blob = await heicTo({ blob, type: 'image/png' });
  } else if (item.ext === 'tif' || item.ext === 'tiff') {
    blob = await ffRun(blob, 'tiff', F.png, ['-frames:v', '1'], cb);
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode().catch(() => { throw new Error('Obrázek se nedá přečíst.'); });
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function canvasOf(img, white) {
  let w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
  const max = 16384; if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (white) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}
const canvasBlob = (c, type, q = 0.92) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Prohlížeč tenhle formát neumí uložit.'))), type, q));
async function imagesToPdf(pngBlobs) {
  const { PDFDocument } = await import('./lib/pdflib.js');
  const pdf = await PDFDocument.create();
  for (const b of pngBlobs) {
    const bytes = new Uint8Array(await b.arrayBuffer());
    const im = b.type === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const w = im.width * 0.75, h = im.height * 0.75;
    pdf.addPage([w, h]).drawImage(im, { x: 0, y: 0, width: w, height: h });
  }
  return new Blob([await pdf.save()], { type: F.pdf.mime });
}

/* ---------- text → PDF (vykreslí se jako obrázky stránek, takže fungují i české znaky) ---------- */
async function textToPdf(text) {
  const W = 1240, H = 1754, M = 110, LH = 36; // A4 při 150 dpi
  const pages = []; let c, ctx, y;
  const page = () => {
    c = document.createElement('canvas'); c.width = W; c.height = H; ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#111';
    ctx.font = '25px "Rethink Sans", system-ui, sans-serif'; ctx.textBaseline = 'top'; y = M; pages.push(c);
  };
  page();
  for (const para of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const words = para.split(/(\s+)/); let line = '';
    const flush = () => { if (y + LH > H - M) page(); ctx.fillText(line, M, y); y += LH; line = ''; };
    for (const w of words) {
      if (ctx.measureText(line + w).width > W - 2 * M && line.trim()) { flush(); if (!w.trim()) continue; }
      line += w;
      while (ctx.measureText(line).width > W - 2 * M) { // hodně dlouhé slovo
        let i = line.length; while (i > 1 && ctx.measureText(line.slice(0, i)).width > W - 2 * M) i--;
        const rest = line.slice(i); line = line.slice(0, i); flush(); line = rest;
      }
    }
    flush();
  }
  return imagesToPdf(await Promise.all(pages.map((p) => canvasBlob(p, 'image/jpeg', 0.9))));
}
const htmlToText = (html) => {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style').forEach((n) => n.remove());
  d.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  d.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr,section,article,header,footer,blockquote,pre').forEach((n) => n.append('\n'));
  return (d.body?.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
};
const htmlDoc = (title, body) => `<!doctype html>\n<html lang="cs">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#111}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}pre{white-space:pre-wrap}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const textBlob = (s, fmt) => new Blob([s], { type: fmt.mime });

/* ---------- samotný převod jednoho souboru → [{name, blob}] ---------- */
async function convert(item, cb) {
  const fmt = F[item.target], base = baseOf(item.file.name), out = (blob, suffix = '') => ({ name: `${base}${suffix}.${fmt.ext}`, blob });
  const k = item.kind;

  if (k === 'video' || k === 'audio' || (k === 'img' && fmt.cat === 'video')) {
    const args = item.ext === 'gif' && fmt.cat === 'video' ? AV_ARGS[item.target].filter((a, i, arr) => !['-c:a', '-b:a'].includes(a) && !['-c:a', '-b:a'].includes(arr[i - 1])).concat('-an') : AV_ARGS[item.target];
    return [out(await ffRun(item.file, item.ext, fmt, args, cb))];
  }
  if (k === 'img') {
    const img = await toDrawable(item, cb);
    cb.status('Převádím…', 0.5);
    if (['png', 'jpg', 'webp'].includes(item.target)) return [out(await canvasBlob(canvasOf(img, item.target === 'jpg'), fmt.mime))];
    if (item.target === 'pdf') return [out(await imagesToPdf([await canvasBlob(canvasOf(img, false), 'image/png')]))];
    const png = await canvasBlob(canvasOf(img, false), 'image/png');
    return [out(await ffRun(png, 'png', fmt, IMG_FF_ARGS[item.target], cb))];
  }
  if (k === 'pdf') {
    const pdfjs = await import('./lib/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = L('./lib/pdf.worker.min.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await item.file.arrayBuffer()), isEvalSupported: false }).promise;
    const n = doc.numPages, pad = String(n).length, res = []; let text = '';
    for (let i = 1; i <= n; i++) {
      cb.status(`Strana ${i} z ${n}…`, (i - 1) / n); cb.alive();
      const page = await doc.getPage(i);
      if (item.target === 'txt') {
        const tc = await page.getTextContent();
        text += tc.items.map((t) => t.str + (t.hasEOL ? '\n' : '')).join('') + '\n\n';
      } else {
        const vp = page.getViewport({ scale: 2 });
        const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        res.push(out(await canvasBlob(c, fmt.mime), n > 1 ? `-strana-${String(i).padStart(pad, '0')}` : ''));
      }
      page.cleanup();
    }
    await doc.destroy();
    return item.target === 'txt' ? [out(textBlob(text.trim() + '\n', fmt))] : res;
  }
  if (k === 'docx') {
    const mammoth = (await import('./lib/mammoth.js')).default;
    const arrayBuffer = await item.file.arrayBuffer();
    if (item.target === 'txt') return [out(textBlob((await mammoth.extractRawText({ arrayBuffer })).value, fmt))];
    if (item.target === 'md') return [out(textBlob((await mammoth.convertToMarkdown({ arrayBuffer })).value, fmt))];
    const html = (await mammoth.convertToHtml({ arrayBuffer })).value;
    if (item.target === 'pdf') return [out(await textToPdf(htmlToText(html)))];
    return [out(textBlob(htmlDoc(base, html), fmt))];
  }
  if (k === 'md' || k === 'html' || k === 'txt') {
    const src = await item.file.text();
    let html = null;
    if (k === 'md') { const { marked } = await import('./lib/marked.js'); html = marked.parse(src); }
    if (k === 'html') html = src;
    if (item.target === 'html') return [out(textBlob(k === 'md' ? htmlDoc(base, html) : htmlDoc(base, `<pre>${esc(src)}</pre>`), fmt))];
    const text = html == null ? src : htmlToText(html);
    if (item.target === 'txt') return [out(textBlob(text, fmt))];
    if (item.target === 'pdf') return [out(await textToPdf(text))];
  }
  if (k === 'data') {
    const XLSX = await import('./lib/xlsx.js');
    let wb;
    if (item.ext === 'json') {
      let data = JSON.parse(await item.file.text());
      if (!Array.isArray(data)) data = Array.isArray(Object.values(data)[0]) ? Object.values(data)[0] : [data];
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, data.every((r) => Array.isArray(r)) ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.json_to_sheet(data), 'List1');
    } else {
      wb = XLSX.read(new Uint8Array(await item.file.arrayBuffer()), { type: 'array', cellDates: true, codepage: 65001 });
    }
    if (['xlsx', 'xls', 'ods'].includes(item.target)) return [out(new Blob([XLSX.write(wb, { bookType: item.target, type: 'array' })], { type: fmt.mime }))];
    const many = wb.SheetNames.length > 1, res = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name], sfx = many ? '-' + name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') : '';
      let s;
      if (item.target === 'csv') s = '﻿' + XLSX.utils.sheet_to_csv(ws);
      else if (item.target === 'tsv') s = '﻿' + XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
      else if (item.target === 'json') s = JSON.stringify(XLSX.utils.sheet_to_json(ws, { defval: '' }), null, 2);
      else if (item.target === 'html') s = htmlDoc(name, XLSX.utils.sheet_to_html(ws, { header: '', footer: '' }));
      else if (item.target === 'pdf') { res.push(out(await textToPdf(XLSX.utils.sheet_to_csv(ws, { FS: '   ' })), sfx)); continue; }
      res.push(out(textBlob(s, fmt), sfx));
    }
    return res;
  }
  throw new Error('Tenhle převod neumím.');
}

/* ---------- ZIP a stahování ---------- */
async function zipOf(files) {
  const { zipSync } = await import('./lib/fflate.js');
  const used = new Set(), entries = {};
  for (const f of files) {
    let n = f.name, i = 2;
    while (used.has(n)) n = f.name.replace(/(\.[^.]+)?$/, ` (${i++})$1`);
    used.add(n);
    const packed = /^(image|video|audio)\/|zip|pdf|openxml|opendocument/.test(f.blob.type);
    entries[n] = [new Uint8Array(await f.blob.arrayBuffer()), { level: packed ? 0 : 6 }];
  }
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}
function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60e3);
}

/* ---------- výběr formátu (rozdělený podle skupin) ---------- */
let pickerEl = null;
function closePicker() { if (pickerEl) { pickerEl.remove(); pickerEl = null; document.removeEventListener('keydown', pickerKey); } }
const pickerKey = (e) => { if (e.key === 'Escape') closePicker(); };
function openPicker(anchor, ids, current, title, onPick) {
  closePicker();
  const groups = CATS.map((c) => ({ ...c, items: ids.filter((id) => F[id].cat === c.id) })).filter((g) => g.items.length);
  pickerEl = document.createElement('div');
  pickerEl.className = 'kv-pick-wrap';
  pickerEl.innerHTML = `<div class="kv-pick" role="dialog" aria-label="${esc(title)}">
    <div class="kv-pick-head"><b>${esc(title)}</b><button class="kv-x" aria-label="Zavřít">${icon('x')}</button></div>
    <div class="kv-pick-body">${groups.map((g) => `
      <section><h4><span class="kv-dot">${icon(g.icon)}</span>${esc(g.label)}</h4>
      <div class="kv-chips">${g.items.map((id) => `<button class="kv-chip${id === current ? ' on' : ''}" data-f="${id}">${esc(F[id].label)}${F[id].hint ? `<small>${esc(F[id].hint)}</small>` : ''}</button>`).join('')}</div></section>`).join('')}
    </div></div>`;
  document.body.append(pickerEl);
  pickerEl.querySelectorAll('.kv-dot').forEach((d, i) => d.style.setProperty('--c', groups[i].color));
  const box = pickerEl.querySelector('.kv-pick');
  if (innerWidth > 640) { // na počítači se otevře u tlačítka, na telefonu zespodu
    const r = anchor.getBoundingClientRect(), bw = Math.min(420, innerWidth - 24);
    box.style.width = bw + 'px';
    box.style.left = Math.max(12, Math.min(r.right - bw, innerWidth - bw - 12)) + 'px';
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    if (below >= 320 || below >= above) { box.style.top = r.bottom + 6 + 'px'; box.style.maxHeight = below - 6 + 'px'; }
    else { box.style.bottom = innerHeight - r.top + 6 + 'px'; box.style.maxHeight = above - 6 + 'px'; }
    pickerEl.classList.add('pop');
  } else pickerEl.classList.add('sheet');
  pickerEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.kv-chip');
    if (chip) { onPick(chip.dataset.f); closePicker(); return; }
    if (e.target === pickerEl || e.target.closest('.kv-x')) closePicker();
  });
  document.addEventListener('keydown', pickerKey);
  (pickerEl.querySelector('.kv-chip.on') || pickerEl.querySelector('.kv-chip'))?.focus();
}

/* ---------- stav a vykreslení ---------- */
const items = []; // { id, file, kind, ext, target, status: idle|busy|done|error, msg, p, outputs }
let host = null, ctx = null, running = false;
const $ = (s, el = host) => el?.querySelector(s);

export function reset() { items.length = 0; closePicker(); } // při zamčení hubu se soubory zahodí

export function mount(el, context) {
  host = el; ctx = context;
  host.innerHTML = `
  <div class="kv">
    <div class="kv-title">
      <button class="ghost" id="kvback">${icon('back')}<span>Hub</span></button>
      <div><h1>Konvertor</h1><p>Převádí přímo v tvém zařízení, soubory se nikam nenahrávají.</p></div>
    </div>
    <label class="kv-drop" id="kvdrop">
      <input type="file" id="kvfile" multiple hidden />
      <span class="kv-drop-ico">${icon('upload')}</span>
      <b>Přetáhni sem soubory nebo klikni a vyber</b>
      <small>Obrázky, video, hudba, PDF, Word, Markdown, HTML, text i tabulky. Klidně víc najednou.</small>
    </label>
    <div class="kv-bar" id="kvbar"></div>
    <ul class="kv-list" id="kvlist" role="list"></ul>
  </div>`;
  $('#kvback').onclick = () => ctx.back();
  $('#kvfile').onchange = (e) => { add(e.target.files); e.target.value = ''; };
  const drop = $('#kvdrop');
  ['dragenter', 'dragover'].forEach((t) => host.addEventListener(t, (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
  ['dragleave', 'drop'].forEach((t) => host.addEventListener(t, (e) => { if (t === 'dragleave' && host.contains(e.relatedTarget)) return; drop.classList.remove('over'); }));
  host.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); add(e.dataTransfer.files); } });
  renderAll();
}

function add(fileList) {
  let bad = 0;
  for (const file of fileList) {
    const kind = kindOf(file);
    if (!kind) { bad++; continue; }
    const it = { id: Math.random().toString(36).slice(2), file, kind, ext: extOf(file.name), target: null, status: 'idle', msg: '', p: 0, outputs: [] };
    // když už je u ostatních vybraný formát, který jde použít i tady, rovnou ho nastav
    const last = [...items].reverse().find((x) => x.target && targetsFor(it).includes(x.target) && KIND_CAT[x.kind] === KIND_CAT[kind]);
    if (last) it.target = last.target;
    items.push(it);
  }
  if (bad) ctx.toast(bad === 1 ? 'Jeden soubor má formát, který neumím převést.' : `${bad} soubory mají formát, který neumím převést.`);
  renderAll();
}

function renderAll() {
  if (!host?.isConnected) return;
  const list = $('#kvlist'), bar = $('#kvbar');
  list.innerHTML = items.map(rowHtml).join('');
  items.forEach((it) => paintRow(it));
  const done = items.filter((i) => i.status === 'done').length, ready = items.filter((i) => i.target && i.status !== 'done' && i.status !== 'busy').length;
  bar.innerHTML = items.length ? `
    <span class="kv-count">${souboru(items.length)}</span>
    <button class="ghost" id="kvall">Vše na: <b>${esc(commonTarget() ? F[commonTarget()].label : 'vybrat')}</b>${icon('chev')}</button>
    <button class="primary" id="kvgo" ${ready && !running ? '' : 'disabled'}>${icon('play')}<span>${running ? 'Převádím…' : 'Převést' + (ready > 1 ? ` (${ready})` : '')}</span></button>
    <button class="ghost" id="kvzip" ${done ? '' : 'disabled'}>${icon('download')}<span>Stáhnout vše</span></button>
    <button class="ghost icon-only" id="kvclear" title="Odebrat všechny soubory" aria-label="Odebrat všechny soubory" ${running ? 'disabled' : ''}>${icon('trash')}</button>` : '';
  host.querySelector('.kv').classList.toggle('has-items', items.length > 0);
  if (!items.length) return;
  $('#kvall').onclick = (e) => {
    const all = [...new Set(items.flatMap(targetsFor))];
    openPicker(e.currentTarget, all, commonTarget(), 'Převést všechny soubory na', (f) => {
      let skip = 0;
      for (const it of items) { if (it.status === 'busy') continue; if (targetsFor(it).includes(f)) setTarget(it, f); else skip++; }
      if (skip) ctx.toast(`${skip === 1 ? 'Jeden soubor' : skip + ' soubory'} do ${F[f].label} převést nejde, ty zůstaly beze změny.`);
      renderAll();
    });
  };
  $('#kvgo').onclick = runAll;
  $('#kvzip').onclick = downloadAll;
  $('#kvclear').onclick = () => { items.length = 0; renderAll(); };
}
const commonTarget = () => { const t = [...new Set(items.map((i) => i.target))]; return t.length === 1 ? t[0] : null; };
function setTarget(it, f) { if (it.target !== f) { it.target = f; if (it.status !== 'busy') { it.status = 'idle'; it.outputs = []; it.msg = ''; } } }

function rowHtml(it) {
  return `<li class="kv-row" id="r-${it.id}">
    <span class="kv-kind">${icon(KIND_ICON[it.kind])}</span>
    <div class="kv-info"><b title="${esc(it.file.name)}">${esc(it.file.name)}</b><small class="kv-meta"></small><div class="kv-prog"><i></i></div></div>
    <div class="kv-ctrl">
      <span class="kv-arrow">${icon('arrow')}</span>
      <button class="kv-fmt"></button>
      <button class="kv-dl ghost" hidden>${icon('download')}<span>Stáhnout</span></button>
      <button class="kv-rm" aria-label="Odebrat">${icon('x')}</button>
    </div>
  </li>`;
}
function paintRow(it) {
  const row = host?.querySelector('#r-' + it.id); if (!row) return;
  row.querySelector('.kv-kind').style.setProperty('--c', catColor(KIND_CAT[it.kind]));
  row.dataset.status = it.status;
  const meta = row.querySelector('.kv-meta');
  meta.textContent = it.status === 'busy' ? it.msg || 'Převádím…'
    : it.status === 'error' ? it.msg
    : it.status === 'done' ? `Hotovo · ${it.outputs.length > 1 ? souboru(it.outputs.length) + ' · ' : ''}${size(it.outputs.reduce((s, o) => s + o.blob.size, 0))}`
    : `${size(it.file.size)} · ${(it.ext || it.kind).toUpperCase()}`;
  row.querySelector('.kv-prog i').style.width = (it.status === 'busy' ? Math.max(3, it.p * 100) : 0) + '%';
  const fb = row.querySelector('.kv-fmt');
  fb.innerHTML = it.target ? `${esc(F[it.target].label)}${F[it.target].hint === 'animace' ? ' anim.' : ''}${icon('chev')}` : `Vyber formát${icon('chev')}`;
  fb.classList.toggle('empty', !it.target);
  if (it.target) fb.style.setProperty('--c', catColor(F[it.target].cat));
  fb.disabled = it.status === 'busy';
  fb.onclick = (e) => openPicker(e.currentTarget, targetsFor(it), it.target, 'Převést na', (f) => { setTarget(it, f); renderAll(); });
  const dl = row.querySelector('.kv-dl');
  dl.hidden = it.status !== 'done';
  dl.onclick = async () => {
    if (it.outputs.length === 1) save(it.outputs[0].blob, it.outputs[0].name);
    else save(await zipOf(it.outputs), baseOf(it.file.name) + '.zip');
  };
  const rm = row.querySelector('.kv-rm');
  rm.disabled = it.status === 'busy';
  rm.onclick = () => { const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); renderAll(); };
}

async function runAll() {
  if (running) return;
  running = true; renderAll();
  const todo = items.filter((i) => i.target && i.status !== 'done');
  for (const it of todo) {
    if (!items.includes(it) || !it.target) continue;
    it.status = 'busy'; it.p = 0; it.msg = 'Připravuji…'; paintRow(it);
    const cb = { status: (msg, p) => { it.msg = msg; it.p = p ?? it.p; paintRow(it); }, alive: () => ctx.alive() };
    try {
      it.outputs = await convert(it, cb);
      it.status = 'done'; it.msg = '';
    } catch (e) {
      console.error(e);
      it.status = 'error'; it.msg = 'Chyba: ' + (e?.message || 'převod se nepovedl.');
    }
    ctx.alive(); paintRow(it);
  }
  running = false; renderAll();
  const ok = todo.filter((i) => i.status === 'done').length, bad = todo.length - ok;
  ctx.toast(bad ? `Hotovo: ${ok}, nepovedlo se: ${bad}.` : ok === 1 ? 'Hotovo, soubor můžeš stáhnout.' : `Hotovo, ${souboru(ok)} můžeš stáhnout.`);
}
async function downloadAll() {
  const files = items.filter((i) => i.status === 'done').flatMap((i) => i.outputs);
  if (!files.length) return;
  if (files.length === 1) return save(files[0].blob, files[0].name);
  const btn = $('#kvzip'); btn.disabled = true;
  try { save(await zipOf(files), 'konvertor.zip'); } finally { btn.disabled = false; }
}

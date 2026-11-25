# Hub stahovač: malý program pro počítač, přes který hub (hub.davix.cz) stahuje video a hudbu.
# Běží jen na tomhle počítači (adresa 127.0.0.1:8766), zvenku se k němu nikdo nedostane
# a příkazy přijímá jen od stránky hubu. Stahuje přes yt-dlp, ffmpeg bere z balíčku imageio-ffmpeg.
#
# Spuštění: pythonw stahovac.py   (bez okna; záznam je v %LOCALAPPDATA%\HubStahovac\zaznam.txt)
# Potřebné balíčky (program si je při startu sám doinstaluje a yt-dlp aktualizuje):
#   pip install -U yt-dlp imageio-ffmpeg
import json, os, re, secrets, shutil, subprocess, sys, threading, time, traceback, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = '1.0'
PORT = 8766
ALLOWED_ORIGINS = {'https://hub.davix.cz', 'https://hub.davidjanecka.cz', 'http://localhost:5180', 'http://127.0.0.1:5180'}
HOME = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~/.local/share'), 'HubStahovac')
TMP = os.path.join(HOME, 'soubory')
KEEP_SECONDS = 3 * 3600  # hotové soubory se po 3 hodinách smažou
os.makedirs(TMP, exist_ok=True)
LOG = open(os.path.join(HOME, 'zaznam.txt'), 'a', encoding='utf-8', buffering=1)


def log(*a):
    line = time.strftime('%Y-%m-%d %H:%M:%S ') + ' '.join(str(x) for x in a)
    LOG.write(line + '\n')
    if sys.stdout:
        try: print(line)
        except Exception: pass


def pip_install(*pkgs):
    flags = 0x08000000 if os.name == 'nt' else 0  # CREATE_NO_WINDOW, aby neblikalo okno
    try:
        r = subprocess.run([sys.executable, '-m', 'pip', 'install', '-U', '--disable-pip-version-check', '-q', *pkgs],
                           capture_output=True, text=True, timeout=600, creationflags=flags)
        log('pip', *pkgs, '->', r.returncode, (r.stderr or '')[-300:])
    except Exception as e:
        log('pip selhal', e)


# YouTube se často mění, proto se yt-dlp při každém startu aktualizuje
if os.environ.get('STAHOVAC_NO_UPDATE') != '1':
    pip_install('yt-dlp', 'imageio-ffmpeg')
import yt_dlp  # noqa: E402
try:
    import imageio_ffmpeg  # noqa: E402
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = shutil.which('ffmpeg')
log('start', VERSION, 'yt-dlp', yt_dlp.version.__version__, 'ffmpeg', FFMPEG)

JOBS = {}
LOCK = threading.Lock()


def public(job):
    return {k: job.get(k) for k in ('id', 'url', 'mode', 'quality', 'status', 'phase', 'progress', 'title', 'filename', 'size', 'error', 'thumb', 'created')}


def spotify_query(url):
    """Spotify hudbu šifruje, takže se vezme název a interpret ze stránky skladby a písnička se najde na YouTube."""
    if '/track/' not in url:
        raise ValueError('Ze Spotify umím stáhnout jen jednotlivou písničku (odkaz na skladbu), ne playlist nebo album.')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en'})
    html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'replace')
    def meta(p):
        m = re.search(r'<meta[^>]+(?:property|name)="%s"[^>]+content="([^"]*)"' % re.escape(p), html)
        return urllib.parse.unquote(m.group(1)) if m else ''
    import html as h
    title = h.unescape(meta('og:title'))
    desc = h.unescape(meta('og:description'))  # „Interpret · Album · Song · 2020“
    artist = desc.split('·')[0].strip() if '·' in desc else ''
    if not title:
        raise ValueError('Ze Spotify se nepodařilo zjistit název písničky.')
    return f'{artist} - {title}'.strip(' -'), title, artist


def run_job(job):
    jdir = os.path.join(TMP, job['id'])
    os.makedirs(jdir, exist_ok=True)

    def hook(d):
        if d.get('status') == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            got = d.get('downloaded_bytes') or 0
            info = d.get('info_dict') or {}
            kind = 'zvuk' if info.get('vcodec') == 'none' else 'video'
            with LOCK:
                job['phase'] = f'Stahuji {kind}'
                job['progress'] = (got / total) if total else None
        elif d.get('status') == 'finished':
            with LOCK:
                job['progress'] = 1

    def pp_hook(d):
        if d.get('status') == 'started':
            name = d.get('postprocessor') or ''
            with LOCK:
                job['phase'] = 'Převádím na MP3' if 'ExtractAudio' in name else 'Spojuji video a zvuk' if 'Merger' in name else 'Dokončuji'
                job['progress'] = None

    url = job['url']
    opts = {
        'outtmpl': os.path.join(jdir, '%(title).120B.%(ext)s'),
        'windowsfilenames': True, 'restrictfilenames': False, 'noplaylist': True, 'quiet': True, 'no_warnings': True,
        'progress_hooks': [hook], 'postprocessor_hooks': [pp_hook], 'ffmpeg_location': FFMPEG, 'noprogress': True,
        'concurrent_fragment_downloads': 4, 'retries': 5, 'socket_timeout': 30,
    }
    if job['mode'] == 'audio':
        opts['format'] = 'bestaudio/best'
        opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '0'}, {'key': 'FFmpegMetadata'}]
    else:
        q = job.get('quality') or 'best'
        res = 'res' if q == 'best' else f'res:{q}'
        opts['format'] = 'bv*+ba/b'
        opts['format_sort'] = [res, 'vcodec:h264', 'acodec:aac', 'ext:mp4:m4a']
        opts['merge_output_format'] = 'mp4'

    try:
        if 'spotify.com' in urllib.parse.urlparse(url).netloc:
            job['phase'] = 'Hledám písničku'
            query, title, artist = spotify_query(url)
            job['title'] = query
            url = 'ytsearch1:' + query + ' audio'
            opts['format'] = 'bestaudio/best'
            opts['postprocessors'] = [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '0'}, {'key': 'FFmpegMetadata'}]
            opts['outtmpl'] = os.path.join(jdir, re.sub(r'[\\/:*?"<>|]', '', query)[:120] + '.%(ext)s')
            job['mode'] = 'audio'
        with yt_dlp.YoutubeDL(opts) as ydl:
            job['phase'] = 'Zjišťuji informace'
            info = ydl.extract_info(url, download=False)
            if info.get('_type') == 'playlist' and info.get('entries'):
                info = next(e for e in info['entries'] if e)
            with LOCK:
                job['title'] = job.get('title') or info.get('title')
                job['thumb'] = info.get('thumbnail')
            ydl.process_ie_result(info, download=True)
        files = [f for f in os.listdir(jdir) if not f.endswith(('.part', '.ytdl', '.temp'))]
        if not files:
            raise RuntimeError('Stažený soubor se nenašel.')
        best = max(files, key=lambda f: os.path.getsize(os.path.join(jdir, f)))
        with LOCK:
            job.update(status='done', phase='Hotovo', progress=1, filename=best, path=os.path.join(jdir, best), size=os.path.getsize(os.path.join(jdir, best)))
        log('hotovo', job['id'], best)
    except Exception as e:
        msg = str(e)
        log('chyba', job['id'], url, msg, traceback.format_exc()[-800:])
        low = msg.lower()
        if 'login' in low or 'sign in' in low or 'private' in low or 'cookies' in low:
            msg = 'Tohle video je soukromé nebo služba chce přihlášení, takže ho stáhnout nejde.'
        elif 'unsupported url' in low:
            msg = 'Tenhle odkaz neumím stáhnout.'
        elif 'unavailable' in low or 'not available' in low or '404' in low:
            msg = 'Video už není dostupné nebo odkaz nefunguje.'
        else:
            msg = re.sub(r'\x1b\[[0-9;]*m', '', msg).replace('ERROR: ', '')[:300]
        with LOCK:
            job.update(status='error', phase='Chyba', error=msg)


def cleanup():
    while True:
        now = time.time()
        with LOCK:
            for jid, job in list(JOBS.items()):
                if job['status'] in ('done', 'error') and now - job['created'] > KEEP_SECONDS:
                    shutil.rmtree(os.path.join(TMP, jid), ignore_errors=True)
                    JOBS.pop(jid, None)
        for d in os.listdir(TMP):  # zbytky z minulého spuštění
            p = os.path.join(TMP, d)
            if d not in JOBS and now - os.path.getmtime(p) > KEEP_SECONDS:
                shutil.rmtree(p, ignore_errors=True)
        time.sleep(600)


class Handler(BaseHTTPRequestHandler):
    server_version = 'HubStahovac/' + VERSION

    def log_message(self, fmt, *args):
        pass

    def origin_ok(self):
        host = (self.headers.get('Host') or '').split(':')[0]
        if host not in ('127.0.0.1', 'localhost'):
            return False  # ochrana proti podvržení adresy (DNS rebinding)
        return self.headers.get('Origin') in ALLOWED_ORIGINS

    def cors(self):
        o = self.headers.get('Origin')
        if o in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', o)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length')

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if self.origin_ok() else 403)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        if not self.origin_ok():
            return self.send_json(403, {'error': 'forbidden'})
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/ping':
            return self.send_json(200, {'ok': True, 'version': VERSION, 'ytdlp': yt_dlp.version.__version__})
        if path == '/api/jobs':
            with LOCK:
                return self.send_json(200, sorted((public(j) for j in JOBS.values()), key=lambda j: -j['created']))
        m = re.fullmatch(r'/api/jobs/([a-f0-9]{32})/file', path)
        if m:
            job = JOBS.get(m.group(1))
            if not job or job['status'] != 'done' or not os.path.exists(job['path']):
                return self.send_json(404, {'error': 'Soubor už tu není.'})
            size = os.path.getsize(job['path'])
            self.send_response(200)
            self.cors()
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(size))
            self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + urllib.parse.quote(job['filename']))
            self.end_headers()
            with open(job['path'], 'rb') as f:
                shutil.copyfileobj(f, self.wfile, 1024 * 1024)
            return
        self.send_json(404, {'error': 'not found'})

    def do_POST(self):
        if not self.origin_ok():
            return self.send_json(403, {'error': 'forbidden'})
        if urllib.parse.urlparse(self.path).path != '/api/jobs':
            return self.send_json(404, {'error': 'not found'})
        try:
            n = min(int(self.headers.get('Content-Length') or 0), 10000)
            data = json.loads(self.rfile.read(n) or b'{}')
            url = str(data.get('url', '')).strip()
            if not re.match(r'^https?://', url):
                raise ValueError
        except Exception:
            return self.send_json(400, {'error': 'Chybí odkaz.'})
        mode = 'audio' if data.get('mode') == 'audio' else 'video'
        quality = str(data.get('quality') or 'best')
        if quality not in ('best', '1080', '720', '480', '360'):
            quality = 'best'
        jid = secrets.token_hex(16)
        job = {'id': jid, 'url': url, 'mode': mode, 'quality': quality, 'status': 'running', 'phase': 'Začínám', 'progress': None,
               'title': None, 'filename': None, 'size': None, 'error': None, 'thumb': None, 'created': time.time()}
        with LOCK:
            JOBS[jid] = job
        threading.Thread(target=run_job, args=(job,), daemon=True).start()
        log('nový', jid, mode, quality, url)
        self.send_json(200, public(job))

    def do_DELETE(self):
        if not self.origin_ok():
            return self.send_json(403, {'error': 'forbidden'})
        m = re.fullmatch(r'/api/jobs/([a-f0-9]{32})', urllib.parse.urlparse(self.path).path)
        if not m:
            return self.send_json(404, {'error': 'not found'})
        with LOCK:
            job = JOBS.pop(m.group(1), None)
        if job and job['status'] != 'running':
            shutil.rmtree(os.path.join(TMP, job['id']), ignore_errors=True)
        self.send_json(200, {'ok': True})


if __name__ == '__main__':
    try:
        srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    except OSError:
        log('Stahovač už běží (port', PORT, 'je obsazený).')
        sys.exit(0)
    threading.Thread(target=cleanup, daemon=True).start()
    log('poslouchám na http://127.0.0.1:%d' % PORT)
    srv.serve_forever()

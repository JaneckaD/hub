HUB STAHOVAČ – program pro počítač
==================================
Díky němu stahuje Stahovač v hubu video a hudbu přímo (YouTube, TikTok, Instagram, Spotify).

Instalace (jednou):
1. Musí být nainstalovaný Python 3 (https://www.python.org).
2. Ve složce s tímhle souborem spusť: pip install -U yt-dlp imageio-ffmpeg
3. Spusť program bez okna: pythonw stahovac.py
4. Aby se spouštěl sám po zapnutí počítače, dej zástupce na "pythonw stahovac.py"
   do složky Po spuštění (Win+R → shell:startup).

Program poslouchá jen na adrese 127.0.0.1:8766 (zvenku se k němu nikdo nedostane)
a přijímá příkazy jen od stránky hubu. Při každém startu si aktualizuje yt-dlp.
Stažené soubory drží 3 hodiny v %LOCALAPPDATA%\HubStahovac\soubory, pak je smaže.
Záznam o běhu: %LOCALAPPDATA%\HubStahovac\zaznam.txt

# hub.

Soukromý osobní hub Davida Janečky na https://hub.davix.cz (statický web na GitHub Pages).

- **Přihlášení:** jen heslo. Ověřuje ho Firebase Authentication (projekt `flashcards-663fd`), účet `hub@hub.davidjanecka.cz`.
  Heslo jde do Firebase tak, jak ho napíšeš (Firebase chce aspoň 6 znaků).
- **Data:** dlaždice jsou v databázi Firestore v dokumentu `hub/tiles`. Pravidla (`firestore.rules`) ho pustí jen k účtu hubu.
  Soubor `firestore.rules` obsahuje pravidla celé databáze (i pro flashcards), vkládá se ve Firebase → Firestore Database → Rules.
- **Soubory:** `index.html`, `app.css`, `app.js` (všechna logika), `firebase.js` (balíček Firebase, sestaví se přes `scripts/firebase.mjs`).
- **Verze:** při každé změně zvýš `VERSION` v `app.js` a stejné `?v=` v `index.html` (3×) a v importu `firebase.js`.
- **Testování:** Firebase emulátor (auth 9099, firestore 8080) a stránka na localhostu s `?emu`.
- **Konvertor** (`#/konvertor`, soubor `konvertor.js`): převádí soubory přímo v prohlížeči, nic se nikam neposílá.
  Knihovny jsou ve složce `lib/` (sestaví je `scripts/libs.mjs`): ffmpeg.wasm (video, zvuk, GIF/BMP/TIFF/ICO), pdf.js a pdf-lib (PDF),
  heic-to (fotky z iPhonu), mammoth (Word), marked (Markdown), SheetJS (tabulky), fflate (ZIP). Načítají se až když jsou potřeba.
  Bezpečnostní pravidla stránky (CSP v `index.html`) kvůli tomu povolují `wasm-unsafe-eval` a `blob:`; knihovny nesmí potřebovat `eval`.

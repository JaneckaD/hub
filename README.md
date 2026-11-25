# hub.

Soukromý osobní hub Davida Janečky na https://hub.davix.cz (statický web na GitHub Pages).

- **Přihlášení:** jen heslo. Ověřuje ho Firebase Authentication (projekt `flashcards-663fd`), účet `hub@hub.davidjanecka.cz`.
  Firebase chce heslo aspoň o 6 znacích, proto stránka před zadané heslo přidá `hub:` (heslo `1234` je ve Firebase uložené jako `hub:1234`).
- **Data:** dlaždice jsou v databázi Firestore v dokumentu `hub/tiles`. Pravidla (`firestore.rules`) ho pustí jen k účtu hubu.
  Soubor `firestore.rules` obsahuje pravidla celé databáze (i pro flashcards), vkládá se ve Firebase → Firestore Database → Rules.
- **Soubory:** `index.html`, `app.css`, `app.js` (všechna logika), `firebase.js` (balíček Firebase, sestaví se přes `scripts/firebase.mjs`).
- **Verze:** při každé změně zvýš `VERSION` v `app.js` a stejné `?v=` v `index.html` (3×) a v importu `firebase.js`.
- **Testování:** Firebase emulátor (auth 9099, firestore 8080) a stránka na localhostu s `?emu`.

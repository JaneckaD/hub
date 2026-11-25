// Sestaví firebase.js jen s funkcemi Firebase, které hub používá.
// Spuštění: npm i --no-save firebase@12 esbuild && node scripts/firebase.mjs
import { build } from 'esbuild';
await build({
  stdin: {
    contents: `export { initializeApp } from 'firebase/app';
export { initializeAuth, browserSessionPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, connectAuthEmulator } from 'firebase/auth';
export { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore/lite';`,
    resolveDir: process.cwd(),
  },
  bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none',
  outfile: process.argv[2] || 'firebase.js',
});

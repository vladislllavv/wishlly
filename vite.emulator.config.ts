// Локальная проверка SQL Connect: вход и SQL идут на эмуляторы (npm run emulators), а Firestore остаётся
// на заглушке dev/firebase-mock.ts (для Firestore-эмулятора нужна Java). Боевой проект не затрагивается.
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

const mock = new URL('./dev/firebase-mock.ts', import.meta.url).pathname;

export default mergeConfig(base, defineConfig({
  resolve: {
    alias: [{ find: /^firebase\/firestore$/, replacement: mock }],
  },
  define: {
    'import.meta.env.VITE_USE_EMULATORS': JSON.stringify('1'),
    'import.meta.env.VITE_SQL_FRIENDS': JSON.stringify('1'),
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('fake-api-key'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('demo-wishlly'),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('demo-wishlly.firebaseapp.com'),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify('1:1:web:1'),
  },
  server: { host: '127.0.0.1', port: 5174, proxy: { '/api': 'http://127.0.0.1:3001' } },
}));

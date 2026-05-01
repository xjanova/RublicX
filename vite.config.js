import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Allow override via env (CI sets VITE_APP_VERSION to commit SHA / tag).
const APP_VERSION = process.env.VITE_APP_VERSION || pkg.version;

// GitHub Pages deploys to /<repo>/ — set base accordingly via env.
// Locally and on custom domains, BASE_PATH stays "/".
const BASE = process.env.VITE_BASE_PATH || '/';

function injectSwVersion() {
  return {
    name: 'inject-sw-version',
    closeBundle() {
      try {
        const out = resolve('dist/sw.js');
        let src = readFileSync(out, 'utf8');
        src = src.replace('self.__RUBLICX_VERSION__', JSON.stringify(APP_VERSION));
        writeFileSync(out, src);
      } catch {}
      try {
        writeFileSync(resolve('dist/version.json'),
          JSON.stringify({ version: APP_VERSION, builtAt: new Date().toISOString() }));
      } catch {}
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), injectSwVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: { port: 5173, host: true },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 1500 },
});

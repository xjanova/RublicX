import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function gitShortSha() {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'local'; }
}

const SHA = process.env.GITHUB_SHA?.slice(0, 7) || gitShortSha();
const BASE_VERSION = process.env.VITE_APP_VERSION || `${pkg.version}+${SHA}`;
const BUILT_AT = new Date().toISOString();
const BASE = process.env.VITE_BASE_PATH || '/';

function injectSwAndVersion() {
  return {
    name: 'inject-sw-version',
    closeBundle() {
      const swPath = resolve('dist/sw.js');
      if (existsSync(swPath)) {
        let src = readFileSync(swPath, 'utf8');
        src = src.replace('self.__RUBLICX_VERSION__', JSON.stringify(BASE_VERSION));
        writeFileSync(swPath, src);
      }
      writeFileSync(
        resolve('dist/version.json'),
        JSON.stringify({ version: BASE_VERSION, builtAt: BUILT_AT, sha: SHA })
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), injectSwAndVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(BASE_VERSION),
    __APP_BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  server: { port: 5173, host: true },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Hashed asset filenames so the SW can cache-forever without staleness risk.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

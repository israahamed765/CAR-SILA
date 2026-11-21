import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      // Disable Vite's open CORS. Same-origin app traffic does not need it; API enforces allowlist.
      cors: false,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          configure: (proxy) => {
            const allowed = new Set([
              'http://localhost:5173',
              'http://127.0.0.1:5173',
              'https://car-sila-sand.vercel.app',
            ]);
            proxy.on('proxyRes', (proxyRes, req) => {
              const origin = String(req.headers.origin || '');
              if (origin && !allowed.has(origin)) {
                delete proxyRes.headers['access-control-allow-origin'];
                delete proxyRes.headers['access-control-allow-credentials'];
              }
            });
          },
        },
      },
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https://*.googleusercontent.com",
          "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com ws: wss:",
          "frame-src https://accounts.google.com",
          "media-src 'self' blob:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self' https://accounts.google.com",
          "frame-ancestors 'none'"
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)'
      }
    },
  };
});
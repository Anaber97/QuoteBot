import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite'

function apiRoutePlugin() {
  return {
    name: 'api-route-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const apiFileName = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
        if (!apiFileName) {
          return next();
        }

        const apiFilePath = path.resolve(process.cwd(), 'api', `${apiFileName}.js`);
        if (!apiFilePath.startsWith(path.resolve(process.cwd(), 'api'))) {
          return next();
        }

        try {
          const handlerModule = await import(`${pathToFileURL(apiFilePath).href}?t=${Date.now()}`);
          const handler = handlerModule.default || handlerModule.handler;
          if (typeof handler !== 'function') {
            return next();
          }

          const response = {
            statusCode: 200,
            headers: {},
            status(code) {
              this.statusCode = code;
              return this;
            },
            setHeader(name, value) {
              this.headers[name] = value;
            },
            json(payload) {
              this.headers['content-type'] = 'application/json';
              this.end(JSON.stringify(payload));
            },
            send(payload) {
              this.headers['content-type'] = 'text/plain';
              this.end(String(payload));
            },
            end(payload) {
              if (!res.headersSent) {
                res.writeHead(this.statusCode, this.headers);
              }
              res.end(payload);
            },
          };

          await handler(
            {
              ...req,
              method: req.method || 'GET',
              query: Object.fromEntries(url.searchParams.entries()),
            },
            response
          );
        } catch (error) {
          console.error('API route failed:', error);
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    apiRoutePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-512x512.png', 'logo-trn.png'],
      manifest: {
        name: 'TowCalc Pro',
        short_name: 'TowCalc Pro',
        description: 'Dispatch & Route Rate Engine',
        theme_color: '#080c14',
        background_color: '#080c14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
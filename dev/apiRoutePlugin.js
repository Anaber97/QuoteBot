import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApiResponse } from './apiResponse.js';

export function apiRoutePlugin() {
  return {
    name: 'api-route-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const apiFileName = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
        if (!/^[a-z][a-zA-Z0-9]*$/.test(apiFileName)) {
          return next();
        }

        const apiFilePath = path.resolve(process.cwd(), 'api', `${apiFileName}.js`);
        if (!apiFilePath.startsWith(path.resolve(process.cwd(), 'api'))) {
          return next();
        }

        try {
          let parsedBody = undefined;
          if (req.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const rawBody = Buffer.concat(chunks).toString('utf8');
            if (rawBody) {
              try {
                parsedBody = JSON.parse(rawBody);
              } catch {
                parsedBody = rawBody;
              }
            }
          }

          const handlerModule = await import(`${pathToFileURL(apiFilePath).href}?t=${Date.now()}`);
          const handler = handlerModule.default || handlerModule.handler;
          if (typeof handler !== 'function') {
            return next();
          }

          const response = createApiResponse(res);

          await handler(
            {
              headers: req.headers,
              socket: req.socket,
              method: req.method || 'GET',
              body: parsedBody,
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


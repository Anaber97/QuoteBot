/** Match the response methods used by our hosted API, including binary downloads. */
export function createApiResponse(response) {
  return {
    status(code) { response.statusCode = code; return this; },
    setHeader(name, value) { response.setHeader(name, value); return this; },
    json(payload) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(payload));
      return this;
    },
    send(payload) {
      const binary = Buffer.isBuffer(payload) || payload instanceof Uint8Array;
      if (!response.hasHeader('Content-Type')) {
        response.setHeader('Content-Type', binary ? 'application/octet-stream' : 'text/plain; charset=utf-8');
      }
      response.end(binary ? payload : String(payload ?? ''));
      return this;
    },
    end(payload) { response.end(payload); return this; },
  };
}

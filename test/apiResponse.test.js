import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApiResponse } from '../dev/apiResponse.js';

test('local HTTP responses preserve PDF bytes and explicit headers', async (t) => {
  const bytes = Buffer.from([37, 80, 68, 70, 45, 255, 0, 128, 10]);
  const server = http.createServer((_req, res) => {
    const response = createApiResponse(res);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="quote.pdf"');
    response.status(200).send(bytes);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="quote.pdf"');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

/**
 * Minimal fluent fake for the subset of the Supabase JS query builder used by
 * the API handlers. Each `.from(table)` call looks up a handler-provided
 * responder for that table; chained methods (select/eq/order/limit/etc.)
 * just record filters and the terminal method (single/maybeSingle/then)
 * resolves using the responder.
 */
export function createQueryBuilder(resolve) {
  const state = { filters: {}, table: null };
  const builder = {
    select() { return builder; },
    eq(column, value) { state.filters[column] = value; return builder; },
    order() { return builder; },
    limit() { return builder; },
    insert(payload) { state.payload = payload; state.op = 'insert'; return builder; },
    update(payload) { state.payload = payload; state.op = 'update'; return builder; },
    upsert(payload) { state.payload = payload; state.op = 'upsert'; return builder; },
    single() { return Promise.resolve(resolve(state, 'single')); },
    maybeSingle() { return Promise.resolve(resolve(state, 'maybeSingle')); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolve(state, 'many')).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

/**
 * Builds a fake admin client. `tableResponders` maps table name -> function
 * (state, mode) => { data, error }.
 */
export function createFakeAdmin({
  tableResponders = {},
  rpcResponders = {},
  authUser = null,
  storage = {},
  functionsInvoke = async () => ({ data: null, error: null }),
} = {}) {
  return {
    from(table) {
      const responder = tableResponders[table] || (() => ({ data: null, error: new Error(`No responder for table "${table}"`) }));
      const qb = createQueryBuilder((state, mode) => responder({ ...state, table, mode }));
      qb.table = table;
      return qb;
    },
    rpc(name, args) {
      const responder = rpcResponders[name] || (() => ({ data: null, error: new Error(`No responder for rpc "${name}"`) }));
      return Promise.resolve(responder(args));
    },
    storage: {
      from(bucket) {
        const bucketApi = storage[bucket] || {};
        return {
          createSignedUrl: bucketApi.createSignedUrl || (async () => ({ data: { signedUrl: `https://signed.example/${bucket}` }, error: null })),
          remove: bucketApi.remove || (async () => ({ data: null, error: null })),
          upload: bucketApi.upload || (async () => ({ data: { path: 'fake-path' }, error: null })),
        };
      },
    },
    functions: { invoke: functionsInvoke },
    auth: {
      getUser: async () => (authUser ? { data: { user: authUser }, error: null } : { data: null, error: new Error('invalid token') }),
      admin: {
        inviteUserByEmail: async () => ({ data: { user: { id: 'invited-user-id' } }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  };
}

/** Convenience: builds req/res doubles compatible with the handler signatures. */
export function createMockReqRes({ method = 'GET', body = {}, query = {}, headers = {} } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader(key, value) { res.headers[key] = value; },
  };
  const req = {
    method,
    body,
    query,
    headers: { authorization: 'Bearer test-token', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  };
  return { req, res };
}

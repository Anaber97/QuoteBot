/** Keep only an opaque ID and content digest; never persist quote/customer inputs. */
export async function pendingOperation(scope, payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `towcalc:pending:${scope}:${digest}`;
  const id = sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return { id, complete: () => sessionStorage.removeItem(key) };
}

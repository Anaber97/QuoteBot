/**
 * Portable options for `t.mock.module()`.
 *
 * Node 24.15 added `options.exports` and deprecated `namedExports` /
 * `defaultExport`, but Node 22 (what CI and .nvmrc use) silently ignores
 * `exports`, so a mock written that way has no exports at all there. Tests
 * write the modern `{ exports }` shape and wrap it with this helper, which
 * hands older runtimes the equivalent `defaultExport` / `namedExports` pair.
 */
const [major, minor] = process.versions.node.split('.').map(Number);
const supportsExportsOption = major > 24 || (major === 24 && minor >= 15);

export function moduleMockOptions({ exports, ...options } = {}) {
  if (exports === undefined || supportsExportsOption) {
    return exports === undefined ? options : { ...options, exports };
  }
  const { default: defaultExport, ...namedExports } = exports;
  return Object.hasOwn(exports, 'default')
    ? { ...options, defaultExport, namedExports }
    : { ...options, namedExports };
}

import { describe, expect, it } from 'vitest';
import { sanitizeSvgMarkup } from '../../src/lib/logoImage';

describe('SVG logo sanitization', () => {
  it('keeps normal vector artwork while removing executable and remote content', () => {
    const result = sanitizeSvgMarkup(`<svg viewBox="0 0 100 50" onload="alert(1)" xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><path d="M0 0h100v50H0z" fill="#123456"/><use href="https://evil.example/logo.svg#x"/></svg>`);
    expect(result).toContain('<path');
    expect(result).not.toMatch(/script|foreignObject|onload|https:\/\/evil/i);
  });

  it('rejects entity declarations and invalid documents', () => {
    expect(() => sanitizeSvgMarkup('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>')).toThrow(/declarations/i);
    expect(() => sanitizeSvgMarkup('<div>not svg</div>')).toThrow(/not valid/i);
  });
});

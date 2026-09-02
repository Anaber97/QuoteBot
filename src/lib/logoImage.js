const MAX_LOGO_DIMENSION = 1200;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const UNSAFE_ELEMENTS = 'script,foreignObject,iframe,object,embed,audio,video,canvas';

export function sanitizeSvgMarkup(markup) {
  const source = String(markup || '');
  if (/<!doctype|<!entity/i.test(source)) throw new Error('SVG declarations and entities are not supported.');
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg') {
    throw new Error('This SVG file is not valid.');
  }

  document.querySelectorAll(UNSAFE_ELEMENTS).forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((node) => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const isExternalReference = (name === 'href' || name === 'xlink:href') && !value.startsWith('#');
      const hasUnsafeValue = /(?:javascript:|data:text\/html|url\(\s*['"]?https?:|url\(\s*['"]?\/\/)/i.test(value);
      if (name.startsWith('on') || isExternalReference || hasUnsafeValue) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return new XMLSerializer().serializeToString(document.documentElement);
}

function svgDimensions(svg) {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const width = Number.parseFloat(svg.getAttribute('width'));
  const height = Number.parseFloat(svg.getAttribute('height'));
  const sourceWidth = Number.isFinite(width) && width > 0 ? width : viewBox?.[2];
  const sourceHeight = Number.isFinite(height) && height > 0 ? height : viewBox?.[3];
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('SVG must include a valid viewBox or width and height.');
  }
  const scale = Math.min(1, MAX_LOGO_DIMENSION / sourceWidth, MAX_LOGO_DIMENSION / sourceHeight);
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
}

const canvasBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not convert this SVG to PNG.')), 'image/png');
});

export async function convertSvgLogoToPng(file) {
  const sanitized = sanitizeSvgMarkup(await file.text());
  const parsed = new DOMParser().parseFromString(sanitized, 'image/svg+xml');
  const dimensions = svgDimensions(parsed.documentElement);
  const sourceUrl = URL.createObjectURL(new Blob([sanitized], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = sourceUrl;
    await image.decode();
    let scale = 1;
    let png;
    do {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(dimensions.width * scale));
      canvas.height = Math.max(1, Math.round(dimensions.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PNG conversion is unavailable in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      png = await canvasBlob(canvas);
      scale *= 0.75;
    } while (png.size > MAX_OUTPUT_BYTES && scale >= 0.25);
    if (png.size > MAX_OUTPUT_BYTES) throw new Error('Converted PNG is larger than 2 MB. Try a simpler SVG.');
    return new File([png], 'logo.png', { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

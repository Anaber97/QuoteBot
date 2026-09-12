import encodedBoundaries from '../data/stateBoundaries.js';

// Delta encoding preserves the Census coordinates to six decimal places while
// avoiding a multi-megabyte JavaScript syntax tree in the browser bundle.
const decodeRing = (encoded) => {
  let i=0, x=0, y=0;
  const points=[];
  const read = () => {
    let value=0, shift=0, byte;
    do { byte=encoded.charCodeAt(i++)-63; value|=(byte&31)<<shift; shift+=5; } while(byte>=32);
    return value&1 ? ~(value>>1) : value>>1;
  };
  while(i<encoded.length) { x+=read(); y+=read(); points.push([x/1e6,y/1e6]); }
  return points;
};
const boundaries = encodedBoundaries.map((state) => ({...state, rings: state.rings.map(decodeRing)}));

const inside = (p, rings) => {
  let hit = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p.lat) !== (b[1] > p.lat) && p.lng < (b[0] - a[0]) * (p.lat - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};
const crosses = (p, q, a, b) => {
  const rx = q.lng-p.lng, ry = q.lat-p.lat, sx = b[0]-a[0], sy = b[1]-a[1];
  const denominator = rx*sy-ry*sx;
  if (Math.abs(denominator) < 1e-14) return false;
  const dx=a[0]-p.lng, dy=a[1]-p.lat;
  const t=(dx*sy-dy*sx)/denominator, u=(dx*ry-dy*rx)/denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};
// Segment intersections detect intervening states even when neither endpoint is inside.
// Cartographic boundaries are generalized: this is a pricing aid, not clearance routing.
export function resolveRouteStates(points = []) {
  const valid = points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
  const states = [];
  for (const state of boundaries) {
    const [minX,minY,maxX,maxY] = state.bbox;
    let hit = valid.some((p) => p.lng>=minX && p.lng<=maxX && p.lat>=minY && p.lat<=maxY && inside(p,state.rings));
    for (let i=1; !hit && i<valid.length; i++) {
      const p=valid[i-1],q=valid[i];
      if (Math.max(p.lng,q.lng)<minX || Math.min(p.lng,q.lng)>maxX || Math.max(p.lat,q.lat)<minY || Math.min(p.lat,q.lat)>maxY) continue;
      hit = state.rings.some((ring) => ring.some((a,j) => {
        const b=ring[(j+1)%ring.length];
        if (Math.max(a[0],b[0])<Math.min(p.lng,q.lng) || Math.min(a[0],b[0])>Math.max(p.lng,q.lng) || Math.max(a[1],b[1])<Math.min(p.lat,q.lat) || Math.min(a[1],b[1])>Math.max(p.lat,q.lat)) return false;
        return crosses(p,q,a,b);
      }));
    }
    if (hit) states.push(state.code);
  }
  return states.sort();
}

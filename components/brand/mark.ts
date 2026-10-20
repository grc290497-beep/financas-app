// The Finanças mark: two interlocked brass rings (euro and real) on an
// emerald tile with a brass hairline. One SVG source for the UI logo and the
// generated app icons (app/icon.tsx), so they can never drift apart.

const EMERALD = ["#0b3328", "#1a5642"];
const BRASS = ["#f1dfa6", "#c9a65a", "#8a6a2c", "#c9a65a"];

export function markSvg({ rounded = true, inset = 0 }: { rounded?: boolean; inset?: number } = {}) {
  // `inset` shrinks the rings toward the centre (maskable icons need a safe zone).
  const s = 1 - inset;
  const t = (v: number) => (24 + (v - 24) * s).toFixed(2);
  const r = (9.5 * s).toFixed(2);
  const w = (3.2 * s).toFixed(2);
  const gap = (4.8 * s).toFixed(2);
  // The left ring passes over the right one at the top crossing: the right ring
  // is masked out along the left ring's path inside a small box there.
  const clip = { x: t(21), y: t(11.5), size: (6.5 * s).toFixed(2), h: (8.5 * s).toFixed(2) };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<defs>
<linearGradient id="e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${EMERALD[0]}"/><stop offset="1" stop-color="${EMERALD[1]}"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRASS[0]}"/><stop offset=".45" stop-color="${BRASS[1]}"/><stop offset=".72" stop-color="${BRASS[2]}"/><stop offset="1" stop-color="${BRASS[3]}"/></linearGradient>
<radialGradient id="g" cx="0" cy="0" r="1.1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="c"><rect x="${clip.x}" y="${clip.y}" width="${clip.size}" height="${clip.h}"/></clipPath>
<mask id="m"><rect width="48" height="48" fill="#fff"/><g clip-path="url(#c)"><circle cx="${t(18.75)}" cy="24" r="${r}" fill="none" stroke="#000" stroke-width="${gap}"/></g></mask>
</defs>
<rect width="48" height="48" rx="${rounded ? 12 : 0}" fill="url(#e)"/>
<rect width="48" height="48" rx="${rounded ? 12 : 0}" fill="url(#g)"/>
${rounded ? `<rect x=".75" y=".75" width="46.5" height="46.5" rx="11.25" fill="none" stroke="#e2c47f" stroke-opacity=".7" stroke-width="1"/>` : ""}
<g fill="none">
<circle cx="${t(18.75)}" cy="24" r="${r}" stroke="url(#b)" stroke-width="${w}"/>
<circle cx="${t(29.25)}" cy="24" r="${r}" stroke="url(#b)" stroke-width="${w}" mask="url(#m)"/>
</g>
</svg>`;
}

export function markDataUri(options?: Parameters<typeof markSvg>[0]) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg(options))}`;
}

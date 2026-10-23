/**
 * A thin line of the month's balance on the hero card. Decorative: the figure
 * above it carries the number, so it is hidden from screen readers.
 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 300;
  const h = 48;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 4 - ((v - min) / span) * (h - 8),
  ]);
  const line = points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-12 w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id="hero-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brass-light)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brass-light)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#hero-spark)" />
      <path
        d={line}
        fill="none"
        stroke="var(--brass-light)"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="draw-line"
      />
    </svg>
  );
}

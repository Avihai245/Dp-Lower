/** A ring that fills with the percentage (decorative: the same number is always written next to it). */
export function ProgressRing({ percent, size = 132, stroke = 10, tone = 'dark' }: { percent: number; size?: number; stroke?: number; tone?: 'dark' | 'light' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg className="ui-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone === 'dark' ? 'rgba(255,255,255,0.14)' : 'var(--ui-paper-2)'} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ui-ring-gold)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="ui-ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6b47a" />
          <stop offset="1" stopColor="#a07a3c" />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={tone === 'dark' ? '#fff' : 'var(--ui-ink)'}
        style={{ fontFamily: 'var(--font-serif)', fontSize: size * 0.26 }}
      >
        {p}%
      </text>
    </svg>
  );
}

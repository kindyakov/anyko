const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];
const relative = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatRelative(value: string, now = Date.now()) {
  const seconds = (new Date(value).getTime() - now) / 1000;
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit);
  return 'только что';
}

/** Relative time with the exact moment available on hover and to assistive tech. */
export function RelativeTime({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const exact = absolute.format(new Date(value));
  return (
    <time
      dateTime={value}
      title={exact}
      className={className}
      suppressHydrationWarning
    >
      {formatRelative(value)}
    </time>
  );
}

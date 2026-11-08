export function OrbitLoader({
  label = 'Загрузка',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <span
      role="status"
      className={
        compact
          ? 'inline-flex items-center gap-3'
          : 'flex flex-col items-center gap-5 py-12'
      }
    >
      <span
        aria-hidden
        className={`relative inline-grid shrink-0 place-items-center ${compact ? 'size-5' : 'size-14'}`}
      >
        <span className="absolute inset-0 rounded-full border border-rose-400/25 bg-black shadow-[0_0_20px_#db143c30]" />
        <span className="border-r-brand absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-rose-400 motion-reduce:animate-none" />
        <span className="absolute inset-x-[-20%] top-[42%] h-1/4 -rotate-25 rounded-[50%] border border-rose-400/80 shadow-[0_0_8px_#db143c80]" />
      </span>
      <span className={compact ? 'sr-only' : 'text-muted text-sm'}>
        {label}
      </span>
    </span>
  );
}

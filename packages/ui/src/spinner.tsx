/** A tiny singularity: a black core with a rotating crimson accretion arc. */
export function Spinner({
  className = 'size-4',
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-hidden={label ? undefined : true}
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
    >
      <span className="animate-orbit absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_120deg,#ff3b62_300deg,#fff_355deg,transparent_360deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]" />
      <span className="size-[42%] rounded-full bg-black shadow-[0_0_0_1px_#ff3b6255,0_0_8px_#db143c]" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

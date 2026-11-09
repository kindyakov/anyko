export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`animate-shimmer block rounded-lg bg-[linear-gradient(90deg,#ffffff08_0%,#ffffff14_40%,#db143c1f_50%,#ffffff14_60%,#ffffff08_100%)] bg-size-[250%_100%] ${className}`}
    />
  );
}

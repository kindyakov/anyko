/**
 * CSS black hole used as the product's "absorbing" emblem. The tilted accretion
 * disk shares a 3D context with the core, so the core hides its far half.
 */
export function EventHorizon({
  state = 'idle',
  className = 'size-40',
}: {
  state?: 'idle' | 'active' | 'hungry' | 'calm';
  className?: string;
}) {
  const speed =
    state === 'hungry'
      ? '[animation-duration:1.2s]'
      : state === 'active'
        ? '[animation-duration:3s]'
        : state === 'calm'
          ? '[animation-duration:30s]'
          : '[animation-duration:12s]';
  return (
    <span
      aria-hidden
      data-state={state}
      className={`group/horizon relative inline-block shrink-0 transition-transform duration-500 ease-out [perspective:600px] data-[state=hungry]:scale-115 ${className}`}
    >
      <span className="animate-horizon absolute -inset-1/3 rounded-full bg-[radial-gradient(closest-side,#db143c70,#db143c22_55%,transparent)] blur-md group-data-[state=calm]/horizon:opacity-40 group-data-[state=hungry]/horizon:bg-[radial-gradient(closest-side,#ff3b62aa,#db143c44_55%,transparent)]" />
      <span className="absolute inset-0 [transform-style:preserve-3d]">
        <span className="absolute inset-[2%] [transform:rotateX(76deg)_rotateY(-8deg)] [transform-style:preserve-3d]">
          <span
            className={`animate-spin-slow absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#ff3b62,#7a0a22,#ff8aa3,#db143c,#3d0612,#ff3b62,#9c0e2c,#ffb3c3,#ff3b62)] [mask:radial-gradient(closest-side,transparent_34%,#000_40%,#000_62%,transparent_100%)] ${speed}`}
          />
          <span
            className={`animate-spin-slow absolute inset-[14%] rounded-full bg-[conic-gradient(from_90deg,transparent,#fff8,transparent_30%,#ff3b62,transparent_60%,#fff6,transparent)] opacity-70 [animation-direction:reverse] [mask:radial-gradient(closest-side,transparent_52%,#000_60%,transparent_100%)] ${speed}`}
          />
        </span>
        <span className="absolute inset-[31%] rounded-full bg-black shadow-[0_0_0_1.5px_#ff6a88cc,0_0_14px_3px_#db143c,inset_0_0_18px_#000] transition-shadow duration-500 group-data-[state=hungry]/horizon:shadow-[0_0_0_2px_#ffd0da,0_0_28px_8px_#ff3b62,inset_0_0_18px_#000]" />
        <span className="absolute inset-[27%] rounded-full border-t-2 border-t-[#ff8aa3]/70 blur-[1.5px]" />
      </span>
    </span>
  );
}

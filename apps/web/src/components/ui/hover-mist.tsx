/**
 * Sparse crimson mist that drifts inside an item while it is hovered or
 * focused. The item must be `group/mist`, positioned and clip its overflow.
 * The drift is paused while hidden, so idle lists cost nothing.
 */
export function HoverMist() {
  const drift =
    'animate-mist absolute rounded-full [animation-play-state:paused] group-hover/mist:[animation-play-state:running] group-focus-within/mist:[animation-play-state:running]';
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 ease-out group-focus-within/mist:opacity-100 group-hover/mist:opacity-100"
    >
      <span
        className={`${drift} -top-2/3 -left-[10%] h-[180%] w-1/2 bg-[radial-gradient(closest-side,#db143c66,#ff6a8826_60%,transparent)] blur-2xl`}
      />
      <span
        className={`${drift} -right-[15%] -bottom-3/4 h-[170%] w-[55%] bg-[radial-gradient(closest-side,#ff8aa340,#db143c22_55%,transparent)] blur-3xl [animation-delay:-4s] [animation-direction:reverse] [animation-duration:15s]`}
      />
      <span
        className={`${drift} top-1/4 left-[35%] h-full w-1/3 bg-[radial-gradient(closest-side,#ff3b6236,transparent)] blur-2xl [animation-delay:-8s] [animation-duration:19s]`}
      />
    </span>
  );
}

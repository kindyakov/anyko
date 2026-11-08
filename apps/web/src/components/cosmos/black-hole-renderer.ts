import { createLensedSky } from '@/components/cosmos/lensed-sky';

// Canvas gas emission over a ray-bent WebGL sky.
export function startBlackHole(
  canvas: HTMLCanvasElement,
  animate: boolean,
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const sky = createLensedSky();
  let frame = 0;
  let previous = 0;
  let time = 0;
  let disposed = false;
  let pointerX = 0;
  let pointerY = 0;
  let offsetX = 0;
  let offsetY = 0;
  function paint() {
    if (!ctx || disposed) return;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, w, h);
    const mobile = w < 1024;
    const r = mobile
      ? Math.min(w * 0.32, h * 0.22)
      : Math.min(h * 0.265, w * 0.165);
    const x = (mobile ? w * 0.43 : w * 0.3) + offsetX * 16;
    const y = (mobile ? h * 0.25 : h * 0.51) + offsetY * 10;
    const renderedSky = sky?.draw(ctx, w, h, x, y, r, time) ?? false;
    canvas.dataset.skyRenderer = renderedSky ? 'webgl' : 'canvas';
    for (let i = 0; !renderedSky && i < 520; i++) {
      const starX = ((((i * 719 + 137) % 997) / 997) * w + time * 0.65) % w;
      const starY = ((((i * 433 + 311) % 991) / 991) * h + time * 0.16) % h;
      const bright = i % 13 === 0;
      const size = bright ? 1.3 : i % 5 === 0 ? 0.85 : 0.5;
      const color = i % 7 < 2 ? '#a8d4ff' : i % 7 < 4 ? '#ffe3a0' : '#f4f7ff';
      const twinkle =
        0.76 + Math.sin(time * (0.35 + (i % 4) * 0.08) + i) * 0.24;
      ctx.shadowColor = color;
      ctx.shadowBlur = bright ? 5 : 0;
      ctx.globalAlpha = (bright ? 0.85 : 0.48) * twinkle;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(starX, starY, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    // A distant, 32px spiral galaxy; subtle independent drift adds depth.
    ctx.save();
    ctx.translate(w * 0.65 + Math.sin(time * 0.025) * 4, h * 0.16);
    ctx.rotate(-0.45);
    ctx.scale(1.6, 1.04);
    ctx.rotate(-time * 0.16);
    const galaxyGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    galaxyGlow.addColorStop(0, '#fff1d5cc');
    galaxyGlow.addColorStop(0.2, '#c9d8ff88');
    galaxyGlow.addColorStop(0.65, '#8c9fd138');
    galaxyGlow.addColorStop(1, '#8c9fd100');
    ctx.fillStyle = galaxyGlow;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.strokeStyle = '#c1d0ef88';
    ctx.lineWidth = 0.8;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let step = 0; step <= 40; step++) {
        const angle = step * 0.13 + arm * Math.PI;
        const radius = 0.7 + step * 0.21;
        const gx = Math.cos(angle) * radius;
        const gy = Math.sin(angle) * radius;
        if (step === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    ctx.restore();
    paintBlackHole(ctx, {
      x,
      y,
      r,
      time,
      tilt: offsetX,
      ship: mobile ? 0.7 : 1,
      quality: 1,
      glow: 1,
    });
    canvas.dataset.ready = 'true';
    canvas.dataset.animated = String(animate);
  }
  function tick(now: number) {
    if (disposed || document.hidden) return;
    frame = requestAnimationFrame(tick);
    if (previous && now - previous < 32) return;
    time += previous ? Math.min((now - previous) / 1000, 0.1) : 0;
    offsetX += (pointerX - offsetX) * 0.065;
    offsetY += (pointerY - offsetY) * 0.065;
    previous = now;
    paint();
  }
  function visibility() {
    cancelAnimationFrame(frame);
    previous = 0;
    if (!document.hidden) {
      paint();
      if (animate) frame = requestAnimationFrame(tick);
    }
  }
  const resize = new ResizeObserver(paint);
  function pointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
  }
  function resetPointer() {
    pointerX = 0;
    pointerY = 0;
  }
  if (animate) {
    window.addEventListener('pointermove', pointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', resetPointer);
    window.addEventListener('blur', resetPointer);
  }
  resize.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  visibility();
  return () => {
    disposed = true;
    sky?.dispose();
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener('pointermove', pointerMove);
    document.documentElement.removeEventListener('pointerleave', resetPointer);
    window.removeEventListener('blur', resetPointer);
    document.removeEventListener('visibilitychange', visibility);
  };
}

export interface HoleFrame {
  x: number;
  y: number;
  /** Shadow radius scale; the disk spans about 2.7r to each side. */
  r: number;
  time: number;
  /** Pointer parallax, -1..1. */
  tilt: number;
  /** Spacecraft scale; 0 hides it. */
  ship: number;
  /** 1 = full detail; smaller emblems need fewer vertices. */
  quality: number;
  /** Multiplier for the halo and silhouette glow. */
  glow: number;
}

/** The accretion disk, lensed light, shadow and orbiting craft. */
export function paintBlackHole(
  ctx: CanvasRenderingContext2D,
  { x, y, r, time, tilt, ship, quality, glow }: HoleFrame,
) {
  const segments = Math.max(96, Math.round(480 * quality));
  const filaments = Math.max(90, Math.round(280 * quality));
  const steps = Math.max(16, Math.round(64 * quality));
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
  halo.addColorStop(
    0,
    `rgba(237,0,59,${String(Math.min(1, (80 / 255) * glow))})`,
  );
  halo.addColorStop(
    0.65,
    `rgba(165,0,40,${String(Math.min(1, (36 / 255) * glow))})`,
  );
  halo.addColorStop(1, 'rgba(8,8,11,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.24 + tilt * 0.025);

  // The disk is inclined; its far side bends into an arch around the shadow.
  // Closed surfaces avoid the visible endpoints of separately stroked arcs.
  function project(radius: number, angle: number): [number, number] {
    radius = 0.74 + (radius - 0.74) * 1.28;
    const depth = Math.sin(angle) * radius * 0.3;
    const perspective = 5 / (5 - depth);
    const px = Math.cos(angle) * radius * r * perspective;
    let py = Math.sin(angle) * radius * r * 0.22 * perspective;
    if (Math.sin(angle) < 0) {
      const arch = r * (0.68 + (radius - 0.74) * 0.27);
      const square = arch * arch - px * px;
      const softness = r * r * 0.23;
      const rounded = Math.sqrt(
        (square + Math.sqrt(square * square + softness * softness)) * 0.5,
      );
      const fade = -Math.sin(angle);
      const bent = -rounded * fade;
      const smoothing = r * 0.28;
      const blend = Math.max(smoothing - Math.abs(py - bent), 0) / smoothing;
      py = Math.min(py, bent) - blend * blend * smoothing * 0.25 * fade;
    }

    return [px, py];
  }
  function annulus(inner: number, outer: number, color: string) {
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const [px, py] = project(outer, (i * Math.PI * 2) / segments);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    for (let i = segments; i >= 0; i--) {
      const [px, py] = project(inner, (i * Math.PI * 2) / segments);
      if (i === segments) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill('evenodd');
  }
  function disk() {
    // Smooth emission underneath advected, turbulent gas filaments.
    for (let band = 47; band >= 0; band--) {
      const distance = band / 47;
      const inner = 0.74 + distance * 1.3;
      const heat = Math.exp(-distance * 3.4);
      const light = 8 + heat * 58;
      const opacity = Math.min(1, (1 - distance) * 5);
      annulus(
        inner,
        inner + 0.032,
        `hsl(348 100% ${String(light)}% / ${String(opacity)})`,
      );
    }
    // Each filament carries its own density pattern around the hole;
    // differential rotation shears the gas instead of rotating rigid rings.
    for (let j = 0; j < filaments; j++) {
      const seed = ((j * 137) % 283) / 283;
      const orbit = 0.78 + seed * 1.22;
      const head = time * (1.8 / Math.pow(orbit, 1.8)) + j * 2.39996;
      const length = 0.18 + (((j * 31) % 97) / 97) * 1.1;
      ctx.beginPath();
      for (const side of [1, -1]) {
        for (let k = 0; k <= steps; k++) {
          const progress = side === 1 ? k / steps : 1 - k / steps;
          const envelope = Math.sin(progress * Math.PI);
          const turbulence =
            Math.sin(progress * 9 + j) * 0.007 +
            Math.sin(progress * 17 + j * 2.7) * 0.002;
          const width = envelope * (0.005 + (j % 5) * 0.004);
          const [px, py] = project(
            orbit + envelope * turbulence + side * width,
            head - progress * length,
          );
          if (side === 1 && k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fillStyle =
        j % 4 === 0 ? '#240008' : j % 3 === 0 ? '#ffb3a8' : '#ff5265';
      ctx.globalAlpha =
        (j % 4 === 0 ? 0.3 : 0.5) * Math.exp(-(orbit - 0.8) * 1.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // The craft orbits inside the disk and is projected exactly like its gas:
  // on the far side its light is lensed over the shadow along the same arch,
  // so it is never hidden behind the hole.
  const shipAngle = time * 0.23 + 0.9;
  function drawSpacecraft() {
    const orbit = 1.5;
    const span = (0.74 + (orbit - 0.74) * 1.28) * r;
    const [sx, sy] = project(orbit, shipAngle);
    const [nx, ny] = project(orbit, shipAngle + 0.01);
    const perspective = 5 / (5 - Math.sin(shipAngle) * (span / r) * 0.3);
    // Heading is the projected tangent; when it turns towards the viewer the
    // hull is foreshortened instead of spinning on the spot.
    const foreshortening = Math.min(
      1,
      Math.max(0.4, Math.hypot(nx - sx, ny - sy) / (span * 0.01)),
    );
    ctx.save();
    ctx.translate(sx, sy - r * 0.03);
    ctx.rotate(Math.atan2(ny - sy, nx - sx));
    ctx.scale(ship * perspective * foreshortening, ship * perspective);
    // Small shuttle silhouette, with the nose tangent to its orbit.
    ctx.shadowColor = '#ffb66d';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffbf78bb';
    ctx.beginPath();
    ctx.moveTo(-5, -1.4);
    ctx.lineTo(-9 - Math.sin(time * 7) * 1.2, 0);
    ctx.lineTo(-5, 1.4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#788aa2';
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dbe2ec';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.quadraticCurveTo(1, -3, -5, -2);
    ctx.lineTo(-5, 2);
    ctx.quadraticCurveTo(1, 3, 7, 0);
    ctx.fill();
    ctx.fillStyle = '#80d7fa';
    ctx.fillRect(1, -1, 2.5, 2);
    ctx.restore();
  }
  // A single luminous silhouette under the sharp rings keeps the glow soft.
  ctx.shadowColor = '#ff003f';
  ctx.shadowBlur = r * 0.18 * glow;
  annulus(0.74, 1.3, '#ff3355');
  ctx.shadowBlur = 0;
  disk();
  // Lensed light wraps below the shadow as a luminous band, not an outline.
  const lens = ctx.createRadialGradient(0, 0, r * 0.705, 0, 0, r * 1.02);
  lens.addColorStop(0, '#ffccd0');
  lens.addColorStop(0.07, '#ff8697');
  lens.addColorStop(0.22, '#f51b4bcc');
  lens.addColorStop(0.5, '#c6003540');
  lens.addColorStop(1, '#b0002800');
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
  ctx.fill();
  // A black-hole shadow stays circular; only the accretion plane is inclined.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#010102';
  ctx.fill();
  // Redraw the exact same disk in front, clipped at its plane. The disk's
  // inner edge lies outside the shadow at the clip boundary, avoiding notches.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-r * 3, 0, r * 6, r * 3);
  ctx.clip();
  disk();
  ctx.restore();
  // Both the near pass and the lensed far image lie in front of the shadow.
  if (ship) drawSpacecraft();
  ctx.restore();
}

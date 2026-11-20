/** Bake the fine structure once; only rotation and the beacon change per frame. */
export function createGalaxyRenderer() {
  const texture = document.createElement('canvas');
  texture.width = texture.height = 384;
  const ink = texture.getContext('2d');
  if (!ink) return null;
  ink.translate(192, 192);
  let seed = 7261;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const glow = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
  ) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  glow(ink, 0, 0, 175, '#7c9ad538');
  glow(ink, 0, 0, 100, '#b7bedb25');
  ink.globalCompositeOperation = 'lighter';
  // Broad starlight, small blue clusters and rose-coloured emission knots.
  for (let i = 0; i < 3000; i++) {
    const t = random();
    const arm = i % 2;
    const angle = arm * Math.PI + t * 5.4;
    const spread = (random() + random() - 1) * (22 + t * 32);
    const radius = 9 + t * 146;
    const x = Math.cos(angle) * radius + Math.cos(angle + 1.1) * spread;
    const y = Math.sin(angle) * radius + Math.sin(angle + 1.1) * spread;
    const knot = i % 29 === 0;
    ink.globalAlpha = (0.18 + random() * 0.35) * (1 - t * 0.65);
    glow(
      ink,
      x,
      y,
      knot ? 4 : 8 + random() * 14,
      knot ? '#ff9bbd9c' : '#a9caff45',
    );
  }
  // Broken dust lanes trace the inside of the arms, rather than solid rings.
  ink.globalCompositeOperation = 'source-over';
  ink.globalAlpha = 0.45;
  ink.strokeStyle = '#101321';
  ink.lineCap = 'round';
  for (let arm = 0; arm < 2; arm++) {
    for (let segment = 0; segment < 5; segment++) {
      ink.beginPath();
      ink.lineWidth = 1.5 + segment * 0.45;
      for (let step = 0; step <= 28; step++) {
        const t = 0.16 + segment * 0.15 + (step / 28) * 0.12;
        const angle = arm * Math.PI + t * 5.4 - 0.07;
        const radius = 9 + t * 146;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (step === 0) ink.moveTo(x, y);
        else ink.lineTo(x, y);
      }
      ink.stroke();
    }
  }
  ink.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 700; i++) {
    const t = random();
    const angle =
      (i % 2) * Math.PI + t * 5.4 + (random() + random() - 1) * 0.65;
    const radius = 10 + t * 143;
    ink.globalAlpha = (0.2 + random() * 0.65) * (1 - t * 0.5);
    ink.fillStyle = i % 4 === 0 ? '#ffe6bb' : '#dbeaff';
    ink.beginPath();
    ink.arc(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.35 + random() * 0.85,
      0,
      Math.PI * 2,
    );
    ink.fill();
  }
  // A sparse inter-arm population fills the disc without flattening its spiral.
  for (let i = 0; i < 450; i++) {
    const radius = 18 + Math.sqrt(random()) * 137;
    const angle = random() * Math.PI * 2;
    const spiralAngle = ((radius - 9) / 146) * 5.4;
    const betweenArms = 1 - Math.abs(Math.cos(angle - spiralAngle));
    ink.globalAlpha =
      (0.25 + random() * 0.3) *
      (0.35 + betweenArms * 0.65) *
      Math.sqrt(1 - radius / 180);
    glow(
      ink,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      12 + random() * 19,
      i % 5 === 0 ? '#b895bb60' : '#86a9db70',
    );
  }
  for (let i = 0; i < 90; i++) {
    const radius = 20 + Math.sqrt(random()) * 130;
    const angle = random() * Math.PI * 2;
    ink.globalAlpha = (0.4 + random() * 0.5) * (1 - radius / 240);
    ink.fillStyle = i % 3 === 0 ? '#ffe2b1' : '#c9dfff';
    ink.beginPath();
    ink.arc(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      1 + random() * 1.1,
      0,
      Math.PI * 2,
    );
    ink.fill();
  }
  ink.globalAlpha = 1;
  glow(ink, 0, 0, 55, '#ffdba899');
  glow(ink, 0, 0, 20, '#fff0cfcc');
  glow(ink, 0, 0, 7, '#fffaf0');

  return (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    time: number,
  ) => {
    // Two smooth flashes every eight seconds, driven by the scene's paused clock.
    const phase = (time + 4) % 8;
    const flash = (start: number, duration: number) => {
      const progress = (phase - start) / duration;
      return progress > 0 && progress < 1
        ? Math.sin(progress * Math.PI) ** 2
        : 0;
    };
    const signal = flash(0, 0.65) + flash(0.95, 0.8) * 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(-0.45);
    ctx.scale(1, 0.66);
    ctx.rotate(-time * 0.16);
    ctx.globalAlpha = 0.85 + signal * 0.15;
    ctx.drawImage(texture, -radius, -radius, radius * 2, radius * 2);
    ctx.globalAlpha = signal * 0.8;
    glow(ctx, 0, 0, radius * 0.7, '#bedaff70');
    glow(ctx, 0, 0, radius * 0.16, '#fff6e6');
    if (phase < 2.2) {
      const travel = phase / 2.2;
      ctx.globalAlpha = Math.sin(travel * Math.PI) * (1 - travel) * 0.24;
      ctx.strokeStyle = '#b8d8ff';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.18 + travel * 0.95), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };
}

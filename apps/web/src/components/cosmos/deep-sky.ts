// A deterministic deep-space "exposure": emission gas with dust lanes, a dense
// field of faint stars coloured by temperature and distant galaxies as soft
// smudges. The seed is fixed so the sky is the same place on every visit.

type Rgb = readonly [number, number, number];
type Random = () => number;
type Noise = (x: number, y: number, octaves?: number) => number;

export interface TwinklingStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: Rgb;
  speed: number;
  phase: number;
}

function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: Random) {
  return (random() + random() + random() + random() - 2) / 2;
}

function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function rgba([r, g, b]: Rgb, alpha: number) {
  return `rgba(${String(r)},${String(g)},${String(b)},${String(alpha)})`;
}

// Blackbody tints from cool K stars through the Sun to hot B stars.
const spectrum: readonly (readonly [number, Rgb])[] = [
  [0.12, [255, 196, 140]],
  [0.2, [255, 226, 178]],
  [0.24, [255, 244, 230]],
  [0.2, [244, 246, 255]],
  [0.14, [210, 224, 255]],
  [0.1, [178, 202, 255]],
];

function starColor(random: Random): Rgb {
  let pick = random();
  for (const [weight, color] of spectrum) {
    if (pick < weight) return color;
    pick -= weight;
  }
  return [255, 255, 255];
}

function valueNoise(random: Random): Noise {
  const size = 256;
  const lattice = Float32Array.from({ length: size * size }, () => random());
  const at = (x: number, y: number) =>
    lattice[(y & (size - 1)) * size + (x & (size - 1))] ?? 0;
  const sample = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return top + (bottom - top) * sy;
  };
  return (x, y, octaves = 5) => {
    let total = 0,
      amplitude = 0.5,
      frequency = 1,
      norm = 0;
    for (let octave = 0; octave < octaves; octave++) {
      total += sample(x * frequency, y * frequency) * amplitude;
      norm += amplitude;
      amplitude *= 0.52;
      frequency *= 2.07;
    }
    return total / norm;
  };
}

interface Field {
  width: number;
  height: number;
  gas: Noise;
  warp: Noise;
  dust: Noise;
}

/** 0 = clear sky, 1 = fully behind a dark dust lane. */
function obscured(field: Field, px: number, py: number) {
  const x = (px / field.height) * 3.1,
    y = (py / field.height) * 3.1;
  return smoothstep(0.5, 0.74, field.dust(x, y, 5));
}

interface Cloud {
  x: number;
  y: number;
  rx: number;
  ry: number;
  core: Rgb;
  edge: Rgb;
  strength: number;
}

// Hydrogen-alpha crimson dominates, with a cooler oxygen-blue veil and a
// reflection-violet patch so the frame does not read as one flat colour.
const clouds: Cloud[] = [
  {
    x: 0.86,
    y: 0.08,
    rx: 0.46,
    ry: 0.4,
    core: [255, 92, 118],
    edge: [150, 26, 62],
    strength: 1,
  },
  {
    x: 0.1,
    y: 0.95,
    rx: 0.42,
    ry: 0.34,
    core: [170, 104, 210],
    edge: [80, 30, 110],
    strength: 0.75,
  },
  {
    x: 0.02,
    y: 0.32,
    rx: 0.24,
    ry: 0.32,
    core: [96, 150, 200],
    edge: [30, 60, 110],
    strength: 0.5,
  },
  {
    x: 0.6,
    y: 0.62,
    rx: 0.34,
    ry: 0.2,
    core: [230, 60, 90],
    edge: [90, 20, 50],
    strength: 0.4,
  },
];

function bandDistance(x: number, y: number, aspect: number) {
  const dx = aspect,
    dy = -0.85;
  return Math.abs(dy * x - dx * (y - 0.95)) / Math.hypot(dx, dy);
}

function paintGas(ctx: CanvasRenderingContext2D, field: Field) {
  const { width, height } = field;
  const columns = Math.min(560, Math.max(200, Math.round(width / 3.4)));
  const rows = Math.max(110, Math.round((columns * height) / width));
  const surface = document.createElement('canvas');
  surface.width = columns;
  surface.height = rows;
  const surfaceCtx = surface.getContext('2d');
  if (!surfaceCtx) return;
  const image = surfaceCtx.createImageData(columns, rows);
  const aspect = width / height;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const v = row / rows,
        u = column / columns,
        x = u * aspect;
      const qx = field.warp(x * 1.5, v * 1.5, 4),
        qy = field.warp(x * 1.5 + 5.2, v * 1.5 + 1.3, 4);
      const gas = field.gas(x * 2.6 + qx * 2.4, v * 2.6 + qy * 2.4, 7);
      const emission = smoothstep(0.36, 0.9, gas) ** 1.7;
      const lane = smoothstep(0.5, 0.74, field.dust(x * 3.1, v * 3.1, 5));
      const veil = 1 - lane * 0.9;
      let r = 0,
        g = 0,
        b = 0;
      for (const cloud of clouds) {
        const dx = (u - cloud.x) / cloud.rx,
          dy = (v - cloud.y) / cloud.ry;
        const amount =
          Math.exp(-(dx * dx + dy * dy)) *
          cloud.strength *
          (0.07 + emission * 1.35) *
          veil;
        const mix = smoothstep(0.45, 0.85, gas);
        r += amount * (cloud.edge[0] + (cloud.core[0] - cloud.edge[0]) * mix);
        g += amount * (cloud.edge[1] + (cloud.core[1] - cloud.edge[1]) * mix);
        b += amount * (cloud.edge[2] + (cloud.core[2] - cloud.edge[2]) * mix);
      }
      // Unresolved starlight of the galactic band, torn by the same dust.
      const band = Math.exp(-((bandDistance(x, v, aspect) / 0.2) ** 2));
      const glow = band * (0.4 + gas * 0.8) * (1 - lane * 0.97) * 26;
      r += glow;
      g += glow * 0.9;
      b += glow * 0.86;
      // Filmic response keeps bright gas from clipping into flat colour.
      const index = (row * columns + column) * 4;
      image.data[index] = 105 * (1 - Math.exp(-r / 170));
      image.data[index + 1] = 105 * (1 - Math.exp(-g / 170));
      image.data[index + 2] = 105 * (1 - Math.exp(-b / 170));
      image.data[index + 3] = 255;
    }
  }
  surfaceCtx.putImageData(image, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(surface, 0, 0, width, height);
  ctx.restore();
}

function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: Rgb,
  alpha: number,
) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, rgba(color, alpha));
  glow.addColorStop(0.4, rgba(color, alpha * 0.35));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// A spiral seen at a distance: diffuse arms built from soft light, a warm
// bulge and a few pink star-forming knots. No hard dots.
function paintSpiral(
  ctx: CanvasRenderingContext2D,
  random: Random,
  x: number,
  y: number,
  radius: number,
  tilt: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, tilt);
  softBlob(ctx, 0, 0, radius, [200, 200, 230], 0.08);
  const puffs = Math.round(radius * 9);
  for (let index = 0; index < puffs; index++) {
    const t = random() ** 0.9;
    const theta =
      (index % 2) * Math.PI + t * Math.PI * 2.4 + gaussian(random) * 0.3;
    const distance = radius * (0.12 + t * 0.85);
    const knot = random() < 0.05;
    softBlob(
      ctx,
      Math.cos(theta) * distance,
      Math.sin(theta) * distance,
      radius * (knot ? 0.025 : 0.06 + random() * 0.05),
      knot ? [255, 140, 170] : [196, 210, 255],
      knot ? 0.35 : (1 - t) * 0.08 + 0.025,
    );
  }
  softBlob(ctx, 0, 0, radius * 0.28, [255, 226, 186], 0.32);
  softBlob(ctx, 0, 0, radius * 0.07, [255, 244, 226], 0.6);
  ctx.restore();
}

function paintSmudge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tilt: number,
  angle: number,
  alpha: number,
  color: Rgb,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, tilt);
  softBlob(ctx, 0, 0, radius, color, alpha);
  ctx.restore();
}

function paintGalaxies(
  ctx: CanvasRenderingContext2D,
  field: Field,
  random: Random,
) {
  const { width, height } = field;
  const unit = Math.min(width, height);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  paintSpiral(ctx, random, width * 0.9, height * 0.8, unit * 0.075, 0.45, -0.5);
  paintSpiral(
    ctx,
    random,
    width * 0.69,
    height * 0.06,
    unit * 0.028,
    0.55,
    0.9,
  );
  // Deep-field background: tiny warm ellipticals and edge-on discs.
  for (let index = 0; index < 18; index++) {
    const px = random() * width,
      py = random() * height;
    const visible = 1 - obscured(field, px, py) * 0.9;
    paintSmudge(
      ctx,
      px,
      py,
      unit * (0.003 + random() ** 2 * 0.009),
      0.25 + random() * 0.6,
      random() * Math.PI,
      (0.14 + random() * 0.2) * visible,
      random() < 0.7 ? [255, 222, 180] : [205, 215, 255],
    );
  }
  ctx.restore();
}

function placeStar(random: Random, width: number, height: number) {
  if (random() < 0.55) return [random() * width, random() * height] as const;
  const t = random();
  const spread = gaussian(random) * height * 0.16;
  const nx = 0.85 * height,
    ny = width;
  const norm = Math.hypot(nx, ny);
  return [
    t * width + (nx / norm) * spread,
    height * (0.95 - 0.85 * t) + (ny / norm) * spread,
  ] as const;
}

// A star is a point spread function: a tight core and a soft seeing halo.
function paintStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: Rgb,
) {
  softBlob(ctx, x, y, radius * 3.2, color, alpha * 0.22);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.75, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints the static sky and returns the few stars that should twinkle. */
export function paintDeepSky(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): TwinklingStar[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const random = seeded(0x41_6e_79_6b);
  const field: Field = {
    width,
    height,
    gas: valueNoise(random),
    warp: valueNoise(random),
    dust: valueNoise(random),
  };
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, width, height);
  paintGas(ctx, field);
  paintGalaxies(ctx, field, random);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Unresolved background: thousands of barely visible points.
  const faint = Math.round((width * height) / 260);
  for (let index = 0; index < faint; index++) {
    const [x, y] = placeStar(random, width, height);
    const alpha = (0.05 + random() ** 2 * 0.28) * (1 - obscured(field, x, y));
    if (alpha < 0.02) continue;
    ctx.fillStyle = rgba(starColor(random), alpha);
    const size = 0.5 + random() * 0.5;
    ctx.fillRect(x, y, size, size);
  }
  // Resolved foreground stars.
  const twinkling: TwinklingStar[] = [];
  const bright = Math.round((width * height) / 5200);
  for (let index = 0; index < bright; index++) {
    const [x, y] = placeStar(random, width, height);
    const magnitude = random() ** 4;
    const radius = 0.55 + magnitude * 1.15;
    const alpha =
      (0.3 + Math.sqrt(magnitude) * 0.62) * (1 - obscured(field, x, y) * 0.8);
    const color = starColor(random);
    if (magnitude > 0.12 && random() < 0.1) {
      twinkling.push({
        x,
        y,
        radius,
        alpha,
        color,
        speed: 0.5 + random() * 0.9,
        phase: random() * Math.PI * 2,
      });
      continue;
    }
    paintStar(ctx, x, y, radius, alpha, color);
  }
  ctx.restore();
  return twinkling;
}

/** Redraws the twinkling layer for the given time in seconds. */
export function paintTwinkles(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  stars: TwinklingStar[],
  time: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio, 2);
  if (
    canvas.width !== Math.round(width * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (const star of stars) {
    const pulse = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase);
    paintStar(
      ctx,
      star.x,
      star.y,
      star.radius,
      star.alpha * (0.6 + pulse * 0.4),
      star.color,
    );
  }
}

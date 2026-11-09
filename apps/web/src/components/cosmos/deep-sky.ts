// A deterministic deep-space "exposure": emission gas with dust lanes, a dense
// field of faint stars coloured by temperature and distant galaxies. The seed
// is fixed so the sky is the same place on every visit. The still exposure is
// painted once; the parts that live (flowing gas, turning galaxies, twinkling
// stars and meteors) are cheap layers redrawn over it.

type Rgb = readonly [number, number, number];
type Random = () => number;
type Noise = (x: number, y: number, octaves?: number) => number;

interface TwinklingStar {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: Rgb;
  speed: number;
  phase: number;
  /** Bright stars show diffraction spikes and now and then flare up. */
  spikes: boolean;
}

interface Galaxy {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  /** Half the sprite size in CSS pixels. */
  half: number;
  tilt: number;
  angle: number;
  /** Radians per second; negative so the arms trail the rotation. */
  spin: number;
}

interface Field {
  width: number;
  height: number;
  gas: Noise;
  warp: Noise;
  dust: Noise;
}

export interface DeepSky {
  field: Field;
  twinkling: TwinklingStar[];
  galaxies: Galaxy[];
  sprites: Map<Rgb, HTMLCanvasElement>;
}

export interface Meteor {
  born: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  length: number;
  life: number;
}

/** The nebula layers overhang the screen by this many CSS pixels to drift. */
const nebulaMargin = 24;

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

function pixelRatio() {
  return Math.min(window.devicePixelRatio, 2);
}

function fit(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = pixelRatio();
  const w = Math.round(width * dpr),
    h = Math.round(height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
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
const white: Rgb = [255, 255, 255];

function starColor(random: Random): Rgb {
  let pick = random();
  for (const [weight, color] of spectrum) {
    if (pick < weight) return color;
    pick -= weight;
  }
  return white;
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

/**
 * Paints the gas into a small opaque canvas that CSS stretches over the
 * screen. `flow` moves the turbulence and brightens emission, so crossfading
 * two states reads as glowing gas slowly churning. Dust lanes stay put to keep
 * hiding the same stars.
 */
export function paintNebula(
  canvas: HTMLCanvasElement,
  sky: DeepSky,
  flow: number,
) {
  const { field } = sky;
  const width = field.width + nebulaMargin * 2,
    height = field.height + nebulaMargin * 2;
  const columns = Math.min(560, Math.max(200, Math.round(width / 3.4)));
  const rows = Math.max(110, Math.round((columns * height) / width));
  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.createImageData(columns, rows);
  const aspect = field.width / field.height;
  const gain = 1 + flow * 0.3;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const v = ((row / rows) * height - nebulaMargin) / field.height,
        u = ((column / columns) * width - nebulaMargin) / field.width,
        x = u * aspect;
      const qx = field.warp(x * 1.5 + flow * 0.24, v * 1.5 - flow * 0.14, 4),
        qy = field.warp(
          x * 1.5 + 5.2 - flow * 0.17,
          v * 1.5 + 1.3 + flow * 0.2,
          4,
        );
      const gas = field.gas(x * 2.6 + qx * 2.4, v * 2.6 + qy * 2.4, 7);
      const emission = smoothstep(0.36, 0.9, gas) ** 1.7 * gain;
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
      // Filmic response over the #060608 canvas keeps bright gas from
      // clipping into flat colour.
      const index = (row * columns + column) * 4;
      image.data[index] = 6 + 105 * (1 - Math.exp(-r / 170));
      image.data[index + 1] = 6 + 105 * (1 - Math.exp(-g / 170));
      image.data[index + 2] = 8 + 105 * (1 - Math.exp(-b / 170));
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
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

// A face-on spiral seen at a distance: diffuse arms built from soft light, a
// warm bulge and a few pink star-forming knots. Tilt and rotation are applied
// when the sprite is drawn, so the galaxy can turn in its own plane.
function spiralSprite(random: Random, radius: number) {
  const dpr = pixelRatio();
  const half = radius * 1.15;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = Math.ceil(half * 2 * dpr);
  const ctx = sprite.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, half * dpr, half * dpr);
    ctx.globalCompositeOperation = 'lighter';
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
  }
  return { sprite, half };
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

function createGalaxies(
  ctx: CanvasRenderingContext2D,
  field: Field,
  random: Random,
): Galaxy[] {
  const { width, height } = field;
  const unit = Math.min(width, height);
  const large = spiralSprite(random, unit * 0.075);
  const small = spiralSprite(random, unit * 0.028);
  const galaxies: Galaxy[] = [
    {
      ...large,
      x: width * 0.9,
      y: height * 0.8,
      tilt: 0.45,
      angle: -0.5,
      spin: -0.035,
    },
    {
      ...small,
      x: width * 0.69,
      y: height * 0.06,
      tilt: 0.55,
      angle: 0.9,
      spin: -0.06,
    },
  ];
  // Deep-field background: tiny warm ellipticals and edge-on discs.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
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
  return galaxies;
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

// Twinkling stars are stamped from one pre-rendered sprite per colour.
const spriteRadius = 8;
const spriteHalf = spriteRadius * 3.2;

function starSprites() {
  const sprites = new Map<Rgb, HTMLCanvasElement>();
  for (const color of [...spectrum.map(([, tint]) => tint), white]) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = spriteHalf * 2;
    const ctx = sprite.getContext('2d');
    if (ctx) paintStar(ctx, spriteHalf, spriteHalf, spriteRadius, 1, color);
    sprites.set(color, sprite);
  }
  return sprites;
}

/** Paints the still stars and returns the scene for the living layers. */
export function paintDeepSky(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): DeepSky {
  const random = seeded(0x41_6e_79_6b);
  const field: Field = {
    width,
    height,
    gas: valueNoise(random),
    warp: valueNoise(random),
    dust: valueNoise(random),
  };
  const sky: DeepSky = {
    field,
    twinkling: [],
    galaxies: [],
    sprites: starSprites(),
  };
  const ctx = fit(canvas, width, height);
  if (!ctx) return sky;
  ctx.clearRect(0, 0, width, height);
  sky.galaxies = createGalaxies(ctx, field, random);

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
  // Resolved foreground stars; about a third of them scintillate.
  const bright = Math.round((width * height) / 5200);
  for (let index = 0; index < bright; index++) {
    const [x, y] = placeStar(random, width, height);
    const magnitude = random() ** 4;
    const radius = 0.55 + magnitude * 1.15;
    const alpha =
      (0.3 + Math.sqrt(magnitude) * 0.62) * (1 - obscured(field, x, y) * 0.8);
    const color = starColor(random);
    if (random() < 0.34) {
      sky.twinkling.push({
        x,
        y,
        radius,
        alpha,
        color,
        speed: 0.7 + random() * 1.6,
        phase: random() * Math.PI * 2,
        spikes: magnitude > 0.35 && alpha > 0.5,
      });
      continue;
    }
    paintStar(ctx, x, y, radius, alpha, color);
  }
  ctx.restore();
  return sky;
}

/** A meteor somewhere in the upper sky, sliding down to the left or right. */
export function launchMeteor(
  width: number,
  height: number,
  time: number,
): Meteor {
  const angle =
    (Math.random() < 0.5 ? 0.45 : Math.PI - 0.45) +
    (Math.random() - 0.5) * 0.35;
  return {
    born: time,
    x: width * (0.15 + Math.random() * 0.7),
    y: height * Math.random() * 0.45,
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    speed: 520 + Math.random() * 420,
    length: 110 + Math.random() * 150,
    life: 0.7 + Math.random() * 0.6,
  };
}

function paintMeteor(
  ctx: CanvasRenderingContext2D,
  meteor: Meteor,
  time: number,
) {
  const age = time - meteor.born;
  if (age < 0 || age > meteor.life) return;
  const progress = age / meteor.life;
  // Flares up fast as it hits the air and burns out more slowly.
  const light = Math.min(1, progress * 6) * (1 - progress) ** 0.7;
  const travelled = meteor.speed * age;
  const tail = Math.min(meteor.length, travelled);
  const hx = meteor.x + meteor.dx * travelled,
    hy = meteor.y + meteor.dy * travelled;
  const ex = hx - meteor.dx * tail,
    ey = hy - meteor.dy * tail;
  ctx.lineCap = 'round';
  // A wide crimson afterglow under a hot, thin core.
  for (const [lineWidth, strength] of [
    [6, 0.35],
    [1.8, 1],
  ] as const) {
    const trail = ctx.createLinearGradient(hx, hy, ex, ey);
    trail.addColorStop(0, `rgba(255,244,240,${String(light * strength)})`);
    trail.addColorStop(
      0.25,
      `rgba(255,110,140,${String(light * strength * 0.7)})`,
    );
    trail.addColorStop(1, 'rgba(219,20,60,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  softBlob(ctx, hx, hy, 12, [255, 214, 222], light);
}

function paintSpikes(
  ctx: CanvasRenderingContext2D,
  star: TwinklingStar,
  length: number,
  alpha: number,
) {
  const glow = rgba(star.color, alpha);
  const fade = rgba(star.color, 0);
  ctx.lineWidth = 0.7;
  for (const [dx, dy] of [
    [length, 0],
    [0, length],
  ] as const) {
    const ray = ctx.createLinearGradient(
      star.x - dx,
      star.y - dy,
      star.x + dx,
      star.y + dy,
    );
    ray.addColorStop(0, fade);
    ray.addColorStop(0.5, glow);
    ray.addColorStop(1, fade);
    ctx.strokeStyle = ray;
    ctx.beginPath();
    ctx.moveTo(star.x - dx, star.y - dy);
    ctx.lineTo(star.x + dx, star.y + dy);
    ctx.stroke();
  }
}

/** Redraws the living layer: galaxies, scintillating stars and a meteor. */
export function paintSkyMotion(
  canvas: HTMLCanvasElement,
  sky: DeepSky,
  time: number,
  meteor?: Meteor,
) {
  const { width, height } = sky.field;
  const ctx = fit(canvas, width, height);
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (const galaxy of sky.galaxies) {
    ctx.save();
    ctx.translate(galaxy.x, galaxy.y);
    ctx.rotate(galaxy.angle);
    ctx.scale(1, galaxy.tilt);
    ctx.rotate(time * galaxy.spin);
    ctx.drawImage(
      galaxy.sprite,
      -galaxy.half,
      -galaxy.half,
      galaxy.half * 2,
      galaxy.half * 2,
    );
    ctx.restore();
  }
  for (const star of sky.twinkling) {
    // Two incommensurate waves make the scintillation irregular; a rare
    // narrow peak makes bright stars flare for a few seconds.
    const slow = Math.sin(time * star.speed + star.phase);
    const quick = Math.sin(time * star.speed * 3.3 + star.phase * 1.7);
    const flare = star.spikes
      ? Math.max(0, Math.sin(time * 0.07 * star.speed + star.phase * 2.3)) ** 40
      : 0;
    const level = 0.52 + slow * 0.3 + quick * 0.16 + flare * 0.7;
    const size = (star.radius / spriteRadius) * (0.8 + level * 0.3 + flare);
    const sprite = sky.sprites.get(star.color);
    if (!sprite) continue;
    ctx.globalAlpha = Math.min(1, star.alpha * level);
    ctx.drawImage(
      sprite,
      star.x - spriteHalf * size,
      star.y - spriteHalf * size,
      spriteHalf * 2 * size,
      spriteHalf * 2 * size,
    );
    ctx.globalAlpha = 1;
    if (star.spikes && level > 0.5) {
      paintSpikes(
        ctx,
        star,
        star.radius * (5 + flare * 12),
        Math.min(0.8, (level - 0.5) * star.alpha * 0.9),
      );
    }
  }
  if (meteor) paintMeteor(ctx, meteor, time);
}

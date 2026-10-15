/**
 * The dusk street, drawn with simple shapes (no image files).
 * Layers from back to front: distant mountains, far + mid buildings
 * (parallax), street-side buildings and trees, the sidewalk, the puddle,
 * the water channel with its stepping stone, and the destination house.
 */
import * as Phaser from 'phaser';
import { CHANNEL, DOOR, GROUND_SEGMENTS, GROUND_Y, PUDDLE, STONE, WORLD_W } from './levelLayout';

export const PALETTE = {
  mountain: 0xd7b3bd,
  mountainSnow: 0xf3e2df,
  far: 0xaab0c4,
  farWindow: 0xf6d98f,
  mid: 0x8c94ab,
  midWindow: 0xf7d27c,
  near: [0x737c93, 0x6b748b, 0x7a8299] as const,
  nearTrim: 0x5d6579,
  window: 0xf7d27c,
  windowDark: 0x5c6479,
  windowFrame: 0x515a6e,
  treeTrunk: 0x6e5e5c,
  tree: [0x8a9a8c, 0x7e8f84, 0x95a596] as const,
  sidewalk: 0xb9a49d,
  curb: 0xd6c4bb,
  street: 0x92818a,
  tileLine: 0xa8948e,
  water: 0x8fb3cf,
  waterLight: 0xc4dced,
  channelWall: 0x7c6b73,
  stone: 0xa39390,
  stoneTop: 0xc6b7b1,
  house: 0x9a8798,
  houseTrim: 0x7f6d80,
  door: 0x8b5e4a,
  doorFrame: 0x6b463a,
  brass: 0xe8c36a,
} as const;

const rngFor = (seed: string) => new Phaser.Math.RandomDataGenerator([seed]);

/** Low dusk sun, a crescent moon and a few slow clouds high in the sky. */
export function drawSky(scene: Phaser.Scene, viewExtent: number): void {
  const sun = scene.add.graphics().setScrollFactor(0.03, 1).setDepth(-60);
  for (let i = 0; i < 6; i++) {
    sun.fillStyle(0xffe9c4, 0.12);
    sun.fillCircle(360, GROUND_Y - 330, 120 - i * 16);
  }
  sun.fillStyle(0xfff1d6, 0.95);
  sun.fillCircle(360, GROUND_Y - 330, 44);

  const moon = scene.add.graphics().setScrollFactor(0.02, 1).setDepth(-60);
  moon.fillStyle(0xfff8ea, 0.9);
  moon.fillCircle(120, GROUND_Y - 560, 16);
  moon.fillStyle(0xd9c1d6, 1);
  moon.fillCircle(128, GROUND_Y - 565, 15);
  const stars = scene.add.graphics().setScrollFactor(0.02, 1).setDepth(-61);
  const srng = rngFor('stars');
  for (let i = 0; i < 26; i++) {
    stars.fillStyle(0xfffbf0, srng.realInRange(0.35, 0.8));
    stars.fillCircle(srng.between(-200, 1400), GROUND_Y - srng.between(470, 900), srng.realInRange(0.8, 1.8));
  }

  const rng = rngFor('clouds');
  for (let i = 0; i < 9; i++) {
    const c = scene.add.graphics().setScrollFactor(0.1, 1).setDepth(-55);
    const w = rng.between(90, 170);
    c.fillStyle(0xfff6f0, rng.realInRange(0.45, 0.7));
    c.fillEllipse(0, 0, w, w * 0.28);
    c.fillEllipse(-w * 0.2, -w * 0.1, w * 0.5, w * 0.3);
    c.fillEllipse(w * 0.15, -w * 0.12, w * 0.45, w * 0.32);
    c.setPosition(rng.between(-200, WORLD_W * 0.1 + viewExtent), GROUND_Y - rng.between(320, 760));
    scene.tweens.add({ targets: c, x: c.x - 120, duration: rng.between(40000, 70000), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** Soft distant mountains (a quiet nod to a city skyline at dusk). */
export function drawMountains(scene: Phaser.Scene, viewExtent: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setScrollFactor(0.06, 1).setDepth(-50);
  const rng = rngFor('mountains');
  const baseY = GROUND_Y - 110;
  g.fillStyle(PALETTE.mountain, 0.75);
  g.beginPath();
  g.moveTo(-600, GROUND_Y);
  let x = -600;
  const peaks: Array<[number, number]> = [];
  while (x < WORLD_W * 0.06 + viewExtent + 600) {
    const h = rng.between(70, 170);
    const w = rng.between(220, 420);
    g.lineTo(x + w / 2, baseY - h);
    peaks.push([x + w / 2, baseY - h]);
    x += w;
    g.lineTo(x, baseY - rng.between(10, 40));
  }
  g.lineTo(x, GROUND_Y);
  g.closePath();
  g.fillPath();
  // snow caps on the tallest peaks
  g.fillStyle(PALETTE.mountainSnow, 0.7);
  peaks
    .filter(([, y]) => y < baseY - 130)
    .forEach(([px, py]) => g.fillTriangle(px, py, px - 22, py + 18, px + 22, py + 18));
  return g;
}

function drawBuildingRow(
  g: Phaser.GameObjects.Graphics,
  rng: Phaser.Math.RandomDataGenerator,
  from: number,
  to: number,
  opts: { minH: number; maxH: number; minW: number; maxW: number; color: number; window: number; lit: number; winSize: number },
) {
  let x = from;
  while (x < to) {
    const w = rng.between(opts.minW, opts.maxW);
    const h = rng.between(opts.minH, opts.maxH);
    const top = GROUND_Y - h;
    g.fillStyle(opts.color, 1);
    g.fillRect(x, top, w, h);
    // rooftop details
    if (rng.frac() < 0.4) g.fillRect(x + w * 0.2, top - 10, w * 0.18, 10);
    // windows
    const cols = Math.max(1, Math.floor((w - 12) / (opts.winSize * 2.2)));
    const rows = Math.max(1, Math.floor((h - 30) / (opts.winSize * 2.4)));
    const gapX = (w - cols * opts.winSize) / (cols + 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.frac() < opts.lit;
        g.fillStyle(lit ? opts.window : 0x5d657a, lit ? 0.95 : 0.35);
        g.fillRect(x + gapX + c * (opts.winSize + gapX), top + 14 + r * opts.winSize * 2.4, opts.winSize, opts.winSize * 1.3);
      }
    }
    x += w + rng.between(0, 10);
  }
}

export function drawFarCity(scene: Phaser.Scene, viewExtent: number): void {
  const far = scene.add.graphics().setScrollFactor(0.25, 1).setDepth(-40);
  drawBuildingRow(far, rngFor('far'), -400, WORLD_W * 0.25 + viewExtent + 400, {
    minH: 170, maxH: 330, minW: 60, maxW: 120, color: PALETTE.far, window: PALETTE.farWindow, lit: 0.35, winSize: 5,
  });
  const mid = scene.add.graphics().setScrollFactor(0.55, 1).setDepth(-30);
  drawBuildingRow(mid, rngFor('mid'), -400, WORLD_W * 0.55 + viewExtent + 400, {
    minH: 130, maxH: 250, minW: 80, maxW: 150, color: PALETTE.mid, window: PALETTE.midWindow, lit: 0.45, winSize: 8,
  });
}

/** Street-side buildings directly behind the sidewalk (scroll with the world). */
export function drawStreetBuildings(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-20);
  const rng = rngFor('street');
  let x = -40;
  let i = 0;
  const stopAt = DOOR.x - 190; // the destination house is drawn separately
  while (x < stopAt) {
    const w = Math.min(rng.between(150, 240), stopAt - x);
    if (w < 60) break;
    const h = rng.between(170, 250);
    const top = GROUND_Y - h;
    const color = PALETTE.near[i % PALETTE.near.length];
    g.fillStyle(color, 1);
    g.fillRect(x, top, w, h);
    // cornice
    g.fillStyle(PALETTE.nearTrim, 1);
    g.fillRect(x - 4, top, w + 8, 8);
    g.fillRect(x, GROUND_Y - 14, w, 14);
    // windows: two floors
    const cols = Math.max(1, Math.floor(w / 62));
    const gap = (w - cols * 30) / (cols + 1);
    for (let floor = 0; floor < 2; floor++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + gap + c * (30 + gap);
        const wy = top + 28 + floor * 70;
        if (wy + 42 > GROUND_Y - 30) continue;
        const lit = rng.frac() < 0.6;
        g.fillStyle(PALETTE.windowFrame, 1);
        g.fillRect(wx - 3, wy - 3, 36, 46);
        if (lit) {
          g.fillStyle(PALETTE.window, 0.25);
          g.fillRect(wx - 7, wy - 7, 44, 54);
        }
        g.fillStyle(lit ? PALETTE.window : PALETTE.windowDark, 1);
        g.fillRect(wx, wy, 30, 40);
        g.fillStyle(PALETTE.windowFrame, 1);
        g.fillRect(wx + 14, wy, 2, 40);
        g.fillRect(wx, wy + 18, 30, 2);
        // small balcony rail on some
        if (rng.frac() < 0.3) {
          g.fillRect(wx - 6, wy + 40, 42, 3);
          for (let b = 0; b < 6; b++) g.fillRect(wx - 4 + b * 8, wy + 34, 2, 7);
        }
      }
    }
    x += w + rng.between(4, 18);
    i++;
  }

  // A few round street trees
  const trees = [520, 1720, 2620, 3560, 4600, 5180];
  trees.forEach((tx, idx) => {
    g.fillStyle(PALETTE.treeTrunk, 1);
    g.fillRect(tx - 5, GROUND_Y - 110, 10, 110);
    const crowns = [
      [0, -140, 44],
      [-30, -118, 32],
      [30, -120, 34],
      [-8, -170, 30],
    ];
    crowns.forEach(([cx, cy, r], ci) => {
      g.fillStyle(PALETTE.tree[(idx + ci) % PALETTE.tree.length], 1);
      g.fillCircle(tx + cx, GROUND_Y + cy, r);
    });
  });
}

/** Sidewalk strips, the puddle, and the water channel with its stone. */
export function drawStreet(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-5);
  for (const [x0, x1] of GROUND_SEGMENTS) {
    const w = x1 - x0;
    g.fillStyle(PALETTE.street, 1);
    g.fillRect(x0, GROUND_Y + 22, w, 1400);
    g.fillStyle(PALETTE.sidewalk, 1);
    g.fillRect(x0, GROUND_Y, w, 22);
    g.fillStyle(PALETTE.curb, 1);
    g.fillRect(x0, GROUND_Y, w, 4);
    g.fillStyle(PALETTE.tileLine, 1);
    for (let tx = Math.ceil(x0 / 56) * 56; tx < x1; tx += 56) g.fillRect(tx, GROUND_Y + 4, 2, 18);
    // dashed lane marks on the street below
    g.fillStyle(0xd8c9c2, 0.35);
    for (let tx = Math.ceil(x0 / 140) * 140; tx < x1 - 60; tx += 140) g.fillRect(tx, GROUND_Y + 90, 60, 5);
  }

  // Water channel (جوی): side walls, water, stepping stone
  const { x0, x1, waterY } = CHANNEL;
  g.fillStyle(PALETTE.channelWall, 1);
  g.fillRect(x0, GROUND_Y, x1 - x0, 1400);
  g.fillStyle(0x6a5a62, 1);
  g.fillRect(x0, GROUND_Y, 6, 1400);
  g.fillRect(x1 - 6, GROUND_Y, 6, 1400);
  g.fillStyle(PALETTE.water, 1);
  g.fillRect(x0 + 6, waterY, x1 - x0 - 12, 1400);
  g.fillStyle(PALETTE.waterLight, 0.8);
  for (let wx = x0 + 20; wx < x1 - 30; wx += 46) g.fillRect(wx, waterY + 8, 22, 2);

  g.fillStyle(PALETTE.stone, 1);
  g.fillRoundedRect(STONE.x0, STONE.top, STONE.x1 - STONE.x0, 260, 6);
  g.fillStyle(PALETTE.stoneTop, 1);
  g.fillRoundedRect(STONE.x0, STONE.top, STONE.x1 - STONE.x0, 7, 3);
  g.fillStyle(0x8f807d, 1);
  g.fillRect(STONE.x0 + 20, STONE.top + 26, 30, 3);
  g.fillRect(STONE.x0 + 70, STONE.top + 48, 40, 3);

  // Puddle
  const pc = (PUDDLE.x0 + PUDDLE.x1) / 2;
  const pw = PUDDLE.x1 - PUDDLE.x0;
  g.fillStyle(0x7f9fb8, 1);
  g.fillEllipse(pc, GROUND_Y + 3, pw + 6, 12);
  g.fillStyle(PALETTE.water, 1);
  g.fillEllipse(pc, GROUND_Y + 3, pw, 9);
}

/** Puddle shimmer — a separate object so it can be gently animated. */
export function addPuddleShimmer(scene: Phaser.Scene): Phaser.GameObjects.Ellipse {
  const pc = (PUDDLE.x0 + PUDDLE.x1) / 2;
  const e = scene.add.ellipse(pc - 12, GROUND_Y + 2, 26, 3, PALETTE.waterLight, 0.9).setDepth(-4);
  scene.tweens.add({ targets: e, x: pc + 12, alpha: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  return e;
}

/** The destination house with its closed wooden door. */
export function drawHouse(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-18);
  const left = DOOR.x - 170;
  const right = WORLD_W + 40;
  const top = GROUND_Y - 270;
  g.fillStyle(PALETTE.house, 1);
  g.fillRect(left, top, right - left, 270);
  g.fillStyle(PALETTE.houseTrim, 1);
  g.fillRect(left - 6, top, right - left + 12, 10);
  g.fillRect(left, GROUND_Y - 16, right - left, 16);

  // upstairs windows (warm, lived-in)
  for (const wx of [DOOR.x - 120, DOOR.x - 20, DOOR.x + 80, DOOR.x + 180, DOOR.x + 280, DOOR.x + 380]) {
    g.fillStyle(PALETTE.window, 0.22);
    g.fillRect(wx - 8, top + 34, 56, 70);
    g.fillStyle(PALETTE.windowFrame, 1);
    g.fillRect(wx - 3, top + 39, 46, 60);
    g.fillStyle(PALETTE.window, 1);
    g.fillRect(wx, top + 42, 40, 54);
    g.fillStyle(PALETTE.windowFrame, 1);
    g.fillRect(wx + 19, top + 42, 2, 54);
  }

  // door step
  g.fillStyle(PALETTE.curb, 1);
  g.fillRect(DOOR.x - 42, GROUND_Y - 4, 84, 6);
  // frame + arched wooden door
  const dw = 54;
  const dh = 96;
  g.fillStyle(PALETTE.doorFrame, 1);
  g.fillRoundedRect(DOOR.x - dw / 2 - 6, GROUND_Y - dh - 6, dw + 12, dh + 6, { tl: 30, tr: 30, bl: 0, br: 0 });
  g.fillStyle(PALETTE.door, 1);
  g.fillRoundedRect(DOOR.x - dw / 2, GROUND_Y - dh, dw, dh - 4, { tl: 26, tr: 26, bl: 0, br: 0 });
  g.fillStyle(0x7a5040, 1);
  g.fillRect(DOOR.x - 1, GROUND_Y - dh + 8, 2, dh - 14);
  g.fillRect(DOOR.x - 20, GROUND_Y - 58, 14, 30);
  g.fillRect(DOOR.x + 6, GROUND_Y - 58, 14, 30);
  g.fillStyle(PALETTE.brass, 1);
  g.fillCircle(DOOR.x + 14, GROUND_Y - 48, 2.6);

  // porch lamp
  g.fillStyle(PALETTE.windowFrame, 1);
  g.fillRect(DOOR.x + 40, GROUND_Y - 118, 4, 14);
  g.fillStyle(PALETTE.window, 1);
  g.fillRoundedRect(DOOR.x + 35, GROUND_Y - 106, 14, 16, 3);

  // potted plant
  g.fillStyle(0xa8705a, 1);
  g.fillRect(DOOR.x - 74, GROUND_Y - 22, 22, 22);
  g.fillStyle(0x7f9583, 1);
  g.fillCircle(DOOR.x - 63, GROUND_Y - 34, 13);
  g.fillCircle(DOOR.x - 72, GROUND_Y - 28, 9);
  g.fillCircle(DOOR.x - 54, GROUND_Y - 28, 9);
}

/** Warm glow around the porch lamp. */
export function addPorchGlow(scene: Phaser.Scene): void {
  const glow = scene.add.image(DOOR.x + 42, GROUND_Y - 98, 'glow').setScale(1.4 / 3).setAlpha(0.8).setDepth(-17);
  scene.tweens.add({ targets: glow, alpha: 0.6, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
}

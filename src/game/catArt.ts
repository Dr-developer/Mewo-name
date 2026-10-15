/**
 * Procedurally drawn black cat (no image files). Each animation frame is
 * drawn with Phaser Graphics and baked into a texture at high resolution
 * so it stays crisp on phone screens.
 *
 * The cat is charcoal, not pure black: a dark body with darker shading,
 * soft gray highlights, warm eyes and a thin light rim (outline) so it
 * reads clearly against the dusk scene.
 */
import * as Phaser from 'phaser';
import { catColors } from '../content/apology';

/** Texture pixels per world unit (sprites are drawn at 1 / CAT_RES). */
export const CAT_RES = 3;
/** Logical frame size (world units). */
export const CAT_FRAME_W = 76;
export const CAT_FRAME_H = 62;
/** y of the paws inside the frame — used as the sprite's origin. */
export const CAT_FEET_Y = 56;

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

interface Pose {
  /** Leg offsets: [backA, backB, frontA, frontB] as [dx, lift]. */
  legs: Array<[number, number]>;
  bodyDy: number;
  bodyH: number;
  headDx: number;
  headDy: number;
  /** Tail control: end point relative to the tail root. */
  tailEnd: [number, number];
  tailMid: [number, number];
  eyes: 'open' | 'closed' | 'wide';
  sitting?: boolean;
  earsBack?: boolean;
}

const BASE: Pose = {
  legs: [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ],
  bodyDy: 0,
  bodyH: 22,
  headDx: 0,
  headDy: 0,
  tailEnd: [-14, -24],
  tailMid: [-14, -4],
  eyes: 'open',
};

const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });

/** Every frame the game uses, by texture key. */
export const CAT_FRAMES: Record<string, Pose> = {
  'cat-idle-0': pose({}),
  'cat-idle-1': pose({ bodyH: 23, bodyDy: -0.5, headDy: -0.6, tailEnd: [-16, -22] }),
  'cat-blink': pose({ eyes: 'closed' }),
  'cat-walk-0': pose({
    legs: [[-3, 0], [3, 2], [3, 2], [-3, 0]],
    bodyDy: 0,
    tailEnd: [-17, -20],
  }),
  'cat-walk-1': pose({
    legs: [[0, 1], [0, 1], [0, 1], [0, 1]],
    bodyDy: -1,
    headDy: -0.6,
    tailEnd: [-16, -23],
  }),
  'cat-walk-2': pose({
    legs: [[3, 2], [-3, 0], [-3, 0], [3, 2]],
    bodyDy: 0,
    tailEnd: [-15, -21],
  }),
  'cat-walk-3': pose({
    legs: [[0, 1], [0, 1], [0, 1], [0, 1]],
    bodyDy: -1,
    headDy: -0.6,
    tailEnd: [-17, -24],
  }),
  'cat-jump': pose({
    legs: [[-6, 3], [-4, 4], [6, 5], [8, 4]],
    bodyDy: -2,
    bodyH: 20,
    headDy: -2,
    tailEnd: [-24, -10],
    tailMid: [-14, -6],
    eyes: 'wide',
  }),
  'cat-fall': pose({
    legs: [[-2, -1], [2, -1], [-2, -1], [2, -1]],
    bodyDy: -1,
    headDy: -1,
    tailEnd: [-10, -30],
    tailMid: [-16, -12],
    eyes: 'wide',
    earsBack: true,
  }),
  'cat-deliver': pose({
    legs: [[0, 0], [0, 0], [2, 2], [4, 2]],
    bodyDy: 1,
    headDx: 3,
    headDy: 7,
    tailEnd: [-12, -26],
  }),
  'cat-sit': pose({ sitting: true, tailEnd: [16, 4], tailMid: [-6, 8] }),
  'cat-sit-blink': pose({ sitting: true, eyes: 'closed', tailEnd: [16, 4], tailMid: [-6, 8] }),
};

/** Builds every cat texture once per game (safe to call again). */
export function createCatTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [key, p] of Object.entries(CAT_FRAMES)) {
    if (scene.textures.exists(key)) continue;
    g.clear();
    drawCat(g, p);
    g.generateTexture(key, CAT_FRAME_W * CAT_RES, CAT_FRAME_H * CAT_RES);
  }
  g.destroy();
}

function drawCat(g: Phaser.GameObjects.Graphics, p: Pose): void {
  const S = CAT_RES;
  const C = {
    body: hex(catColors.body),
    shadow: hex(catColors.shadow),
    highlight: hex(catColors.highlight),
    eyes: hex(catColors.eyes),
    nose: hex(catColors.nose),
    outline: hex(catColors.outline),
  };
  const O = 1.5; // outline thickness (world units)

  // ── Silhouette pieces (drawn twice: outline pass, then body pass) ──
  type Shape =
    | { k: 'e'; x: number; y: number; w: number; h: number }
    | { k: 'c'; x: number; y: number; r: number }
    | { k: 't'; pts: [number, number, number, number, number, number] }
    | { k: 'r'; x: number; y: number; w: number; h: number; r: number };
  const shapes: Shape[] = [];

  const bodyY = (p.sitting ? 40 : 38) + p.bodyDy;
  const headX = (p.sitting ? 46 : 52) + p.headDx;
  const headY = (p.sitting ? 20 : 26) + p.headDy + (p.sitting ? 0 : p.bodyDy);

  // Tail as a chain of dots along a quadratic curve (smooth round shape).
  const tailRoot: [number, number] = p.sitting ? [26, 50] : [18, bodyY - 3];
  const tail = new Phaser.Curves.QuadraticBezier(
    new Phaser.Math.Vector2(tailRoot[0], tailRoot[1]),
    new Phaser.Math.Vector2(tailRoot[0] + p.tailMid[0], tailRoot[1] + p.tailMid[1]),
    new Phaser.Math.Vector2(tailRoot[0] + p.tailEnd[0], tailRoot[1] + p.tailEnd[1]),
  );
  const tailPts = tail.getPoints(18);
  tailPts.forEach((pt, i) => {
    const r = 3.6 - (i / tailPts.length) * 0.9;
    shapes.push({ k: 'c', x: pt.x, y: pt.y, r });
  });

  if (p.sitting) {
    // Sitting: upright body, haunch, straight front legs.
    shapes.push({ k: 'e', x: 36, y: bodyY, w: 30, h: 28 });
    shapes.push({ k: 'e', x: 30, y: 49, w: 22, h: 14 }); // haunch
    shapes.push({ k: 'r', x: 41, y: 40, w: 5, h: 16, r: 2.5 });
    shapes.push({ k: 'r', x: 47, y: 40, w: 5, h: 16, r: 2.5 });
    shapes.push({ k: 'e', x: 42, y: 30, w: 18, h: 16 }); // chest/neck
  } else {
    const legBase = bodyY + 6;
    const legX = [22, 28, 43, 49];
    p.legs.forEach(([dx, lift], i) => {
      const h = 14 - lift;
      shapes.push({ k: 'r', x: legX[i] + dx - 2.5, y: legBase, w: 5, h, r: 2.5 });
    });
    shapes.push({ k: 'e', x: 35, y: bodyY, w: 38, h: p.bodyH });
    shapes.push({ k: 'e', x: 46, y: headY + 7, w: 14, h: 14 }); // neck
  }

  // Head + ears
  shapes.push({ k: 'e', x: headX, y: headY, w: 26, h: 22 });
  const earL = p.earsBack ? -2 : 0;
  shapes.push({ k: 't', pts: [headX - 10, headY - 4, headX - 7 + earL, headY - 17, headX - 1, headY - 9] });
  shapes.push({ k: 't', pts: [headX + 2, headY - 9, headX + 7 + earL, headY - 18, headX + 11, headY - 3] });

  const drawShape = (s: Shape, grow: number, color: number, alpha: number) => {
    switch (s.k) {
      case 'e':
        g.fillEllipse(s.x * S, s.y * S, (s.w + grow * 2) * S, (s.h + grow * 2) * S, 32);
        break;
      case 'c':
        g.fillCircle(s.x * S, s.y * S, (s.r + grow) * S);
        break;
      case 'r':
        g.fillRoundedRect((s.x - grow) * S, (s.y - grow) * S, (s.w + grow * 2) * S, (s.h + grow * 2) * S, (s.r + grow) * S);
        break;
      case 't': {
        const [ax, ay, bx, by, cx, cy] = s.pts.map((v) => v * S);
        if (grow > 0) {
          g.lineStyle(grow * 2 * S, color, alpha);
          g.strokeTriangle(ax, ay, bx, by, cx, cy);
        }
        g.fillTriangle(ax, ay, bx, by, cx, cy);
        break;
      }
    }
  };

  // Outline pass (slightly larger, light rim)
  g.fillStyle(C.outline, 1);
  shapes.forEach((s) => drawShape(s, O, C.outline, 1));
  // Body pass
  g.fillStyle(C.body, 1);
  shapes.forEach((s) => drawShape(s, 0, C.body, 1));

  // ── Shading (shadow color) ──
  g.fillStyle(C.shadow, 0.9);
  if (p.sitting) {
    g.fillEllipse(30 * S, 52 * S, 18 * S, 7 * S);
    g.fillEllipse(36 * S, (bodyY + 8) * S, 18 * S, 8 * S);
  } else {
    g.fillEllipse(35 * S, (bodyY + p.bodyH / 2 - 3) * S, 28 * S, 6 * S); // belly
    g.fillEllipse((headX - 1) * S, (headY + 8) * S, 16 * S, 5 * S); // chin shadow
  }

  // ── Highlights (soft gray) ──
  g.fillStyle(C.highlight, 1);
  if (p.sitting) {
    g.fillEllipse(33 * S, (bodyY - 9) * S, 14 * S, 5 * S);
  } else {
    g.fillEllipse(32 * S, (bodyY - p.bodyH / 2 + 4) * S, 24 * S, 4.5 * S); // back
  }
  g.fillEllipse((headX - 2) * S, (headY - 7) * S, 13 * S, 4 * S); // top of head
  // Inner ears
  g.fillStyle(C.nose, 0.45);
  g.fillTriangle((headX - 8) * S, (headY - 6) * S, (headX - 6.5 + earL) * S, (headY - 14) * S, (headX - 3) * S, (headY - 9) * S);
  g.fillTriangle((headX + 4) * S, (headY - 9) * S, (headX + 7 + earL) * S, (headY - 15) * S, (headX + 9) * S, (headY - 5) * S);

  // ── Face ──
  const eyeY = headY + 0.5;
  const eyes: Array<[number, number]> = [
    [headX - 3, eyeY],
    [headX + 5, eyeY],
  ];
  if (p.eyes === 'closed') {
    g.lineStyle(1.3 * S, C.eyes, 0.9);
    eyes.forEach(([x, y]) => {
      g.beginPath();
      g.arc(x * S, (y - 0.5) * S, 2.3 * S, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
      g.strokePath();
    });
  } else {
    const ew = p.eyes === 'wide' ? 5.4 : 4.8;
    const eh = p.eyes === 'wide' ? 6.2 : 5.4;
    // soft glow ring so the eyes read from afar
    g.fillStyle(C.eyes, 0.18);
    eyes.forEach(([x, y]) => g.fillCircle(x * S, y * S, 4.6 * S));
    g.fillStyle(C.eyes, 1);
    eyes.forEach(([x, y]) => g.fillEllipse(x * S, y * S, ew * S, eh * S, 24));
    g.fillStyle(0x0b0b0f, 1);
    eyes.forEach(([x, y]) => g.fillEllipse((x + 0.5) * S, y * S, 1.7 * S, (eh - 1.4) * S, 16));
    g.fillStyle(0xffffff, 0.9);
    eyes.forEach(([x, y]) => g.fillCircle((x - 0.7) * S, (y - 1.4) * S, 0.75 * S));
  }

  // Nose + whiskers
  const nx = headX + 9.5;
  const ny = headY + 4.5;
  g.fillStyle(C.nose, 1);
  g.fillTriangle((nx - 1.6) * S, (ny - 1) * S, (nx + 1.6) * S, (ny - 1) * S, nx * S, (ny + 1.3) * S);
  g.lineStyle(0.6 * S, 0xc9c2cc, 0.55);
  for (const dy of [-0.5, 1.5]) {
    g.lineBetween((nx + 1) * S, (ny + 0.5) * S, (nx + 9) * S, (ny + dy) * S);
    g.lineBetween((nx - 6) * S, (ny + 1) * S, (nx - 13) * S, (ny + dy + 0.5) * S);
  }
}

/** Small flat textures used around the cat (shadow, letter, sparkles). */
export function createPropTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const S = CAT_RES;
  const make = (key: string, w: number, h: number, draw: () => void) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw();
    g.generateTexture(key, w * S, h * S);
  };

  // Soft ground shadow under the cat
  make('cat-shadow', 48, 10, () => {
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x3a2c38, 0.07);
      g.fillEllipse(24 * S, 5 * S, (48 - i * 7) * S, (10 - i * 1.5) * S);
    }
  });

  // Torn letter piece
  make('fragment', 34, 28, () => {
    g.fillStyle(0xb9857f, 0.35);
    g.fillRoundedRect(3 * S, 4 * S, 28 * S, 21 * S, 2 * S);
    g.fillStyle(0xfff8ee, 1);
    g.beginPath();
    const pts = [
      [3, 3], [12, 2], [15, 4], [22, 2], [31, 3], [30, 11], [32, 17], [30, 24], [20, 25], [16, 23], [9, 25], [2, 24], [4, 15], [2, 9],
    ];
    g.moveTo(pts[0][0] * S, pts[0][1] * S);
    pts.slice(1).forEach(([x, y]) => g.lineTo(x * S, y * S));
    g.closePath();
    g.fillPath();
    g.lineStyle(0.8 * S, 0xc9a49c, 1);
    g.strokePath();
    g.lineStyle(1 * S, 0xc7b2b6, 1);
    [9, 13.5, 18].forEach((y, i) => g.lineBetween(7 * S, y * S, (26 - i * 5) * S, y * S));
  });

  // Soft glow
  make('glow', 64, 64, () => {
    for (let i = 0; i < 10; i++) {
      g.fillStyle(0xfff0c2, 0.05);
      g.fillCircle(32 * S, 32 * S, (32 - i * 3) * S);
    }
  });

  // Sealed envelope (the completed letter)
  make('envelope', 26, 18, () => {
    g.fillStyle(0xfff8ee, 1);
    g.fillRoundedRect(1 * S, 1 * S, 24 * S, 16 * S, 2 * S);
    g.lineStyle(1 * S, 0xb9857f, 1);
    g.strokeRoundedRect(1 * S, 1 * S, 24 * S, 16 * S, 2 * S);
    g.lineBetween(1.5 * S, 2 * S, 13 * S, 10 * S);
    g.lineBetween(24.5 * S, 2 * S, 13 * S, 10 * S);
    g.fillStyle(0xd68c9a, 1);
    g.fillCircle(13 * S, 10.5 * S, 2.6 * S);
  });

  make('sparkle', 8, 8, () => {
    g.fillStyle(0xfff3c4, 1);
    g.fillCircle(4 * S, 4 * S, 2.2 * S);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(4 * S, 4 * S, 1.1 * S);
  });

  make('droplet', 6, 6, () => {
    g.fillStyle(0xa9cbe3, 1);
    g.fillCircle(3 * S, 3 * S, 2.4 * S);
  });

  make('dust', 10, 10, () => {
    g.fillStyle(0xe9dcd6, 0.8);
    g.fillCircle(5 * S, 5 * S, 4 * S);
  });

  make('streak', 70, 3, () => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 70 * S, 2.2 * S, 1.1 * S);
  });

  make('leaf', 12, 8, () => {
    g.fillStyle(0xd9a066, 1);
    g.fillEllipse(6 * S, 4 * S, 11 * S, 6 * S);
    g.lineStyle(0.7 * S, 0xa86f3d, 1);
    g.lineBetween(1.5 * S, 4 * S, 10.5 * S, 4 * S);
  });

  make('hint-arrow', 20, 20, () => {
    g.fillStyle(0xfff8ee, 0.95);
    g.fillTriangle(5 * S, 3 * S, 17 * S, 10 * S, 5 * S, 17 * S);
  });

  g.destroy();
}

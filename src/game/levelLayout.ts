/**
 * Level layout in world units. The level reads left → right in one
 * continuous street at dusk.
 *
 *  start ─ piece 1 ─ puddle ─ piece 2 ─ [ windy stretch + piece 3 ] ─
 *  water channel with a stepping stone (piece 4 on the stone) ─ door
 *
 * Every piece sits in a full-height "column": walking past its x position
 * collects it, so pieces are always collected in order and can't be skipped.
 */

export const WORLD_W = 6200;
export const GROUND_Y = 600;
/** Visible height (world units) we try to keep on screen on tall layouts. */
export const MIN_VISIBLE_W = 430;
export const BASE_VISIBLE_H = 500;

/** Solid ground strips [x0, x1]. The gap between them is the water channel. */
export const GROUND_SEGMENTS: ReadonlyArray<readonly [number, number]> = [
  [0, 3880],
  [4180, WORLD_W],
];

/** Low stepping stone in the middle of the channel (the "simple jump"). */
export const STONE = { x0: 3940, x1: 4120, top: GROUND_Y - 46 } as const;

/** Water channel (جوی آب): falling in here gently respawns the cat. */
export const CHANNEL = { x0: 3880, x1: 4180, waterY: GROUND_Y + 64 } as const;

/** Small puddle on the sidewalk. */
export const PUDDLE = { x0: 1318, x1: 1398 } as const;

/** The windy stretch pushes gently against the cat (never enough to stop it). */
export const WIND = { x0: 2380, x1: 3320, push: 72, idleDrift: 38 } as const;

/** Letter pieces: x position and how high above the ground they float. */
export const FRAGMENTS: ReadonlyArray<{ x: number; lift: number; flutter: number }> = [
  { x: 720, lift: 46, flutter: 0.08 },
  { x: 1960, lift: 46, flutter: 0.08 },
  { x: 2900, lift: 64, flutter: 0.28 }, // caught in the wind
  { x: 4030, lift: 46 + (GROUND_Y - STONE.top), flutter: 0.1 }, // above the stone
];
/** Half-width of each fragment's collection column. */
export const FRAGMENT_REACH = 34;

/** Street lamps double as checkpoints; they light up as the cat passes. */
export const CHECKPOINTS: ReadonlyArray<number> = [140, 1150, 1570, 2290, 3420, 3770, 4330];

/** The destination door. */
export const DOOR = {
  x: 5720,
  /** Reaching this x triggers the ending (or a gentle "not yet" note). */
  triggerX: 5630,
  /** Where the cat stops, leaves the letter, and steps back to. */
  catStopX: 5664,
  letterX: 5712,
  catRestX: 5596,
} as const;

export const START_X = 140;

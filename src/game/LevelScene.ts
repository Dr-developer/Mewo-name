/**
 * The single playable level.
 *
 * Scene phases (internal):
 *   intro → playing ⇄ (collecting → dialog) ⇄ recovering → ending → done
 *
 * The scene never decides which HTML screen is visible; it reports events
 * (collect, doorReached, endingDone, hints) to React through the bridge and
 * obeys `resume` / `pause` commands.
 */
import * as Phaser from 'phaser';
import type { GameBridge } from './bridge';
import { FRAGMENT_COUNT, gameTuning } from '../content/apology';
import { CAT_FEET_Y, CAT_FRAME_H, CAT_RES, createCatTextures, createPropTextures } from './catArt';
import {
  BASE_VISIBLE_H,
  CHANNEL,
  CHECKPOINTS,
  DOOR,
  FRAGMENT_REACH,
  FRAGMENTS,
  GROUND_SEGMENTS,
  GROUND_Y,
  MIN_VISIBLE_W,
  PUDDLE,
  START_X,
  STONE,
  WIND,
  WORLD_W,
} from './levelLayout';
import {
  addPorchGlow,
  addPuddleShimmer,
  drawFarCity,
  drawHouse,
  drawMountains,
  drawSky,
  drawStreet,
  drawStreetBuildings,
} from './scenery';

type ScenePhase = 'intro' | 'playing' | 'collecting' | 'dialog' | 'recovering' | 'ending' | 'done';

const GRAVITY = 1400;
const JUMP_VELOCITY = 610; // ≈ 133 units high, generous air time
const JUMP_BUFFER_MS = 170; // a press slightly before landing still jumps
const COYOTE_MS = 120; // a press slightly after leaving an edge still jumps
const BODY_W = 30;
const BODY_H = 26;
const CAT_SCALE = 1 / CAT_RES;
const MAX_ZOOM_CSS = 1.7;

interface Fragment {
  index: number;
  x: number;
  y: number;
  paper: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  collected: boolean;
}

interface Lamp {
  x: number;
  bulb: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Image;
  lit: boolean;
}

interface Drifter {
  img: Phaser.GameObjects.Image;
  vx: number;
  life: number;
  maxLife: number;
  baseY: number;
  phase: number;
}

type ArcadeZone = Phaser.GameObjects.Zone & { body: Phaser.Physics.Arcade.Body };

export class LevelScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private phase: ScenePhase = 'intro';

  private catBody!: ArcadeZone;
  private cat!: Phaser.GameObjects.Sprite;
  private catShadow!: Phaser.GameObjects.Image;
  private hintArrow!: Phaser.GameObjects.Image;

  private fragments: Fragment[] = [];
  private lamps: Lamp[] = [];
  private checkpointIndex = 0;
  private collectedCount = 0;

  private streaks: Drifter[] = [];
  private leaves: Drifter[] = [];

  private keys: Record<'left' | 'right' | 'a' | 'd' | 'up' | 'w' | 'space', Phaser.Input.Keyboard.Key> | null = null;

  private facing: 1 | -1 = 1;
  private lastGroundedAt = 0;
  private wasOnGround = true;
  private jumpConsumed = false;
  private blinkUntil = 0;
  private nextBlinkAt = 0;
  private camX = START_X;
  private camLook = 0;

  /** Visual-only vertical offset for the sprite (little hops). */
  private hop = { y: 0 };
  private hintShownAt = 0;
  private hintVisible = false;
  private doorNoteArmed = true;

  private unsubscribers: Array<() => void> = [];

  constructor() {
    super('level');
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    createCatTextures(this);
    createPropTextures(this);

    // ── Scenery ──
    const viewExtent = 3200;
    drawSky(this, viewExtent);
    drawMountains(this, viewExtent);
    drawFarCity(this, viewExtent);
    drawStreetBuildings(this);
    drawHouse(this);
    addPorchGlow(this);
    this.createLamps();
    drawStreet(this);
    addPuddleShimmer(this);

    // ── Physics world ──
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, -2000, WORLD_W, 5000, true, true, false, false);
    const solids = this.physics.add.staticGroup();
    for (const [x0, x1] of GROUND_SEGMENTS) {
      solids.add(this.add.zone((x0 + x1) / 2, GROUND_Y + 200, x1 - x0, 400));
    }
    solids.add(this.add.zone((STONE.x0 + STONE.x1) / 2, STONE.top + 130, STONE.x1 - STONE.x0, 260));

    // ── The cat: an invisible physics box + an animated sprite that follows it ──
    this.catBody = this.add.zone(START_X, GROUND_Y - BODY_H / 2, BODY_W, BODY_H) as ArcadeZone;
    this.physics.add.existing(this.catBody);
    this.catBody.body.setCollideWorldBounds(true);
    this.catBody.body.setMaxVelocityY(900);
    this.physics.add.collider(this.catBody, solids);

    this.catShadow = this.add.image(START_X, GROUND_Y + 1, 'cat-shadow').setScale(CAT_SCALE).setDepth(9);
    this.cat = this.add
      .sprite(START_X, GROUND_Y, 'cat-idle-0')
      .setOrigin(0.5, CAT_FEET_Y / CAT_FRAME_H)
      .setScale(CAT_SCALE)
      .setDepth(10);
    if (!this.anims.exists('cat-walk')) {
      this.anims.create({
        key: 'cat-walk',
        frames: [0, 1, 2, 3].map((i) => ({ key: `cat-walk-${i}` })),
        frameRate: 10,
        repeat: -1,
      });
    }

    this.hintArrow = this.add.image(0, 0, 'hint-arrow').setScale(CAT_SCALE).setAlpha(0).setDepth(11);

    this.createFragments();
    this.createWind();

    // ── Keyboard (desktop convenience; never shown in the UI) ──
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      // enableCapture=false: don't block Space/Enter on focused HTML buttons
      this.keys = {
        left: kb.addKey(K.LEFT, false),
        right: kb.addKey(K.RIGHT, false),
        a: kb.addKey(K.A, false),
        d: kb.addKey(K.D, false),
        up: kb.addKey(K.UP, false),
        w: kb.addKey(K.W, false),
        space: kb.addKey(K.SPACE, false),
      };
    }

    // ── Bridge commands ──
    this.unsubscribers.push(
      this.bridge.toScene.on('resume', () => this.resumePlay()),
      this.bridge.toScene.on('pause', () => this.pausePlay()),
      this.bridge.toScene.on('relayout', () => this.applyLayout()),
    );

    // ── Layout / camera ──
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyLayout, this);
    this.applyLayout();
    this.camX = this.targetCamX();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    // Start frozen until the player taps the start button.
    this.physics.world.pause();
    this.phase = 'intro';
    if (this.lamps[0]) this.lightLamp(this.lamps[0], false);
    if (this.bridge.playRequested) this.resumePlay();
  }

  private cleanup(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyLayout, this);
  }

  // ───────────────────────── commands ─────────────────────────

  private resumePlay(): void {
    if (this.phase !== 'intro' && this.phase !== 'dialog') return;
    this.phase = 'playing';
    this.bridge.input.reset();
    this.bridge.input.touch();
    this.physics.world.resume();
    this.setHint(false);
  }

  private pausePlay(): void {
    this.bridge.input.reset();
  }

  // ───────────────────────── layout ─────────────────────────

  /** Frames the camera so the street sits just above the touch controls. */
  private applyLayout(): void {
    const cam = this.cameras.main;
    const { dpr, reserveCss } = this.bridge.layout;
    cam.setSize(this.scale.width, this.scale.height);
    const cssW = this.scale.width / dpr;
    const cssH = this.scale.height / dpr;
    const zoomCss = Math.min(cssH / BASE_VISIBLE_H, cssW / MIN_VISIBLE_W, MAX_ZOOM_CSS);
    cam.setZoom(zoomCss * dpr);
    this.layoutCache = { cssW, cssH, zoomCss, groundCss: cssH - reserveCss - 18 };
    this.positionCamera(true);
  }

  private layoutCache = { cssW: 400, cssH: 800, zoomCss: 1, groundCss: 600 };

  private targetCamX(): number {
    const { cssW, zoomCss } = this.layoutCache;
    const viewW = cssW / zoomCss;
    if (viewW >= WORLD_W) return WORLD_W / 2;
    const x = this.catBody ? this.catBody.x + this.camLook : START_X;
    return Phaser.Math.Clamp(x, viewW / 2, WORLD_W - viewW / 2);
  }

  private positionCamera(snap: boolean, dt = 0): void {
    const { cssH, zoomCss, groundCss } = this.layoutCache;
    const target = this.targetCamX();
    this.camX = snap ? target : this.camX + (target - this.camX) * (1 - Math.exp(-dt * 4.5));
    const cy = GROUND_Y - (groundCss - cssH / 2) / zoomCss;
    this.cameras.main.centerOn(this.camX, cy);
  }

  // ───────────────────────── level objects ─────────────────────────

  private createLamps(): void {
    const g = this.add.graphics().setDepth(-8);
    CHECKPOINTS.forEach((x) => {
      const lx = x + 18;
      g.fillStyle(0x4f5568, 1);
      g.fillRect(lx - 2.5, GROUND_Y - 128, 5, 128);
      g.fillRect(lx - 7, GROUND_Y - 6, 14, 6);
      g.fillRoundedRect(lx - 9, GROUND_Y - 142, 18, 6, 3);
      const glow = this.add
        .image(lx, GROUND_Y - 128, 'glow')
        .setScale(1.6 * CAT_SCALE)
        .setAlpha(0)
        .setDepth(-9);
      const bulb = this.add.circle(lx, GROUND_Y - 131, 6, 0x8a8e9c).setDepth(-7);
      this.lamps.push({ x, bulb, glow, lit: false });
    });
  }

  private lightLamp(lamp: Lamp, animate = true): void {
    if (lamp.lit) return;
    lamp.lit = true;
    lamp.bulb.setFillStyle(0xffe7a3);
    if (animate) {
      this.tweens.add({ targets: lamp.glow, alpha: { from: 0, to: 0.95 }, duration: 600, ease: 'Sine.out' });
    } else {
      lamp.glow.setAlpha(0.95);
    }
  }

  private createFragments(): void {
    FRAGMENTS.slice(0, FRAGMENT_COUNT).forEach((f, index) => {
      const y = GROUND_Y - f.lift;
      const glow = this.add.image(f.x, y, 'glow').setScale(0.95 * CAT_SCALE).setAlpha(0.7).setDepth(7);
      const paper = this.add.image(f.x, y, 'fragment').setScale(CAT_SCALE).setDepth(8);
      this.tweens.add({ targets: [paper, glow], y: y - 7, duration: 1400 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({
        targets: paper,
        angle: { from: -f.flutter * 57, to: f.flutter * 57 },
        duration: f.flutter > 0.2 ? 520 : 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.fragments.push({ index, x: f.x, y, paper, glow, collected: false });
    });
  }

  private createWind(): void {
    for (let i = 0; i < 16; i++) {
      const img = this.add.image(0, 0, 'streak').setScale(CAT_SCALE).setDepth(12).setAlpha(0);
      this.streaks.push({ img, vx: 0, life: 0, maxLife: 0, baseY: 0, phase: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const img = this.add.image(0, 0, 'leaf').setScale(CAT_SCALE).setDepth(12).setAlpha(0);
      this.leaves.push({ img, vx: 0, life: 0, maxLife: 0, baseY: 0, phase: 0 });
    }
  }

  // ───────────────────────── frame loop ─────────────────────────

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const now = performance.now();
    this.updateWindVisuals(dt);

    if (this.phase === 'playing') this.updatePlaying(now, dt);
    else if (this.phase === 'intro') this.updateIdleLook(now);

    this.syncCatSprite();
    this.positionCamera(false, dt);
    this.updateHintArrow(time);
  }

  private readInput() {
    const k = this.keys;
    const inp = this.bridge.input;
    const kLeft = !!k && (k.left.isDown || k.a.isDown);
    const kRight = !!k && (k.right.isDown || k.d.isDown);
    if (k && (Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w) || Phaser.Input.Keyboard.JustDown(k.space))) {
      inp.pressJump();
    }
    if (kLeft || kRight) inp.touch();
    if (inp.left || inp.right) inp.touch();
    const left = inp.left || kLeft;
    const right = inp.right || kRight;
    return { dir: (right ? 1 : 0) - (left ? 1 : 0) };
  }

  private updatePlaying(now: number, dt: number): void {
    const body = this.catBody.body;
    const { dir } = this.readInput();
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundedAt = now;
      this.jumpConsumed = false;
    }

    // Horizontal: ease toward the target speed; the wind pushes back gently.
    const inWind = this.catBody.x > WIND.x0 && this.catBody.x < WIND.x1;
    let target = dir * gameTuning.walkSpeed;
    if (inWind) target -= dir !== 0 ? WIND.push : WIND.idleDrift;
    const vx = body.velocity.x + (target - body.velocity.x) * Math.min(1, dt * 12);
    body.setVelocityX(vx);
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    this.camLook += ((dir !== 0 ? dir : this.facing) * 60 - this.camLook) * Math.min(1, dt * 2);

    // Jump with buffering + coyote time so taps feel reliable.
    const inp = this.bridge.input;
    const buffered = now - inp.jumpPressedAt < JUMP_BUFFER_MS;
    const canJump = !this.jumpConsumed && (onGround || now - this.lastGroundedAt < COYOTE_MS);
    if (buffered && canJump) {
      body.setVelocityY(-JUMP_VELOCITY);
      inp.jumpPressedAt = -Infinity;
      this.jumpConsumed = true;
      this.squash(0.9, 1.1);
      this.puff(this.catBody.x, this.catBody.y + BODY_H / 2, 3);
    }

    // Landing
    if (onGround && !this.wasOnGround) {
      this.squash(1.1, 0.9);
      this.puff(this.catBody.x, this.catBody.y + BODY_H / 2, 2);
    }
    this.wasOnGround = onGround;

    // Checkpoints light up as the cat walks past on solid ground.
    if (onGround) {
      for (let i = this.checkpointIndex + 1; i < this.lamps.length; i++) {
        if (this.catBody.x >= this.lamps[i].x) {
          this.checkpointIndex = i;
          this.lightLamp(this.lamps[i]);
        }
      }
    }

    // Letter pieces (full-height columns: walking past = collecting).
    for (const f of this.fragments) {
      if (!f.collected && Math.abs(this.catBody.x - f.x) < FRAGMENT_REACH) {
        this.collect(f);
        return;
      }
    }

    // Puddle: touching it while on the ground → gentle splash + respawn.
    if (onGround && this.catBody.x > PUDDLE.x0 + 12 && this.catBody.x < PUDDLE.x1 - 12 && this.catBody.y > GROUND_Y - BODY_H) {
      this.recover('puddle');
      return;
    }
    // Water channel: dropping below the sidewalk → gentle respawn.
    if (this.catBody.y > GROUND_Y + 30) {
      this.recover('fall');
      return;
    }

    // Door
    if (this.catBody.x >= DOOR.triggerX) {
      if (this.collectedCount >= FRAGMENT_COUNT) {
        this.startEnding();
        return;
      }
      if (this.doorNoteArmed) {
        this.doorNoteArmed = false;
        this.bridge.toReact.emit('doorLocked', { remaining: FRAGMENT_COUNT - this.collectedCount });
      }
    } else if (this.catBody.x < DOOR.triggerX - 120) {
      this.doorNoteArmed = true;
    }

    // Idle hint
    const idleFor = now - inp.lastInputAt;
    if (!this.hintVisible && idleFor > gameTuning.idleHintSeconds * 1000) {
      this.setHint(true, inWind);
    } else if (this.hintVisible && inp.lastInputAt > this.hintShownAt) {
      this.setHint(false);
    }

    this.chooseCatFrame(now, onGround, dir, inWind);
  }

  private updateIdleLook(now: number): void {
    this.chooseCatFrame(now, true, 0, false);
  }

  private chooseCatFrame(now: number, onGround: boolean, dir: number, inWind: boolean): void {
    const body = this.catBody.body;
    this.cat.setFlipX(this.facing < 0);
    if (!onGround) {
      this.cat.anims.stop();
      this.cat.setTexture(body.velocity.y < 0 ? 'cat-jump' : 'cat-fall');
    } else if (dir !== 0 && Math.abs(body.velocity.x) > 25) {
      if (!this.cat.anims.isPlaying || this.cat.anims.currentAnim?.key !== 'cat-walk') this.cat.play('cat-walk');
      this.cat.anims.timeScale = Phaser.Math.Clamp(Math.abs(body.velocity.x) / gameTuning.walkSpeed, 0.55, 1.15);
    } else {
      this.cat.anims.stop();
      if (now > this.nextBlinkAt) {
        this.blinkUntil = now + 140;
        this.nextBlinkAt = now + Phaser.Math.Between(2400, 4800);
      }
      const breath = Math.floor(now / 900) % 2;
      this.cat.setTexture(now < this.blinkUntil ? 'cat-blink' : `cat-idle-${breath}`);
    }
    // a slight lean into the wind
    const lean = inWind && dir > 0 ? -5 : 0;
    this.cat.angle += (lean - this.cat.angle) * 0.15;
  }

  private syncCatSprite(): void {
    const x = this.catBody.x;
    const feetY = this.catBody.y + BODY_H / 2;
    this.cat.setPosition(x, feetY - this.hop.y);
    // shadow on whatever surface is beneath the cat
    let surface: number | null = GROUND_Y;
    if (x > STONE.x0 && x < STONE.x1) surface = STONE.top;
    else if (x > CHANNEL.x0 && x < CHANNEL.x1) surface = null;
    if (surface === null || feetY > surface + 4) {
      this.catShadow.setVisible(false);
    } else {
      const h = Math.max(0, surface - feetY);
      const s = Phaser.Math.Clamp(1 - h / 220, 0.35, 1);
      this.catShadow
        .setVisible(true)
        .setPosition(x, surface + 1)
        .setScale(CAT_SCALE * s)
        .setAlpha(this.cat.alpha * s);
    }
  }

  // ───────────────────────── events ─────────────────────────

  private collect(f: Fragment): void {
    f.collected = true;
    this.collectedCount += 1;
    this.phase = 'collecting';
    this.bridge.input.reset();
    this.setHint(false);
    this.physics.world.pause();
    this.cat.anims.stop();
    this.cat.setTexture('cat-idle-0');
    this.tweens.killTweensOf([f.paper, f.glow]);
    this.tweens.add({
      targets: f.paper,
      y: f.paper.y - 30,
      scale: CAT_SCALE * 1.6,
      angle: 0,
      alpha: 0,
      duration: 560,
      ease: 'Sine.out',
    });
    this.tweens.add({ targets: f.glow, scale: CAT_SCALE * 2.2, alpha: 0, duration: 560, ease: 'Sine.out' });
    this.sparkles(f.x, f.paper.y, 10);
    // happy little hop of the sprite only (physics is paused)
    this.tweens.add({ targets: this.hop, y: 8, duration: 160, yoyo: true, ease: 'Sine.out' });

    this.time.delayedCall(600, () => {
      this.phase = 'dialog';
      this.bridge.toReact.emit('collect', { index: f.index });
    });
  }

  /** Gentle reset to the latest lit lamp. Collected pieces are kept. */
  private recover(kind: 'puddle' | 'fall'): void {
    this.phase = 'recovering';
    // Keep held buttons as they are (the finger may still be down), but
    // drop any pending jump so the cat doesn't hop on arrival.
    this.bridge.input.jumpPressedAt = -Infinity;
    this.setHint(false);
    const body = this.catBody.body;
    if (kind === 'puddle') {
      body.setVelocity(0, 0);
      this.splash(this.catBody.x, GROUND_Y);
      this.cat.anims.stop();
      this.cat.setTexture('cat-fall');
    } else {
      this.splash(this.catBody.x, CHANNEL.waterY);
    }
    this.tweens.add({ targets: this.cat, alpha: 0, duration: 380, ease: 'Sine.in' });

    this.time.delayedCall(kind === 'fall' ? 420 : 460, () => {
      const lamp = this.lamps[this.checkpointIndex];
      const x = lamp ? lamp.x : START_X;
      body.reset(x, GROUND_Y - BODY_H / 2);
      body.setVelocity(0, 0);
      this.facing = 1;
      this.camLook = 60;
      this.cat.setTexture('cat-fall').setAlpha(0).setAngle(0);
      this.syncCatSprite();
      // reappear + shake it off
      this.tweens.add({ targets: this.cat, alpha: 1, duration: 320, ease: 'Sine.out' });
      this.tweens.add({
        targets: this.cat,
        angle: { from: -7, to: 7 },
        duration: 90,
        yoyo: true,
        repeat: 2,
        delay: 260,
        onComplete: () => this.cat.setAngle(0),
      });
      this.time.delayedCall(320, () => this.cat.setTexture('cat-idle-0'));
      this.puff(x, GROUND_Y, 3);
      if (lamp) {
        this.tweens.add({ targets: lamp.glow, alpha: { from: 0.4, to: 0.95 }, duration: 380, yoyo: false });
      }
      this.time.delayedCall(720, () => {
        if (this.phase === 'recovering') {
          this.phase = 'playing';
          this.wasOnGround = true;
          this.bridge.input.touch();
        }
      });
    });
  }

  private startEnding(): void {
    this.phase = 'ending';
    this.bridge.input.reset();
    this.setHint(false);
    this.physics.world.pause();
    this.bridge.toReact.emit('doorReached');

    const startX = this.catBody.x;
    const walkMs = Math.max(250, (Math.abs(DOOR.catStopX - startX) / gameTuning.walkSpeed) * 1000);
    this.facing = 1;
    this.cat.setFlipX(false).setAngle(0);
    this.cat.play('cat-walk');
    this.cat.anims.timeScale = 0.8;

    const envelope = this.add.image(0, 0, 'envelope').setScale(0).setDepth(11);

    this.tweens.chain({
      tweens: [
        // 1) walk up to the door
        { targets: this.catBody, x: DOOR.catStopX, duration: walkMs, ease: 'Sine.out' },
        // 2) lower the head and set the letter down on the step
        {
          targets: envelope,
          scale: CAT_SCALE,
          duration: 260,
          onStart: () => {
            this.cat.anims.stop();
            this.cat.setTexture('cat-deliver');
            envelope.setPosition(this.catBody.x + 18, GROUND_Y - 16);
          },
        },
        { targets: envelope, x: DOOR.letterX, y: GROUND_Y - 5, angle: -6, duration: 650, ease: 'Quad.inOut' },
        { targets: envelope, scale: CAT_SCALE * 1.08, duration: 220, yoyo: true, ease: 'Sine.inOut',
          onStart: () => this.sparkles(DOOR.letterX, GROUND_Y - 10, 6),
        },
        // 3) turn around and step back a little
        {
          targets: this.catBody,
          x: DOOR.catRestX,
          duration: 1100,
          delay: 250,
          ease: 'Sine.inOut',
          onStart: () => {
            this.cat.setTexture('cat-idle-0');
            this.cat.setFlipX(true);
            this.cat.play('cat-walk');
            this.cat.anims.timeScale = 0.55;
          },
        },
      ],
      onComplete: () => {
        // 4) face the door and sit quietly
        this.cat.anims.stop();
        this.cat.setFlipX(false).setTexture('cat-sit');
        this.time.addEvent({
          delay: 2600,
          loop: true,
          callback: () => {
            this.cat.setTexture('cat-sit-blink');
            this.time.delayedCall(150, () => this.cat.setTexture('cat-sit'));
          },
        });
        this.drift(DOOR.x - 300, GROUND_Y - 160);
        this.time.delayedCall(1500, () => {
          this.phase = 'done';
          this.bridge.toReact.emit('endingDone');
        });
      },
    });
  }

  // ───────────────────────── hints ─────────────────────────

  private setHint(show: boolean, inWind = false): void {
    if (show === this.hintVisible) return;
    this.hintVisible = show;
    if (show) {
      this.hintShownAt = performance.now();
      const kind = this.collectedCount >= FRAGMENT_COUNT ? 'goToDoor' : inWind ? 'windy' : 'findNext';
      this.bridge.toReact.emit('hint', { kind });
    } else {
      this.bridge.toReact.emit('hint', null);
    }
  }

  private updateHintArrow(time: number): void {
    const target = this.hintVisible ? 0.85 : 0;
    this.hintArrow.alpha += (target - this.hintArrow.alpha) * 0.08;
    const bob = Math.sin(time / 260) * 4;
    this.hintArrow.setPosition(this.catBody.x + 40 + bob, this.catBody.y - 34);
  }

  // ───────────────────────── small effects ─────────────────────────

  private squash(sx: number, sy: number): void {
    this.tweens.add({
      targets: this.cat,
      scaleX: CAT_SCALE * sx,
      scaleY: CAT_SCALE * sy,
      duration: 90,
      yoyo: true,
      ease: 'Sine.out',
      onComplete: () => this.cat.setScale(CAT_SCALE),
    });
  }

  private puff(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(x + Phaser.Math.Between(-10, 10), y - 2, 'dust').setScale(CAT_SCALE * 0.6).setAlpha(0.7).setDepth(9);
      this.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-18, 18),
        y: d.y - Phaser.Math.Between(4, 12),
        scale: CAT_SCALE * 1.1,
        alpha: 0,
        duration: 420,
        ease: 'Sine.out',
        onComplete: () => d.destroy(),
      });
    }
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const d = this.add.image(x, y - 2, 'droplet').setScale(CAT_SCALE).setDepth(12);
      const ang = Phaser.Math.DegToRad(Phaser.Math.Between(200, 340));
      const dist = Phaser.Math.Between(16, 34);
      this.tweens.add({
        targets: d,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        duration: 480,
        ease: 'Quad.out',
        onComplete: () => d.destroy(),
      });
    }
  }

  private sparkles(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'sparkle').setScale(CAT_SCALE).setDepth(13);
      const ang = (i / n) * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 38);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist - 10,
        alpha: 0,
        scale: CAT_SCALE * 0.4,
        duration: 700,
        ease: 'Sine.out',
        onComplete: () => s.destroy(),
      });
    }
  }

  /** A couple of leaves drifting by (used at the ending). */
  private drift(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const leaf = this.add.image(x - i * 60, y + i * 24, 'leaf').setScale(CAT_SCALE).setDepth(12).setAlpha(0.9);
      this.tweens.add({
        targets: leaf,
        x: leaf.x + 520,
        y: leaf.y + 90,
        angle: 360,
        alpha: 0,
        duration: 5200 + i * 600,
        delay: i * 400,
        ease: 'Sine.inOut',
        onComplete: () => leaf.destroy(),
      });
    }
  }

  /** Streaks and tumbling leaves in the windy stretch (purely visual). */
  private updateWindVisuals(dt: number): void {
    const view = this.cameras.main.worldView;
    const left = Math.max(WIND.x0, view.x - 40);
    const right = Math.min(WIND.x1, view.right + 40);
    const visible = right > left;

    const step = (d: Drifter, isLeaf: boolean) => {
      if (!visible) {
        d.img.setAlpha(0);
        d.life = 0;
        return;
      }
      if (d.life <= 0 || d.img.x < WIND.x0 - 30) {
        d.maxLife = d.life = Phaser.Math.FloatBetween(0.8, 1.8);
        d.vx = isLeaf ? Phaser.Math.Between(-200, -140) : Phaser.Math.Between(-420, -300);
        d.baseY = GROUND_Y - Phaser.Math.Between(isLeaf ? 8 : 20, isLeaf ? 120 : 260);
        d.phase = Math.random() * Math.PI * 2;
        d.img.setPosition(Phaser.Math.Between(left, right + 60), d.baseY);
      }
      d.life -= dt;
      d.img.x += d.vx * dt;
      d.phase += dt * (isLeaf ? 6 : 2);
      d.img.y = d.baseY + Math.sin(d.phase) * (isLeaf ? 10 : 2);
      if (isLeaf) d.img.angle += 260 * dt;
      const t = d.life / d.maxLife; // 1 → 0
      d.img.setAlpha((isLeaf ? 0.9 : 0.32) * Math.sin(Math.PI * t));
    };
    this.streaks.forEach((d) => step(d, false));
    this.leaves.forEach((d) => step(d, true));
  }
}

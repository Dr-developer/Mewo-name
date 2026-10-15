import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import type { GameBridge } from './bridge';
import { LevelScene } from './LevelScene';

/**
 * Mounts exactly one Phaser game for the lifetime of this component and
 * destroys it (canvas, listeners, textures) on unmount. Restarting the game
 * is done by remounting this component with a new React key.
 *
 * The canvas is rendered at device-pixel resolution (capped at 2×) and
 * scaled back down with CSS, so the drawn shapes stay crisp on phones.
 */
export function GameCanvas({ bridge }: { bridge: GameBridge }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const readLayout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const reserveEl = host.querySelector<HTMLElement>('[data-controls-reserve]');
      const reserveCss = reserveEl ? reserveEl.getBoundingClientRect().height : 150;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      bridge.layout = { dpr, reserveCss };
      return { w: Math.round(w * dpr), h: Math.round(h * dpr) };
    };

    const { w, h } = readLayout();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: w,
      height: h,
      transparent: true,
      banner: false,
      scale: { mode: Phaser.Scale.NONE },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, debug: false } },
      // On-screen controls are HTML; the canvas itself takes no pointer input.
      input: { keyboard: true, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
    });
    game.scene.add('level', LevelScene, true, { bridge });
    // Development-only handle for debugging in the browser console.
    if (import.meta.env.DEV) (window as unknown as { __letterGame?: unknown }).__letterGame = { game, bridge };

    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const size = readLayout();
        if (size.w !== game.scale.width || size.h !== game.scale.height) {
          game.scale.resize(size.w, size.h);
        } else {
          // the controls' reserved height may have changed without a size change
          bridge.toScene.emit('relayout');
        }
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    window.addEventListener('orientationchange', onResize);

    // Never leave the cat walking when the tab loses focus.
    const release = () => bridge.input.reset();
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
      bridge.input.reset();
      game.destroy(true);
    };
  }, [bridge]);

  return (
    <div ref={hostRef} className="game-host" aria-hidden="true">
      {/* Invisible box matching the touch-control area (incl. safe area).
          The scene reads its height to keep the street above the buttons. */}
      <div className="controls-reserve" data-controls-reserve />
    </div>
  );
}

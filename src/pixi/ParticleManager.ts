/**
 * ParticleManager — GPU-accelerated particle effects.
 */
import { Container, Graphics, Ticker, TickerCallback } from 'pixi.js';

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export class ParticleManager extends Container {
  private particles: Particle[] = [];
  private _ticker: TickerCallback<unknown>;

  constructor() {
    super();
    this._ticker = (t) => this._update(t.deltaTime);
    Ticker.shared.add(this._ticker);
  }

  burstCoins(x: number, y: number, count = 30) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      this._spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: 0xffd700,
        size: 5 + Math.random() * 5,
        life: 60 + Math.random() * 40,
      });
    }
  }

  sparkRing(x: number, y: number, radius = 40, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 2;
      this._spawn(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ([0xffd700, 0x00ffff, 0xff00ff] as number[])[i % 3],
          size: 3 + Math.random() * 3,
          life: 30 + Math.random() * 20,
        }
      );
    }
  }

  jackpotBurst(x: number, y: number) {
    const colors = [0xffd700, 0xffa500, 0xffff00, 0x00ffff] as number[];
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this._spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[i % 4],
        size: 4 + Math.random() * 6,
        life: 90 + Math.random() * 60,
      });
    }
    for (let i = 0; i < 40; i++) {
      this._spawn(x + (Math.random() - 0.5) * 300, y - 50, {
        vx: (Math.random() - 0.5) * 3,
        vy: -5 - Math.random() * 5,
        color: 0xffd700,
        size: 6 + Math.random() * 6,
        life: 120 + Math.random() * 60,
      });
    }
  }

  clear() {
    for (const p of this.particles) p.gfx.destroy();
    this.particles = [];
  }

  private _spawn(
    x: number, y: number,
    opts: { vx: number; vy: number; color: number; size: number; life: number }
  ) {
    const gfx = new Graphics().circle(0, 0, opts.size).fill({ color: opts.color });
    gfx.x = x;
    gfx.y = y;
    this.addChild(gfx);
    this.particles.push({ gfx, maxLife: opts.life, ...opts });
  }

  private _update(dt: number) {
    const gravity = 0.3;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.gfx.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= 0.97;
      p.vy += gravity * dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.gfx.alpha = p.life / p.maxLife;
    }
  }

  destroy(options?: any) {
    Ticker.shared.remove(this._ticker);
    this.clear();
    super.destroy(options);
  }
}

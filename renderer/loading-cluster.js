/**
 * LoadingCluster — 3×3 簇旋转加载动画（可复用组件）
 * 从 loading-animation.html 抽取，零依赖。
 *
 * 用法：
 *   const lc = new LoadingCluster(canvasEl, {
 *     colors: [[240,130,0],[0,168,84],[240,19,13]], // 每组颜色
 *     cell: 20,       // 单个格子边长 px
 *     glow: 0.6,      // 光晕强度
 *     speed: 1,       // 旋转速度倍率
 *     cluster: 4,     // 簇大小（格数）
 *     freq: 2,        // 呼吸频率倍率
 *   });
 *   lc.start();
 *   lc.stop();
 */
(function (global) {
  'use strict';

  const RING = [[0,1],[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2]]; // 逆时针 [row,col]
  const cellAngle = Math.PI * 2 / 8;
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeGroup(color) {
    const groupPhase = rand(0, Math.PI * 2);
    const ring = RING.map((_, i) => {
      const c = {
        phase: rand(0, Math.PI * 2),
        freq:  rand(0.85, 1.6),
        amp:   rand(0.15, 0.34),
        idlePhase: rand(0, Math.PI * 2),
        idleFreq:  rand(0.5, 1.6),
        idleAmp:   rand(0.03, 0.09),
      };
      if (i % 2 === 0) {
        c.cross = true;
        c.crossPhase = groupPhase + rand(-0.3, 0.3);
        c.crossFreq  = rand(0.4, 0.8);
        c.crossAmp   = rand(0.35, 0.6);
      } else {
        c.corner = true;
        c.cornerPhase = groupPhase + Math.PI + rand(-0.3, 0.3);
        c.cornerFreq  = rand(0.4, 0.8);
        c.cornerAmp   = rand(0.35, 0.6);
      }
      return c;
    });
    return {
      color,
      theta: rand(0, Math.PI * 2),
      ring,
      center: { phase: rand(0, Math.PI * 2), freq: rand(0.4, 0.8) },
    };
  }

  class LoadingCluster {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      this.colors = opts.colors || [[240,130,0],[0,168,84],[240,19,13]];
      this.cell   = opts.cell   || 20;
      this.gap    = opts.gap    || 2;
      this.rad    = opts.rad    != null ? opts.rad : 1;
      this.glow   = opts.glow   != null ? opts.glow : 0.6;
      this.halo   = opts.halo   != null ? opts.halo : 75;
      this.speed  = opts.speed  != null ? opts.speed : 1;
      this.cluster= opts.cluster!= null ? opts.cluster : 4;
      this.freq   = opts.freq   != null ? opts.freq : 2;
      this.amp    = opts.amp    != null ? opts.amp : 1;

      this.groups = this.colors.map(c => makeGroup(c));

      this.t = 0;
      this._last = 0;
      this._raf = null;
      this._running = false;

      this._layout();
      this._resize();
    }

    _layout() {
      const GROUP = 3 * this.cell + 2 * this.gap;
      const MARGIN = Math.round(this.cell * 1.2);   // 光晕留白（组件内紧凑）
      const H_GAP = Math.round(this.cell * 1.6);
      const n = this.groups.length;
      this.W = MARGIN * 2 + n * GROUP + (n - 1) * H_GAP;
      this.H = MARGIN * 2 + GROUP;
      this._GROUP = GROUP;
      this._MARGIN = MARGIN;
      this._H_GAP = H_GAP;
      this._cellCx = (base, c) => base + c * (this.cell + this.gap);
      this._cellCy = (base, r) => base + r * (this.cell + this.gap);
    }

    _resize() {
      const dpr = (global.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
      this.canvas.style.width = this.W + 'px';
      this.canvas.style.height = this.H + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _rr(x, y, w, h, r) {
      const ctx = this.ctx;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    }

    _clusterWeight(d, arc, t) {
      if (d >= arc) return 0;
      const steps = d / cellAngle;
      const base = Math.max(0, 1 - 0.2 * steps);
      const wave = 1 + 0.06 * Math.sin(steps * 2.1 - t * 9);
      return Math.max(0, base * wave);
    }

    _drawGroup(g, xBase, yBase) {
      const ctx = this.ctx;
      const CELL = this.cell, RAD = this.rad, GROUP = this._GROUP;

      // 3×3 底格：本组色 25% 透明度
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        this._rr(this._cellCx(xBase, c), this._cellCy(yBase, r), CELL, CELL, RAD);
        ctx.fillStyle = `rgba(${g.color[0]},${g.color[1]},${g.color[2]},0.25)`;
        ctx.fill();
      }

      // 方形柔光：覆盖整组
      {
        ctx.save();
        ctx.filter = `blur(${Math.round(CELL * 0.9)}px)`;
        this._rr(xBase, yBase, GROUP, GROUP, RAD);
        ctx.fillStyle = `rgba(${g.color[0]},${g.color[1]},${g.color[2]},0.4)`;
        ctx.fill();
        ctx.restore();
        ctx.filter = 'none';
      }

      const lit = (rc, cc, intensity) => {
        const a = Math.max(0, Math.min(1, intensity));
        const [R, G, B] = g.color;
        const x = this._cellCx(xBase, cc), y = this._cellCy(yBase, rc);
        const cx = x + CELL / 2, cy = y + CELL / 2;

        if (a >= 0.12) {
          const baseA = Math.min(0.92, (0.20 + a * 0.55) * this.glow);
          const radius = (CELL * 0.6 + a * this.halo) * this.glow;
          if (radius > 1 && baseA > 0.01) {
            const grad = ctx.createRadialGradient(cx, cy, CELL * 0.1, cx, cy, radius);
            grad.addColorStop(0,    `rgba(${R},${G},${B},${baseA})`);
            grad.addColorStop(0.35, `rgba(${R},${G},${B},${baseA * 0.55})`);
            grad.addColorStop(0.7,  `rgba(${R},${G},${B},${baseA * 0.18})`);
            grad.addColorStop(1,    `rgba(${R},${G},${B},0)`);
            ctx.save();
            ctx.fillStyle = grad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();
          }
        }

        this._rr(x, y, CELL, CELL, RAD);
        ctx.fillStyle = `rgba(${R},${G},${B},${a})`;
        ctx.fill();
      };

      const arc = this.cluster * cellAngle;
      const t = this.t;

      // 中心块：慢速大呼吸 + 8 拍联动
      const cb = g.center;
      const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * cb.freq * this.freq * t + cb.phase);
      const shaped = Math.pow(pulse, 1.6);
      const sync = 1 + 0.15 * Math.cos(8 * g.theta);
      lit(1, 1, 0.02 + 0.98 * shaped * sync);

      // 8 环绕块
      for (let i = 0; i < 8; i++) {
        const [rc, cc] = RING[i];
        const a = i * cellAngle;
        let d = g.theta - a;
        d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const w = this._clusterWeight(d, arc, t);
        const cell = g.ring[i];
        const breath = 1 + cell.amp * this.amp * Math.sin(Math.PI * 2 * cell.freq * this.freq * t + cell.phase);
        const idle = 0.03 + cell.idleAmp * (0.5 + 0.5 * Math.sin(Math.PI * 2 * cell.idleFreq * t + cell.idlePhase));

        let cross = 0;
        if (cell.cross) {
          const cp = 0.5 + 0.5 * Math.sin(Math.PI * 2 * cell.crossFreq * this.freq * t + cell.crossPhase);
          cross = cell.crossAmp * Math.pow(cp, 1.6);
        }
        let corner = 0;
        if (cell.corner) {
          const cp = 0.5 + 0.5 * Math.sin(Math.PI * 2 * cell.cornerFreq * this.freq * t + cell.cornerPhase);
          corner = cell.cornerAmp * Math.pow(cp, 1.6);
        }

        lit(rc, cc, idle + w * breath + cross + corner);
      }
    }

    _draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.W, this.H);
      const n = this.groups.length;
      for (let i = 0; i < n; i++) {
        const xBase = this._MARGIN + i * (this._GROUP + this._H_GAP);
        this._drawGroup(this.groups[i], xBase, this._MARGIN);
      }
    }

    _frame = (now) => {
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this.t += dt;
      for (const g of this.groups) g.theta += (Math.PI * 2 / 0.8) * this.speed * dt;
      this._draw();
      this._raf = requestAnimationFrame(this._frame);
    };

    start() {
      if (this._running) return;
      this._running = true;
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._frame);
    }

    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  global.LoadingCluster = LoadingCluster;
})(window);

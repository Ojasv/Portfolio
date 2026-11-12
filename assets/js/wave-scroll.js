/*! wave-scroll.js v2 — photo-matched, scroll-driven ocean waves (canvas). No dependencies.
 * <section id="hero" class="relative h-[220vh]">
 *   <div class="sticky top-0 h-screen overflow-hidden">
 *     <img src="hero.jpg" class="absolute inset-0 w-full h-full object-cover">
 *     <canvas data-wave-scroll data-trigger="#hero" data-texture="water-texture.jpg"
 *             class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
 *   </div>
 * </section>
 * data-*: texture (water photo crop, tiles mirrored), layers (2–5), amplitude, rise (0–1.2),
 *   speed, foam (0–2), idle (true|false), bg (colour the water deepens into), trigger (selector).
 * Sets --wave-p (0→1) on the trigger for CSS parallax.
 */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // palette sampled from the hero photograph
  var TINT = [[7, 85, 113], [10, 111, 135], [36, 116, 137]];   // far → near water body
  var FACE = 'rgba(4,72,86,', LIP = 'rgba(70,196,200,', FOAM = 'rgba(244,250,252,';

  function hash(a, b) { var h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); }
  function hexRgb(c) {
    var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(c.trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [22, 24, 38];
  }
  function read(el) {
    var d = el.dataset;
    return {
      texture: d.texture || '',
      texTop: +(d.textureTop == null ? 0.5 : d.textureTop),          // row (0–1) of the photo where the texture crop starts
      imgAspect: +(d.imageAspect || 2.3256),
      photoX: d.photoX == null ? 0.5 : +d.photoX,   // photo x (0–1) kept centred when the screen is narrower than the photo (match object-position / shore-scroll data-focus-x)
      focus: (d.foamFocus || '0.7,0.16,0.32').split(',').map(Number),  // photo x (0–1) of the breaking foam, left spread, right spread                          // hero photo width / height (object-cover math)
      layers: Math.min(5, Math.max(1, +(d.layers || 3))),
      amp: +(d.amplitude || 1),
      rise: +(d.rise == null ? 1 : d.rise),
      speed: +(d.speed || 1),
      foam: +(d.foam == null ? 1 : d.foam),
      idle: d.idle !== 'false' && !reduce,
      bg: hexRgb(d.bg || '#161826'),
      range: (d.range || '0,1').split(',').map(Number),
      trigger: (d.trigger && document.querySelector(d.trigger)) || el.parentElement
    };
  }

  function loadTexture(st) {
    st.pattern = null;
    if (!st.o.texture) return;
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      st.tex = c; st.pattern = st.ctx.createPattern(c, 'repeat-x');
    };
    img.src = st.o.texture;
  }

  function progress(st) {
    var r = st.o.trigger.getBoundingClientRect();
    var span = Math.max(1, r.height - innerHeight) || r.height;
    var raw = Math.min(1, Math.max(0, -r.top / span)), a = st.o.range[0], b = st.o.range[1];
    return Math.min(1, Math.max(0, (raw - a) / Math.max(0.001, b - a)));
  }

  // trochoid-like profile: sharp crests, long flat troughs. returns 0 (trough) … 1 (crest)
  function swell(th) { var s = (1 + Math.sin(th)) * 0.5; return Math.pow(s, 2.2); }

  function frame(st, now) {
    var o = st.o, cv = st.el, ctx = st.ctx;
    var W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(1.25, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    if (!st.buf) st.buf = document.createElement('canvas');
    if (st.buf.width !== cv.width || st.buf.height !== cv.height) { st.buf.width = cv.width; st.buf.height = cv.height; }
    var out = ctx;
    out.setTransform(1, 0, 0, 1, 0, 0); out.clearRect(0, 0, cv.width, cv.height);
    ctx = st.buf.getContext('2d');

    var target = progress(st), dv = Math.abs(target - st.last); st.last = target;
    st.energy = Math.min(1, st.energy * 0.94 + dv * 8);
    st.p += (target - st.p) * 0.08;
    o.trigger.style.setProperty('--wave-p', st.p.toFixed(4));
    var p = st.p, ep = p * p * (3 - 2 * p);              // smoothstep for rise
    var t = o.idle ? now / 1000 : 0, n = o.layers, step = Math.max(4, W / 220);
    var fade = 1 - Math.min(1, Math.max(0, (p - 0.25) / 0.7)); fade = fade * fade * (3 - 2 * fade);
    var hi = H;
    if (fade < 0.01) { if (!st.cleared) { out.setTransform(1, 0, 0, 1, 0, 0); out.clearRect(0, 0, cv.width, cv.height); st.cleared = true; } return; }
    st.cleared = false;
    var ia = o.imgAspect, cDw, cDh; if (W / H > ia) { cDw = W; cDh = W / ia; } else { cDh = H; cDw = H * ia; }
    var fX = offX(o, W, cDw) + o.focus[0] * cDw, sL = o.focus[1] * cDw * 1.4, sR = o.focus[2] * cDw * 1.2;
    var lineY = (H - cDh) / 2 + 0.68 * cDh;                // photo's breaking foam line, on screen
    function hump(x) { var dd = x - fX, sp = dd < 0 ? sL : sR; return Math.exp(-(dd * dd) / (sp * sp)); }

    for (var i = 0; i < n; i++) {
      var k = n === 1 ? 1 : i / (n - 1);                   // 0 far → 1 near
      var scale = 0.55 + 0.75 * k;                         // perspective: nearer = bigger
      var base = H * (0.9 + 0.08 * k) - H * 0.08 * o.rise * ep * (0.55 + 0.6 * k);
      var A = H * 0.045 * scale * o.amp * (1 + st.energy * 0.25);
      var len = W * (0.38 + 0.5 * k);
      var f = Math.PI * 2 / len;
      var ph = t * (0.45 - 0.15 * k) * 1.2 + p * 7 * o.speed * (0.5 + k) + i * 2.1;   // crests travel left
      var ys = [], xs = [];
      for (var x = -step; x <= W + step; x += step) {
        var th = x * f + ph;
        var y = base - A * (swell(th) * 1.6 - 0.3)
          - A * 0.22 * Math.sin(x * f * 2.7 - ph * 1.3 + i)
          - A * 0.08 * Math.sin(x * f * 6.3 + ph * 2.1);
        xs.push(x); ys.push(y);
      }
      var top = Math.min.apply(null, ys);

      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // body
      ctx.save();
      ctx.beginPath(); ctx.moveTo(xs[0], H + 2);
      for (var j = 0; j < xs.length; j++) ctx.lineTo(xs[j], ys[j]);
      ctx.lineTo(xs[xs.length - 1], H + 2); ctx.closePath();
      ctx.clip();
      var c = TINT[Math.round(k * (TINT.length - 1))];
      ctx.fillStyle = 'rgb(' + c + ')'; ctx.fillRect(0, top - 2, W, H - top + 4);
      if (st.pattern) {
        // place the crop exactly where that water sits in the cover-fitted photo: same scale on both axes,
        // same rows on screen → ripple size, direction and perspective all match the photo behind
        var ia = o.imgAspect, Dw, Dh;
        if (W / H > ia) { Dw = W; Dh = W / ia; } else { Dh = H; Dw = H * ia; }
        var s = (Dh * (1 - o.texTop)) / st.tex.height, tw = st.tex.width * s;
        var ty = (H - Dh) / 2 + o.texTop * Dh, tx = offX(o, W, Dw);
        st.pattern.setTransform(new DOMMatrix().translate(tx - ((t * (10 + 8 * k)) % tw), ty).scale(s, s));
        ctx.globalAlpha = 0.9 - 0.25 * (1 - k);
        ctx.fillStyle = st.pattern; ctx.fillRect(0, top - 2, W, H - top + 4);
        ctx.globalAlpha = 1;
      }
      // far layers sit in haze so they melt into the photo
      if (k < 1) { ctx.fillStyle = 'rgba(' + TINT[0] + ',' + (0.35 * (1 - k)).toFixed(3) + ')'; ctx.fillRect(0, top - 2, W, H - top + 4); }
      // depth: water darkens into page bg as it rises

      // crest-following shading: translucent lip, then the darker wave face
      ctx.lineJoin = 'round';
      var sg = ctx.createLinearGradient(0, top, 0, top + A * 4);
      sg.addColorStop(0, LIP + '0.18)'); sg.addColorStop(0.25, LIP + '0.05)');
      sg.addColorStop(0.6, FACE + (0.22 * (0.5 + k * 0.5)).toFixed(3) + ')'); sg.addColorStop(1, FACE + '0)');
      ctx.fillStyle = sg; ctx.fillRect(0, top - 2, W, A * 4 + 4);
      ctx.restore();
      // 4. feather the top edge so it melts into whatever is behind
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.lineJoin = 'round';
      var fe = A * (0.5 + 0.5 * (1 - k)) + 4;
      for (var q = 1; q <= 8; q++) strokeCrest(ctx, xs, ys, fe * 0.12 * q, 'rgba(0,0,0,0.13)', fe * q / 4);
      ctx.restore();

      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      var tg = ctx.createLinearGradient(0, top, 0, top + (H - top) * 0.75);
      tg.addColorStop(0, 'rgba(0,0,0,0.6)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, top - 2, W, H - top + 4); ctx.restore();
      foam(st, ctx, xs, ys, f, ph, A, i, k, W, step);
      out.globalAlpha = fade; out.drawImage(st.buf, 0, 0); out.globalAlpha = 1;
      if (top < hi) hi = top;
    }

  }

  function strokeCrest(ctx, xs, ys, off, col, lw) {
    ctx.beginPath();
    for (var j = 0; j < xs.length; j++) ctx[j ? 'lineTo' : 'moveTo'](xs[j], ys[j] + off);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
  }

  // left edge of the cover-fitted photo on screen, honouring the focal point (same maths as shore-scroll.js)
  function offX(o, W, Dw) { return Math.min(0, Math.max(W - Dw, W / 2 - o.photoX * Dw)); }

  // bubbly whitewater anchored in wave-space, densest where the photo's wave breaks (by the feet)
  function foam(st, ctx, xs, ys, f, ph, A, i, k, W, step) {
    var o = st.o; if (o.foam <= 0 || k < 0.5) return;
    var H = st.el.clientHeight, ia = o.imgAspect, Dw, Dh;
    if (W / H > ia) { Dw = W; Dh = W / ia; } else { Dh = H; Dw = H * ia; }
    var fX = offX(o, W, Dw) + o.focus[0] * Dw, sL = o.focus[1] * Dw, sR = o.focus[2] * Dw;
    function weight(x) { var dd = x - fX, sp = dd < 0 ? sL : sR; return 0.1 + 0.9 * Math.exp(-(dd * dd) / (sp * sp)); }
    function cy(x) { var u = (x + step) / step, j = Math.max(0, Math.min(ys.length - 2, Math.floor(u))), fr = Math.min(1, Math.max(0, u - j)); return ys[j] + (ys[j + 1] - ys[j]) * fr; }
    var amt = Math.min(1.1, o.foam * (0.45 + 0.75 * k));
    var n0 = Math.floor(ph / (Math.PI * 2)) - 1, n1 = Math.min(n0 + 12, Math.ceil((W * f + ph) / (Math.PI * 2)) + 1);
    var per = Math.round(140 + 260 * k), size = 1.0 + 2.6 * k;
    ctx.save();
    for (var n = n0; n <= n1; n++) {
      var br = Math.min(1, Math.max(0, hash(n, i * 9.7) * 1.3 - 0.15)) * amt;
      if (br < 0.04) continue;
      for (var j = 0; j < per; j++) {
        var r1 = hash(n * 13 + j, i), r2 = hash(j, n * 7 + i), r3 = hash(j * 3 + n, i * 5);
        var x = (Math.PI * 2 * n + Math.PI * (0.05 + 0.95 * r1) - ph) / f;
        if (x < -10 || x > W + 10) continue;
        var w = weight(x); if (r3 > w * 1.15) continue;        // sparse away from the break
        var lace = r2 * r2;
        var y = cy(x) - A * 0.12 * (1 - r2) + lace * A * (1 + 0.8 * w) * br;
        var al = br * w * (1 - lace * 0.6) * (0.55 + 0.45 * r3);
        var r = size * (0.5 + r3 * 1.3) * (1 - lace * 0.5);
        ctx.fillStyle = FOAM + Math.min(0.85, al).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r, 0, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
  }

  function init(el) {
    if (el.__wave) return refresh(el);
    if (el.tagName !== 'CANVAS') { var c = document.createElement('canvas'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; el.appendChild(c); el.__canvasHost = true; }
    var cv = el.tagName === 'CANVAS' ? el : el.querySelector('canvas');
    var st = { el: cv, host: el, o: read(el), p: 0, last: 0, energy: 0, visible: true, t2: 0 };
    st.ctx = cv.getContext('2d');
    st.p = st.last = progress(st);
    el.__wave = st;
    loadTexture(st);
    if ('IntersectionObserver' in window) {
      st.io = new IntersectionObserver(function (e) { st.visible = e[0].isIntersecting; if (st.visible) loop(); });
      st.io.observe(cv);
    }
    function loop() {
      if (st.raf || st.dead) return;
      st.raf = requestAnimationFrame(function tick(now) {
        st.raf = 0;
        if (st.dead || !st.visible) return;
        st.t2 = st.o.idle ? now / 1000 : 0;
        frame(st, now);
        st.raf = requestAnimationFrame(tick);
      });
    }
    st.loop = loop; loop();
    return st;
  }
  function refresh(el) {
    var st = el.__wave; if (!st) return init(el);
    var prev = st.o.texture; st.o = read(el);
    if (st.o.texture !== prev) loadTexture(st);
    st.loop(); return st;
  }
  function destroy(el) { var st = el.__wave; if (!st) return; st.dead = true; cancelAnimationFrame(st.raf); st.io && st.io.disconnect(); delete el.__wave; }
  function initAll() { document.querySelectorAll('[data-wave-scroll]').forEach(init); hoverUpdate(); }

  // [data-hover-color="<zone selector>"] → grayscale until the pointer is over the zone or any [data-hover-include]
  var mx = -1, my = -1;
  function hoverUpdate() {
    document.querySelectorAll('[data-hover-color]').forEach(function (el) {
      var zone = (el.dataset.hoverColor && document.querySelector(el.dataset.hoverColor)) || el;
      var z = zone.getBoundingClientRect(), on = false;
      var inRect = function (r) { return mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom; };
      if (mx >= 0) {
        on = inRect(z);
        if (!on && z.bottom > 0 && z.top < innerHeight)
          document.querySelectorAll('[data-hover-include]').forEach(function (n) { if (inRect(n.getBoundingClientRect())) on = true; });
      }
      el.style.transition = 'filter 1.6s cubic-bezier(0.45, 0, 0.25, 1)';
      var f = on ? 'grayscale(0)' : 'grayscale(1)';
      if (el.style.filter !== f) el.style.filter = f;
    });
  }
  addEventListener('mousemove', function (e) {
    mx = e.clientX; my = e.clientY; hoverUpdate();
  }, { passive: true });
  addEventListener('scroll', hoverUpdate, { passive: true });
  document.addEventListener('mouseleave', function () { mx = my = -1; hoverUpdate(); });

  window.WaveScroll = { hoverUpdate: hoverUpdate, init: init, refresh: refresh, destroy: destroy, initAll: initAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
})();

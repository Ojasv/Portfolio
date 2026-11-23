// Zoomable, pannable t-SNE plot of image crops drawn on a canvas.
// Markup: <canvas data-tsne data-atlas="sprites.webp" data-points="points.json">, with optional
// [data-tsne-zoom="in|out|reset"] buttons and a [data-tsne-level] readout inside the same [data-tsne-wrap].
// Trackpad pinch (ctrl+wheel) and touch pinch zoom; drag pans; two-finger scroll pans once zoomed.
(function () {
  'use strict';
  var LABELS = [
    { name: 'Red', color: '#ff6b5a' },
    { name: 'Orange', color: '#ff9a3c' },
    { name: 'Amber', color: '#ffc24a' },
    { name: 'Green', color: '#3ee6a8' },
    null // blue crops sit inside the green cluster and get no label of their own
  ];
  var WORLD_W = 1000, WORLD_H = 620, CROP_W = 13, MAX_ZOOM = 14;

  function init(canvas) {
    var wrap = canvas.closest('[data-tsne-wrap]') || canvas.parentElement;
    var ctx = canvas.getContext('2d');
    var atlas = new Image();
    var data = null, cropH = 0, view = { s: 1, x: 0, y: 0 }, fit = 1, cw = 0, ch = 0, raf = 0;
    var labels = [], B = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
    var level = wrap.querySelector('[data-tsne-level]');

    function worldOf(p) { return [WORLD_W / 2 + p[0] * 460, WORLD_H / 2 - p[1] * 260.4]; }

    function prepare() {
      cropH = CROP_W * data.th / data.tw;
      var groups = {};
      data.pts.forEach(function (p) {
        var w = worldOf(p); p.wx = w[0]; p.wy = w[1];
        (groups[p[3]] = groups[p[3]] || []).push(p);
      });
      // draw in a stable shuffled order so no cluster sits entirely on top
      data.pts.sort(function (a, b) { return ((a[2] * 7919 + a.wx * 31) % 97) - ((b[2] * 7919 + b.wx * 31) % 97); });
      var xs0 = data.pts.map(function (p) { return p.wx; }), ys0 = data.pts.map(function (p) { return p.wy; });
      var minx = Math.min.apply(null, xs0), maxx = Math.max.apply(null, xs0), miny = Math.min.apply(null, ys0), maxy = Math.max.apply(null, ys0);
      B = { x: minx - 30, y: miny - 50, w: maxx - minx + 60, h: maxy - miny + 80 };
      labels = [];
      Object.keys(groups).forEach(function (k) {
        var L = LABELS[k]; if (!L) return;
        var g = groups[k], xs = g.map(function (p) { return p.wx; }), ys = g.map(function (p) { return p.wy; }).sort(function (a, b) { return a - b; });
        var mx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
        labels.push({ x: mx, y: ys[Math.floor(ys.length * 0.02)] - cropH, name: L.name, color: L.color, n: g.length });
      });
    }

    function resize() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
      var first = !cw;
      var cx = first ? 0 : (cw / 2 - view.x) / view.s, cy = first ? 0 : (ch / 2 - view.y) / view.s, rel = first ? 1 : view.s / fit;
      cw = r.width; ch = r.height;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fit = Math.min(cw / B.w, ch / B.h);
      if (first) reset(); else { view.s = fit * rel; view.x = cw / 2 - cx * view.s; view.y = ch / 2 - cy * view.s; clamp(); }
      draw();
    }
    function reset() { view.s = fit; view.x = (cw - B.w * fit) / 2 - B.x * fit; view.y = (ch - B.h * fit) / 2 - B.y * fit; }
    function clamp() {
      view.s = Math.max(fit, Math.min(fit * MAX_ZOOM, view.s));
      var w = B.w * view.s, h = B.h * view.s, ox = B.x * view.s, oy = B.y * view.s;
      view.x = w <= cw ? (cw - w) / 2 - ox : Math.min(-ox, Math.max(cw - w - ox, view.x));
      view.y = h <= ch ? (ch - h) / 2 - oy : Math.min(-oy, Math.max(ch - h - oy, view.y));
      canvas.style.touchAction = view.s > fit * 1.01 ? 'none' : 'pan-y';
      canvas.style.cursor = view.s > fit * 1.01 ? 'grab' : 'zoom-in';
    }
    function zoomAt(f, px, py) {
      var wx = (px - view.x) / view.s, wy = (py - view.y) / view.s;
      view.s *= f; clamp();
      view.x = px - wx * view.s; view.y = py - wy * view.s; clamp(); queue();
    }
    function queue() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); }

    function draw() {
      ctx.clearRect(0, 0, cw, ch);
      if (!data || !atlas.complete) return;
      var s = view.s, w = CROP_W * s, h = cropH * s, tw = data.tw, th = data.th, cols = data.cols;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      for (var i = 0; i < data.pts.length; i++) {
        var p = data.pts[i], x = view.x + p.wx * s - w / 2, y = view.y + p.wy * s - h / 2;
        if (x > cw || y > ch || x + w < 0 || y + h < 0) continue;
        var v = p[2];
        ctx.drawImage(atlas, (v % cols) * tw, Math.floor(v / cols) * th, tw, th, x, y, w, h);
      }
      var fs = cw < 500 ? 10 : 13;
      ctx.font = '500 ' + fs + 'px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
      labels.forEach(function (l) {
        var x = view.x + l.x * s, y = view.y + l.y * s - 8;
        var t1 = l.name, t2 = '  ' + l.n.toLocaleString('en-GB') + ' crops';
        ctx.font = '500 ' + fs + 'px Inter, system-ui, sans-serif'; var w1 = ctx.measureText(t1).width;
        ctx.font = '400 ' + fs + 'px Inter, system-ui, sans-serif'; var w2 = ctx.measureText(t2).width;
        var x0 = x - (w1 + w2 + fs) / 2;
        ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(x0 + fs * 0.35, y - fs * 0.35, fs * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e9e9ed'; ctx.font = '500 ' + fs + 'px Inter, system-ui, sans-serif'; ctx.fillText(t1, x0 + fs, y);
        ctx.fillStyle = '#9397ab'; ctx.font = '400 ' + fs + 'px Inter, system-ui, sans-serif'; ctx.fillText(t2, x0 + fs + w1, y);
      });
      if (level) level.textContent = Math.round(view.s / fit * 100) + '%';
    }

    function local(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    canvas.addEventListener('wheel', function (e) {
      var zoomed = view.s > fit * 1.01;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); var p = local(e);
        var dy = Math.max(-30, Math.min(30, e.deltaY * (e.deltaMode ? 16 : 1)));
        zoomAt(Math.exp(-dy * 0.01), p[0], p[1]);
      } else if (zoomed) {
        e.preventDefault(); view.x -= e.deltaX; view.y -= e.deltaY; clamp(); queue();
      }
    }, { passive: false });

    var ptrs = new Map(), last = null;
    function gesture() {
      var a = Array.from(ptrs.values());
      if (a.length === 1) return { x: a[0][0], y: a[0][1], d: 0 };
      return { x: (a[0][0] + a[1][0]) / 2, y: (a[0][1] + a[1][1]) / 2, d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) };
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && ptrs.size === 0 && view.s <= fit * 1.01 && !e.isPrimary) return;
      ptrs.set(e.pointerId, local(e)); last = gesture();
      if (e.pointerType !== 'touch' || ptrs.size > 1 || view.s > fit * 1.01) canvas.setPointerCapture(e.pointerId);
      if (view.s > fit * 1.01) canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, local(e));
      var g = gesture();
      if (ptrs.size >= 2 && last.d && g.d) {
        var f = g.d / last.d, wx = (last.x - view.x) / view.s, wy = (last.y - view.y) / view.s;
        view.s *= f; clamp(); view.x = g.x - wx * view.s; view.y = g.y - wy * view.s;
      } else if (ptrs.size === 1 && (e.pointerType !== 'touch' || view.s > fit * 1.01)) {
        view.x += g.x - last.x; view.y += g.y - last.y;
      }
      clamp(); last = g; queue();
    });
    function up(e) { ptrs.delete(e.pointerId); last = ptrs.size ? gesture() : null; clamp(); }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', function (e) { var p = local(e); zoomAt(2, p[0], p[1]); });

    wrap.querySelectorAll('[data-tsne-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-tsne-zoom');
        if (k === 'reset') { reset(); clamp(); queue(); } else zoomAt(k === 'in' ? 1.6 : 1 / 1.6, cw / 2, ch / 2);
      });
    });

    new ResizeObserver(resize).observe(canvas);
    atlas.onload = queue;
    atlas.src = canvas.getAttribute('data-atlas');
    fetch(canvas.getAttribute('data-points')).then(function (r) { return r.json(); }).then(function (d) {
      data = d; prepare(); resize();
    });
    if (document.fonts) document.fonts.ready.then(queue);
  }
  document.querySelectorAll('canvas[data-tsne]').forEach(init);
})();

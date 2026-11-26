/* Shared behaviour for every page: mobile menu, header background on scroll, footer year. No dependencies. */
(function () {
  var header = document.getElementById('site-header');
  var toggle = document.querySelector('[data-menu-toggle]');
  var menu = document.querySelector('[data-menu]');

  if (toggle && menu) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      header && header.classList.toggle('is-open', open);
      menu.inert = !open;                       // closed menu is out of the tab order
    };
    setOpen(false);
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); } });
    document.addEventListener('click', function (e) { if (header && !header.contains(e.target)) setOpen(false); });
  }

  // Dropdowns (e.g. the résumé combo button on /about/): [data-dropdown] wraps a [data-dropdown-toggle] button and a
  // [data-dropdown-menu] list. Opens on click; closes on Escape, a click outside, or choosing an item.
  document.querySelectorAll('[data-dropdown]').forEach(function (root) {
    var btn = root.querySelector('[data-dropdown-toggle]');
    var list = root.querySelector('[data-dropdown-menu]');
    if (!btn || !list) return;
    var set = function (open) { btn.setAttribute('aria-expanded', String(open)); list.hidden = !open; };
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      set(open);
      if (open) { var first = list.querySelector('a, button'); first && first.focus(); }
    });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !list.hidden) { set(false); btn.focus(); }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !list.hidden) {
        var items = Array.prototype.slice.call(list.querySelectorAll('a, button'));
        var i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
        e.preventDefault();
      }
    });
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) set(false); });
    root.addEventListener('focusout', function (e) { if (e.relatedTarget && !root.contains(e.relatedTarget)) set(false); });
  });

  // Header gets a solid ground once the page has scrolled (pages can opt out with data-header="overlay" on <body>
  // to keep it transparent over a full-bleed hero until that hero has passed).
  if (header) {
    var overlay = document.body.dataset.header === 'overlay';
    var hero = overlay && document.querySelector('[data-header-until]');
    var update = function () {
      var limit = hero ? hero.getBoundingClientRect().bottom - header.offsetHeight : 8;
      var solid = hero ? limit <= 0 : window.scrollY > limit;
      header.classList.toggle('bg-ink/85', solid);
      header.classList.toggle('backdrop-blur', solid);
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  // Videos marked data-play-once play through once, then rest on the last frame. When the video has scrolled
  // completely out of view it rewinds, so it can play once more the next time (every time, not just the first).
  //   data-play-once         (card thumbnails) plays on hover or keyboard focus of its card. Touch screens cannot
  //                          hover, so there it plays once the whole thumbnail is in view.
  //   data-play-once="view"  plays once the whole video is in view (or it fills the screen, if taller than it).
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('video[data-play-once]').forEach(function (video) {
    if (reduce) return;
    var played = false;
    var playOnce = function () {
      if (played) return;
      played = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () { played = false; });
    };
    var rewind = function () {
      video.pause();
      video.currentTime = 0;
      played = false;
    };
    var onView = video.dataset.playOnce === 'view' || matchMedia('(hover: none)').matches;
    if (video.dataset.playOnce !== 'view') {
      var card = video.closest('.group') || video;
      card.addEventListener('mouseenter', playOnce);
      card.addEventListener('focusin', playOnce);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        if (!e.isIntersecting) { rewind(); return; }
        var full = e.intersectionRatio >= 0.98 || (e.rootBounds && e.intersectionRect.height >= e.rootBounds.height * 0.9);
        if (onView && full) playOnce();
      }, { threshold: Array.from({ length: 51 }, function (_, i) { return i / 50; }) }).observe(video);  // fine steps, so a video taller than the screen is seen once it fills it
    } else if (onView) { playOnce(); }
  });

  // Slide viewer: a figure link that points at an image opens in a modal instead of a new tab.
  // Click outside the slide (or press Esc) to close. Zoom 100-500% where you point: pinch, trackpad pinch or mouse
  // wheel, a click/tap on the slide, the toolbar, or + and -. When zoomed, drag (or arrow keys) to pan.
  var slideLinks = document.querySelectorAll('figure a[href$=".webp"], figure a[href$=".jpg"], figure a[href$=".png"]');
  if (slideLinks.length && window.HTMLDialogElement) {
    var MIN = 1, MAX = 5, opener = null;
    var icon = function (d) { return '<svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' + d + '</svg>'; };
    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Slide viewer');
    dlg.innerHTML =
      '<div class="lb-stage" data-lb-stage><img class="lb-img" alt="" draggable="false" data-lb-img></div>' +
      '<div class="lb-bar">' +
        '<button type="button" class="lb-btn" data-lb="out" aria-label="Zoom out">' + icon('<path d="M5 12h14"/>') + '</button>' +
        '<button type="button" class="lb-btn lb-level" data-lb="reset" aria-label="Reset zoom">100%</button>' +
        '<button type="button" class="lb-btn" data-lb="in" aria-label="Zoom in">' + icon('<path d="M5 12h14M12 5v14"/>') + '</button>' +
        '<span class="lb-sep" aria-hidden="true"></span>' +
        '<button type="button" class="lb-btn" data-lb="close" aria-label="Close">' + icon('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
      '</div>';
    document.body.appendChild(dlg);
    var stage = dlg.querySelector('[data-lb-stage]'), img = dlg.querySelector('[data-lb-img]');
    var label = dlg.querySelector('[data-lb="reset"]');
    var btnIn = dlg.querySelector('[data-lb="in"]'), btnOut = dlg.querySelector('[data-lb="out"]');
    var s = 1, tx = 0, ty = 0;

    // The slide's untransformed box: transforms scale around its centre, so the centre only moves by (tx, ty).
    var box = function () {
      // (offsets are layout values, so this is right even mid-animation; the dialog sits at the viewport origin)
      return { cx: img.offsetLeft + img.offsetWidth / 2, cy: img.offsetTop + img.offsetHeight / 2, w: img.offsetWidth, h: img.offsetHeight };
    };
    var render = function (animate) {
      var b = box(), sr = stage.getBoundingClientRect();
      // Keep the slide over the stage: no panning past its edges, and centred when it is smaller than the screen.
      var mx = Math.max(0, (b.w * s - sr.width) / 2), my = Math.max(0, (b.h * s - sr.height) / 2);
      var ox = sr.left + sr.width / 2 - b.cx, oy = sr.top + sr.height / 2 - b.cy;
      tx = Math.min(ox + mx, Math.max(ox - mx, tx)); ty = Math.min(oy + my, Math.max(oy - my, ty));
      if (s === 1) { tx = 0; ty = 0; }
      img.classList.toggle('is-animating', !!animate);
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      dlg.classList.toggle('is-zoomed', s > 1.001);
      label.textContent = Math.round(s * 100) + '%';
      btnOut.disabled = s <= MIN; btnIn.disabled = s >= MAX;
    };
    // Zoom to `next`, keeping the screen point (px, py) fixed under the finger or cursor.
    var zoomAt = function (next, px, py, animate) {
      next = Math.max(MIN, Math.min(MAX, next));
      var b = box();
      if (px == null) { var sr = stage.getBoundingClientRect(); px = sr.left + sr.width / 2; py = sr.top + sr.height / 2; }
      var k = next / s;
      tx = px - b.cx - (px - b.cx - tx) * k;
      ty = py - b.cy - (py - b.cy - ty) * k;
      s = next;
      render(animate);
    };
    var reset = function (animate) { s = 1; tx = 0; ty = 0; render(animate); };

    var open = function (link) {
      var thumb = link.querySelector('img');
      opener = link;
      img.src = link.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      dlg.showModal();
      reset(false);
      document.documentElement.style.overflow = 'hidden';
    };
    dlg.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
      if (opener) opener.focus();
    });
    slideLinks.forEach(function (link) {
      link.removeAttribute('target');
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  // let modified clicks open a tab
        e.preventDefault(); open(link);
      });
    });
    btnIn.addEventListener('click', function () { zoomAt(s * 1.5, null, null, true); });
    btnOut.addEventListener('click', function () { zoomAt(s / 1.5, null, null, true); });
    label.addEventListener('click', function () { reset(true); });
    dlg.querySelector('[data-lb="close"]').addEventListener('click', function () { dlg.close(); });

    // Pointers: one pointer drags (pans) a zoomed slide, two pointers pinch. A press that barely moves is a tap:
    // on the slide it zooms in (or back out), outside the slide it closes the viewer.
    var pts = new Map(), moved = 0, last = null, downOnImg = false;
    var mid = function () { var a = Array.from(pts.values()); return a.length < 2 ? a[0] : { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { moved = 0; downOnImg = e.target === img; }
      last = mid();
      dlg.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var m = mid();
      moved += Math.hypot(m.x - last.x, m.y - last.y);
      if (pts.size >= 2 && last.d) {
        moved += 10;                                                    // a pinch is never a tap
        zoomAt(s * m.d / last.d, last.x, last.y, false);
        tx += m.x - last.x; ty += m.y - last.y; render(false);
      } else if (s > 1) {
        tx += m.x - last.x; ty += m.y - last.y; render(false);
      }
      last = m;
    });
    var up = function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size) { last = mid(); return; }
      dlg.classList.remove('is-dragging');
      if (e.type === 'pointercancel' || moved > 6) return;
      if (downOnImg) { if (s > 1.001) reset(true); else zoomAt(2.5, e.clientX, e.clientY, true); }
      else dlg.close();
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    // Wheel and trackpad pinch (which arrives as a ctrl+wheel) zoom at the cursor.
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (s > 1.001 && !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(dy)) { tx -= e.deltaX; render(false); return; }  // two-finger sideways swipe pans
      zoomAt(s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY, false);
    }, { passive: false });
    addEventListener('resize', function () { if (dlg.open) render(false); });
    dlg.addEventListener('keydown', function (e) {
      var k = e.key, step = 80;
      if (k === '+' || k === '=') zoomAt(s * 1.5, null, null, true);
      else if (k === '-' || k === '_') zoomAt(s / 1.5, null, null, true);
      else if (k === '0') reset(true);
      else if (s > 1 && k === 'ArrowLeft') { tx += step; render(true); }
      else if (s > 1 && k === 'ArrowRight') { tx -= step; render(true); }
      else if (s > 1 && k === 'ArrowUp') { ty += step; render(true); }
      else if (s > 1 && k === 'ArrowDown') { ty -= step; render(true); }
      else return;
      e.preventDefault();
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

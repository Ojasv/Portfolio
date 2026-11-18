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
      }, { threshold: [0, 0.5, 0.9, 0.98, 1] }).observe(video);
    } else if (onView) { playOnce(); }
  });

  // Slide viewer: a figure link that points at an image opens in a modal instead of a new tab.
  // Click outside the slide (or press Esc) to close. Zoom with the toolbar buttons, a click on the slide, or + and -.
  var slideLinks = document.querySelectorAll('figure a[href$=".webp"], figure a[href$=".jpg"], figure a[href$=".png"]');
  if (slideLinks.length && window.HTMLDialogElement) {
    var levels = [1, 1.5, 2, 3, 4], level = 0, opener = null;
    var icon = function (d) { return '<svg aria-hidden="true" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' + d + '</svg>'; };
    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Slide viewer');
    dlg.innerHTML =
      '<div class="lb-stage" data-lb-stage><img class="lb-img" alt="" data-lb-img></div>' +
      '<div class="lb-bar">' +
        '<button type="button" class="lb-btn" data-lb="out" aria-label="Zoom out">' + icon('<path d="M5 12h14"/>') + '</button>' +
        '<span class="lb-level" data-lb-level aria-live="polite">100%</span>' +
        '<button type="button" class="lb-btn" data-lb="in" aria-label="Zoom in">' + icon('<path d="M5 12h14M12 5v14"/>') + '</button>' +
        '<span class="lb-sep" aria-hidden="true"></span>' +
        '<button type="button" class="lb-btn" data-lb="close" aria-label="Close">' + icon('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
      '</div>';
    document.body.appendChild(dlg);
    var stage = dlg.querySelector('[data-lb-stage]'), img = dlg.querySelector('[data-lb-img]');
    var label = dlg.querySelector('[data-lb-level]');
    var btnIn = dlg.querySelector('[data-lb="in"]'), btnOut = dlg.querySelector('[data-lb="out"]');
    var fitWidth = 0;

    var setLevel = function (next, cx, cy) {
      next = Math.max(0, Math.min(levels.length - 1, next));
      if (level === 0) fitWidth = img.getBoundingClientRect().width;     // the fitted size is the 100% reference
      var r = stage.getBoundingClientRect();
      cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy;
      var fx = (stage.scrollLeft + cx) / Math.max(stage.scrollWidth, 1), fy = (stage.scrollTop + cy) / Math.max(stage.scrollHeight, 1);
      level = next;
      dlg.classList.toggle('is-zoomed', level > 0);
      img.style.width = level > 0 ? Math.round(fitWidth * levels[level]) + 'px' : '';
      label.textContent = Math.round(levels[level] * 100) + '%';
      btnOut.disabled = level === 0; btnIn.disabled = level === levels.length - 1;
      requestAnimationFrame(function () {                               // keep the point under the cursor in place
        stage.scrollLeft = fx * stage.scrollWidth - cx;
        stage.scrollTop = fy * stage.scrollHeight - cy;
      });
    };
    var open = function (link) {
      var thumb = link.querySelector('img');
      opener = link;
      img.src = link.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      level = 0; img.style.width = ''; dlg.classList.remove('is-zoomed');
      label.textContent = '100%'; btnOut.disabled = true; btnIn.disabled = false;
      dlg.showModal();
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
    btnIn.addEventListener('click', function () { setLevel(level + 1); });
    btnOut.addEventListener('click', function () { setLevel(level - 1); });
    dlg.querySelector('[data-lb="close"]').addEventListener('click', function () { dlg.close(); });
    img.addEventListener('click', function (e) {
      var r = stage.getBoundingClientRect();
      setLevel(level === levels.length - 1 ? 0 : level + 1, e.clientX - r.left, e.clientY - r.top);
    });
    // A click anywhere outside the slide and the toolbar closes the viewer.
    dlg.addEventListener('click', function (e) {
      if (e.target === stage || e.target === dlg) dlg.close();
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setLevel(level + 1); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setLevel(level - 1); }
      else if (e.key === '0') { e.preventDefault(); setLevel(0); }
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

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

  // Videos marked data-play-once play through once, then rest on the last frame; a page reload starts fresh.
  //   data-play-once         (card thumbnails) on the first hover or keyboard focus of their card. Touch screens
  //                          cannot hover, so there the video plays once when it scrolls into view.
  //   data-play-once="view"  once the whole video is in view (or it fills the screen, if taller than the screen).
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
    var onView = video.dataset.playOnce === 'view';
    if (!onView) {
      var card = video.closest('.group') || video;
      card.addEventListener('mouseenter', playOnce);
      card.addEventListener('focusin', playOnce);
    }
    if ((onView || matchMedia('(hover: none)').matches) && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        var e = entries[0];
        var full = e.intersectionRatio >= 0.98 || (e.rootBounds && e.intersectionRect.height >= e.rootBounds.height * 0.9);
        if (onView ? full : e.isIntersecting && e.intersectionRatio >= 0.6) { playOnce(); io.disconnect(); }
      }, { threshold: [0.6, 0.8, 0.9, 0.98, 1] });
      io.observe(video);
    } else if (onView) { playOnce(); }
  });

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

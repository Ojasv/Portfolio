/* Shared behaviour for every page: mobile menu, header background on scroll, footer year. No dependencies. */
(function () {
  var header = document.getElementById('site-header');
  var toggle = document.querySelector('[data-menu-toggle]');
  var menu = document.querySelector('[data-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? 'Menu' : 'Close';
      menu.classList.toggle('hidden', open);
      header && header.classList.toggle('is-open', !open);
    });
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

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

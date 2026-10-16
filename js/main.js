(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  if (finePointer) root.classList.add('has-pointer');

  document.querySelectorAll('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------------------
     Loader: greetings flip, then the curtain lifts
     ------------------------------------------------------------------------ */

  function runLoader(done) {
    const loader = document.querySelector('.loader');
    const words = loader ? [...loader.querySelectorAll('.loader-word')] : [];

    // Skipped for reduced motion and on repeat views within the same tab.
    if (!loader || reduceMotion || !words.length || root.classList.contains('no-loader')) {
      if (loader) loader.remove();
      done();
      return;
    }

    try { sessionStorage.setItem('seen-loader', '1'); } catch (e) { /* private mode */ }

    // The first greeting is already visible via CSS; JS only flips the rest.
    const list = words[0].parentElement;
    const show = (i) => {
      words.forEach((w, j) => w.classList.toggle('is-active', j === i));
    };

    let i = 0;

    const next = () => {
      i += 1;
      if (i < words.length) {
        if (i === 1) list.classList.add('is-cycling');
        show(i);
        setTimeout(next, i === words.length - 1 ? 500 : 110);
        return;
      }
      loader.classList.add('is-out');
      setTimeout(done, 300);
      setTimeout(() => loader.remove(), 1100);
    };

    setTimeout(next, 450);
  }

  /* ------------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------------ */

  function setupReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-inview'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     Magnetic buttons (mouse only)
     ------------------------------------------------------------------------ */

  function setupMagnetic() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll('.magnetic').forEach((el) => {
      const strength = Number(el.dataset.strength) || 30;
      const inner = el.querySelector('.btn-text');
      const innerStrength = strength / 2;

      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add('is-magnet');
        el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
        if (inner) inner.style.transform = `translate3d(${dx * innerStrength}px, ${dy * innerStrength}px, 0)`;
      });

      el.addEventListener('mouseleave', () => {
        el.classList.remove('is-magnet');
        el.style.transform = '';
        if (inner) inner.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------------
     Quick press feedback on touch screens
     ------------------------------------------------------------------------ */

  function setupPress() {
    if (finePointer) return;
    document.querySelectorAll('.btn').forEach((el) => {
      el.addEventListener('touchstart', () => el.classList.add('is-pressed'), { passive: true });
      const release = () => setTimeout(() => el.classList.remove('is-pressed'), 250);
      el.addEventListener('touchend', release, { passive: true });
      el.addEventListener('touchcancel', release, { passive: true });
    });
  }

  /* ------------------------------------------------------------------------
     Menu
     ------------------------------------------------------------------------ */

  function setupMenu() {
    const menu = document.getElementById('menu');
    const btn = document.querySelector('.menu-btn');
    if (!menu || !btn) return;

    const setOpen = (open) => {
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) {
        menu.removeAttribute('inert');
        btn.focus({ preventScroll: true });
      } else {
        menu.setAttribute('inert', '');
      }
    };

    document.querySelectorAll('.js-menu-toggle').forEach((el) => {
      el.addEventListener('click', () => setOpen(!root.classList.contains('menu-open')));
    });

    document.querySelectorAll('.js-menu-close').forEach((el) => {
      el.addEventListener('click', () => setOpen(false));
    });

    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------------
     Scroll-driven bits + marquee, all in one rAF loop
     ------------------------------------------------------------------------ */

  function setupMotion() {
    const track = document.querySelector('.marquee-track');
    const photo = document.querySelector('.hero-photo-inner');
    const hero = document.querySelector('.hero');
    const menuBtn = document.querySelector('.menu-btn');
    const footer = document.querySelector('.footer');
    const footerArrow = document.querySelector('.footer-arrow');
    const cursor = document.querySelector('.cursor');
    const cursorLabel = cursor && cursor.querySelector('.cursor-label');

    let x = 0;            // marquee offset, % of track width
    let dir = -1;         // -1 → left, 1 → right
    let boost = 0;        // extra speed from scrolling
    let lastY = scrollY;
    let last = performance.now();
    let mouseX = innerWidth / 2;
    let mouseY = innerHeight / 2;
    let curX = mouseX;
    let curY = mouseY;
    let drawnY = -1;      // scroll position the parallax/footer were last drawn for

    // Layout is measured here, never inside the frame loop.
    let heroH = 0;
    let footerTop = 0;
    let footerH = 0;
    const measure = () => {
      if (hero) heroH = hero.offsetHeight;
      if (footer) {
        footerTop = footer.getBoundingClientRect().top + scrollY;
        footerH = footer.offsetHeight;
      }
      drawnY = -1;
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(body);

    const onScroll = () => {
      const y = scrollY;
      const dy = y - lastY;
      if (dy !== 0) {
        dir = dy > 0 ? -1 : 1;
        boost = clamp(boost + Math.abs(dy) * 0.0009, 0, 0.02);
      }
      lastY = y;

      if (menuBtn) menuBtn.classList.toggle('is-visible', y > Math.min(innerHeight * 0.5, 260));
    };

    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (cursor && finePointer) {
      addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });
      document.querySelectorAll('[data-cursor]').forEach((el) => {
        el.addEventListener('mouseenter', () => {
          cursorLabel.textContent = el.dataset.cursor;
          cursor.classList.add('is-active');
        });
        el.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
      });
    }

    const tick = (now) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const y = scrollY;
      const vh = innerHeight;

      // Name marquee: always drifting, faster while scrolling (only drawn while the hero is on screen)
      if (track && !reduceMotion && y < heroH) {
        x += dir * (0.004 + boost) * dt * 0.6;
        if (x <= -50) x += 50;
        if (x > 0) x -= 50;
        track.style.transform = `translate3d(${x}%, 0, 0)`;
        boost *= 0.94;
      }

      // Hero parallax
      if (photo && y !== drawnY && y < heroH && !reduceMotion) {
        photo.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
      }

      // Footer: curve flattens and content drifts in
      if (footer && y !== drawnY && !reduceMotion) {
        const top = footerTop - y;
        if (top < vh && top + footerH > 0) {
          const p = clamp((vh - top) / Math.min(footerH, vh), 0, 1);
          footer.style.setProperty('--curve', (1 - p).toFixed(3));
          footer.style.setProperty('--fy', `${((p - 1) * 12).toFixed(2)}vh`);
          if (footerArrow) footerArrow.style.setProperty('--arrow', `${(p * 90 - 90).toFixed(1)}deg`);
        }
      }

      drawnY = y;

      // Cursor bubble follows with a little lag
      if (cursor && finePointer) {
        curX += (mouseX - curX) * 0.16;
        curY += (mouseY - curY) * 0.16;
        cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  setupMagnetic();
  setupPress();
  setupMenu();
  setupMotion();

  runLoader(() => {
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    setupReveal();
  });
})();

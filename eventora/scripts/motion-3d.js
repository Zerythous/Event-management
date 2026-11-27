/* ==========================================================================
   EVENTORA 3D MOTION ENGINE
   Mouse-driven layered perspective parallax, smooth card tilt & scroll reveals
   ========================================================================== */

window.EventoraMotion = (function () {
  function initHeroParallax(stageEl) {
    if (!stageEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let rafId = 0;

    stageEl.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      const rect = stageEl.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    stageEl.addEventListener('pointerleave', function () {
      targetX = 0;
      targetY = 0;
    });

    function tick() {
      curX += (targetX - curX) * 0.085;
      curY += (targetY - curY) * 0.085;
      document.documentElement.style.setProperty('--ev-mx', curX.toFixed(4));
      document.documentElement.style.setProperty('--ev-my', curY.toFixed(4));
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return function cleanup() { cancelAnimationFrame(rafId); };
  }

  function bindCardTilts(root = document) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = root.querySelectorAll('.ev-3d-card');
    cards.forEach(function (card) {
      if (card.dataset.tiltBound === '1') return;
      card.dataset.tiltBound = '1';

      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotX = (0.5 - y) * 6.5;
        const rotY = (x - 0.5) * 7.5;
        card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        card.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(8px)`;
      });

      card.addEventListener('pointerleave', function () {
        card.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
      });
    });
  }

  function initScrollReveals(root = document) {
    const items = root.querySelectorAll('.ev-reveal');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    items.forEach(function (el) {
      if (!el.classList.contains('is-visible')) observer.observe(el);
    });
  }

  function initAll(heroEl) {
    if (heroEl) initHeroParallax(heroEl);
    bindCardTilts(document);
    initScrollReveals(document);
  }

  return { initAll, bindCardTilts, initScrollReveals, initHeroParallax };
})();

/* ==========================================================================
   EVENTORA SHARED UI COMPONENTS
   Navigation, Footer, Event Cards, Modals, Organizer Builder & Notifications
   ========================================================================== */

window.EventoraUI = (function () {
  const ICONS = {
    calendar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    mapPin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    users: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    arrowRight: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    chevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    sparkles: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    code: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    terminal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
    wrench: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    cpu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
    rocket: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    mic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    compass: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    upload: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
    image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    replace: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    alert: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    eye: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
  };

  function icon(name) {
    return ICONS[name] || '';
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let currentNavRoute = '';

  function getActiveAuthSession() {
    if (window.EventoraAuth && typeof window.EventoraAuth.getSession === 'function') {
      return window.EventoraAuth.getSession();
    }
    return null;
  }

  function isAuthRestoring() {
    return Boolean(window.EventoraAuth && typeof window.EventoraAuth.isRestoring === 'function' && window.EventoraAuth.isRestoring());
  }

  function resolveNavbarConfig(activeRoute) {
    const user = getActiveAuthSession();
    const restoring = isAuthRestoring();
    if (window.EventoraAccess && typeof window.EventoraAccess.getNavbarConfig === 'function') {
      return window.EventoraAccess.getNavbarConfig(activeRoute, user, restoring);
    }
    return {
      mode: restoring ? 'restoring' : (user ? 'authenticated' : 'guest'),
      role: user ? 'participant' : null,
      pillItems: [
        { type: 'link', href: 'index.html', label: 'Home', active: activeRoute === 'home' },
        { type: 'link', href: 'discover.html', label: 'Discover', active: activeRoute === 'discover' }
      ],
      mobileLinks: [
        { href: 'index.html', label: 'Home' },
        { href: 'discover.html', label: 'Discover Events' }
      ],
      dropdownItems: [],
      showCreateButton: false
    };
  }

  function renderAvatarInner(user, initials) {
    if (user && user.avatarUrl) {
      return `<img src="${escapeHTML(user.avatarUrl)}" alt="${escapeHTML(user.fullName)}" data-ev-avatar-img="true" />`;
    }
    return escapeHTML(initials);
  }

  function renderDesktopPillItems(activeRoute) {
    const cfg = resolveNavbarConfig(activeRoute);
    return cfg.pillItems.map((item) => {
      if (item.type === 'events-dropdown') {
        return `
          <div class="ev-dropdown" id="evEventsDropdown">
            <button type="button" class="ev-nav-link ${item.active ? 'is-active' : ''}" id="evEventsDropdownBtn" aria-expanded="false" aria-haspopup="true">
              Events ${icon('chevronDown')}
            </button>
            <div class="ev-dropdown-menu" role="menu">
              <a href="discover.html" class="ev-dropdown-item" role="menuitem">
                <span>All Campus Events</span>
                <span class="ev-dd-meta">Browse</span>
              </a>
              <a href="discover.html?category=hackathons" class="ev-dropdown-item" role="menuitem">
                <span>Hackathons</span>
                <span class="ev-dd-meta">Track</span>
              </a>
              <a href="discover.html?category=workshops" class="ev-dropdown-item" role="menuitem">
                <span>Workshops &amp; Labs</span>
                <span class="ev-dd-meta">Hands-on</span>
              </a>
              <a href="discover.html?category=coding" class="ev-dropdown-item" role="menuitem">
                <span>Coding Competitions</span>
                <span class="ev-dd-meta">Ranked</span>
              </a>
              <a href="discover.html?category=entrepreneurship" class="ev-dropdown-item" role="menuitem">
                <span>Founders &amp; Summits</span>
                <span class="ev-dd-meta">Pitch</span>
              </a>
            </div>
          </div>
        `;
      }
      if (item.type === 'create-button') {
        return `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" style="margin-left:0.4rem;" data-open-create="true">${escapeHTML(item.label)}</button>`;
      }
      return `<a href="${escapeHTML(item.href)}" class="ev-nav-link ${item.active ? 'is-active' : ''}">${escapeHTML(item.label)}</a>`;
    }).join('');
  }

  function renderMobileNavLinksHTML(activeRoute) {
    const cfg = resolveNavbarConfig(activeRoute);
    return cfg.mobileLinks.map((lnk) => `<a href="${escapeHTML(lnk.href)}" class="ev-mobile-link">${escapeHTML(lnk.label)}</a>`).join('');
  }

  function renderDesktopAuthControls() {
    const restoring = isAuthRestoring();
    const user = getActiveAuthSession();
    if (restoring) {
      return `
        <div class="ev-auth-links" aria-live="polite">
          <span style="font-size:0.8rem;color:var(--ev-muted);font-weight:500;">Loading...</span>
        </div>
      `;
    }
    if (!user) {
      return `
        <div class="ev-auth-links">
          <a href="login.html" class="ev-auth-btn" id="evNavLoginLink">Log in</a>
          <span class="ev-auth-sep">|</span>
          <a href="signup.html" class="ev-auth-btn" id="evNavSignupLink">Sign up</a>
        </div>
      `;
    }
    const initials = window.EventoraAuth.getInitials(user.fullName);
    const role = window.EventoraAccess ? window.EventoraAccess.getEffectiveRole(user) : 'participant';
    const roleLabel = window.EventoraAccess ? window.EventoraAccess.getRoleLabel(role) : 'Participant';
    const cfg = resolveNavbarConfig(currentNavRoute);
    const ddLinks = cfg.dropdownItems.map((d) => `
      <a href="${escapeHTML(d.href)}" class="ev-dropdown-item" role="menuitem">
        <span>${escapeHTML(d.label)}</span>
        <span class="ev-dd-meta">${escapeHTML(d.meta)}</span>
      </a>
    `).join('');

    return `
      <div class="ev-dropdown" id="evAccountDropdown">
        <button type="button" class="ev-account-btn" id="evAccountBtn" aria-expanded="false" aria-haspopup="true" aria-label="Account menu for ${escapeHTML(user.fullName)}">
          <span class="ev-avatar-chip" data-ev-initials="${escapeHTML(initials)}">${renderAvatarInner(user, initials)}</span>
          <span class="ev-account-name">${escapeHTML(user.fullName)}</span>
          ${icon('chevronDown')}
        </button>
        <div class="ev-dropdown-menu ev-account-menu" role="menu">
          <div class="ev-account-menu-head">
            <div class="ev-account-menu-name">${escapeHTML(user.fullName)}</div>
            <div class="ev-account-menu-email">${escapeHTML(user.email)}</div>
            <span class="ev-badge ev-badge-open" style="margin-top:0.45rem;">${escapeHTML(roleLabel)}</span>
          </div>
          ${ddLinks}
          <button type="button" class="ev-dropdown-item ev-dropdown-danger" id="evNavLogoutBtn" role="menuitem">
            <span>Logout</span>
            <span class="ev-dd-meta">Sign out</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderMobileAuthControls() {
    if (isAuthRestoring()) {
      return `<div style="font-size:0.84rem;color:var(--ev-muted);padding:0.5rem 0;">Checking session...</div>`;
    }
    const user = getActiveAuthSession();
    if (!user) {
      return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">
          <a href="login.html" class="ev-btn ev-btn-outline ev-btn-sm">Log in</a>
          <a href="signup.html" class="ev-btn ev-btn-forest ev-btn-sm">Sign up</a>
        </div>
      `;
    }
    const initials = window.EventoraAuth.getInitials(user.fullName);
    const role = window.EventoraAccess ? window.EventoraAccess.getEffectiveRole(user) : 'participant';
    const roleLabel = window.EventoraAccess ? window.EventoraAccess.getRoleLabel(role) : 'Participant';
    const dashUrl = window.EventoraAccess ? window.EventoraAccess.getDashboardUrl(role) : 'participant-dashboard.html';
    const canCreate = window.EventoraAccess ? window.EventoraAccess.can(role, 'create_event') : false;

    return `
      <div style="padding:0.85rem;background:var(--ev-white);border:1px solid var(--ev-border);border-radius:var(--ev-radius-md);display:flex;align-items:center;gap:0.75rem;">
        <span class="ev-avatar-chip" data-ev-initials="${escapeHTML(initials)}" style="width:36px;height:36px;font-size:0.82rem;">${renderAvatarInner(user, initials)}</span>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;font-size:0.88rem;color:var(--ev-charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(user.fullName)}</div>
          <div style="font-size:0.74rem;color:var(--ev-muted);">${escapeHTML(roleLabel)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;">
        <a href="${escapeHTML(dashUrl)}" class="ev-btn ev-btn-forest ev-btn-sm">Dashboard</a>
        <a href="profile.html" class="ev-btn ev-btn-outline ev-btn-sm">Profile</a>
      </div>
      ${canCreate ? '<button type="button" class="ev-btn ev-btn-forest" data-open-create="true">Create Event</button>' : ''}
      <button type="button" class="ev-btn ev-btn-sm ev-btn-danger-ghost" id="evMobileLogoutBtn">Logout</button>
    `;
  }

  function renderNavbar(activeRoute) {
    currentNavRoute = activeRoute || '';
    return `
      <header class="ev-nav" id="evNavbar">
        <div class="ev-container ev-nav-inner">
          <a href="index.html" class="ev-brand" aria-label="Eventora Home">
            <span class="ev-brand-mark">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </span>
            <span>Eventora</span>
          </a>

          <nav class="ev-nav-pill" id="evNavPillMount" aria-label="Primary Navigation">
            ${renderDesktopPillItems(currentNavRoute)}
          </nav>

          <div class="ev-nav-auth">
            <div id="evDesktopAuthMount">
              ${renderDesktopAuthControls()}
            </div>
            <button type="button" class="ev-hamburger" id="evHamburgerBtn" aria-label="Open menu" aria-expanded="false">
              ${icon('menu')}
            </button>
          </div>
        </div>
      </header>

      <div class="ev-mobile-backdrop" id="evMobileBackdrop"></div>
      <aside class="ev-mobile-drawer" id="evMobileDrawer" aria-hidden="true">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <span class="ev-brand">Eventora</span>
            <button type="button" class="ev-modal-close" id="evMobileCloseBtn" aria-label="Close menu">${icon('close')}</button>
          </div>
          <div class="ev-mobile-list" id="evMobileNavListMount">
            ${renderMobileNavLinksHTML(currentNavRoute)}
          </div>
        </div>
        <div id="evMobileAuthMount" style="display:flex;flex-direction:column;gap:0.65rem;">
          ${renderMobileAuthControls()}
        </div>
      </aside>
    `;
  }

  function renderFooter() {
    return `
      <footer class="ev-footer" id="about">
        <div class="ev-container">
          <div class="ev-footer-grid">
            <div>
              <div class="ev-brand" style="color:#FFFFFF;margin-bottom:0.9rem;">
                <span class="ev-brand-mark" style="background:#56785C;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </span>
                <span>Eventora</span>
              </div>
              <p style="font-size:0.9rem;max-width:21rem;color:rgba(246,245,239,0.72);line-height:1.65;">
                An independent event discovery and multi-round competition platform built for campus communities, organizers, judges, and student builders.
              </p>
            </div>
            <div>
              <div class="ev-footer-title">Platform</div>
              <div class="ev-footer-links">
                <a href="index.html">Landing Home</a>
                <a href="discover.html">Discover Events</a>
                <a href="index.html#how-it-works">How Eventora Works</a>
                <a href="index.html#organizer">For Organizers</a>
              </div>
            </div>
            <div>
              <div class="ev-footer-title">Explore</div>
              <div class="ev-footer-links">
                <a href="discover.html?category=hackathons">Hackathons</a>
                <a href="discover.html?category=workshops">Workshops</a>
                <a href="discover.html?category=coding">Coding Competitions</a>
                <a href="discover.html?category=entrepreneurship">Entrepreneurship</a>
              </div>
            </div>
            <div>
              <div class="ev-footer-title">Organize</div>
              <div class="ev-footer-links">
                <a href="index.html#organizer">Organizer Studio Overview</a>
                <button type="button" style="background:none;border:none;color:inherit;text-align:left;font-size:inherit;" data-open-walkthrough="true">Platform Walkthrough</button>
                <a href="signup.html?role=organizer">Organizer Sign Up</a>
              </div>
            </div>
          </div>
          <div class="ev-footer-bottom">
            <span>&copy; 2026 Eventora Platform. Reusable multi-event architecture.</span>
            <span>All featured listings currently shown are illustrative sample events for UI preview.</span>
          </div>
        </div>
      </footer>
    `;
  }

  function resolveCategoryIcon(categorySlug) {
    if (window.EventoraStore && typeof window.EventoraStore.getCategories === 'function') {
      const cat = window.EventoraStore.getCategories().find((c) => c.slug === categorySlug);
      if (cat && ICONS[cat.icon]) return cat.icon;
    }
    return 'sparkles';
  }

  function renderPosterFallbackHTML(ev) {
    const fallbackIcon = resolveCategoryIcon(ev.category);
    const label = ev.categoryLabel || 'Campus Event';
    const title = ev.name || 'Untitled Event';
    return `
      <div class="ev-poster-fallback" ${ev.coverImage ? 'hidden' : ''}>
        <span class="ev-poster-fallback-icon">${icon(fallbackIcon)}</span>
        <span class="ev-poster-fallback-sub">${escapeHTML(label)}</span>
        <span class="ev-poster-fallback-title">${escapeHTML(title)}</span>
      </div>
    `;
  }

  function renderEventCard(ev, options = {}) {
    const safeSlug = encodeURIComponent(ev.slug || 'draft');
    let badgeCls = ev.registrationBadgeClass || 'ev-badge-open';
    let regLabel = ev.registrationStatus || 'Open';
    const sampleLabel = ev.isPreviewDraft ? 'Preview Draft' : 'Sample Event';
    const hasCover = Boolean(ev.coverImage && String(ev.coverImage).trim());
    const roundCount = Array.isArray(ev.rounds) ? ev.rounds.length : 0;
    const isLivePreview = Boolean(options && options.isLivePreview);
    let actionText = 'View Event';
    let actionHref = `event.html?slug=${safeSlug}`;

    if (!isLivePreview && window.EventoraStore && typeof window.EventoraStore.evaluateRegistrationAvailability === 'function') {
      const curUser = window.EventoraAuth && typeof window.EventoraAuth.getSession === 'function' ? window.EventoraAuth.getSession() : null;
      const avail = window.EventoraStore.evaluateRegistrationAvailability(ev, curUser);
      if (avail.state === 'already_registered' && avail.existingRegistration) {
        const st = avail.existingRegistration.registrationStatus;
        regLabel = `Registered • ${st}`;
        badgeCls = st === 'Approved' ? 'ev-badge-open' : (st === 'Waitlisted' ? 'ev-badge-filling' : (st === 'Rejected' ? 'ev-badge-closed' : 'ev-badge-sample'));
        actionText = 'View Registration';
        actionHref = 'participant-dashboard.html?section=registrations';
      } else if (avail.state === 'waitlist_available') {
        regLabel = 'Waitlist Open';
        badgeCls = 'ev-badge-filling';
      } else if (avail.state === 'closed' || avail.state === 'full') {
        regLabel = 'Registration Closed';
        badgeCls = 'ev-badge-closed';
      } else if (avail.state === 'not_open_yet') {
        regLabel = 'Opens Soon';
        badgeCls = 'ev-badge-sample';
      }
    }

    const ctaMarkup = isLivePreview
      ? `<span class="ev-btn ev-btn-forest ev-btn-sm" aria-hidden="true">View Event ${icon('arrowRight')}</span>`
      : `<a href="${actionHref}" class="ev-btn ev-btn-forest ev-btn-sm">${escapeHTML(actionText)} ${icon('arrowRight')}</a>`;

    return `
      <article class="ev-3d-stage">
        <div class="ev-3d-card ev-event-card">
          <div class="ev-event-media">
            ${hasCover ? `<img src="${escapeHTML(ev.coverImage)}" alt="${escapeHTML(ev.name)} cover poster" loading="lazy" data-ev-poster-img="true" />` : ''}
            ${renderPosterFallbackHTML(ev)}
            <div class="ev-event-media-badges">
              <span class="ev-badge ev-badge-category">${escapeHTML(ev.categoryLabel)}</span>
              <span class="ev-badge ${escapeHTML(badgeCls)}">${escapeHTML(regLabel)}</span>
            </div>
          </div>
          <div class="ev-event-body">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.35rem;">
              <span class="ev-event-org">${escapeHTML(ev.institutionShort || ev.institution)}</span>
              <span class="ev-badge ev-badge-sample" title="Illustrative preview content">${escapeHTML(sampleLabel)}</span>
            </div>
            <h3 class="ev-event-title">${escapeHTML(ev.name)}</h3>
            <p class="ev-event-desc">${escapeHTML(ev.tagline)}</p>
            <div class="ev-event-meta">
              <div class="ev-meta-row">${icon('calendar')}<span>${escapeHTML(ev.dateLabel)}</span></div>
              <div class="ev-meta-row">${icon('mapPin')}<span>${escapeHTML(ev.location)}</span></div>
              <div class="ev-meta-row">${icon('users')}<span>By ${escapeHTML(ev.organizer)} • ${escapeHTML(ev.teamConfig.label)}</span></div>
            </div>
            <div class="ev-event-footer">
              <span style="font-size:0.78rem;color:var(--ev-muted);font-weight:500;">
                ${roundCount > 0 ? `${roundCount} Configured Round${roundCount > 1 ? 's' : ''}` : 'Single-Session Format'}
              </span>
              ${ctaMarkup}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderGlobalModals() {
    return `
      <!-- Quick Auth Modal -->
      <div class="ev-modal" id="evAuthModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="evAuthTitle">
        <div class="ev-modal-backdrop" data-close-modal="evAuthModal"></div>
        <div class="ev-modal-panel" style="max-width:440px;">
          <div class="ev-modal-head">
            <div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.5rem;">Eventora Account</span>
              <h2 id="evAuthTitle" class="ev-display" style="font-size:1.55rem;font-weight:600;">Log in to Eventora</h2>
            </div>
            <button type="button" class="ev-modal-close" data-close-modal="evAuthModal" aria-label="Close modal">${icon('close')}</button>
          </div>
          <div class="ev-tabs" style="margin-bottom:1.1rem;">
            <button type="button" class="ev-tab-btn is-active" data-auth-tab="login">Log in</button>
            <button type="button" class="ev-tab-btn" data-auth-tab="signup">Sign up</button>
          </div>
          <div id="evAuthModalStatus" class="ev-auth-status" role="status" aria-live="polite" style="margin-bottom:0.9rem;" hidden></div>
          <button type="button" class="ev-btn ev-btn-google" id="evAuthModalGoogleBtn">
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"/>
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
          <div class="ev-oauth-divider"><span>or use email</span></div>
          <form id="evAuthForm" novalidate style="display:flex;flex-direction:column;gap:0.9rem;margin-top:0.85rem;">
            <div class="ev-field" id="evAuthNameWrap" style="display:none;">
              <label class="ev-label" for="evAuthName">Full Name</label>
              <input class="ev-input" id="evAuthName" type="text" placeholder="e.g. Ananya Deshmukh" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evAuthEmail">Email Address</label>
              <input class="ev-input" id="evAuthEmail" type="email" required placeholder="you@university.edu" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evAuthPass">Password</label>
              <input class="ev-input" id="evAuthPass" type="password" required placeholder="••••••••" />
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;">
              <a href="forgot-password.html" class="ev-text-link">Forgot password?</a>
              <a href="login.html" class="ev-text-link" id="evAuthFullPageLink">Open full auth page &rarr;</a>
            </div>
            <button type="submit" class="ev-btn ev-btn-forest" id="evAuthSubmitBtn">Log in</button>
          </form>
        </div>
      </div>

      <!-- Create Your Event 3-Step Wizard Modal (Frontend UI Only) -->
      <div class="ev-modal" id="evCreateModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="evCreateTitle">
        <div class="ev-modal-backdrop" data-close-modal="evCreateModal"></div>
        <div class="ev-modal-panel ev-create-panel">
          <div class="ev-modal-head">
            <div>
              <span class="ev-badge ev-badge-sample" style="margin-bottom:0.5rem;">Organizer Studio UI Preview</span>
              <h2 id="evCreateTitle" class="ev-display" style="font-size:1.65rem;font-weight:600;">Create Your Event</h2>
              <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.25rem;">Configure event details, upload a cover poster, preview how it appears, and finish creation.</p>
            </div>
            <button type="button" class="ev-modal-close" data-close-modal="evCreateModal" aria-label="Close modal">${icon('close')}</button>
          </div>

          <!-- 3-Step Wizard Stepper -->
          <div class="ev-wizard-steps" id="evWizardStepper" role="tablist" aria-label="Event creation steps">
            <button type="button" class="ev-wizard-step is-active" data-wizard-goto="1" aria-selected="true">
              <span class="ev-wizard-step-num">1</span>
              <span class="ev-wizard-step-label">Event Details</span>
            </button>
            <button type="button" class="ev-wizard-step" data-wizard-goto="2" aria-selected="false">
              <span class="ev-wizard-step-num">2</span>
              <span class="ev-wizard-step-label">Poster &amp; Cover</span>
            </button>
            <button type="button" class="ev-wizard-step" data-wizard-goto="3" aria-selected="false">
              <span class="ev-wizard-step-num">3</span>
              <span class="ev-wizard-step-label">Rounds &amp; Create</span>
            </button>
          </div>

          <div class="ev-create-layout">
            <form id="evCreateForm" novalidate style="display:flex;flex-direction:column;gap:0.95rem;min-width:0;">
              <!-- STEP 1: EVENT DETAILS -->
              <div class="ev-wizard-panel is-active" data-wizard-panel="1">
                <div class="ev-form-grid-2">
                  <div class="ev-field">
                    <label class="ev-label" for="evNewName">Event Name <span style="color:#9E2A20;">*</span></label>
                    <input class="ev-input" id="evNewName" required placeholder="e.g. Cascadia Design Sprint" />
                  </div>
                  <div class="ev-field">
                    <label class="ev-label" for="evNewCategory">Category</label>
                    <select class="ev-select" id="evNewCategory">
                      <option value="hackathons">Hackathons</option>
                      <option value="workshops">Workshops</option>
                      <option value="coding">Coding Competitions</option>
                      <option value="entrepreneurship">Entrepreneurship</option>
                      <option value="technical">Technical Events</option>
                      <option value="seminars">Seminars</option>
                      <option value="cultural">Cultural Festivals</option>
                      <option value="innovation">Innovation Challenges</option>
                    </select>
                  </div>
                </div>
                <div class="ev-form-grid-2">
                  <div class="ev-field">
                    <label class="ev-label" for="evNewOrg">Organizer / Club <span style="color:#9E2A20;">*</span></label>
                    <input class="ev-input" id="evNewOrg" required placeholder="e.g. Open Source Society" />
                  </div>
                  <div class="ev-field">
                    <label class="ev-label" for="evNewCollege">College / Institution <span style="color:#9E2A20;">*</span></label>
                    <input class="ev-input" id="evNewCollege" required placeholder="e.g. Northshore University" />
                  </div>
                </div>
                <div class="ev-form-grid-3">
                  <div class="ev-field">
                    <label class="ev-label" for="evNewCity">City / Mode <span style="color:#9E2A20;">*</span></label>
                    <input class="ev-input" id="evNewCity" required value="Bengaluru" />
                  </div>
                  <div class="ev-field">
                    <label class="ev-label" for="evNewDate">Date Label <span style="color:#9E2A20;">*</span></label>
                    <input class="ev-input" id="evNewDate" required value="Jan 24 – Jan 25, 2027" />
                  </div>
                  <div class="ev-field">
                    <label class="ev-label" for="evNewParticipation">Format</label>
                    <select class="ev-select" id="evNewParticipation">
                      <option value="team">Team (2–4 members)</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>
                </div>
                <div class="ev-field">
                  <label class="ev-label" for="evNewDesc">Short Event Description</label>
                  <textarea class="ev-textarea" id="evNewDesc" rows="2" placeholder="Describe tracks, goals, and what participants will build or experience..."></textarea>
                </div>

                <div class="ev-wizard-error" id="evWizardError1" role="alert" hidden></div>

                <div class="ev-wizard-footer">
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" data-close-modal="evCreateModal">Cancel</button>
                  <div class="ev-wizard-footer-actions">
                    <button type="button" class="ev-btn ev-btn-forest" id="evStep1NextBtn">
                      Next: Poster &amp; Cover ${icon('arrowRight')}
                    </button>
                  </div>
                </div>
              </div>

              <!-- STEP 2: POSTER & COVER IMAGE -->
              <div class="ev-wizard-panel" data-wizard-panel="2">
                <div class="ev-upload-studio" id="evPosterUploadStudio">
                  <div class="ev-upload-head">
                    <div>
                      <div class="ev-upload-title">Upload Event Poster &amp; Cover Image</div>
                      <p class="ev-upload-sub">Landscape cover shown on Event Cards and the Event Hero banner.</p>
                    </div>
                    <span class="ev-upload-pill-tag">Browser State Only</span>
                  </div>

                  <input
                    type="file"
                    id="evPosterFileInput"
                    class="ev-visually-hidden"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    aria-label="Select event poster or cover image"
                  />

                  <div class="ev-dropzone" id="evPosterDropzone" tabindex="0" role="button" aria-label="Upload event poster or cover image">
                    <div class="ev-dropzone-icon">${icon('upload')}</div>
                    <div class="ev-dropzone-copy">Drag and drop your poster here, or select an image</div>
                    <p class="ev-dropzone-hint">Preview renders immediately inside your browser. No file is uploaded to any server.</p>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evPosterSelectBtn">
                      ${icon('image')} Choose Cover Image
                    </button>
                    <div class="ev-upload-specs">
                      <span class="ev-spec-chip">16:9 Landscape</span>
                      <span class="ev-spec-chip">1600 &times; 900 px recommended</span>
                      <span class="ev-spec-chip">JPEG, PNG, WebP</span>
                      <span class="ev-spec-chip">Max 5 MB</span>
                    </div>
                  </div>

                  <div class="ev-upload-preview" id="evPosterPreviewBox" hidden>
                    <div class="ev-upload-preview-stage">
                      <img id="evPosterPreviewImg" src="" alt="Selected event poster preview" />
                    </div>
                    <div class="ev-upload-preview-bar">
                      <div class="ev-upload-filemeta">
                        <div class="ev-upload-filename" id="evPosterFileName">poster.jpg</div>
                        <div class="ev-upload-filedetails" id="evPosterFileMeta">Local preview ready</div>
                      </div>
                      <div class="ev-upload-actions">
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evPosterReplaceBtn">
                          ${icon('replace')} Replace
                        </button>
                        <button type="button" class="ev-btn ev-btn-sm ev-btn-danger-ghost" id="evPosterRemoveBtn">
                          ${icon('trash')} Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="ev-upload-feedback" id="evPosterFeedback" role="status" aria-live="polite" hidden></div>
                </div>

                <div class="ev-wizard-footer">
                  <button type="button" class="ev-btn ev-btn-outline" id="evStep2BackBtn">&larr; Back</button>
                  <div class="ev-wizard-footer-actions">
                    <button type="button" class="ev-btn ev-btn-forest" id="evStep2NextBtn">
                      Next: Rounds &amp; Review ${icon('arrowRight')}
                    </button>
                  </div>
                </div>
              </div>

              <!-- STEP 3: ROUNDS & FINAL CREATE -->
              <div class="ev-wizard-panel" data-wizard-panel="3">
                <div style="background:var(--ev-white);border:1px solid var(--ev-border);border-radius:var(--ev-radius-md);padding:1rem;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;gap:0.5rem;flex-wrap:wrap;">
                    <span class="ev-label">Dynamic Rounds Configuration</span>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evAddRoundRowBtn">+ Add Round</button>
                  </div>
                  <div id="evBuilderRoundsList" style="display:flex;flex-direction:column;gap:0.55rem;"></div>
                </div>

                <div class="ev-review-summary" id="evWizardSummary" aria-label="Configured event summary"></div>

                <div class="ev-wizard-error" id="evWizardError3" role="alert" hidden></div>

                <p style="font-size:0.76rem;color:var(--ev-muted);line-height:1.45;">
                  Frontend prototype notice: Previewing or creating here stores the draft locally in browser session state without database writes or server uploads.
                </p>

                <div class="ev-wizard-footer">
                  <button type="button" class="ev-btn ev-btn-outline" id="evWizardBackBtn">&larr; Back</button>
                  <div class="ev-wizard-footer-actions">
                    <button type="button" class="ev-btn ev-btn-outline" id="evWizardPreviewBtn">Preview Event</button>
                    <button type="submit" class="ev-btn ev-btn-forest" id="evWizardCreateBtn">
                      Create Event ${icon('arrowRight')}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <!-- Live Updating Event Card Preview -->
            <aside class="ev-live-preview-pane" aria-label="Live event poster preview">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                <div>
                  <div class="ev-upload-title">Live Eventora Card Preview</div>
                  <p class="ev-upload-sub">Updates as you upload a poster or edit fields.</p>
                </div>
                <span class="ev-badge ev-badge-open" style="white-space:nowrap;flex-shrink:0;">16:9 Card</span>
              </div>
              <div class="ev-live-preview-card-wrap" id="evLiveCardPreviewMount"></div>
            </aside>
          </div>
        </div>
      </div>

      <!-- Full Event Preview Review Overlay (Separate from Create Event) -->
      <div class="ev-modal" id="evEventPreviewModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="evPreviewModalTitle" style="z-index:220;">
        <div class="ev-modal-backdrop" data-close-modal="evEventPreviewModal"></div>
        <div class="ev-modal-panel ev-preview-modal-panel">
          <div id="evPreviewSheetMount"></div>
        </div>
      </div>

      <!-- Walkthrough Modal -->
      <div class="ev-modal" id="evWalkthroughModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="evWalkTitle">
        <div class="ev-modal-backdrop" data-close-modal="evWalkthroughModal"></div>
        <div class="ev-modal-panel" style="max-width:540px;">
          <div class="ev-modal-head">
            <div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.5rem;">Platform Tour</span>
              <h2 id="evWalkTitle" class="ev-display" style="font-size:1.55rem;font-weight:600;">See how Eventora works</h2>
            </div>
            <button type="button" class="ev-modal-close" data-close-modal="evWalkthroughModal" aria-label="Close modal">${icon('close')}</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.9rem;margin-bottom:1.5rem;">
            <div style="padding:1rem;background:var(--ev-white);border-radius:var(--ev-radius-md);border:1px solid var(--ev-border);">
              <strong style="color:var(--ev-forest);font-size:0.92rem;">1. Multi-Event Discovery</strong>
              <p style="font-size:0.84rem;color:var(--ev-muted);margin-top:0.2rem;">Students browse hackathons, coding sprints, workshops, and seminars by campus, category, or date.</p>
            </div>
            <div style="padding:1rem;background:var(--ev-white);border-radius:var(--ev-radius-md);border:1px solid var(--ev-border);">
              <strong style="color:var(--ev-forest);font-size:0.92rem;">2. Flexible Round Architecture</strong>
              <p style="font-size:0.84rem;color:var(--ev-muted);margin-top:0.2rem;">Organizers configure 0, 1, or N custom rounds with schedules, team rules, managers, and live status.</p>
            </div>
            <div style="padding:1rem;background:var(--ev-white);border-radius:var(--ev-radius-md);border:1px solid var(--ev-border);">
              <strong style="color:var(--ev-forest);font-size:0.92rem;">3. Unified Organizer Control</strong>
              <p style="font-size:0.84rem;color:var(--ev-muted);margin-top:0.2rem;">Coordinate teams, assign judges or proctors, and publish standings from one cohesive system.</p>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            <a href="discover.html" class="ev-btn ev-btn-forest">Explore Events ${icon('arrowRight')}</a>
            <button type="button" class="ev-btn ev-btn-outline" data-close-modal="evWalkthroughModal" data-open-create="true">Try Event Builder</button>
          </div>
        </div>
      </div>

      <div class="ev-toast-stack" id="evToastStack" aria-live="polite"></div>
    `;
  }

  function showToast(msg) {
    const stack = document.getElementById('evToastStack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = 'ev-toast';
    toast.innerHTML = `<span>${escapeHTML(msg)}</span><button type="button" style="background:none;border:none;color:rgba(255,255,255,0.75);font-size:0.9rem;">✕</button>`;
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    stack.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4200);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.ev-modal.is-open')) {
      document.body.style.overflow = '';
    }
  }

  function bindChromeInteractions() {
    // Scroll nav state
    const nav = document.getElementById('evNavbar');
    function onScroll() {
      if (!nav) return;
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile drawer controls (declared before account logout handler)
    const ham = document.getElementById('evHamburgerBtn');
    const backdrop = document.getElementById('evMobileBackdrop');
    const drawer = document.getElementById('evMobileDrawer');
    const closeMobileBtn = document.getElementById('evMobileCloseBtn');
    function setMobile(open) {
      if (!drawer || !backdrop || !ham) return;
      drawer.classList.toggle('is-open', open);
      backdrop.classList.toggle('is-open', open);
      ham.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (ham) ham.addEventListener('click', () => setMobile(true));
    if (backdrop) backdrop.addEventListener('click', () => setMobile(false));
    if (closeMobileBtn) closeMobileBtn.addEventListener('click', () => setMobile(false));
    if (drawer) {
      drawer.addEventListener('click', (e) => {
        if (e.target.closest('a, button[data-open-auth], button[data-open-create]')) {
          setMobile(false);
        }
      });
    }

    let isLoggingOut = false;
    async function performLogout() {
      if (isLoggingOut) return;
      isLoggingOut = true;
      if (window.EventoraAuth && typeof window.EventoraAuth.signOut === 'function') {
        const res = await window.EventoraAuth.signOut();
        setMobile(false);
        refreshAuthUI();
        showToast(res && !res.ok ? (res.error || 'Signed out.') : 'Signed out cleanly.');
        if (window.EventoraAccess && !window.EventoraAccess.canAccessPage(null, window.location.pathname)) {
          isLoggingOut = false;
          window.location.href = 'login.html';
          return;
        }
      } else {
        setMobile(false);
        refreshAuthUI();
      }
      isLoggingOut = false;
    }

    function bindEventsDropdown() {
      const dd = document.getElementById('evEventsDropdown');
      const ddBtn = document.getElementById('evEventsDropdownBtn');
      if (dd && ddBtn && !ddBtn.dataset.evBound) {
        ddBtn.dataset.evBound = 'true';
        ddBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          const accDd = document.getElementById('evAccountDropdown');
          const accBtn = document.getElementById('evAccountBtn');
          if (accDd && accBtn) {
            accDd.classList.remove('is-open');
            accBtn.setAttribute('aria-expanded', 'false');
          }
          const open = !dd.classList.contains('is-open');
          dd.classList.toggle('is-open', open);
          ddBtn.setAttribute('aria-expanded', String(open));
        });
      }
    }

    function syncRoleScopedElements() {
      const restoring = isAuthRestoring();
      const user = getActiveAuthSession();
      const canCreate = Boolean(window.EventoraAccess && user && window.EventoraAccess.can(user, 'create_event'));
      document.querySelectorAll('[data-open-create="true"]').forEach((el) => {
        if (el.closest('#evNavPillMount, #evMobileAuthMount, #evWsShell')) return;
        if (el.hasAttribute('data-organizer-strict')) {
          el.hidden = !canCreate;
          return;
        }
        el.hidden = restoring || (user && !canCreate);
      });
    }

    function bindAccountControls() {
      const accDd = document.getElementById('evAccountDropdown');
      const accBtn = document.getElementById('evAccountBtn');
      const logoutDesktop = document.getElementById('evNavLogoutBtn');
      const logoutMobile = document.getElementById('evMobileLogoutBtn');
      const dd = document.getElementById('evEventsDropdown');
      const ddBtn = document.getElementById('evEventsDropdownBtn');

      if (accDd && accBtn) {
        accBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (dd && ddBtn) {
            dd.classList.remove('is-open');
            ddBtn.setAttribute('aria-expanded', 'false');
          }
          const open = !accDd.classList.contains('is-open');
          accDd.classList.toggle('is-open', open);
          accBtn.setAttribute('aria-expanded', String(open));
        });
      }
      if (logoutDesktop) logoutDesktop.addEventListener('click', performLogout);
      if (logoutMobile) logoutMobile.addEventListener('click', performLogout);
    }

    function refreshAuthUI() {
      const pillMount = document.getElementById('evNavPillMount');
      const desktopMount = document.getElementById('evDesktopAuthMount');
      const mobileListMount = document.getElementById('evMobileNavListMount');
      const mobileMount = document.getElementById('evMobileAuthMount');
      if (pillMount) pillMount.innerHTML = renderDesktopPillItems(currentNavRoute);
      if (desktopMount) desktopMount.innerHTML = renderDesktopAuthControls();
      if (mobileListMount) mobileListMount.innerHTML = renderMobileNavLinksHTML(currentNavRoute);
      if (mobileMount) mobileMount.innerHTML = renderMobileAuthControls();
      bindEventsDropdown();
      bindAccountControls();
      syncRoleScopedElements();
    }

    bindEventsDropdown();
    bindAccountControls();
    syncRoleScopedElements();
    window.__evRefreshAuthUI = refreshAuthUI;
    if (!window.__evAuthListenerBound) {
      window.__evAuthListenerBound = true;
      window.addEventListener('eventora:authchange', () => {
        if (typeof window.__evRefreshAuthUI === 'function') {
          window.__evRefreshAuthUI();
        }
        const st = window.EventoraAuth && typeof window.EventoraAuth.getAuthState === 'function'
          ? window.EventoraAuth.getAuthState()
          : null;
        if (st && st.callbackError && !document.getElementById('evProfileRoot') && !document.getElementById('evLoginForm') && !document.getElementById('evForgotForm')) {
          const msg = window.EventoraAuth.consumeCallbackError();
          if (msg) showToast(msg);
        }
      });
    }

    document.addEventListener('click', function () {
      const accDd = document.getElementById('evAccountDropdown');
      const accBtn = document.getElementById('evAccountBtn');
      if (accDd && accBtn) {
        accDd.classList.remove('is-open');
        accBtn.setAttribute('aria-expanded', 'false');
      }
      const dd = document.getElementById('evEventsDropdown');
      const ddBtn = document.getElementById('evEventsDropdownBtn');
      if (dd && ddBtn) {
        dd.classList.remove('is-open');
        ddBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Auth modal tabs & form (real Supabase Auth integration)
    const authTabs = document.querySelectorAll('[data-auth-tab]');
    const authNameWrap = document.getElementById('evAuthNameWrap');
    const authTitle = document.getElementById('evAuthTitle');
    const authSubmit = document.getElementById('evAuthSubmitBtn');
    const authModalStatus = document.getElementById('evAuthModalStatus');
    const authFullPageLink = document.getElementById('evAuthFullPageLink');
    const authModalGoogleBtn = document.getElementById('evAuthModalGoogleBtn');
    let currentAuthModalMode = 'login';
    let isModalAuthSubmitting = false;

    function setAuthModalStatus(kind, msg) {
      if (!authModalStatus) return;
      if (!msg) {
        authModalStatus.hidden = true;
        authModalStatus.className = 'ev-auth-status';
        authModalStatus.innerHTML = '';
        return;
      }
      authModalStatus.hidden = false;
      authModalStatus.className = `ev-auth-status is-${kind}`;
      const ic = kind === 'success' ? icon('check') : icon('alert');
      authModalStatus.innerHTML = `<span style="flex-shrink:0;display:inline-flex;margin-top:2px;">${ic}</span><span>${escapeHTML(msg)}</span>`;
    }

    function setAuthMode(mode) {
      currentAuthModalMode = mode === 'signup' ? 'signup' : 'login';
      authTabs.forEach((b) => b.classList.toggle('is-active', b.dataset.authTab === currentAuthModalMode));
      if (authNameWrap) authNameWrap.style.display = currentAuthModalMode === 'signup' ? 'flex' : 'none';
      if (authTitle) authTitle.textContent = currentAuthModalMode === 'signup' ? 'Create an Eventora account' : 'Log in to Eventora';
      if (authSubmit) authSubmit.textContent = currentAuthModalMode === 'signup' ? 'Create Account' : 'Log in';
      if (authFullPageLink) authFullPageLink.href = currentAuthModalMode === 'signup' ? 'signup.html' : 'login.html';
      setAuthModalStatus('', '');
    }
    authTabs.forEach((b) => b.addEventListener('click', () => setAuthMode(b.dataset.authTab)));

    if (authModalGoogleBtn) {
      authModalGoogleBtn.addEventListener('click', async () => {
        if (isModalAuthSubmitting || !window.EventoraAuth) return;
        isModalAuthSubmitting = true;
        authModalGoogleBtn.disabled = true;
        const res = await window.EventoraAuth.signInWithGoogle('login.html?oauth=google');
        if (!res.ok) {
          isModalAuthSubmitting = false;
          authModalGoogleBtn.disabled = false;
          setAuthModalStatus('error', res.error);
        }
      });
    }

    const authForm = document.getElementById('evAuthForm');
    if (authForm) {
      authForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (isModalAuthSubmitting || !window.EventoraAuth) return;
        const nameEl = document.getElementById('evAuthName');
        const emailEl = document.getElementById('evAuthEmail');
        const passEl = document.getElementById('evAuthPass');
        const emailVal = emailEl ? emailEl.value.trim() : '';
        const passVal = passEl ? passEl.value : '';
        const nameVal = nameEl ? nameEl.value.trim() : '';

        if (!window.EventoraAuth.isValidEmail(emailVal)) {
          setAuthModalStatus('error', 'Enter a valid email address.');
          return;
        }
        if (currentAuthModalMode === 'signup' && (!nameVal || nameVal.length < 2)) {
          setAuthModalStatus('error', 'Enter your full name (at least 2 characters).');
          return;
        }
        if (!passVal || (currentAuthModalMode === 'signup' && passVal.length < 8)) {
          setAuthModalStatus('error', currentAuthModalMode === 'signup' ? 'Password must be at least 8 characters.' : 'Password is required.');
          return;
        }

        isModalAuthSubmitting = true;
        if (authSubmit) {
          authSubmit.disabled = true;
          authSubmit.textContent = currentAuthModalMode === 'signup' ? 'Creating Account...' : 'Signing in...';
        }

        const res = currentAuthModalMode === 'signup'
          ? await window.EventoraAuth.signUpWithEmail({ fullName: nameVal, email: emailVal, password: passVal, role: 'participant' })
          : await window.EventoraAuth.signInWithPassword({ email: emailVal, password: passVal });

        isModalAuthSubmitting = false;
        if (authSubmit) {
          authSubmit.disabled = false;
          authSubmit.textContent = currentAuthModalMode === 'signup' ? 'Create Account' : 'Log in';
        }

        if (!res.ok) {
          setAuthModalStatus('error', res.error);
          return;
        }

        if (passEl) passEl.value = '';
        if (res.needsEmailVerification) {
          setAuthModalStatus('success', `Verification email sent to ${emailVal}. Confirm your email before logging in.`);
          return;
        }
        if (res.alreadyRegisteredNotice) {
          setAuthModalStatus('error', `An account for ${emailVal} may already exist. Try logging in.`);
          return;
        }
        closeModal('evAuthModal');
        const dest = window.EventoraAccess && res.user
          ? window.EventoraAccess.getPostLoginRedirect(res.user)
          : 'participant-dashboard.html';
        showToast(`Signed in as ${res.user ? res.user.fullName : emailVal}. Opening dashboard...`);
        setTimeout(() => {
          window.location.href = dest;
        }, 350);
      });
    }

    // Graceful image failure fallback across any dynamically rendered Eventora media & avatar slots
    document.addEventListener('error', function (e) {
      const target = e.target;
      if (target && target.tagName === 'IMG' && target.hasAttribute('data-ev-avatar-img')) {
        const parent = target.parentElement;
        const initials = parent ? (parent.getAttribute('data-ev-initials') || 'EV') : '';
        target.remove();
        if (parent) parent.textContent = initials;
        return;
      }
      if (target && target.tagName === 'IMG' && target.hasAttribute('data-ev-poster-img')) {
        target.hidden = true;
        const container = target.parentElement;
        if (container) {
          const fallback = container.querySelector('.ev-poster-fallback');
          if (fallback) fallback.hidden = false;
        }
      }
    }, true);

    // Dynamic Round Builder, Poster Upload Studio & Live Card Preview
    const MAX_POSTER_BYTES = 5 * 1024 * 1024;
    const ALLOWED_POSTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const ALLOWED_POSTER_EXT = /\.(jpe?g|png|webp)$/i;

    const roundsList = document.getElementById('evBuilderRoundsList');
    const addRoundBtn = document.getElementById('evAddRoundRowBtn');
    const livePreviewMount = document.getElementById('evLiveCardPreviewMount');
    const fileInput = document.getElementById('evPosterFileInput');
    const dropzone = document.getElementById('evPosterDropzone');
    const selectBtn = document.getElementById('evPosterSelectBtn');
    const previewBox = document.getElementById('evPosterPreviewBox');
    const previewImg = document.getElementById('evPosterPreviewImg');
    const previewFileName = document.getElementById('evPosterFileName');
    const previewFileMeta = document.getElementById('evPosterFileMeta');
    const replaceBtn = document.getElementById('evPosterReplaceBtn');
    const removeBtn = document.getElementById('evPosterRemoveBtn');
    const feedbackEl = document.getElementById('evPosterFeedback');

    let builderRounds = [
      { name: 'Initial Screening', duration: '2 Hours', typeKey: 'manual', type: 'Manual Evaluation Round' },
      { name: 'Final Presentation', duration: '3 Hours', typeKey: 'presentation', type: 'Presentation Round' }
    ];
    let posterState = {
      file: null,
      dataUrl: '',
      fileName: '',
      fileSize: 0,
      width: 0,
      height: 0
    };

    function formatFileSize(bytes) {
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    function setPosterFeedback(kind, message) {
      if (!feedbackEl) return;
      if (!message) {
        feedbackEl.hidden = true;
        feedbackEl.className = 'ev-upload-feedback';
        feedbackEl.innerHTML = '';
        return;
      }
      const ic = kind === 'ready' ? icon('check') : icon('alert');
      feedbackEl.hidden = false;
      feedbackEl.className = `ev-upload-feedback is-${kind}`;
      feedbackEl.innerHTML = `<span style="flex-shrink:0;display:inline-flex;">${ic}</span><span>${escapeHTML(message)}</span>`;
    }

    function readDraftFormValues() {
      const getVal = (id, fallback) => {
        const el = document.getElementById(id);
        return el && el.value.trim() ? el.value.trim() : fallback;
      };
      const name = getVal('evNewName', 'Cascadia Campus Design Sprint');
      const cat = getVal('evNewCategory', 'hackathons');
      const catObj = (window.EventoraStore && window.EventoraStore.getCategories().find((c) => c.slug === cat)) || { name: 'Hackathons' };
      const org = getVal('evNewOrg', 'Open Source Society');
      const college = getVal('evNewCollege', 'Northshore University');
      const city = getVal('evNewCity', 'Bengaluru');
      const dateLabel = getVal('evNewDate', 'Jan 24 – Jan 25, 2027');
      const partType = getVal('evNewParticipation', 'team');
      const customDescEl = document.getElementById('evNewDesc');
      const customDesc = customDescEl && customDescEl.value.trim() ? customDescEl.value.trim() : '';
      const rawSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = `${rawSlug || 'custom-event'}-preview`;

      return {
        slug,
        isSample: false,
        isPreviewDraft: true,
        isCreatedEvent: true,
        ownerEmail: (window.EventoraAuth && EventoraAuth.getSession() && EventoraAuth.getSession().email) || '',
        featured: true,
        name,
        tagline: customDesc || `Configured via the Eventora Organizer Studio for ${college}.`,
        category: cat,
        categoryLabel: catObj.name,
        organizer: org,
        institution: college,
        institutionShort: college,
        city,
        location: `${college}, ${city}`,
        mode: city.toLowerCase() === 'online' ? 'Online' : 'In-Person',
        dateLabel,
        dateWindow: 'upcoming',
        startTimeISO: '2027-01-24T10:00:00',
        coverImage: posterState.dataUrl || '',
        accentColor: '#183B2A',
        statusKey: 'draft',
        eventStatus: 'Draft',
        registrationStatus: 'Open',
        registrationBadgeClass: 'ev-badge-open',
        participationType: partType,
        teamConfig: partType === 'team'
          ? { supported: true, minSize: 2, maxSize: 4, label: 'Teams of 2–4 members' }
          : { supported: false, minSize: 1, maxSize: 1, label: 'Individual Participation' },
        description: customDesc || `This event ("${name}") was configured by ${org} at ${college}. Participants follow the configured stages, team format rules, and venue timeline directly on Eventora.`,
        schedule: [
          { time: `${dateLabel} • Opening`, title: 'Check-In & Organizer Welcome', detail: `Venue orientation hosted by ${org}.` },
          ...(builderRounds.length > 0 ? [{ time: `${dateLabel} • Midday`, title: `${builderRounds[0].name} Begins`, detail: 'Configured first active stage.' }] : [])
        ],
        rounds: builderRounds.map((r, idx) => {
          const typeKey = r.typeKey || 'custom';
          const meta = window.EventoraStore && typeof window.EventoraStore.getRoundTypeMeta === 'function'
            ? window.EventoraStore.getRoundTypeMeta(typeKey)
            : { label: r.type || 'Custom Round' };
          return {
            order: idx + 1,
            name: r.name || `Stage ${idx + 1}`,
            typeKey,
            type: meta.label,
            typeLabel: meta.label,
            status: 'Scheduled',
            enabled: true,
            duration: r.duration || 'TBD',
            eligibility: idx === 0 ? 'Open to all registered participants' : `Qualified from Round ${idx}`,
            qualification: {
              mode: idx === 0 ? 'all' : 'previous_round',
              minScore: 0,
              sourceRoundOrder: idx === 0 ? null : idx,
              note: ''
            },
            startTime: dateLabel,
            instructions: 'Custom round instructions configured by the event organizer.'
          };
        }),
        rules: [
          `Participants must abide by ${college} campus code of conduct.`,
          'Rounds and schedules are managed dynamically by the organizing committee.'
        ],
        organizers: [
          { name: org, role: 'Lead Organizer', department: college }
        ],
        faqs: [
          { q: 'How are configured events persisted in this preview?', a: 'This frontend prototype saves created event drafts locally inside browser sessionStorage for interactive exploration.' }
        ]
      };
    }

    let currentWizardStep = 1;
    let isCreatingEvent = false;
    const stepBtns = document.querySelectorAll('[data-wizard-goto]');
    const stepPanels = document.querySelectorAll('[data-wizard-panel]');
    const wizardErr1 = document.getElementById('evWizardError1');
    const wizardErr3 = document.getElementById('evWizardError3');
    const wizardSummaryEl = document.getElementById('evWizardSummary');
    const createBtn = document.getElementById('evWizardCreateBtn');
    const previewBtn = document.getElementById('evWizardPreviewBtn');
    const wizardBackBtn = document.getElementById('evWizardBackBtn');
    const previewSheetMount = document.getElementById('evPreviewSheetMount');

    function setWizardError(stepNum, message) {
      const box = stepNum === 1 ? wizardErr1 : wizardErr3;
      if (!box) return;
      if (!message) {
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      box.hidden = false;
      box.innerHTML = `<span style="flex-shrink:0;display:inline-flex;">${icon('alert')}</span><span>${escapeHTML(message)}</span>`;
    }

    function clearFieldInvalidStates() {
      document.querySelectorAll('#evCreateForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    }

    function validateStep1Fields() {
      clearFieldInvalidStates();
      setWizardError(1, '');
      const reqFields = [
        { id: 'evNewName', label: 'Event Name' },
        { id: 'evNewOrg', label: 'Organizer / Club' },
        { id: 'evNewCollege', label: 'College / Institution' },
        { id: 'evNewCity', label: 'City / Mode' },
        { id: 'evNewDate', label: 'Date Label' }
      ];
      const missing = [];
      let firstBad = null;
      reqFields.forEach((f) => {
        const el = document.getElementById(f.id);
        if (!el || !el.value.trim()) {
          missing.push(f.label);
          if (el) {
            el.classList.add('is-invalid');
            if (!firstBad) firstBad = el;
          }
        }
      });
      if (missing.length > 0) {
        setWizardError(1, `Please fill in the required fields before continuing: ${missing.join(', ')}.`);
        if (firstBad) firstBad.focus();
        return false;
      }
      return true;
    }

    function validateAllWizardInputs() {
      setWizardError(3, '');
      if (!validateStep1Fields()) {
        goToWizardStep(1, true);
        return false;
      }
      let roundErr = false;
      const roundNameInputs = roundsList ? roundsList.querySelectorAll('[data-r-field="name"]') : [];
      roundNameInputs.forEach((inp) => {
        if (!inp.value.trim()) {
          inp.classList.add('is-invalid');
          if (!roundErr) inp.focus();
          roundErr = true;
        }
      });
      if (roundErr) {
        setWizardError(3, 'Each configured round needs a title. Enter a title or remove unused rounds.');
        return false;
      }
      return true;
    }

    function renderWizardSummary() {
      if (!wizardSummaryEl) return;
      const draft = readDraftFormValues();
      const posterText = posterState.dataUrl
        ? `Uploaded (${posterState.width}×${posterState.height} px)`
        : 'Designed Eventora Fallback';
      wizardSummaryEl.innerHTML = `
        <div>
          <div class="ev-review-kv-label">Event Name</div>
          <div class="ev-review-kv-val">${escapeHTML(draft.name)}</div>
        </div>
        <div>
          <div class="ev-review-kv-label">Category &amp; Format</div>
          <div class="ev-review-kv-val">${escapeHTML(draft.categoryLabel)} • ${escapeHTML(draft.teamConfig.label)}</div>
        </div>
        <div>
          <div class="ev-review-kv-label">Schedule &amp; Venue</div>
          <div class="ev-review-kv-val">${escapeHTML(draft.dateLabel)} • ${escapeHTML(draft.location)}</div>
        </div>
        <div>
          <div class="ev-review-kv-label">Cover Poster &amp; Rounds</div>
          <div class="ev-review-kv-val">${escapeHTML(posterText)} • ${draft.rounds.length} Round${draft.rounds.length === 1 ? '' : 's'}</div>
        </div>
      `;
    }

    function goToWizardStep(stepNum, skipValidation) {
      if (!skipValidation && stepNum > currentWizardStep && currentWizardStep === 1) {
        if (!validateStep1Fields()) return;
      }
      currentWizardStep = Math.max(1, Math.min(3, stepNum));
      stepBtns.forEach((btn) => {
        const idx = Number(btn.dataset.wizardGoto);
        btn.classList.toggle('is-active', idx === currentWizardStep);
        btn.classList.toggle('is-done', idx < currentWizardStep);
        btn.setAttribute('aria-selected', String(idx === currentWizardStep));
      });
      stepPanels.forEach((p) => {
        p.classList.toggle('is-active', Number(p.dataset.wizardPanel) === currentWizardStep);
      });
      if (currentWizardStep === 3) {
        renderWizardSummary();
        setWizardError(3, '');
      }
      syncLiveCardPreview();
    }

    function renderPreviewSheet(draft) {
      if (!previewSheetMount) return;
      const mediaHTML = draft.coverImage
        ? `<img src="${escapeHTML(draft.coverImage)}" alt="${escapeHTML(draft.name)} preview cover" />`
        : '';
      previewSheetMount.innerHTML = `
        <div class="ev-preview-hero-banner">
          ${mediaHTML}
          ${renderPosterFallbackHTML(draft)}
          <div class="ev-preview-hero-scrim"></div>
          <div class="ev-preview-hero-inner">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.85rem;">
              <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                <span class="ev-badge ev-badge-category">${escapeHTML(draft.categoryLabel)}</span>
                <span class="ev-badge" style="background:rgba(255,255,255,0.18);color:#FFFFFF;">Pre-Creation Review Preview</span>
              </div>
              <button type="button" class="ev-modal-close" data-close-modal="evEventPreviewModal" aria-label="Close preview">${icon('close')}</button>
            </div>
            <h2 class="ev-display" style="font-size:clamp(1.5rem,3vw,2.2rem);font-weight:600;color:#FFFFFF;margin-bottom:0.4rem;">
              ${escapeHTML(draft.name)}
            </h2>
            <p style="font-size:0.9rem;color:rgba(246,245,239,0.88);max-width:38rem;">${escapeHTML(draft.tagline)}</p>
          </div>
        </div>
        <div class="ev-preview-sheet-body">
          <div class="ev-review-summary">
            <div>
              <div class="ev-review-kv-label">Institution</div>
              <div class="ev-review-kv-val">${escapeHTML(draft.institution)}</div>
            </div>
            <div>
              <div class="ev-review-kv-label">Organizer</div>
              <div class="ev-review-kv-val">${escapeHTML(draft.organizer)}</div>
            </div>
            <div>
              <div class="ev-review-kv-label">Date &amp; Location</div>
              <div class="ev-review-kv-val">${escapeHTML(draft.dateLabel)} • ${escapeHTML(draft.location)}</div>
            </div>
            <div>
              <div class="ev-review-kv-label">Participation &amp; Rounds</div>
              <div class="ev-review-kv-val">${escapeHTML(draft.teamConfig.label)} • ${draft.rounds.length} Round${draft.rounds.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          ${draft.rounds.length > 0 ? `
            <div>
              <div class="ev-review-kv-label" style="margin-bottom:0.5rem;">Configured Stages</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.65rem;">
                ${draft.rounds.map((r) => `
                  <div style="padding:0.75rem 0.9rem;border-radius:var(--ev-radius-sm);border:1px solid var(--ev-border);background:var(--ev-white);">
                    <div style="font-size:0.72rem;font-weight:700;color:var(--ev-primary);text-transform:uppercase;">Round ${r.order}</div>
                    <div style="font-weight:600;font-size:0.88rem;color:var(--ev-charcoal);">${escapeHTML(r.name)}</div>
                    <div style="font-size:0.76rem;color:var(--ev-muted);">${escapeHTML(r.duration)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;padding-top:0.5rem;border-top:1px solid var(--ev-border);">
            <span style="font-size:0.78rem;color:var(--ev-muted);">This is a temporary preview only — event has not been created yet.</span>
            <div style="display:flex;gap:0.6rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline" data-close-modal="evEventPreviewModal">&larr; Return to Wizard</button>
              <button type="button" class="ev-btn ev-btn-forest" id="evPreviewProceedCreateBtn">Create Event ${icon('arrowRight')}</button>
            </div>
          </div>
        </div>
      `;

      const proceedBtn = document.getElementById('evPreviewProceedCreateBtn');
      if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
          closeModal('evEventPreviewModal');
          triggerCreateEventFlow();
        });
      }
    }

    function handlePreviewEventClick() {
      if (!validateAllWizardInputs()) return;
      const previewObj = readDraftFormValues();
      renderPreviewSheet(previewObj);
      openModal('evEventPreviewModal');
    }

    function setCreateLoadingState(loading) {
      isCreatingEvent = loading;
      if (createBtn) {
        createBtn.disabled = loading;
        createBtn.innerHTML = loading
          ? `<span class="ev-spinner" aria-hidden="true"></span><span>Creating Event...</span>`
          : `Create Event ${icon('arrowRight')}`;
      }
      if (previewBtn) previewBtn.disabled = loading;
      if (wizardBackBtn) wizardBackBtn.disabled = loading;
    }

    async function triggerCreateEventFlow() {
      if (isCreatingEvent) return;
      const activeUser = getActiveAuthSession();
      if (!window.EventoraAccess || !activeUser || !window.EventoraAccess.can(activeUser, 'create_event')) {
        showToast('Access restricted: Event creation requires Event Organizer permissions.');
        closeModal('evCreateModal');
        return;
      }
      if (!validateAllWizardInputs()) return;

      const createdEvent = readDraftFormValues();
      setCreateLoadingState(true);

      const isDbMode = window.EventoraSync && window.EventoraSync.getStatus().mode === 'supabase';
      if (isDbMode) {
        // Ensure unique slug if duplicate already exists in PostgreSQL
        if (window.EventoraStore.getEventBySlug(createdEvent.slug)) {
          createdEvent.slug = `${createdEvent.slug}-${Date.now().toString(36).slice(-4)}`;
        }
        window.EventoraStore.savePreviewEvent(createdEvent);
        const dbRes = await window.EventoraSync.persistNewEventToDb(createdEvent);
        if (!dbRes.ok) {
          setCreateLoadingState(false);
          showToast(dbRes.error || 'Failed to save event to PostgreSQL.');
          return;
        }
        if (posterState.file) {
          const upRes = await window.EventoraSync.saveEventPosterFromFile(createdEvent.slug, posterState.file, 'poster');
          if (!upRes.ok) {
            showToast(`Event saved, but poster upload failed: ${upRes.error || 'Storage permission error'}`);
          }
        }
        setCreateLoadingState(false);
        closeModal('evEventPreviewModal');
        closeModal('evCreateModal');
        showToast(`"${createdEvent.name}" saved to Supabase PostgreSQL! Opening event manager...`);
        setTimeout(() => {
          window.location.href = `manage-event.html?slug=${encodeURIComponent(createdEvent.slug)}`;
        }, 320);
        return;
      }

      setTimeout(() => {
        const saveResult = window.EventoraStore.savePreviewEvent(createdEvent);
        setCreateLoadingState(false);
        closeModal('evEventPreviewModal');
        closeModal('evCreateModal');
        if (saveResult && saveResult.omittedImage) {
          showToast('Event created in local preview (oversized cover image exceeded browser sessionStorage limit).');
        } else {
          showToast(`"${createdEvent.name}" created in workspace! Opening event manager...`);
        }
        setTimeout(() => {
          const target = (window.EventoraAuth && EventoraAuth.getSession())
            ? `manage-event.html?slug=${encodeURIComponent(createdEvent.slug)}`
            : `event.html?slug=${encodeURIComponent(createdEvent.slug)}`;
          window.location.href = target;
        }, 380);
      }, 420);
    }

    function syncLiveCardPreview() {
      if (!livePreviewMount) return;
      const draftPreview = readDraftFormValues();
      livePreviewMount.innerHTML = renderEventCard(draftPreview, { isLivePreview: true });
    }

    function clearPosterSelection(message) {
      posterState = { file: null, dataUrl: '', fileName: '', fileSize: 0, width: 0, height: 0 };
      if (fileInput) fileInput.value = '';
      if (previewImg) previewImg.removeAttribute('src');
      if (previewBox) previewBox.hidden = true;
      if (dropzone) {
        dropzone.hidden = false;
        dropzone.classList.remove('has-error', 'is-dragover');
      }
      setPosterFeedback(message ? 'warn' : '', message || '');
      syncLiveCardPreview();
    }

    function applySelectedPoster(file) {
      if (!file) return;
      if (dropzone) dropzone.classList.remove('has-error');

      const mimeOk = ALLOWED_POSTER_TYPES.has(file.type);
      const extOk = ALLOWED_POSTER_EXT.test(file.name || '');
      if (!mimeOk && !extOk) {
        if (dropzone) dropzone.classList.add('has-error');
        setPosterFeedback('error', `Unsupported format (${file.type || file.name}). Please choose a JPEG, PNG, or WebP image.`);
        if (fileInput) fileInput.value = '';
        return;
      }

      if (file.size === 0) {
        if (dropzone) dropzone.classList.add('has-error');
        setPosterFeedback('error', 'The selected file is empty. Please choose a valid image file.');
        if (fileInput) fileInput.value = '';
        return;
      }

      if (file.size > MAX_POSTER_BYTES) {
        if (dropzone) dropzone.classList.add('has-error');
        setPosterFeedback('error', `Image exceeds the 5 MB frontend preview limit (selected: ${formatFileSize(file.size)}).`);
        if (fileInput) fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        const resultUrl = typeof reader.result === 'string' ? reader.result : '';
        const probeImg = new Image();
        probeImg.onload = function () {
          const w = probeImg.naturalWidth || 0;
          const h = probeImg.naturalHeight || 0;
          posterState = {
            file,
            dataUrl: resultUrl,
            fileName: file.name,
            fileSize: file.size,
            width: w,
            height: h
          };
          if (previewImg) previewImg.src = resultUrl;
          if (previewFileName) previewFileName.textContent = file.name;
          if (previewFileMeta) previewFileMeta.textContent = `${w} × ${h} px • ${formatFileSize(file.size)} • Local preview ready`;
          if (dropzone) dropzone.hidden = true;
          if (previewBox) previewBox.hidden = false;

          if (w > 0 && h > 0 && (w < h || w < 720)) {
            setPosterFeedback('warn', `Local preview loaded (${w}×${h} px). Landscape 16:9 covers (1600×900 recommended) display best across Eventora cards.`);
          } else {
            setPosterFeedback('ready', `Local cover preview active (${w}×${h} px • ${formatFileSize(file.size)}). Kept in browser state only — not uploaded.`);
          }
          syncLiveCardPreview();
        };
        probeImg.onerror = function () {
          if (dropzone) dropzone.classList.add('has-error');
          setPosterFeedback('error', 'Could not read image data. Please select a valid JPEG, PNG, or WebP file.');
        };
        probeImg.src = resultUrl;
      };
      reader.onerror = function () {
        if (dropzone) dropzone.classList.add('has-error');
        setPosterFeedback('error', 'Unable to read the selected local file.');
      };
      reader.readAsDataURL(file);
    }

    function bindDropSurface(el) {
      if (!el) return;
      ['dragenter', 'dragover'].forEach((evt) => {
        el.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (dropzone) dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'dragend'].forEach((evt) => {
        el.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (dropzone && !dropzone.contains(e.relatedTarget)) {
            dropzone.classList.remove('is-dragover');
          }
        });
      });
      el.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (dropzone) dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) applySelectedPoster(file);
      });
    }

    if (dropzone) {
      dropzone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (fileInput) fileInput.click();
      });
      dropzone.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && fileInput) {
          e.preventDefault();
          fileInput.click();
        }
      });
    }
    bindDropSurface(dropzone);
    bindDropSurface(previewBox);

    if (selectBtn) selectBtn.addEventListener('click', () => fileInput && fileInput.click());
    if (replaceBtn) replaceBtn.addEventListener('click', () => fileInput && fileInput.click());
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        clearPosterSelection('Poster removed. Event card preview now shows the designed Eventora fallback.');
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) applySelectedPoster(file);
      });
    }

    ['evNewName', 'evNewCategory', 'evNewOrg', 'evNewCollege', 'evNewCity', 'evNewDate', 'evNewParticipation', 'evNewDesc'].forEach((fid) => {
      const inputEl = document.getElementById(fid);
      if (inputEl) {
        inputEl.addEventListener('input', () => {
          inputEl.classList.remove('is-invalid');
          syncLiveCardPreview();
          if (currentWizardStep === 3) renderWizardSummary();
        });
        inputEl.addEventListener('change', () => {
          inputEl.classList.remove('is-invalid');
          syncLiveCardPreview();
          if (currentWizardStep === 3) renderWizardSummary();
        });
      }
    });

    stepBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        goToWizardStep(Number(btn.dataset.wizardGoto));
      });
    });
    const step1NextBtn = document.getElementById('evStep1NextBtn');
    const step2BackBtn = document.getElementById('evStep2BackBtn');
    const step2NextBtn = document.getElementById('evStep2NextBtn');
    if (step1NextBtn) step1NextBtn.addEventListener('click', () => goToWizardStep(2));
    if (step2BackBtn) step2BackBtn.addEventListener('click', () => goToWizardStep(1, true));
    if (step2NextBtn) step2NextBtn.addEventListener('click', () => goToWizardStep(3));
    if (wizardBackBtn) wizardBackBtn.addEventListener('click', () => goToWizardStep(2, true));
    if (previewBtn) previewBtn.addEventListener('click', handlePreviewEventClick);

    function renderBuilderRounds() {
      if (!roundsList) return;
      const typeCatalog = window.EventoraStore && typeof window.EventoraStore.getRoundTypeCatalog === 'function'
        ? window.EventoraStore.getRoundTypeCatalog()
        : [{ key: 'custom', label: 'Custom Round' }];
      if (builderRounds.length === 0) {
        roundsList.innerHTML = '<div style="font-size:0.8rem;color:var(--ev-muted);">No competitive rounds (single-session event format).</div>';
        syncLiveCardPreview();
        if (currentWizardStep === 3) renderWizardSummary();
        return;
      }
      roundsList.innerHTML = builderRounds.map((r, i) => `
        <div class="ev-wizard-round-row">
          <input class="ev-input" style="padding:0.45rem 0.65rem;font-size:0.82rem;" data-r-idx="${i}" data-r-field="name" value="${escapeHTML(r.name)}" placeholder="Round title" />
          <select class="ev-select" style="padding:0.45rem 0.6rem;font-size:0.8rem;" data-r-idx="${i}" data-r-field="typeKey" aria-label="Round ${i + 1} type">
            ${typeCatalog.map((rt) => `<option value="${escapeHTML(rt.key)}" ${(r.typeKey || 'custom') === rt.key ? 'selected' : ''}>${escapeHTML(rt.label)}</option>`).join('')}
          </select>
          <input class="ev-input" style="padding:0.45rem 0.65rem;font-size:0.82rem;" data-r-idx="${i}" data-r-field="duration" value="${escapeHTML(r.duration)}" placeholder="Duration" />
          <button type="button" class="ev-modal-close" style="width:28px;height:28px;" data-r-del="${i}" aria-label="Remove round">${icon('close')}</button>
        </div>
      `).join('');

      roundsList.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', () => {
          inp.classList.remove('is-invalid');
          builderRounds[Number(inp.dataset.rIdx)][inp.dataset.rField] = inp.value;
          syncLiveCardPreview();
          if (currentWizardStep === 3) renderWizardSummary();
        });
      });
      roundsList.querySelectorAll('select[data-r-field="typeKey"]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const item = builderRounds[Number(sel.dataset.rIdx)];
          if (!item) return;
          item.typeKey = sel.value;
          const found = typeCatalog.find((t) => t.key === sel.value);
          item.type = found ? found.label : 'Custom Round';
          if (currentWizardStep === 3) renderWizardSummary();
        });
      });
      roundsList.querySelectorAll('[data-r-del]').forEach((del) => {
        del.addEventListener('click', () => {
          builderRounds.splice(Number(del.dataset.rDel), 1);
          renderBuilderRounds();
        });
      });
      syncLiveCardPreview();
      if (currentWizardStep === 3) renderWizardSummary();
    }
    if (addRoundBtn) {
      addRoundBtn.addEventListener('click', () => {
        builderRounds.push({ name: `Round ${builderRounds.length + 1}`, duration: '90 Mins', typeKey: 'custom', type: 'Custom Round' });
        renderBuilderRounds();
      });
    }
    renderBuilderRounds();

    const createForm = document.getElementById('evCreateForm');
    if (createForm) {
      createForm.addEventListener('submit', function (e) {
        e.preventDefault();
        triggerCreateEventFlow();
      });
    }

    // Delegated open/close triggers
    document.addEventListener('click', function (e) {
      const authTrigger = e.target.closest('[data-open-auth]');
      if (authTrigger) {
        setAuthMode(authTrigger.dataset.openAuth || 'login');
        openModal('evAuthModal');
        return;
      }
      const createTrigger = e.target.closest('[data-open-create]');
      if (createTrigger) {
        const activeUser = getActiveAuthSession();
        const canCreate = Boolean(window.EventoraAccess && activeUser && window.EventoraAccess.can(activeUser, 'create_event'));
        if (!activeUser) {
          showToast('Log in with an Organizer account to create events.');
          if (createTrigger.dataset.closeModal) closeModal(createTrigger.dataset.closeModal);
          window.location.href = 'signup.html?role=organizer';
          return;
        }
        if (!canCreate) {
          showToast('Access restricted: Event creation requires verified Event Organizer permissions.');
          return;
        }
        if (createTrigger.dataset.closeModal) closeModal(createTrigger.dataset.closeModal);
        openModal('evCreateModal');
        return;
      }
      const walkTrigger = e.target.closest('[data-open-walkthrough]');
      if (walkTrigger) {
        openModal('evWalkthroughModal');
        return;
      }
      const closeTrigger = e.target.closest('[data-close-modal]');
      if (closeTrigger) {
        closeModal(closeTrigger.dataset.closeModal);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.ev-modal.is-open').forEach((m) => closeModal(m.id));
      }
    });
  }

  function mountShell(activeRoute) {
    const navMount = document.getElementById('evNavMount');
    const footerMount = document.getElementById('evFooterMount');
    const modalsMount = document.getElementById('evModalsMount');

    if (navMount) navMount.innerHTML = renderNavbar(activeRoute);
    if (footerMount) footerMount.innerHTML = renderFooter();
    if (modalsMount) modalsMount.innerHTML = renderGlobalModals();

    bindChromeInteractions();
  }

  function refreshAuthUI() {
    if (typeof window.__evRefreshAuthUI === 'function') {
      window.__evRefreshAuthUI();
    }
  }

  return {
    icon,
    escapeHTML,
    renderEventCard,
    mountShell,
    refreshAuthUI,
    showToast,
    openModal,
    closeModal
  };
})();

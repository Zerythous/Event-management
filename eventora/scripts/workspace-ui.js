/* ==========================================================================
   EVENTORA ORGANIZER WORKSPACE SHARED SHELL
   Shared SaaS Sidebar, Topbar, Confirmation Modal, Empty States & Notifications
   ========================================================================== */

window.EventoraWorkspace = (function () {
  const WS_ICONS = {
    overview: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    events: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    plus: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    participants: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    teams: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    rounds: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    content: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
    live: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
    results: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    collaborators: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',
    settings: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    details: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 Z"/></svg>',
    registration: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    bell: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    sidebarToggle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>'
  };

  function wsIcon(name) {
    return WS_ICONS[name] || EventoraUI.icon(name) || '';
  }

  function renderAvatarInner(user, initials) {
    const esc = EventoraUI.escapeHTML;
    if (user && user.avatarUrl) {
      return `<img src="${esc(user.avatarUrl)}" alt="${esc(user.fullName)}" data-ev-avatar-img="true" />`;
    }
    return esc(initials);
  }

  function renderLoadingView(pageName) {
    const esc = EventoraUI.escapeHTML;
    return `
      <div class="ev-auth-page" style="min-height:100vh;">
        <header class="ev-auth-topbar">
          <div class="ev-container ev-auth-topbar-inner">
            <a href="index.html" class="ev-brand">
              <span class="ev-brand-mark">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </span>
              <span>Eventora</span>
            </a>
            <a href="index.html" class="ev-back-link" style="font-size:0.86rem;font-weight:600;color:var(--ev-forest);">&larr; Back to Eventora</a>
          </div>
        </header>
        <main class="ev-auth-main">
          <div class="ev-container" style="max-width:560px;">
            <div class="ev-empty-state" style="padding:3rem 2rem;">
              <div class="ev-empty-icon"><span class="ev-spinner" aria-hidden="true"></span></div>
              <h1 class="ev-display" style="font-size:1.55rem;font-weight:600;margin-bottom:0.45rem;">Loading ${esc(pageName)}</h1>
              <p style="font-size:0.9rem;color:var(--ev-muted);">Restoring your Supabase authentication session...</p>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function renderSignedOutView(pageName, redirectPath) {
    const esc = EventoraUI.escapeHTML;
    const cfg = window.EventoraAuth && typeof window.EventoraAuth.getConfigStatus === 'function'
      ? window.EventoraAuth.getConfigStatus()
      : { configured: true };
    const cfgNote = !cfg.configured
      ? `
        <div class="ev-auth-status is-info" style="max-width:30rem;margin:0 auto 1.25rem;text-align:left;">
          <span style="flex-shrink:0;display:inline-flex;margin-top:2px;">${EventoraUI.icon('alert')}</span>
          <span>${esc(cfg.errorMessage || 'Local Supabase credentials are not configured yet.')}</span>
        </div>
      `
      : '';
    return `
      <div class="ev-auth-page" style="min-height:100vh;">
        <header class="ev-auth-topbar">
          <div class="ev-container ev-auth-topbar-inner">
            <a href="index.html" class="ev-brand">
              <span class="ev-brand-mark">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </span>
              <span>Eventora</span>
            </a>
            <a href="index.html" class="ev-back-link" style="font-size:0.86rem;font-weight:600;color:var(--ev-forest);">&larr; Back to Eventora</a>
          </div>
        </header>
        <main class="ev-auth-main">
          <div class="ev-container" style="max-width:600px;">
            <div class="ev-empty-state" style="padding:3.25rem 2rem;">
              <div class="ev-empty-icon">${wsIcon('overview')}</div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.75rem;">Authentication Required</span>
              <h1 class="ev-display" style="font-size:1.85rem;font-weight:600;margin-bottom:0.55rem;">Sign in to open ${esc(pageName)}</h1>
              <p style="font-size:0.94rem;color:var(--ev-muted);max-width:29rem;margin:0 auto 1.35rem;line-height:1.6;">
                Log in with your verified Eventora account or Google to open event management tools and workspace controls.
              </p>
              ${cfgNote}
              <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
                <a href="login.html?redirect=${encodeURIComponent(redirectPath)}" class="ev-btn ev-btn-forest">Log in</a>
                <a href="signup.html?role=organizer" class="ev-btn ev-btn-outline">Sign up as Organizer</a>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function renderEmptyState({ iconName = 'events', title, message, actionHTML = '' }) {
    const esc = EventoraUI.escapeHTML;
    return `
      <div class="ev-empty-state" style="padding:2.85rem 1.5rem;">
        <div class="ev-empty-icon">${wsIcon(iconName)}</div>
        <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;color:var(--ev-charcoal);margin-bottom:0.4rem;">${esc(title)}</h3>
        <p style="font-size:0.88rem;color:var(--ev-muted);max-width:30rem;margin:0 auto ${actionHTML ? '1.25rem' : '0'};line-height:1.58;">
          ${esc(message)}
        </p>
        ${actionHTML}
      </div>
    `;
  }

  function renderPosterThumbHTML(ev, extraStyle) {
    const esc = EventoraUI.escapeHTML;
    const hasCover = Boolean(ev && ev.coverImage && String(ev.coverImage).trim());
    const fallbackIcon = (window.EventoraStore && EventoraStore.getCategories().find((c) => c.slug === (ev && ev.category))?.icon) || 'sparkles';
    return `
      <div class="ev-event-media" style="${extraStyle || ''}">
        ${hasCover ? `<img src="${esc(ev.coverImage)}" alt="${esc(ev.name)} cover" loading="lazy" data-ev-poster-img="true" />` : ''}
        <div class="ev-poster-fallback" ${hasCover ? 'hidden' : ''}>
          <span class="ev-poster-fallback-icon">${EventoraUI.icon(fallbackIcon)}</span>
          <span class="ev-poster-fallback-sub">${esc((ev && ev.categoryLabel) || 'Event')}</span>
        </div>
      </div>
    `;
  }

  function mountConfirmModal() {
    if (document.getElementById('evWsConfirmModal')) return;
    const div = document.createElement('div');
    div.className = 'ev-modal';
    div.id = 'evWsConfirmModal';
    div.setAttribute('aria-hidden', 'true');
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.innerHTML = `
      <div class="ev-modal-backdrop" id="evWsConfirmBackdrop"></div>
      <div class="ev-modal-panel" style="max-width:460px;">
        <div class="ev-modal-head">
          <div>
            <span class="ev-badge ev-badge-filling" style="margin-bottom:0.45rem;">Confirm Action</span>
            <h2 class="ev-display" id="evWsConfirmTitle" style="font-size:1.45rem;font-weight:600;">Confirm</h2>
          </div>
          <button type="button" class="ev-modal-close" id="evWsConfirmClose" aria-label="Close modal">${EventoraUI.icon('close')}</button>
        </div>
        <p id="evWsConfirmBody" style="font-size:0.9rem;color:var(--ev-body);line-height:1.58;margin-bottom:1.35rem;"></p>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:0.65rem;flex-wrap:wrap;">
          <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evWsConfirmCancel">Cancel</button>
          <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evWsConfirmProceed">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function openConfirm({ title, body, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    mountConfirmModal();
    const modal = document.getElementById('evWsConfirmModal');
    const titleEl = document.getElementById('evWsConfirmTitle');
    const bodyEl = document.getElementById('evWsConfirmBody');
    const okBtn = document.getElementById('evWsConfirmProceed');
    const cancelBtn = document.getElementById('evWsConfirmCancel');
    const closeBtn = document.getElementById('evWsConfirmClose');
    const backdrop = document.getElementById('evWsConfirmBackdrop');

    if (titleEl) titleEl.textContent = title || 'Confirm Action';
    if (bodyEl) bodyEl.textContent = body || 'Are you sure you want to continue?';
    if (okBtn) {
      okBtn.textContent = confirmLabel;
      okBtn.className = danger ? 'ev-btn ev-btn-sm ev-btn-danger-ghost' : 'ev-btn ev-btn-forest ev-btn-sm';
      if (danger) {
        okBtn.style.background = '#9E2A20';
        okBtn.style.color = '#FFFFFF';
        okBtn.style.borderColor = '#9E2A20';
      } else {
        okBtn.style.background = '';
        okBtn.style.color = '';
        okBtn.style.borderColor = '';
      }
    }

    function cleanupAndClose() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if (!document.querySelector('.ev-modal.is-open')) {
        document.body.style.overflow = '';
      }
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
    }

    if (okBtn) okBtn.onclick = () => { cleanupAndClose(); if (typeof onConfirm === 'function') onConfirm(); };
    if (cancelBtn) cancelBtn.onclick = cleanupAndClose;
    if (closeBtn) closeBtn.onclick = cleanupAndClose;
    if (backdrop) backdrop.onclick = cleanupAndClose;

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function renderWorkspaceShell({ rootEl, user, navGroups, activeSection, topTitle, backLinkHTML = '', onSelectSection, onSearchSubmit, onLogout }) {
    const esc = EventoraUI.escapeHTML;
    const initials = EventoraAuth.getInitials(user.fullName);
    const role = window.EventoraAccess ? window.EventoraAccess.getEffectiveRole(user) : 'participant';
    const roleLabel = window.EventoraAccess ? window.EventoraAccess.getRoleLabel(role) : 'Participant';
    const dashUrl = window.EventoraAccess ? window.EventoraAccess.getDashboardUrl(role) : 'participant-dashboard.html';

    rootEl.innerHTML = `
      <div class="ev-ws-shell" id="evWsShell">
        <div class="ev-ws-backdrop" id="evWsBackdrop"></div>

        <aside class="ev-ws-sidebar" id="evWsSidebar" aria-label="Workspace Navigation">
          <div class="ev-ws-sidebar-head">
            <a href="index.html" class="ev-brand" aria-label="Eventora Public Home">
              <span class="ev-brand-mark">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </span>
              <span class="ev-ws-brand-text">Eventora</span>
            </a>
            <button type="button" class="ev-ws-collapse-btn" id="evWsCollapseBtn" title="Toggle sidebar width" aria-label="Toggle sidebar width">
              ${wsIcon('sidebarToggle')}
            </button>
          </div>

          <div class="ev-ws-nav-scroll" id="evWsSidebarNav">
            ${backLinkHTML}
            ${navGroups.map((g) => `
              ${g.title ? `<div class="ev-ws-nav-group-title">${esc(g.title)}</div>` : ''}
              ${g.items.map((item) => `
                <button
                  type="button"
                  class="ev-ws-nav-item ${item.id === activeSection ? 'is-active' : ''}"
                  data-ws-nav="${esc(item.id)}"
                  ${item.action === 'create' ? 'data-open-create="true"' : ''}
                >
                  <span class="ev-ws-nav-icon">${wsIcon(item.icon)}</span>
                  <span class="ev-ws-nav-label">${esc(item.label)}</span>
                </button>
              `).join('')}
            `).join('')}
          </div>

          <div class="ev-ws-sidebar-foot">
            <div style="display:flex;align-items:center;gap:0.65rem;min-width:0;">
              <span class="ev-avatar-chip" data-ev-initials="${esc(initials)}">${renderAvatarInner(user, initials)}</span>
              <div class="ev-ws-user-text" style="min-width:0;flex:1;">
                <div style="font-size:0.84rem;font-weight:600;color:var(--ev-charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(user.fullName)}</div>
                <div style="font-size:0.72rem;color:var(--ev-muted);">${esc(roleLabel)}</div>
              </div>
            </div>
            <div class="ev-ws-user-text" style="display:flex;gap:0.45rem;flex-wrap:wrap;">
              <a href="profile.html" class="ev-btn ev-btn-outline ev-btn-sm" style="flex:1;">Profile</a>
              <button type="button" class="ev-btn ev-btn-sm ev-btn-danger-ghost" id="evWsSidebarLogout" style="flex:1;">Logout</button>
            </div>
          </div>
        </aside>

        <div class="ev-ws-main-wrap">
          <header class="ev-ws-topbar">
            <div class="ev-ws-topbar-left">
              <button type="button" class="ev-hamburger" id="evWsMobileToggle" aria-label="Open workspace navigation" style="width:36px;height:36px;">
                ${EventoraUI.icon('menu')}
              </button>
              <div style="min-width:0;">
                <h1 class="ev-display" id="evWsTopHeading" style="font-size:1.25rem;font-weight:600;color:var(--ev-charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${esc(topTitle)}
                </h1>
              </div>
            </div>

            <div class="ev-ws-topbar-right">
              <form class="ev-ws-search-mini" id="evWsTopSearchForm" role="search">
                <span style="color:var(--ev-muted);display:inline-flex;">${EventoraUI.icon('search')}</span>
                <input type="search" id="evWsTopSearchInput" placeholder="Search events..." aria-label="Search workspace events" />
              </form>

              <div class="ev-dropdown" id="evWsNotifDropdown">
                <button type="button" class="ev-ws-icon-btn" id="evWsNotifBtn" aria-label="Workspace notifications" aria-expanded="false">
                  ${wsIcon('bell')}
                </button>
                <div class="ev-dropdown-menu ev-account-menu" role="menu">
                  <div class="ev-account-menu-head">
                    <div class="ev-account-menu-name">Notifications</div>
                    <div class="ev-account-menu-email">UI Placeholder (Frontend Only)</div>
                  </div>
                  <div style="padding:0.75rem 0.85rem;font-size:0.8rem;color:var(--ev-muted);">
                    No new notifications. Live alerts connect alongside real participant registrations.
                  </div>
                </div>
              </div>

              <div class="ev-dropdown" id="evWsUserDropdown">
                <button type="button" class="ev-account-btn" id="evWsUserBtn" aria-expanded="false" aria-haspopup="true">
                  <span class="ev-avatar-chip" data-ev-initials="${esc(initials)}">${renderAvatarInner(user, initials)}</span>
                  <span class="ev-account-name">${esc(user.fullName)}</span>
                  ${EventoraUI.icon('chevronDown')}
                </button>
                <div class="ev-dropdown-menu ev-account-menu" role="menu">
                  <div class="ev-account-menu-head">
                    <div class="ev-account-menu-name">${esc(user.fullName)}</div>
                    <div class="ev-account-menu-email">${esc(user.email)}</div>
                    <span class="ev-badge ev-badge-open" style="margin-top:0.4rem;">${esc(roleLabel)}</span>
                  </div>
                  <a href="${esc(dashUrl)}" class="ev-dropdown-item" role="menuitem"><span>${esc(roleLabel)} Dashboard</span><span class="ev-dd-meta">Home</span></a>
                  <a href="profile.html" class="ev-dropdown-item" role="menuitem"><span>Profile</span><span class="ev-dd-meta">Account</span></a>
                  <a href="index.html" class="ev-dropdown-item" role="menuitem"><span>Public Site</span><span class="ev-dd-meta">Eventora</span></a>
                  <button type="button" class="ev-dropdown-item ev-dropdown-danger" id="evWsTopLogout" role="menuitem"><span>Logout</span><span class="ev-dd-meta">Sign out</span></button>
                </div>
              </div>
            </div>
          </header>

          <main class="ev-ws-body" id="evWsBodyMount"></main>
        </div>
      </div>
    `;

    const shell = document.getElementById('evWsShell');
    const sidebar = document.getElementById('evWsSidebar');
    const backdrop = document.getElementById('evWsBackdrop');
    const collapseBtn = document.getElementById('evWsCollapseBtn');
    const mobileBtn = document.getElementById('evWsMobileToggle');
    const notifDd = document.getElementById('evWsNotifDropdown');
    const notifBtn = document.getElementById('evWsNotifBtn');
    const userDd = document.getElementById('evWsUserDropdown');
    const userBtn = document.getElementById('evWsUserBtn');
    const searchForm = document.getElementById('evWsTopSearchForm');
    const searchInput = document.getElementById('evWsTopSearchInput');

    function setMobileOpen(open) {
      if (!sidebar || !backdrop) return;
      sidebar.classList.toggle('is-mobile-open', open);
      backdrop.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    if (collapseBtn && shell) {
      collapseBtn.addEventListener('click', () => shell.classList.toggle('is-collapsed'));
    }
    if (mobileBtn) mobileBtn.addEventListener('click', () => setMobileOpen(true));
    if (backdrop) backdrop.addEventListener('click', () => setMobileOpen(false));

    function toggleDd(dd, btn, otherDd, otherBtn) {
      if (otherDd && otherBtn) {
        otherDd.classList.remove('is-open');
        otherBtn.setAttribute('aria-expanded', 'false');
      }
      const next = !dd.classList.contains('is-open');
      dd.classList.toggle('is-open', next);
      btn.setAttribute('aria-expanded', String(next));
    }

    if (notifDd && notifBtn) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDd(notifDd, notifBtn, userDd, userBtn);
      });
    }
    if (userDd && userBtn) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDd(userDd, userBtn, notifDd, notifBtn);
      });
    }
    document.addEventListener('click', () => {
      if (notifDd && notifBtn) { notifDd.classList.remove('is-open'); notifBtn.setAttribute('aria-expanded', 'false'); }
      if (userDd && userBtn) { userDd.classList.remove('is-open'); userBtn.setAttribute('aria-expanded', 'false'); }
    });

    document.querySelectorAll('[data-ws-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.wsNav;
        setMobileOpen(false);
        if (btn.hasAttribute('data-open-create')) return;
        if (typeof onSelectSection === 'function') onSelectSection(id);
      });
    });

    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (typeof onSearchSubmit === 'function') onSearchSubmit(searchInput.value.trim());
      });
    }

    const doLogout = () => {
      if (typeof onLogout === 'function') onLogout();
    };
    document.getElementById('evWsSidebarLogout')?.addEventListener('click', doLogout);
    document.getElementById('evWsTopLogout')?.addEventListener('click', doLogout);

    return {
      bodyMount: document.getElementById('evWsBodyMount'),
      setActiveNav(id, headingText) {
        document.querySelectorAll('[data-ws-nav]').forEach((b) => b.classList.toggle('is-active', b.dataset.wsNav === id));
        const h = document.getElementById('evWsTopHeading');
        if (h && headingText) h.textContent = headingText;
        setMobileOpen(false);
      }
    };
  }

  return {
    wsIcon,
    renderLoadingView,
    renderSignedOutView,
    renderEmptyState,
    renderPosterThumbHTML,
    openConfirm,
    renderWorkspaceShell
  };
})();

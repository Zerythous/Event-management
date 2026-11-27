/* ==========================================================================
   EVENTORA SHARED ROLE & ACCESS CONTROL HELPER
   - Single frontend source of truth for role resolution, nav items,
     capabilities, post-login redirects, and page access boundaries.
   - SECURITY NOTE: Frontend access rules control UI presentation and routing
     only. Authoritative authorization MUST be enforced server-side via
     Supabase PostgreSQL Row Level Security (RLS), verified platform_role,
     and server RPCs (Phase 3+).
   ========================================================================== */

window.EventoraAccess = (function () {
  const VALID_ROLES = new Set(['participant', 'organizer', 'manager', 'admin', 'super_admin']);

  const ROLE_DASHBOARDS = {
    participant: 'participant-dashboard.html',
    organizer: 'organizer-dashboard.html',
    manager: 'manager-dashboard.html',
    admin: 'admin-dashboard.html',
    super_admin: 'superadmin-dashboard.html'
  };

  const ROLE_LABELS = {
    participant: 'Participant',
    organizer: 'Event Organizer',
    manager: 'Event Manager',
    admin: 'Admin',
    super_admin: 'Super Admin'
  };

  const ROLE_CAPABILITIES = {
    participant: new Set([
      'discover_events',
      'view_participant_dashboard',
      'manage_own_registrations',
      'manage_own_teams',
      'view_own_activity',
      'edit_own_profile'
    ]),
    organizer: new Set([
      'discover_events',
      'view_organizer_dashboard',
      'create_event',
      'edit_event',
      'delete_event',
      'manage_event_workspace',
      'manage_registrations',
      'manage_teams',
      'manage_rounds',
      'control_live_event',
      'publish_results',
      'manage_collaborators',
      'edit_own_profile'
    ]),
    manager: new Set([
      'discover_events',
      'view_manager_workspace',
      'manage_assigned_events',
      'manage_rounds_assigned',
      'view_participants_assigned',
      'view_teams_assigned',
      'control_live_assigned',
      'edit_own_profile'
    ]),
    admin: new Set([
      'discover_events',
      'view_admin_console',
      'moderate_directory',
      'review_role_requests',
      'edit_own_profile'
    ]),
    super_admin: new Set([
      'discover_events',
      'view_superadmin_console',
      'view_admin_console',
      'moderate_directory',
      'review_role_requests',
      'system_governance',
      'edit_own_profile'
    ])
  };

  // Explicit page allowlist map per role (protected pages require authenticated user + matching role)
  const PAGE_ALLOWED_ROLES = {
    'register.html': VALID_ROLES,
    'participant-dashboard.html': new Set(['participant']),
    'organizer-dashboard.html': new Set(['organizer']),
    'manage-event.html': new Set(['organizer', 'manager']),
    'manager-dashboard.html': new Set(['manager']),
    'admin-dashboard.html': new Set(['admin', 'super_admin']),
    'superadmin-dashboard.html': new Set(['super_admin']),
    'profile.html': VALID_ROLES
  };

  function getEsc() {
    if (window.EventoraUI && typeof window.EventoraUI.escapeHTML === 'function') {
      return window.EventoraUI.escapeHTML;
    }
    return function fallbackEsc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
  }

  // Resolve effective role:
  // 1. Server-verified app_metadata claim always takes precedence (supports all 5 roles incl. admin/super_admin).
  // 2. While Phase 3+ backend DB triggers/RPCs are pending, non-admin workspace role selected during
  //    Supabase Auth signup (user_metadata.role_preference clamped strictly to participant | organizer | manager)
  //    routes Organizers/Managers to their workspace. Admin & Super Admin NEVER resolve from user_metadata.
  function getEffectiveRole(user) {
    if (!user || typeof user !== 'object') return 'participant';
    if (user.hasServerVerifiedRole) {
      const srv = String(user.verifiedRole || '').trim().toLowerCase();
      return VALID_ROLES.has(srv) ? srv : 'participant';
    }
    const nonAdmin = String(user.rolePreference || user.role || '').trim().toLowerCase();
    if (nonAdmin === 'organizer' || nonAdmin === 'manager' || nonAdmin === 'participant') {
      return nonAdmin;
    }
    return 'participant';
  }

  function getRoleLabel(role) {
    return ROLE_LABELS[role] || 'Participant';
  }

  function getDashboardUrl(roleOrUser) {
    const role = typeof roleOrUser === 'string' && VALID_ROLES.has(roleOrUser)
      ? roleOrUser
      : getEffectiveRole(roleOrUser);
    return ROLE_DASHBOARDS[role] || 'participant-dashboard.html';
  }

  function can(roleOrUser, capability) {
    if (!roleOrUser) return false;
    const role = typeof roleOrUser === 'string' && VALID_ROLES.has(roleOrUser)
      ? roleOrUser
      : getEffectiveRole(roleOrUser);
    const caps = ROLE_CAPABILITIES[role];
    return Boolean(caps && caps.has(capability));
  }

  function extractPageFile(targetUrl) {
    const raw = String(targetUrl || '').trim();
    if (!raw) return '';
    const withoutHash = raw.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    return segments.length ? segments[segments.length - 1] : '';
  }

  function canAccessPage(roleOrUser, targetUrl) {
    const pageFile = extractPageFile(targetUrl);
    if (!pageFile) return false;
    const rule = PAGE_ALLOWED_ROLES[pageFile];
    if (!rule) return true; // Public route (index.html, discover.html, event.html, login/signup/forgot-password)
    if (!roleOrUser) return false;
    const role = typeof roleOrUser === 'string' && VALID_ROLES.has(roleOrUser)
      ? roleOrUser
      : getEffectiveRole(roleOrUser);
    return rule.has(role);
  }

  // Safely resolve post-login destination: validates allowlisted Eventora path AND verifies user's trusted role is allowed there.
  function getPostLoginRedirect(user, rawExplicitRedirect) {
    const role = getEffectiveRole(user);
    const defaultDash = getDashboardUrl(role);

    if (rawExplicitRedirect && window.EventoraAuth && typeof window.EventoraAuth.getSafeRedirectTarget === 'function') {
      const safeRel = window.EventoraAuth.getSafeRedirectTarget(rawExplicitRedirect, defaultDash);
      const pageFile = extractPageFile(safeRel);
      if (PAGE_ALLOWED_ROLES[pageFile] && canAccessPage(role, safeRel)) {
        return safeRel;
      }
      if (pageFile === 'discover.html' || pageFile === 'event.html' || pageFile === 'index.html') {
        return safeRel;
      }
    }

    return defaultDash;
  }

  function getCurrentRelativeUrl() {
    const pageFile = extractPageFile(window.location.pathname) || 'index.html';
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    return `${pageFile}${search}${hash}`;
  }

  function getNavbarConfig(activeRoute, user, isRestoring) {
    const isHome = activeRoute === 'home';
    const isDiscover = activeRoute === 'discover';
    const isEvent = activeRoute === 'event';
    const isProfile = activeRoute === 'profile';

    if (isRestoring) {
      return {
        mode: 'restoring',
        role: null,
        pillItems: [
          { type: 'link', href: 'index.html', label: 'Home', active: isHome },
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'link', href: isHome ? '#how-it-works' : 'index.html#how-it-works', label: 'How It Works', active: false },
          { type: 'link', href: isHome ? '#about' : 'index.html#about', label: 'About', active: false }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: isHome ? '#how-it-works' : 'index.html#how-it-works', label: 'How It Works' },
          { href: isHome ? '#about' : 'index.html#about', label: 'About' }
        ],
        dropdownItems: [],
        showCreateButton: false
      };
    }

    if (!user) {
      return {
        mode: 'guest',
        role: null,
        pillItems: [
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'events-dropdown', active: isEvent },
          { type: 'link', href: isHome ? '#colleges' : 'index.html#colleges', label: 'Colleges', active: false },
          { type: 'link', href: isHome ? '#how-it-works' : 'index.html#how-it-works', label: 'How It Works', active: false },
          { type: 'link', href: isHome ? '#about' : 'index.html#about', label: 'About', active: false }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: isHome ? '#colleges' : 'index.html#colleges', label: 'Colleges' },
          { href: isHome ? '#how-it-works' : 'index.html#how-it-works', label: 'How It Works' },
          { href: isHome ? '#about' : 'index.html#about', label: 'About' }
        ],
        dropdownItems: [],
        showCreateButton: false
      };
    }

    const role = getEffectiveRole(user);

    if (role === 'organizer') {
      return {
        mode: 'authenticated',
        role,
        pillItems: [
          { type: 'link', href: 'index.html', label: 'Home', active: isHome },
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'link', href: 'organizer-dashboard.html', label: 'Organizer Dashboard', active: activeRoute === 'organizer' },
          { type: 'link', href: 'organizer-dashboard.html?section=my-events', label: 'My Events', active: false },
          { type: 'link', href: 'profile.html', label: 'Profile', active: isProfile },
          { type: 'create-button', label: 'Create Event' }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: 'organizer-dashboard.html', label: 'Organizer Dashboard' },
          { href: 'organizer-dashboard.html?section=my-events', label: 'My Events' },
          { href: 'profile.html', label: 'Profile' }
        ],
        dropdownItems: [
          { href: 'organizer-dashboard.html', label: 'Organizer Dashboard', meta: 'Studio' },
          { href: 'organizer-dashboard.html?section=my-events', label: 'My Events', meta: 'Catalog' },
          { href: 'profile.html', label: 'Profile', meta: 'Account' }
        ],
        showCreateButton: true
      };
    }

    if (role === 'manager') {
      return {
        mode: 'authenticated',
        role,
        pillItems: [
          { type: 'link', href: 'index.html', label: 'Home', active: isHome },
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'link', href: 'manager-dashboard.html', label: 'Manager Workspace', active: activeRoute === 'manager' },
          { type: 'link', href: 'manager-dashboard.html?section=assigned-events', label: 'Assigned Events', active: false },
          { type: 'link', href: 'profile.html', label: 'Profile', active: isProfile }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: 'manager-dashboard.html', label: 'Manager Workspace' },
          { href: 'manager-dashboard.html?section=assigned-events', label: 'Assigned Events' },
          { href: 'profile.html', label: 'Profile' }
        ],
        dropdownItems: [
          { href: 'manager-dashboard.html', label: 'Manager Workspace', meta: 'Assigned' },
          { href: 'manager-dashboard.html?section=assigned-events', label: 'Assigned Events', meta: 'Scope' },
          { href: 'profile.html', label: 'Profile', meta: 'Account' }
        ],
        showCreateButton: false
      };
    }

    if (role === 'admin') {
      return {
        mode: 'authenticated',
        role,
        pillItems: [
          { type: 'link', href: 'index.html', label: 'Home', active: isHome },
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'link', href: 'admin-dashboard.html', label: 'Admin Console', active: activeRoute === 'admin' },
          { type: 'link', href: 'admin-dashboard.html?section=moderation', label: 'Moderation', active: false },
          { type: 'link', href: 'profile.html', label: 'Profile', active: isProfile }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: 'admin-dashboard.html', label: 'Admin Console' },
          { href: 'admin-dashboard.html?section=moderation', label: 'Moderation' },
          { href: 'profile.html', label: 'Profile' }
        ],
        dropdownItems: [
          { href: 'admin-dashboard.html', label: 'Admin Console', meta: 'Governance' },
          { href: 'profile.html', label: 'Profile', meta: 'Account' }
        ],
        showCreateButton: false
      };
    }

    if (role === 'super_admin') {
      return {
        mode: 'authenticated',
        role,
        pillItems: [
          { type: 'link', href: 'index.html', label: 'Home', active: isHome },
          { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
          { type: 'link', href: 'superadmin-dashboard.html', label: 'Super Admin', active: activeRoute === 'superadmin' },
          { type: 'link', href: 'admin-dashboard.html', label: 'Admin Console', active: activeRoute === 'admin' },
          { type: 'link', href: 'profile.html', label: 'Profile', active: isProfile }
        ],
        mobileLinks: [
          { href: 'index.html', label: 'Home' },
          { href: 'discover.html', label: 'Discover Events' },
          { href: 'superadmin-dashboard.html', label: 'Super Admin Console' },
          { href: 'admin-dashboard.html', label: 'Admin Console' },
          { href: 'profile.html', label: 'Profile' }
        ],
        dropdownItems: [
          { href: 'superadmin-dashboard.html', label: 'Super Admin Console', meta: 'System' },
          { href: 'admin-dashboard.html', label: 'Admin Console', meta: 'Directory' },
          { href: 'profile.html', label: 'Profile', meta: 'Account' }
        ],
        showCreateButton: false
      };
    }

    // Default authenticated role: participant
    return {
      mode: 'authenticated',
      role: 'participant',
      pillItems: [
        { type: 'link', href: 'index.html', label: 'Home', active: isHome },
        { type: 'link', href: 'discover.html', label: 'Discover', active: isDiscover },
        { type: 'link', href: 'participant-dashboard.html?section=registrations', label: 'My Registrations', active: false },
        { type: 'link', href: 'participant-dashboard.html?section=teams', label: 'My Teams', active: false },
        { type: 'link', href: 'profile.html', label: 'Profile', active: isProfile }
      ],
      mobileLinks: [
        { href: 'index.html', label: 'Home' },
        { href: 'discover.html', label: 'Discover Events' },
        { href: 'participant-dashboard.html', label: 'Participant Dashboard' },
        { href: 'participant-dashboard.html?section=registrations', label: 'My Registrations' },
        { href: 'participant-dashboard.html?section=teams', label: 'My Teams' },
        { href: 'profile.html', label: 'Profile' }
      ],
      dropdownItems: [
        { href: 'participant-dashboard.html', label: 'Participant Dashboard', meta: 'Home' },
        { href: 'participant-dashboard.html?section=registrations', label: 'My Registrations', meta: 'Events' },
        { href: 'participant-dashboard.html?section=teams', label: 'My Teams', meta: 'Squads' },
        { href: 'profile.html', label: 'Profile', meta: 'Account' }
      ],
      showCreateButton: false
    };
  }

  function renderRestrictedAccessView({ user, requiredRoles, pageName }) {
    const esc = getEsc();
    const role = getEffectiveRole(user);
    const roleLabel = getRoleLabel(role);
    const dashboardUrl = getDashboardUrl(role);
    const requiredText = (requiredRoles || []).map(getRoleLabel).join(' or ');

    return `
      <div class="ev-auth-page" style="min-height:100vh;">
        <header class="ev-auth-topbar">
          <div class="ev-container ev-auth-topbar-inner">
            <a href="index.html" class="ev-brand" aria-label="Eventora Home">
              <span class="ev-brand-mark">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </span>
              <span>Eventora</span>
            </a>
            <a href="${esc(dashboardUrl)}" class="ev-back-link" style="font-size:0.86rem;font-weight:600;color:var(--ev-forest);">
              &larr; Return to ${esc(roleLabel)} Dashboard
            </a>
          </div>
        </header>
        <main class="ev-auth-main">
          <div class="ev-container" style="max-width:620px;">
            <div class="ev-empty-state" style="padding:3.1rem 2rem;">
              <div class="ev-empty-icon" style="background:rgba(180,60,46,0.1);color:#96261B;">
                ${window.EventoraUI ? window.EventoraUI.icon('alert') : '!'}
              </div>
              <span class="ev-badge ev-badge-filling" style="margin-bottom:0.75rem;">Access Restricted</span>
              <h1 class="ev-display" style="font-size:1.75rem;font-weight:600;margin-bottom:0.55rem;">
                ${esc(pageName)} is not available for your role
              </h1>
              <p style="font-size:0.94rem;color:var(--ev-muted);max-width:30rem;margin:0 auto 1.25rem;line-height:1.6;">
                You are signed in as <strong>${esc(user.fullName)}</strong> with verified role <strong>${esc(roleLabel)}</strong>.
                Accessing this workspace requires <strong>${esc(requiredText || 'elevated permissions')}</strong>.
              </p>
              <div class="ev-auth-status is-info" style="max-width:31rem;margin:0 auto 1.4rem;text-align:left;">
                <span style="flex-shrink:0;display:inline-flex;margin-top:2px;">${window.EventoraUI ? window.EventoraUI.icon('alert') : 'i'}</span>
                <span>Verified roles are assigned strictly via server-controlled metadata/database authorization and cannot be escalated from browser storage or profile forms.</span>
              </div>
              <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
                <a href="${esc(dashboardUrl)}" class="ev-btn ev-btn-forest">Go to ${esc(roleLabel)} Dashboard &rarr;</a>
                <a href="profile.html" class="ev-btn ev-btn-outline">View Profile</a>
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  function renderRedirectingToLoginView(pageName) {
    const esc = getEsc();
    const targetUrl = getCurrentRelativeUrl();
    const loginHref = `login.html?redirect=${encodeURIComponent(targetUrl)}&reason=auth_required`;
    return `
      <div class="ev-auth-page" style="min-height:100vh;">
        <main class="ev-auth-main">
          <div class="ev-container" style="max-width:560px;">
            <div class="ev-empty-state" style="padding:3rem 2rem;">
              <div class="ev-empty-icon"><span class="ev-spinner" aria-hidden="true"></span></div>
              <h1 class="ev-display" style="font-size:1.55rem;font-weight:600;margin-bottom:0.45rem;">Authentication Required</h1>
              <p style="font-size:0.9rem;color:var(--ev-muted);margin-bottom:1.15rem;">
                Redirecting you to Log in before opening ${esc(pageName)}...
              </p>
              <a href="${esc(loginHref)}" class="ev-btn ev-btn-forest ev-btn-sm">Continue to Log in &rarr;</a>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  // Enforces page access consistently across protected dashboards/workspaces.
  // Returns { allowed: boolean, status: 'loading' | 'unauthenticated' | 'forbidden' | 'ok', user, role }.
  function evaluatePageAccess({ requiredRoles, rootEl, pageName, redirectOnUnauth = true }) {
    const isRestoring = window.EventoraAuth && typeof window.EventoraAuth.isRestoring === 'function' && window.EventoraAuth.isRestoring();
    if (isRestoring) {
      if (rootEl && window.EventoraWorkspace && typeof window.EventoraWorkspace.renderLoadingView === 'function') {
        rootEl.innerHTML = window.EventoraWorkspace.renderLoadingView(pageName);
      }
      return { allowed: false, status: 'loading', user: null, role: null };
    }

    const user = window.EventoraAuth && typeof window.EventoraAuth.getSession === 'function'
      ? window.EventoraAuth.getSession()
      : null;

    if (!user) {
      if (redirectOnUnauth) {
        if (rootEl) {
          rootEl.innerHTML = renderRedirectingToLoginView(pageName);
        }
        const safeRel = window.EventoraAuth && typeof window.EventoraAuth.getSafeRedirectTarget === 'function'
          ? window.EventoraAuth.getSafeRedirectTarget(getCurrentRelativeUrl(), 'profile.html')
          : 'profile.html';
        const dest = `login.html?redirect=${encodeURIComponent(safeRel)}&reason=auth_required`;
        if (!window.__evRedirectingToLogin) {
          window.__evRedirectingToLogin = true;
          window.location.replace(dest);
        }
      }
      return { allowed: false, status: 'unauthenticated', user: null, role: null };
    }

    const role = getEffectiveRole(user);
    const allowedSet = new Set(Array.isArray(requiredRoles) ? requiredRoles : VALID_ROLES);
    if (!allowedSet.has(role)) {
      if (rootEl) {
        rootEl.innerHTML = renderRestrictedAccessView({ user, requiredRoles: Array.from(allowedSet), pageName });
      }
      return { allowed: false, status: 'forbidden', user, role };
    }

    return { allowed: true, status: 'ok', user, role };
  }

  return {
    VALID_ROLES,
    ROLE_DASHBOARDS,
    ROLE_LABELS,
    getEffectiveRole,
    getRoleLabel,
    getDashboardUrl,
    can,
    canAccessPage,
    getPostLoginRedirect,
    getNavbarConfig,
    renderRestrictedAccessView,
    renderRedirectingToLoginView,
    evaluatePageAccess
  };
})();

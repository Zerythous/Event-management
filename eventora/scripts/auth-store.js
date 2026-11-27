/* ==========================================================================
   EVENTORA REAL SUPABASE AUTHENTICATION STORE
   - Uses @supabase/supabase-js v2 via EventoraSupabase client
   - Never stores passwords or tokens manually (relies on Supabase SDK session)
   - Never grants privileged roles (admin/super_admin) from frontend signup/metadata
   ========================================================================== */

window.EventoraAuth = (function () {
  const ALLOWED_SIGNUP_ROLE_KEYS = new Set(['participant', 'organizer', 'manager']);
  const VALID_VERIFIED_ROLES = new Set(['participant', 'organizer', 'manager', 'admin', 'super_admin']);
  const SAFE_PAGE_ALLOWLIST = new Set([
    'index.html',
    'discover.html',
    'event.html',
    'register.html',
    'login.html',
    'profile.html',
    'participant-dashboard.html',
    'organizer-dashboard.html',
    'manage-event.html',
    'manager-dashboard.html',
    'admin-dashboard.html',
    'superadmin-dashboard.html'
  ]);

  // Complete role hierarchy metadata (admin & super_admin are strictly server-assigned)
  const ROLES = [
    {
      key: 'participant',
      label: 'Participant',
      badge: 'Participant',
      selectableOnSignup: true,
      description: 'Discover events, join teams, and follow round timelines.'
    },
    {
      key: 'organizer',
      label: 'Event Organizer',
      badge: 'Organizer',
      selectableOnSignup: true,
      description: 'Configure event drafts, round workflows, and schedules.'
    },
    {
      key: 'manager',
      label: 'Event Manager',
      badge: 'Manager',
      selectableOnSignup: true,
      description: 'Coordinate logistics and manage assigned competition rounds.'
    },
    {
      key: 'admin',
      label: 'Admin',
      badge: 'Admin',
      selectableOnSignup: false,
      description: 'Server-assigned role only (never granted through signup).'
    },
    {
      key: 'super_admin',
      label: 'SuperAdmin',
      badge: 'SuperAdmin',
      selectableOnSignup: false,
      description: 'Server-assigned platform governance (never granted through signup).'
    }
  ];

  const SIGNUP_ROLES = ROLES.filter((r) => r.selectableOnSignup);

  let currentSession = null;
  let currentUser = null;
  let isRestoringState = true;
  let recoveryModeActive = false;
  let pendingAuthCallbackError = '';
  let initPromise = null;
  let authSubscription = null;

  // Clean up any legacy prototype web-storage artifacts from Phase 2 prototype
  try { sessionStorage.removeItem('eventora_auth_session_v1'); } catch (_) {}
  try { localStorage.removeItem('eventora_auth_session_v1'); } catch (_) {}
  try { localStorage.removeItem('eventora_auth_profiles_v1'); } catch (_) {}

  function getRoleMeta(roleKey) {
    return ROLES.find((r) => r.key === roleKey) || ROLES[0];
  }

  function normalizeRoleValue(raw) {
    const clean = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (clean === 'event_organizer' || clean === 'organizer') return 'organizer';
    if (clean === 'event_manager' || clean === 'manager') return 'manager';
    if (clean === 'super_admin' || clean === 'superadmin') return 'super_admin';
    if (clean === 'admin') return 'admin';
    if (clean === 'participant') return 'participant';
    return '';
  }

  function sanitizePreferredRole(roleKey) {
    const normalized = normalizeRoleValue(roleKey);
    return ALLOWED_SIGNUP_ROLE_KEYS.has(normalized) ? normalized : 'participant';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
  }

  function evaluatePasswordStrength(password) {
    const pw = String(password || '');
    if (!pw) {
      return {
        score: 0,
        label: 'Enter a password',
        tier: 'empty',
        checks: { length: false, upper: false, lower: false, numberOrSymbol: false }
      };
    }
    const checks = {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      numberOrSymbol: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)
    };
    let score = 0;
    if (checks.length) score += 1;
    if (checks.upper && checks.lower) score += 1;
    if (checks.numberOrSymbol) score += 1;
    if (pw.length >= 12 && checks.upper && checks.lower && checks.numberOrSymbol) score += 1;

    const map = [
      { label: 'Too short — use 8+ characters', tier: 'weak' },
      { label: 'Weak — add uppercase, numbers, or symbols', tier: 'weak' },
      { label: 'Fair — stronger with mixed characters', tier: 'fair' },
      { label: 'Good password', tier: 'good' },
      { label: 'Strong password', tier: 'strong' }
    ];
    const entry = map[Math.min(score, 4)];
    return { score, label: entry.label, tier: entry.tier, checks };
  }

  function getInitials(name) {
    const clean = String(name || '').trim();
    if (!clean) return 'EV';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function sanitizeAvatarUrl(rawUrl) {
    const candidate = String(rawUrl || '').trim();
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.href;
      }
    } catch (_) {}
    return '';
  }

  function getSafeRedirectTarget(rawTarget, fallback = 'profile.html') {
    const safeFallback = SAFE_PAGE_ALLOWLIST.has(fallback) ? fallback : 'profile.html';
    const raw = String(rawTarget || '').trim();
    if (!raw || raw.startsWith('//') || raw.includes('..') || raw.includes('\\')) {
      return safeFallback;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      return safeFallback;
    }
    const clean = raw.replace(/^\.\//, '');
    const match = clean.match(/^([a-z0-9-]+\.html)(\?[a-zA-Z0-9_=&%+.-]*)?(#[a-zA-Z0-9_-]*)?$/);
    if (!match || !SAFE_PAGE_ALLOWLIST.has(match[1])) {
      return safeFallback;
    }
    return clean;
  }

  function buildAppRedirectUrl(relativeTarget) {
    const safeRel = getSafeRedirectTarget(relativeTarget, 'profile.html');
    try {
      return new URL(safeRel, window.location.href).href;
    } catch (_) {
      return undefined;
    }
  }

  function mapSupabaseUser(sbUser) {
    if (!sbUser || typeof sbUser !== 'object' || !sbUser.id) return null;
    const meta = sbUser.user_metadata && typeof sbUser.user_metadata === 'object' ? sbUser.user_metadata : {};
    const appMeta = sbUser.app_metadata && typeof sbUser.app_metadata === 'object' ? sbUser.app_metadata : {};
    const email = String(sbUser.email || meta.email || '').trim().toLowerCase();
    const fallbackName = email
      ? email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Eventora User';
    const fullName = String(meta.full_name || meta.name || '').trim() || fallbackName;
    const rawUserPref = normalizeRoleValue(
      meta.role_preference || meta.preferred_role || meta.role || meta.account_role || meta.account_type
    );
    const rolePreference = ALLOWED_SIGNUP_ROLE_KEYS.has(rawUserPref) ? rawUserPref : 'participant';
    const hasExplicitSignupPref = ALLOWED_SIGNUP_ROLE_KEYS.has(rawUserPref);

    // Authoritative platform role comes ONLY from server-controlled app_metadata (never user_metadata)
    const rawServerCandidate = appMeta.platform_role
      || appMeta.role
      || appMeta.user_role
      || appMeta.eventora_role
      || (Array.isArray(appMeta.roles) && appMeta.roles[0])
      || '';
    const normalizedServer = normalizeRoleValue(rawServerCandidate);
    const hasServerVerifiedRole = VALID_VERIFIED_ROLES.has(normalizedServer);
    const verifiedRole = hasServerVerifiedRole ? normalizedServer : 'participant';
    const effectiveRole = hasServerVerifiedRole ? verifiedRole : rolePreference;
    const roleSource = hasServerVerifiedRole
      ? 'server_app_metadata'
      : (hasExplicitSignupPref ? 'supabase_signup_metadata' : 'default');
    const provider = String(appMeta.provider || 'email').trim();
    const providers = Array.isArray(appMeta.providers) ? appMeta.providers : [provider];

    return {
      id: String(sbUser.id),
      email,
      emailConfirmed: Boolean(sbUser.email_confirmed_at || sbUser.confirmed_at),
      emailConfirmedAt: sbUser.email_confirmed_at || null,
      provider,
      providers,
      fullName,
      avatarUrl: sanitizeAvatarUrl(meta.avatar_url || meta.picture),
      role: effectiveRole,
      verifiedRole,
      hasServerVerifiedRole,
      rolePreference,
      requestedRole: rolePreference,
      roleSource,
      institution: String(meta.institution || '').trim(),
      department: String(meta.department || '').trim(),
      city: String(meta.city || '').trim(),
      bio: String(meta.bio || '').trim(),
      createdAt: String(sbUser.created_at || ''),
      lastSignInAt: String(sbUser.last_sign_in_at || ''),
      updatedAt: String(sbUser.updated_at || '')
    };
  }

  function formatAuthError(error, context = '') {
    if (!error) return 'An unexpected authentication error occurred.';
    const rawMsg = String(error.message || error.error_description || error.msg || error || '').trim();
    const lower = rawMsg.toLowerCase();

    if (lower.includes('invalid login credentials')) {
      return 'Incorrect email or password. Please verify your credentials and try again.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Please verify your email address using the confirmation link in your inbox before logging in.';
    }
    if (lower.includes('user already registered') || lower.includes('already been registered')) {
      return 'An account with this email address already exists. Try logging in or resetting your password.';
    }
    if (lower.includes('missing oauth secret') || lower.includes('unsupported provider') || lower.includes('provider is not enabled') || lower.includes('validation_failed')) {
      return 'Google OAuth configuration is incomplete in Supabase: add your Google Client ID and Client Secret under Supabase Dashboard -> Authentication -> Providers -> Google (and allow your localhost Redirect URLs).';
    }
    if (lower.includes('redirect_to') || lower.includes('redirect url')) {
      return 'Redirect URL rejected by Supabase Auth. Add your local Eventora callback URLs under Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs.';
    }
    if (lower.includes('rate limit') || error.status === 429) {
      return 'Too many requests in a short window. Please wait a minute and try again.';
    }
    if (lower.includes('password') && lower.includes('different')) {
      return 'Your new password must be different from your current password.';
    }
    if (lower.includes('unable to exchange external code')) {
      return 'Google rejected the token exchange with Supabase (invalid/mismatched Google Client Secret, whitespace, or already-used callback code). Re-copy an active Client Secret (GOCSPX-...) from Google Cloud Console -> Eventora Web Client into Supabase Dashboard -> Authentication -> Providers -> Google -> Save, then retry Continue with Google.';
    }
    if (lower.includes('invalid flow state') || lower.includes('flow state')) {
      return 'OAuth sign-in session could not be exchanged (the link expired or originated in another tab/origin). Please try Continue with Google again.';
    }
    if (lower.includes('session missing') || lower.includes('invalid claim') || lower.includes('expired')) {
      if (context === 'recovery') {
        return 'This password recovery session has expired or is invalid. Request a new password reset link.';
      }
      return 'Your authentication session has expired or is missing. Please sign in again.';
    }
    if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
      return 'Unable to reach Supabase Auth. Verify your Project URL and internet connection.';
    }
    return rawMsg || 'Authentication request failed.';
  }

  function extractCallbackParams() {
    const search = new URLSearchParams(window.location.search || '');
    const hashRaw = (window.location.hash || '').replace(/^#/, '');
    const hash = new URLSearchParams(hashRaw.includes('=') ? hashRaw : '');

    const errorMsg = search.get('error_description') || hash.get('error_description') || search.get('error') || hash.get('error') || '';
    const type = search.get('type') || hash.get('type') || '';
    const tokenHash = search.get('token_hash') || '';
    const code = search.get('code') || '';

    return {
      errorMsg: errorMsg ? decodeURIComponent(errorMsg.replace(/\+/g, ' ')) : '',
      type,
      tokenHash,
      code
    };
  }

  function scrubAuthUrlNoise(keysToRemove) {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      keysToRemove.forEach((k) => {
        if (url.searchParams.has(k)) {
          url.searchParams.delete(k);
          changed = true;
        }
      });
      if (url.hash && /(access_token|refresh_token|error|type=recovery|type=signup)/.test(url.hash)) {
        url.hash = '';
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function notifyAuthChange(eventName) {
    if (window.EventoraUI && typeof window.EventoraUI.refreshAuthUI === 'function') {
      window.EventoraUI.refreshAuthUI();
    }
    window.dispatchEvent(new CustomEvent('eventora:authchange', {
      detail: {
        event: eventName || 'SYNC',
        user: currentUser,
        session: currentSession,
        configured: isConfigured(),
        recoveryMode: recoveryModeActive
      }
    }));
  }

  async function hydrateDatabaseProfile() {
    if (!currentUser || !currentUser.id || !window.EventoraProfilesApi || !window.EventoraSupabase || !window.EventoraSupabase.db) {
      return currentUser;
    }
    try {
      const dbStatus = await window.EventoraSupabase.db.probeDatabase();
      if (!dbStatus || !dbStatus.ready) return currentUser;
      const ensured = await window.EventoraProfilesApi.ensureProfile(currentUser);
      if (!ensured || !ensured.ok || !ensured.data) return currentUser;
      const dbProf = ensured.data;
      const validDbRole = VALID_VERIFIED_ROLES.has(dbProf.platformRole) ? dbProf.platformRole : '';
      const serverRole = currentUser.hasServerVerifiedRole
        ? currentUser.verifiedRole
        : (validDbRole || currentUser.role);
      const hasSrv = currentUser.hasServerVerifiedRole || (validDbRole === 'admin' || validDbRole === 'super_admin' || Boolean(validDbRole));

      currentUser = {
        ...currentUser,
        fullName: dbProf.fullName || currentUser.fullName,
        institution: dbProf.institution || currentUser.institution,
        department: dbProf.department || currentUser.department,
        city: dbProf.city || currentUser.city,
        bio: dbProf.bio || currentUser.bio,
        avatarUrl: dbProf.avatarUrl || currentUser.avatarUrl,
        role: serverRole,
        verifiedRole: serverRole,
        hasServerVerifiedRole: hasSrv,
        requestedRole: dbProf.requestedRole || currentUser.requestedRole,
        roleSource: currentUser.hasServerVerifiedRole ? currentUser.roleSource : 'postgresql_profiles',
        dbProfileSynced: true
      };
      notifyAuthChange('PROFILE_DB_SYNC');
    } catch (_) {}
    return currentUser;
  }

  function syncFromSession(session, eventName) {
    currentSession = session || null;
    currentUser = session && session.user ? mapSupabaseUser(session.user) : null;
    if (eventName === 'PASSWORD_RECOVERY') {
      recoveryModeActive = true;
    } else if (eventName === 'SIGNED_OUT') {
      recoveryModeActive = false;
    }
    notifyAuthChange(eventName || 'SESSION_SYNC');
    if (currentUser && eventName !== 'PROFILE_DB_SYNC') {
      hydrateDatabaseProfile();
    }
  }

  async function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      isRestoringState = true;
      const cb = extractCallbackParams();
      if (cb.errorMsg) {
        pendingAuthCallbackError = formatAuthError({ message: cb.errorMsg });
      }
      if (cb.type === 'recovery') {
        recoveryModeActive = true;
      }

      if (!window.EventoraSupabase || typeof window.EventoraSupabase.init !== 'function') {
        isRestoringState = false;
        syncFromSession(null, 'UNCONFIGURED');
        return getAuthState();
      }

      const { client, state } = await window.EventoraSupabase.init();
      if (!client || !state.configured) {
        isRestoringState = false;
        syncFromSession(null, 'UNCONFIGURED');
        return getAuthState();
      }

      // Subscribe cleanly to Supabase SDK auth transitions
      if (!authSubscription) {
        const subResult = client.auth.onAuthStateChange((event, session) => {
          syncFromSession(session, event);
        });
        authSubscription = subResult && subResult.data ? subResult.data.subscription : null;
      }

      // Handle explicit token_hash verification links if configured in Supabase email templates
      if (cb.tokenHash && cb.type) {
        const { error: otpErr } = await client.auth.verifyOtp({
          token_hash: cb.tokenHash,
          type: cb.type
        });
        if (otpErr) {
          pendingAuthCallbackError = formatAuthError(otpErr, cb.type === 'recovery' ? 'recovery' : '');
        } else if (cb.type === 'recovery') {
          recoveryModeActive = true;
        }
        scrubAuthUrlNoise(['token_hash', 'type']);
      }

      // Ensure Supabase finishes URL PKCE / hash detection and surface any exchange error
      if (typeof client.auth.initialize === 'function') {
        const initRes = await client.auth.initialize();
        if (initRes && initRes.error && !pendingAuthCallbackError) {
          pendingAuthCallbackError = formatAuthError(initRes.error);
        }
      }

      // Restore current Supabase session
      const { data, error } = await client.auth.getSession();
      if (error && !pendingAuthCallbackError) {
        pendingAuthCallbackError = formatAuthError(error);
      }

      if (cb.code && (!data || !data.session)) {
        if (!pendingAuthCallbackError) {
          pendingAuthCallbackError = 'OAuth sign-in returned an authorization code, but session exchange could not complete. Verify that Supabase URL Configuration allows http://localhost:8000/eventora/* and retry from the same browser origin.';
        }
        scrubAuthUrlNoise(['code']);
      }

      if (cb.errorMsg) {
        scrubAuthUrlNoise(['error', 'error_code', 'error_description']);
      }

      isRestoringState = false;
      syncFromSession(data ? data.session : null, 'INITIAL_SESSION');
      return getAuthState();
    })();

    return initPromise;
  }

  async function ensureConfiguredClient() {
    await init();
    const state = window.EventoraSupabase ? window.EventoraSupabase.getState() : { configured: false, errorMessage: 'Supabase client module missing.' };
    const client = window.EventoraSupabase ? window.EventoraSupabase.getClient() : null;
    if (!client || !state.configured) {
      return {
        ok: false,
        client: null,
        error: state.errorMessage || 'Supabase local credentials are not configured yet. Follow SUPABASE_AUTH_SETUP.md to create eventora/scripts/supabase-config.local.js.'
      };
    }
    return { ok: true, client, error: '' };
  }

  async function signUpWithEmail({ fullName, email, password, role }) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const cleanName = String(fullName || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const safeRoleIntent = sanitizePreferredRole(role);

    try {
      const { data, error } = await check.client.auth.signUp({
        email: cleanEmail,
        password: String(password || ''),
        options: {
          emailRedirectTo: buildAppRedirectUrl('login.html?verified=1'),
          data: {
            full_name: cleanName,
            role_preference: safeRoleIntent
          }
        }
      });

      if (error) {
        return { ok: false, error: formatAuthError(error) };
      }

      const createdUser = data ? data.user : null;
      const activeSession = data ? data.session : null;
      const identities = createdUser && Array.isArray(createdUser.identities) ? createdUser.identities : null;
      const duplicateUnconfirmed = Boolean(createdUser && identities && identities.length === 0 && !activeSession);

      if (activeSession) {
        syncFromSession(activeSession, 'SIGNED_IN');
      }

      return {
        ok: true,
        user: mapSupabaseUser(createdUser),
        session: activeSession,
        needsEmailVerification: Boolean(createdUser && !activeSession && !duplicateUnconfirmed),
        alreadyRegisteredNotice: duplicateUnconfirmed
      };
    } catch (err) {
      return { ok: false, error: formatAuthError(err) };
    }
  }

  async function resendSignupVerification(email) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return { ok: false, error: 'Enter a valid email address before requesting verification.' };
    }

    try {
      const { error } = await check.client.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: buildAppRedirectUrl('login.html?verified=1')
        }
      });
      if (error) {
        return { ok: false, error: formatAuthError(error) };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatAuthError(err) };
    }
  }

  async function signInWithPassword({ email, password }) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const cleanEmail = String(email || '').trim().toLowerCase();
    try {
      const { data, error } = await check.client.auth.signInWithPassword({
        email: cleanEmail,
        password: String(password || '')
      });
      if (error) {
        const lower = String(error.message || '').toLowerCase();
        return {
          ok: false,
          needsVerification: lower.includes('email not confirmed'),
          error: formatAuthError(error)
        };
      }
      syncFromSession(data ? data.session : null, 'SIGNED_IN');
      return {
        ok: true,
        user: currentUser,
        session: currentSession
      };
    } catch (err) {
      return { ok: false, error: formatAuthError(err) };
    }
  }

  async function signInWithGoogle(redirectTarget) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const safeTarget = getSafeRedirectTarget(redirectTarget, 'profile.html');
    const redirectTo = buildAppRedirectUrl(safeTarget);

    try {
      const { data, error } = await check.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo
        }
      });
      if (error) {
        return { ok: false, error: formatAuthError(error) };
      }
      return {
        ok: true,
        url: data && data.url ? data.url : ''
      };
    } catch (err) {
      return { ok: false, error: formatAuthError(err) };
    }
  }

  async function requestPasswordReset(email) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const cleanEmail = String(email || '').trim().toLowerCase();
    try {
      const { error } = await check.client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: buildAppRedirectUrl('forgot-password.html?mode=reset')
      });
      if (error) {
        return { ok: false, error: formatAuthError(error, 'recovery') };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatAuthError(err, 'recovery') };
    }
  }

  async function updatePassword(newPassword) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    const { data: sessionData } = await check.client.auth.getSession();
    if (!sessionData || !sessionData.session) {
      return {
        ok: false,
        error: 'No active recovery or authenticated session found. Open the reset link from your email again to set a new password.'
      };
    }

    try {
      const { data, error } = await check.client.auth.updateUser({
        password: String(newPassword || '')
      });
      if (error) {
        return { ok: false, error: formatAuthError(error, 'recovery') };
      }
      recoveryModeActive = false;
      if (data && data.user && currentSession) {
        syncFromSession({ ...currentSession, user: data.user }, 'USER_UPDATED');
      }
      if (window.EventoraProfilesApi && window.EventoraSupabase && window.EventoraSupabase.db && window.EventoraSupabase.db.getStatus().ready) {
        await window.EventoraProfilesApi.updateProfile(currentUser.id, {
          fullName: payloadData.full_name,
          institution: payloadData.institution,
          department: payloadData.department,
          city: payloadData.city,
          bio: payloadData.bio,
          avatarUrl: updates.avatarUrl
        });
      }
      return { ok: true, user: currentUser };
    } catch (err) {
      return { ok: false, error: formatAuthError(err, 'recovery') };
    }
  }

  async function updateProfile(updates) {
    const check = await ensureConfiguredClient();
    if (!check.ok) return { ok: false, error: check.error };

    if (!currentUser) {
      return { ok: false, error: 'You must be logged in to update your profile.' };
    }

    const fullName = String(updates.fullName != null ? updates.fullName : currentUser.fullName).trim();
    if (!fullName || fullName.length < 2) {
      return { ok: false, error: 'Full Name must be at least 2 characters.' };
    }

    // Profile editing updates personal info only and never alters account role or permissions
    const payloadData = {
      full_name: fullName,
      institution: String(updates.institution != null ? updates.institution : currentUser.institution).trim(),
      department: String(updates.department != null ? updates.department : currentUser.department).trim(),
      city: String(updates.city != null ? updates.city : currentUser.city).trim(),
      bio: String(updates.bio != null ? updates.bio : currentUser.bio).trim()
    };

    try {
      const { data, error } = await check.client.auth.updateUser({
        data: payloadData
      });
      if (error) {
        return { ok: false, error: formatAuthError(error) };
      }
      const { data: refreshed } = await check.client.auth.getSession();
      if (refreshed && refreshed.session) {
        syncFromSession(refreshed.session, 'USER_UPDATED');
      } else if (data && data.user && currentSession) {
        syncFromSession({ ...currentSession, user: data.user }, 'USER_UPDATED');
      }
      return { ok: true, user: currentUser };
    } catch (err) {
      return { ok: false, error: formatAuthError(err) };
    }
  }

  // Updates non-privileged onboarding workspace role (participant | organizer | manager) on authenticated user_metadata.
  // Never elevates admin/super_admin and never overrides server app_metadata roles.
  async function syncSignupRolePreference(preferredRole) {
    const check = await ensureConfiguredClient();
    if (!check.ok || !currentUser) return { ok: false, user: currentUser };
    if (currentUser.hasServerVerifiedRole) return { ok: true, user: currentUser };

    const safeRole = sanitizePreferredRole(preferredRole);
    try {
      const { data, error } = await check.client.auth.updateUser({
        data: { role_preference: safeRole }
      });
      if (error) {
        return { ok: false, error: formatAuthError(error), user: currentUser };
      }
      const { data: refreshed } = await check.client.auth.getSession();
      if (refreshed && refreshed.session) {
        syncFromSession(refreshed.session, 'USER_UPDATED');
      } else if (data && data.user && currentSession) {
        syncFromSession({ ...currentSession, user: data.user }, 'USER_UPDATED');
      }
      return { ok: true, user: currentUser };
    } catch (err) {
      return { ok: false, error: formatAuthError(err), user: currentUser };
    }
  }

  async function signOut() {
    recoveryModeActive = false;
    const client = window.EventoraSupabase ? window.EventoraSupabase.getClient() : null;
    if (client) {
      try {
        const { error } = await client.auth.signOut();
        if (error) {
          syncFromSession(null, 'SIGNED_OUT');
          return { ok: false, error: formatAuthError(error) };
        }
      } catch (err) {
        syncFromSession(null, 'SIGNED_OUT');
        return { ok: false, error: formatAuthError(err) };
      }
    }
    syncFromSession(null, 'SIGNED_OUT');
    return { ok: true };
  }

  function ready() {
    return init();
  }

  function isRestoring() {
    return isRestoringState;
  }

  function isConfigured() {
    return Boolean(window.EventoraSupabase && window.EventoraSupabase.getState().configured);
  }

  function getConfigStatus() {
    if (!window.EventoraSupabase) {
      return {
        initialized: true,
        sdkLoaded: false,
        configured: false,
        reason: 'missing_client_module',
        errorMessage: 'supabase-client.js is not loaded.'
      };
    }
    return window.EventoraSupabase.getState();
  }

  function getSession() {
    return currentUser;
  }

  function getAuthState() {
    return {
      restoring: isRestoringState,
      configured: isConfigured(),
      configStatus: getConfigStatus(),
      user: currentUser,
      session: currentSession,
      recoveryMode: recoveryModeActive,
      callbackError: pendingAuthCallbackError
    };
  }

  function consumeCallbackError() {
    const msg = pendingAuthCallbackError;
    pendingAuthCallbackError = '';
    return msg;
  }

  function isPasswordRecoveryActive() {
    return recoveryModeActive;
  }

  // Kick off session restoration immediately once DOM/scripts initialize
  init();

  return {
    ROLES,
    SIGNUP_ROLES,
    getRoleMeta,
    sanitizePreferredRole,
    isValidEmail,
    evaluatePasswordStrength,
    getInitials,
    getSafeRedirectTarget,
    buildAppRedirectUrl,
    ready,
    init,
    isRestoring,
    isConfigured,
    getConfigStatus,
    getSession,
    getAuthState,
    consumeCallbackError,
    isPasswordRecoveryActive,
    signUpWithEmail,
    resendSignupVerification,
    signInWithPassword,
    signInWithGoogle,
    requestPasswordReset,
    updatePassword,
    updateProfile,
    syncSignupRolePreference,
    signOut
  };
})();

/* ==========================================================================
   EVENTORA PHASE 10: REALTIME SYNCHRONIZATION COORDINATOR
   Manages scoped Supabase Realtime channels without duplicate listeners,
   cleans up on navigation, handles reconnects gracefully, and triggers
   authoritative RLS-backed data refreshes instead of trusting raw payloads.
   ========================================================================== */

window.EventoraRealtime = (function () {
  const activeChannels = new Map();
  let connectionStatus = 'idle'; // idle | connecting | live | disconnected | error
  let debounceTimers = new Map();
  let unloadHooked = false;
  let lastNoticeAt = 0;

  function notifyImportantChange(msg) {
    if (!msg) return;
    const now = Date.now();
    if (now - lastNoticeAt < 3500) return;
    lastNoticeAt = now;
    if (window.EventoraUI && typeof window.EventoraUI.showToast === 'function') {
      window.EventoraUI.showToast(msg);
    }
  }

  function emitStatus(status, detail) {
    connectionStatus = status;
    try {
      if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('eventora:realtimestatus', {
          detail: { status, detail: detail || '', activeCount: activeChannels.size }
        }));
      }
    } catch (_) {}
  }

  function ensureUnloadCleanup() {
    if (unloadHooked || typeof window === 'undefined' || !window.addEventListener) return;
    unloadHooked = true;
    window.addEventListener('beforeunload', () => {
      unsubscribeAll();
    });
  }

  function scheduleRefresh(key, callback) {
    if (typeof callback !== 'function') return;
    if (debounceTimers.has(key)) {
      window.clearTimeout(debounceTimers.get(key));
    }
    const tid = window.setTimeout(() => {
      debounceTimers.delete(key);
      try {
        callback();
      } catch (_) {}
    }, 180);
    debounceTimers.set(key, tid);
  }

  async function unsubscribeScope(scopeKey) {
    const entry = activeChannels.get(scopeKey);
    if (!entry) return;
    activeChannels.delete(scopeKey);
    if (debounceTimers.has(scopeKey)) {
      window.clearTimeout(debounceTimers.get(scopeKey));
      debounceTimers.delete(scopeKey);
    }
    const client = window.EventoraSupabase && window.EventoraSupabase.getClient
      ? window.EventoraSupabase.getClient()
      : null;
    if (client && typeof client.removeChannel === 'function' && entry.channel) {
      try { await client.removeChannel(entry.channel); } catch (_) {}
    } else if (entry.channel && typeof entry.channel.unsubscribe === 'function') {
      try { await entry.channel.unsubscribe(); } catch (_) {}
    }
    if (activeChannels.size === 0) emitStatus('idle');
  }

  async function unsubscribeAll() {
    const keys = Array.from(activeChannels.keys());
    for (const k of keys) {
      await unsubscribeScope(k);
    }
  }

  /**
   * Subscribe to scoped PostgreSQL changes for an event, organizer dashboard, or participant hub.
   * @param {Object} cfg
   * @param {string} cfg.scopeKey Unique channel identifier to prevent duplicate subscriptions
   * @param {Array<{table:string, filter?:string, event?:string}>} cfg.subscriptions
   * @param {Function} cfg.onChange Debounced callback executed to reload authoritative DB state
   */
  async function subscribe(cfg) {
    const scopeKey = String((cfg && cfg.scopeKey) || '').trim();
    const subs = Array.isArray(cfg && cfg.subscriptions) ? cfg.subscriptions : [];
    const onChange = cfg && typeof cfg.onChange === 'function' ? cfg.onChange : null;
    if (!scopeKey || !subs.length || !onChange) return { ok: false, reason: 'invalid_subscription' };

    ensureUnloadCleanup();
    if (!window.EventoraSupabase || typeof window.EventoraSupabase.init !== 'function') {
      return { ok: false, reason: 'supabase_client_missing' };
    }
    const { client, state } = await window.EventoraSupabase.init();
    if (!client || !state.configured || typeof client.channel !== 'function') {
      emitStatus('idle', 'Supabase client not configured');
      return { ok: false, reason: 'not_configured' };
    }

    const dbStat = window.EventoraSupabase.db && window.EventoraSupabase.db.getStatus
      ? window.EventoraSupabase.db.getStatus()
      : null;
    if (dbStat && dbStat.probed && !dbStat.ready) {
      emitStatus('disconnected', dbStat.errorMessage || 'Database not ready');
      return { ok: false, reason: dbStat.status || 'db_not_ready' };
    }

    // Prevent duplicate subscription on identical scope key + subscription signature
    const sig = JSON.stringify(subs.map((s) => `${s.table}:${s.filter || '*'}:${s.event || '*'}`));
    const existing = activeChannels.get(scopeKey);
    if (existing && existing.sig === sig) {
      existing.onChange = onChange;
      return { ok: true, scopeKey, reused: true };
    }
    if (existing) {
      await unsubscribeScope(scopeKey);
    }

    emitStatus('connecting', scopeKey);
    const channel = client.channel(`eventora:${scopeKey}`);

    subs.forEach((s) => {
      if (!s || !s.table) return;
      const filterOpts = {
        event: s.event || '*',
        schema: 'public',
        table: s.table
      };
      if (s.filter) filterOpts.filter = s.filter;
      channel.on('postgres_changes', filterOpts, (payload) => {
        const entry = activeChannels.get(scopeKey);
        const cb = entry && typeof entry.onChange === 'function' ? entry.onChange : onChange;
        scheduleRefresh(scopeKey, () => cb(payload));
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        emitStatus('live', scopeKey);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        emitStatus('error', `Realtime ${status} on ${scopeKey}`);
      } else if (status === 'CLOSED') {
        emitStatus('disconnected', `Channel closed: ${scopeKey}`);
      }
    });

    activeChannels.set(scopeKey, { channel, scopeKey, subscriptions: subs, sig, onChange });
    return { ok: true, scopeKey };
  }

  function subscribePublicCatalog({ scopeKey, onChange }) {
    return subscribe({
      scopeKey: scopeKey || 'public-catalog',
      subscriptions: [
        { table: 'events' },
        { table: 'event_rounds' }
      ],
      onChange
    });
  }

  function subscribeOrganizerDashboard({ scopeKey, userId, onChange }) {
    const subs = [
      { table: 'events' },
      { table: 'event_rounds' },
      { table: 'registrations' },
      { table: 'teams' },
      { table: 'event_collaborators' },
      { table: 'round_submissions' },
      { table: 'evaluations' }
    ];
    if (userId) {
      subs[4] = { table: 'event_collaborators' };
    }
    return subscribe({
      scopeKey: scopeKey || `org-dash-${userId || 'anon'}`,
      subscriptions: subs,
      onChange
    });
  }

  function subscribeParticipantDashboard({ scopeKey, userId, onChange }) {
    if (!userId) return Promise.resolve({ ok: false, reason: 'auth_required' });
    const subs = [
      { table: 'registrations', filter: `user_id=eq.${userId}` },
      { table: 'team_members' },
      { table: 'teams' },
      { table: 'event_rounds' },
      { table: 'round_contents' },
      { table: 'event_announcements' },
      { table: 'round_qualification_results' },
      { table: 'events' }
    ];
    return subscribe({
      scopeKey: scopeKey || `part-dash-${userId}`,
      subscriptions: subs,
      onChange
    });
  }

  function subscribeEventWorkspace({ scopeKey, eventId, includeOrganizerTables, onChange }) {
    if (!eventId || !window.EventoraSupabase || !window.EventoraSupabase.db || !window.EventoraSupabase.db.isUuid(eventId)) {
      return Promise.resolve({ ok: false, reason: 'non_uuid_or_local_event' });
    }
    const subs = [
      { table: 'events', filter: `id=eq.${eventId}` },
      { table: 'event_rounds', filter: `event_id=eq.${eventId}` },
      { table: 'round_contents', filter: `event_id=eq.${eventId}` },
      { table: 'teams', filter: `event_id=eq.${eventId}` },
      { table: 'team_members', filter: `event_id=eq.${eventId}` },
      { table: 'round_qualification_results', filter: `event_id=eq.${eventId}` },
      { table: 'event_announcements', filter: `event_id=eq.${eventId}` }
    ];
    if (includeOrganizerTables) {
      subs.push(
        { table: 'registrations', filter: `event_id=eq.${eventId}` },
        { table: 'round_submissions', filter: `event_id=eq.${eventId}` },
        { table: 'evaluations', filter: `event_id=eq.${eventId}` },
        { table: 'event_collaborators', filter: `event_id=eq.${eventId}` },
        { table: 'event_activity_logs', filter: `event_id=eq.${eventId}` }
      );
    } else {
      subs.push(
        { table: 'registrations', filter: `event_id=eq.${eventId}` },
        { table: 'round_submissions', filter: `event_id=eq.${eventId}` }
      );
    }
    return subscribe({ scopeKey: scopeKey || `ev-${eventId}`, subscriptions: subs, onChange });
  }

  function getStatus() {
    return {
      status: connectionStatus,
      activeScopes: Array.from(activeChannels.keys())
    };
  }

  return {
    subscribe,
    subscribePublicCatalog,
    subscribeOrganizerDashboard,
    subscribeParticipantDashboard,
    subscribeEventWorkspace,
    unsubscribeScope,
    unsubscribeAll,
    notifyImportantChange,
    getStatus
  };
})();

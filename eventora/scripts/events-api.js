/* ==========================================================================
   EVENTORA PHASE 10: EVENTS & ACTIVITY LOGS API MODULE
   ========================================================================== */

window.EventoraEventsApi = (function () {
  function runDb(fn, msg) {
    if (!window.EventoraSupabase || !window.EventoraSupabase.db) {
      return Promise.resolve({ ok: false, error: 'Supabase client module is unavailable.', data: null });
    }
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  function mapUiStatusToDb(statusKey) {
    const s = String(statusKey || 'published').toLowerCase().trim();
    if (s === 'ongoing') return 'live';
    if (['draft', 'published', 'upcoming', 'live', 'paused', 'completed', 'cancelled', 'archived'].includes(s)) return s;
    return 'published';
  }

  function mapDbStatusToUi(dbStatus) {
    const s = String(dbStatus || 'published').toLowerCase().trim();
    if (s === 'live') return 'ongoing';
    return s;
  }

  function mapUiRegStatusToDb(regStatus) {
    const s = String(regStatus || 'open').toLowerCase().trim();
    if (s === 'registration open') return 'open';
    if (s === 'opens soon' || s === 'not open yet') return 'not_open_yet';
    if (s === 'waitlist open') return 'waitlist';
    if (['open', 'not_open_yet', 'closed', 'waitlist', 'paused', 'full'].includes(s)) return s;
    return 'open';
  }

  function mapEventPayloadToRow(ev, organizerId) {
    const coverImg = String(ev.coverImage || '');
    const safeCover = coverImg.startsWith('data:') && coverImg.length > 180000 ? '' : (ev.posterPath ? '' : coverImg);
    const settings = {
      ...(ev.settings || {}),
      categoryLabel: ev.categoryLabel || '',
      tagline: ev.tagline || ev.shortDescription || '',
      dateLabel: ev.dateLabel || '',
      dateWindow: ev.dateWindow || 'this-month',
      mode: ev.mode || 'In-Person',
      organizerName: ev.organizer || '',
      institutionShort: ev.institutionShort || '',
      maxCapacity: (ev.registrationConfig && ev.registrationConfig.maxRegistrations) || ev.maxCapacity || ev.capacity || 250,
      teamConfig: ev.teamConfig || { supported: false, minSize: 1, maxSize: 1, label: 'Individual' },
      registrationConfig: ev.registrationConfig || {},
      evaluationState: ev.evaluationState || null,
      highlights: ev.highlights || [],
      schedule: ev.schedule || [],
      rules: ev.rules || [],
      faqs: ev.faqs || [],
      organizers: ev.organizers || [],
      organizerContacts: ev.organizerContacts || [],
      image: ev.image || (!coverImg.startsWith('data:') && !ev.posterPath ? coverImg : ''),
      posterDataUrl: ev.posterPath ? '' : (ev.posterDataUrl || safeCover || ''),
      posterPath: ev.posterPath || '',
      coverPath: ev.coverPath || ev.posterPath || '',
      legacySlug: ev.slug
    };

    const partMode = ev.teamConfig && ev.teamConfig.supported
      ? (Number(ev.teamConfig.minSize) > 1 ? 'team' : 'individual_or_team')
      : 'individual';

    return {
      slug: ev.slug,
      title: ev.name || ev.title || 'Untitled Event',
      description: ev.description || '',
      short_description: ev.tagline || ev.shortDescription || '',
      event_type: ev.eventType || ev.category || 'technical',
      category: ev.category || 'technical',
      institution: ev.institution || '',
      venue: ev.location || ev.venue || '',
      city: ev.city || '',
      event_date: ev.dateLabel || '',
      start_date: ev.startTimeISO || ev.startDate || null,
      end_date: ev.endTimeISO || ev.endDate || null,
      registration_start: ev.registrationConfig && ev.registrationConfig.registrationOpensAt ? ev.registrationConfig.registrationOpensAt : (ev.registrationConfig && ev.registrationConfig.openAt ? ev.registrationConfig.openAt : null),
      registration_end: ev.registrationConfig && ev.registrationConfig.registrationClosesAt ? ev.registrationConfig.registrationClosesAt : (ev.registrationConfig && ev.registrationConfig.closeAt ? ev.registrationConfig.closeAt : null),
      poster_url: ev.posterPath || ev.image || '',
      cover_url: ev.coverPath || ev.posterPath || ev.image || '',
      organizer_id: organizerId,
      participation_mode: partMode,
      event_status: mapUiStatusToDb(ev.statusKey || ev.eventStatus),
      registration_status: mapUiRegStatusToDb(ev.registrationStatusKey || (ev.registrationConfig && ev.registrationConfig.registrationStatus) || ev.registrationStatus),
      visibility: ev.visibility || 'public',
      settings,
      live_ops: ev.liveOps || {}
    };
  }

  function mapRowToEventShell(row) {
    if (!row) return null;
    const s = row.settings && typeof row.settings === 'object' ? row.settings : {};
    const statusMap = {
      draft: { label: 'Draft', cls: 'ev-badge-sample' },
      published: { label: 'Published', cls: 'ev-badge-open' },
      upcoming: { label: 'Upcoming', cls: 'ev-badge-open' },
      live: { label: 'Ongoing', cls: 'ev-badge-filling' },
      paused: { label: 'Paused', cls: 'ev-badge-filling' },
      completed: { label: 'Completed', cls: 'ev-badge-closed' },
      cancelled: { label: 'Cancelled', cls: 'ev-badge-closed' },
      archived: { label: 'Archived', cls: 'ev-badge-sample' }
    };
    const st = statusMap[row.event_status] || { label: 'Published', cls: 'ev-badge-open' };
    const regLabelMap = {
      open: { label: 'Open', cls: 'ev-badge-open' },
      not_open_yet: { label: 'Opens Soon', cls: 'ev-badge-sample' },
      waitlist: { label: 'Waitlist Open', cls: 'ev-badge-filling' },
      closed: { label: 'Closed', cls: 'ev-badge-closed' },
      paused: { label: 'Paused', cls: 'ev-badge-filling' },
      full: { label: 'Full', cls: 'ev-badge-closed' }
    };
    const rg = regLabelMap[row.registration_status] || regLabelMap.open;
    const posterPath = s.posterPath || (row.poster_url && !/^assets\/|^https?:|^data:/i.test(row.poster_url) ? row.poster_url : '');
    const coverPath = s.coverPath || (row.cover_url && !/^assets\/|^https?:|^data:/i.test(row.cover_url) ? row.cover_url : '') || posterPath;
    const inlineImg = s.image || (/^assets\//i.test(row.poster_url || '') ? row.poster_url : '') || s.posterDataUrl || '';

    return {
      dbId: row.id,
      slug: row.slug,
      name: row.title,
      tagline: row.short_description || s.tagline || '',
      description: row.description || '',
      category: row.category || 'technical',
      categoryLabel: s.categoryLabel || row.category || 'Technical',
      organizer: s.organizerName || 'Eventora Organizer',
      organizerId: row.organizer_id,
      institution: row.institution || '',
      institutionShort: s.institutionShort || row.institution || '',
      city: row.city || '',
      location: row.venue || row.city || '',
      mode: s.mode || 'In-Person',
      dateLabel: row.event_date || s.dateLabel || '',
      dateWindow: s.dateWindow || 'this-month',
      startTimeISO: row.start_date || '',
      endTimeISO: row.end_date || '',
      statusKey: mapDbStatusToUi(row.event_status),
      eventStatus: st.label,
      statusBadgeClass: st.cls,
      registrationStatusKey: row.registration_status || 'open',
      registrationStatus: rg.label,
      registrationBadgeClass: rg.cls,
      visibility: row.visibility || 'public',
      maxCapacity: Number(s.maxCapacity) || 250,
      capacity: Number(s.maxCapacity) || 250,
      image: s.image || '',
      posterPath,
      coverPath,
      posterDataUrl: s.posterDataUrl || '',
      coverImage: inlineImg,
      teamConfig: s.teamConfig || { supported: row.participation_mode !== 'individual', minSize: 1, maxSize: 4, label: 'Individual or Team' },
      registrationConfig: s.registrationConfig || {},
      evaluationState: s.evaluationState || null,
      highlights: Array.isArray(s.highlights) ? s.highlights : [],
      schedule: Array.isArray(s.schedule) ? s.schedule : [],
      rules: Array.isArray(s.rules) ? s.rules : [],
      faqs: Array.isArray(s.faqs) ? s.faqs : [],
      organizers: Array.isArray(s.organizers) ? s.organizers : [],
      organizerContacts: Array.isArray(s.organizerContacts) ? s.organizerContacts : [],
      liveOps: row.live_ops || {},
      isCreatedEvent: true,
      _source: 'supabase',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async function fetchPublicEvents(filters) {
    const f = filters || {};
    return runDb(async (sb) => {
      let query = sb
        .from('events')
        .select('*')
        .eq('visibility', 'public')
        .not('event_status', 'in', '("draft","archived")')
        .order('created_at', { ascending: false });

      if (f.category && f.category !== 'all') {
        query = query.eq('category', f.category);
      }
      if (f.search) {
        const term = String(f.search).trim().replace(/[%_,]/g, '');
        if (term) query = query.or(`title.ilike.%${term}%,institution.ilike.%${term}%,city.ilike.%${term}%`);
      }
      const res = await query;
      if (res.error) return res;
      return { data: (res.data || []).map(mapRowToEventShell), error: null };
    }, 'Failed to load public events.');
  }

  async function fetchOrganizerEvents(userId) {
    return runDb(async (sb) => {
      let uid = userId;
      if (!uid) {
        const authRes = await sb.auth.getUser();
        uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      }
      if (!uid) return { data: [], error: { message: 'Authentication required to load organizer events.' } };

      const res = await sb
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      if (res.error) return res;

      const collabRes = await sb
        .from('event_collaborators')
        .select('event_id, collaborator_role, permissions, invitation_status')
        .eq('user_id', uid)
        .eq('invitation_status', 'accepted');
      const collabSet = new Set((collabRes.data || []).map((c) => c.event_id));

      const ownedOrAssigned = (res.data || [])
        .filter((row) => row.organizer_id === uid || collabSet.has(row.id))
        .map(mapRowToEventShell);
      return { data: ownedOrAssigned, error: null };
    }, 'Failed to fetch organizer events.');
  }

  async function fetchEventBySlug(slug) {
    const clean = String(slug || '').trim();
    if (!clean) return { ok: false, error: 'Missing event slug.', data: null };
    return runDb(async (sb) => {
      const res = await sb.from('events').select('*').eq('slug', clean).maybeSingle();
      if (res.error) return res;
      return { data: mapRowToEventShell(res.data), error: null };
    }, 'Failed to load event details.');
  }

  async function createEvent(evPayload) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      if (!uid) return { data: null, error: { message: 'Sign in as an organizer to create an event.' } };
      const row = mapEventPayloadToRow(evPayload, uid);
      const res = await sb.from('events').insert(row).select('*').single();
      if (res.error) return res;
      const mapped = mapRowToEventShell(res.data);
      await logActivity(mapped.dbId, 'event_created', 'event', mapped.dbId, { slug: mapped.slug, title: mapped.name });
      return { data: mapped, error: null };
    }, 'Failed to create event in PostgreSQL.');
  }

  async function updateEvent(eventIdOrSlug, patchEvent) {
    return runDb(async (sb) => {
      const isUuid = window.EventoraSupabase.db.isUuid(eventIdOrSlug);
      const col = isUuid ? 'id' : 'slug';
      const existing = await sb.from('events').select('*').eq(col, eventIdOrSlug).single();
      if (existing.error) return existing;

      const mergedRow = mapEventPayloadToRow(patchEvent, existing.data.organizer_id);
      delete mergedRow.organizer_id; // Never mutate ownership via standard edit
      delete mergedRow.slug;

      const upd = await sb.from('events').update(mergedRow).eq('id', existing.data.id).select('*').single();
      if (upd.error) return upd;
      return { data: mapRowToEventShell(upd.data), error: null };
    }, 'Failed to update event in PostgreSQL.');
  }

  async function updateEventStatus(eventId, nextEventStatus, nextRegStatus) {
    return runDb(async (sb) => {
      const patch = {};
      if (nextEventStatus) patch.event_status = nextEventStatus;
      if (nextRegStatus) patch.registration_status = nextRegStatus;
      const res = await sb.from('events').update(patch).eq('id', eventId).select('*').single();
      if (res.error) return res;
      await logActivity(eventId, 'event_status_updated', 'event', eventId, patch);
      return { data: mapRowToEventShell(res.data), error: null };
    }, 'Failed to update event status.');
  }

  async function deleteEvent(eventId) {
    return runDb(async (sb) => {
      const res = await sb.from('events').delete().eq('id', eventId);
      return res;
    }, 'Failed to delete event.');
  }

  async function logActivity(eventId, action, entityType, entityId, metadata) {
    if (!eventId || !window.EventoraSupabase || !window.EventoraSupabase.db || !window.EventoraSupabase.db.isUuid(eventId)) {
      return { ok: false, data: null };
    }
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null;
      if (!uid) return { data: null, error: null };
      return sb.from('event_activity_logs').insert({
        event_id: eventId,
        actor_id: uid,
        action: String(action || 'updated'),
        entity_type: String(entityType || 'event'),
        entity_id: String(entityId || ''),
        metadata: metadata && typeof metadata === 'object' ? metadata : {}
      });
    }, 'Failed to record activity log.');
  }

  async function fetchActivityLogs(eventId, limit = 40) {
    return runDb(async (sb) => {
      return sb
        .from('event_activity_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(limit);
    }, 'Failed to load activity logs.');
  }

  return {
    mapEventPayloadToRow,
    mapRowToEventShell,
    fetchPublicEvents,
    fetchOrganizerEvents,
    fetchEventBySlug,
    createEvent,
    updateEvent,
    updateEventStatus,
    deleteEvent,
    logActivity,
    fetchActivityLogs
  };
})();

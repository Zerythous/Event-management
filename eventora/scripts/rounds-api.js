/* ==========================================================================
   EVENTORA PHASE 10: EVENT ROUNDS API MODULE
   ========================================================================== */

window.EventoraRoundsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  function mapRoundStatusToDb(status) {
    const clean = String(status || 'Upcoming').trim();
    if (clean === 'Scheduled' || clean === 'Draft') return 'Upcoming';
    if (clean === 'Cancelled') return 'Skipped';
    if (['Upcoming', 'Live', 'Paused', 'Completed', 'Skipped', 'Disabled'].includes(clean)) return clean;
    return 'Upcoming';
  }

  function mapRoundToRow(eventId, r, idx) {
    return {
      id: r.dbId && window.EventoraSupabase.db.isUuid(r.dbId) ? r.dbId : undefined,
      event_id: eventId,
      client_round_key: r.id || `rnd_${idx + 1}`,
      round_number: Number(r.order) || idx + 1,
      title: String(r.name || r.title || `Round ${idx + 1}`).trim(),
      description: String(r.description || '').trim(),
      round_type: String(r.typeKey || r.type || 'custom').trim(),
      duration: String(r.duration || '60 Mins').trim(),
      venue: String(r.venue || r.venueOrOnline || '').trim(),
      scheduled_at: r.startDateTime || null,
      max_marks: Math.max(1, Number((r.scoring && r.scoring.maxScore) || r.maxScore || r.maxMarks) || 100),
      qualification_config: r.qualification || r.qualificationConfig || { mode: r.advancementRule || 'manual' },
      settings: {
        instructions: r.instructions || '',
        eligibility: r.eligibility || '',
        formatMode: r.formatMode || 'Online',
        venueOrOnline: r.venueOrOnline || r.venue || '',
        maxParticipants: r.maxParticipants || null,
        typeLabel: r.typeLabel || r.type || 'Custom',
        typeConfig: r.typeConfig || {},
        scoring: r.scoring || { enabled: true, maxScore: Number(r.maxScore) || 100, pointsLabel: 'pts' },
        teamParticipation: r.teamParticipation !== false,
        scoringMethod: r.scoringMethod || 'points',
        submissionRequired: Boolean(r.submissionRequired),
        submissionLabel: r.submissionLabel || '',
        startTime: r.startTime || '',
        endDateTime: r.endDateTime || '',
        config: r.config || {},
        enabled: r.enabled !== false
      },
      round_status: mapRoundStatusToDb(r.status),
      timer_state: r.timerState || {}
    };
  }

  function mapRowToRound(row) {
    const s = row.settings && typeof row.settings === 'object' ? row.settings : {};
    return {
      dbId: row.id,
      id: row.client_round_key || row.id,
      order: row.round_number,
      name: row.title,
      description: row.description || '',
      typeKey: row.round_type || 'custom',
      type: s.typeLabel || row.round_type || 'Custom',
      typeLabel: s.typeLabel || row.round_type || 'Custom',
      typeConfig: s.typeConfig || {},
      scoring: s.scoring || { enabled: true, maxScore: Number(row.max_marks) || 100, pointsLabel: 'pts' },
      duration: row.duration || '60 Mins',
      venue: row.venue || '',
      venueOrOnline: s.venueOrOnline || row.venue || '',
      maxParticipants: s.maxParticipants || null,
      startTime: s.startTime || '',
      startDateTime: row.scheduled_at || '',
      endDateTime: s.endDateTime || '',
      maxScore: Number(row.max_marks) || 100,
      advancementRule: (row.qualification_config && row.qualification_config.mode) || 'manual',
      qualification: row.qualification_config || {},
      qualificationConfig: row.qualification_config || {},
      instructions: s.instructions || '',
      eligibility: s.eligibility || '',
      formatMode: s.formatMode || 'Online',
      teamParticipation: s.teamParticipation !== false,
      scoringMethod: s.scoringMethod || 'points',
      submissionRequired: Boolean(s.submissionRequired),
      submissionLabel: s.submissionLabel || '',
      config: s.config || {},
      enabled: s.enabled !== false,
      status: row.round_status || 'Upcoming',
      timerState: row.timer_state || {}
    };
  }

  async function fetchEventRounds(eventId) {
    return runDb(async (sb) => {
      const res = await sb
        .from('event_rounds')
        .select('*')
        .eq('event_id', eventId)
        .order('round_number', { ascending: true });
      if (res.error) return res;
      return { data: (res.data || []).map(mapRowToRound), error: null };
    }, 'Failed to fetch event rounds.');
  }

  async function createRound(eventId, roundObj) {
    return runDb(async (sb) => {
      const row = mapRoundToRow(eventId, roundObj, (Number(roundObj.order) || 1) - 1);
      delete row.id;
      const res = await sb.from('event_rounds').insert(row).select('*').single();
      if (res.error) return res;
      return { data: mapRowToRound(res.data), error: null };
    }, 'Failed to create round.');
  }

  async function updateRound(roundDbId, eventId, roundObj) {
    return runDb(async (sb) => {
      const row = mapRoundToRow(eventId, roundObj, (Number(roundObj.order) || 1) - 1);
      delete row.id;
      const res = await sb.from('event_rounds').update(row).eq('id', roundDbId).select('*').single();
      if (res.error) return res;
      return { data: mapRowToRound(res.data), error: null };
    }, 'Failed to update round.');
  }

  async function deleteRound(roundDbId) {
    return runDb(async (sb) => sb.from('event_rounds').delete().eq('id', roundDbId), 'Failed to delete round.');
  }

  async function syncEventRoundsList(eventId, roundsList) {
    return runDb(async (sb) => {
      const existingRes = await sb.from('event_rounds').select('id, client_round_key').eq('event_id', eventId);
      if (existingRes.error) return existingRes;
      const existingByKey = new Map((existingRes.data || []).map((x) => [x.client_round_key, x.id]));
      const keepIds = new Set();

      // Clear temporary round_number collisions during reordering by shifting old numbers high first
      if ((existingRes.data || []).length > 0) {
        for (let i = 0; i < existingRes.data.length; i++) {
          await sb.from('event_rounds').update({ round_number: 1000 + i }).eq('id', existingRes.data[i].id);
        }
      }

      const saved = [];
      for (let i = 0; i < (roundsList || []).length; i++) {
        const r = roundsList[i];
        const row = mapRoundToRow(eventId, { ...r, order: i + 1 }, i);
        const matchId = (r.dbId && window.EventoraSupabase.db.isUuid(r.dbId)) ? r.dbId : existingByKey.get(row.client_round_key);
        delete row.id;
        if (matchId) {
          const upd = await sb.from('event_rounds').update(row).eq('id', matchId).select('*').single();
          if (upd.error) return upd;
          keepIds.add(upd.data.id);
          saved.push(mapRowToRound(upd.data));
        } else {
          const ins = await sb.from('event_rounds').insert(row).select('*').single();
          if (ins.error) return ins;
          keepIds.add(ins.data.id);
          saved.push(mapRowToRound(ins.data));
        }
      }

      for (const oldRow of (existingRes.data || [])) {
        if (!keepIds.has(oldRow.id)) {
          await sb.from('event_rounds').delete().eq('id', oldRow.id);
        }
      }
      return { data: saved, error: null };
    }, 'Failed to synchronize event rounds.');
  }

  async function updateRoundStatus(roundDbId, roundStatus, timerState) {
    return runDb(async (sb) => {
      const patch = { round_status: mapRoundStatusToDb(roundStatus) };
      if (timerState !== undefined) patch.timer_state = timerState;
      const res = await sb.from('event_rounds').update(patch).eq('id', roundDbId).select('*').single();
      if (res.error) return res;
      return { data: mapRowToRound(res.data), error: null };
    }, 'Failed to update round status.');
  }

  return {
    mapRoundToRow,
    mapRowToRound,
    fetchEventRounds,
    createRound,
    updateRound,
    deleteRound,
    syncEventRoundsList,
    updateRoundStatus
  };
})();

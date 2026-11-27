/* ==========================================================================
   EVENTORA PHASE 10: QUALIFICATION RESULTS API MODULE
   ========================================================================== */

window.EventoraQualificationApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchQualificationResults(eventId, roundDbId) {
    return runDb(async (sb) => {
      let query = sb.from('round_qualification_results').select('*').eq('event_id', eventId);
      if (roundDbId) query = query.eq('round_id', roundDbId);
      return query.order('rank', { ascending: true });
    }, 'Failed to load qualification results.');
  }

  async function saveQualificationBatch(eventId, roundDbId, entries, isPublished = false) {
    return runDb(async (sb) => {
      if (!Array.isArray(entries) || !entries.length) return { data: [], error: null };
      const saved = [];
      for (const item of entries) {
        let qFind = sb.from('round_qualification_results').select('id').eq('round_id', roundDbId);
        qFind = item.teamId ? qFind.eq('team_id', item.teamId) : qFind.eq('participant_id', item.participantId).is('team_id', null);
        const exRes = await qFind.maybeSingle();

        const row = {
          event_id: eventId,
          round_id: roundDbId,
          participant_id: item.teamId ? null : item.participantId,
          team_id: item.teamId || null,
          score: Number(item.score) || 0,
          rank: item.rank != null ? Number(item.rank) : null,
          qualification_status: item.qualificationStatus || 'Pending',
          qualification_reason: String(item.qualificationReason || ''),
          is_published: Boolean(isPublished),
          finalized_at: item.finalizedAt || null
        };
        const res = exRes.data && exRes.data.id
          ? await sb.from('round_qualification_results').update(row).eq('id', exRes.data.id).select('*').single()
          : await sb.from('round_qualification_results').insert(row).select('*').single();
        if (res.error) return res;
        saved.push(res.data);
      }
      return { data: saved, error: null };
    }, 'Failed to save qualification results.');
  }

  async function finalizeQualification(eventId, roundDbId, isPublished = true) {
    return runDb(async (sb) => {
      const nowIso = new Date().toISOString();
      const res = await sb
        .from('round_qualification_results')
        .update({ finalized_at: nowIso, is_published: Boolean(isPublished) })
        .eq('event_id', eventId)
        .eq('round_id', roundDbId)
        .select('*');
      if (!res.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'qualification_finalized', 'round', roundDbId, { published: Boolean(isPublished) });
      }
      return res;
    }, 'Failed to finalize qualification results.');
  }

  return {
    fetchQualificationResults,
    saveQualificationBatch,
    finalizeQualification
  };
})();

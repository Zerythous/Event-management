/* ==========================================================================
   EVENTORA PHASE 10: ROUND SUBMISSIONS API MODULE
   Handles participant & team coding, MCQ, frontend, and file submissions.
   ========================================================================== */

window.EventoraSubmissionsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchRoundSubmissions(eventId, roundDbId) {
    return runDb(async (sb) => {
      let query = sb.from('round_submissions').select('*').eq('event_id', eventId);
      if (roundDbId) query = query.eq('round_id', roundDbId);
      return query.order('submitted_at', { ascending: false });
    }, 'Failed to fetch round submissions.');
  }

  async function upsertSubmission({ eventId, roundDbId, participantId, teamId, submissionType, submissionData, submissionStatus }) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null;
      if (!uid) return { data: null, error: { message: 'Authentication required before submitting.' } };

      let existingQuery = sb.from('round_submissions').select('*').eq('round_id', roundDbId);
      existingQuery = teamId ? existingQuery.eq('team_id', teamId) : existingQuery.eq('participant_id', participantId).is('team_id', null);
      const exRes = await existingQuery.maybeSingle();

      const nowIso = new Date().toISOString();
      const prevData = (exRes.data && exRes.data.submission_data) || {};
      const prevHist = Array.isArray(prevData.history) ? prevData.history : [];
      const nextHist = [{ submittedAt: nowIso, note: (submissionData && submissionData.historyNote) || 'Updated submission', selectedLanguage: (submissionData && submissionData.selectedLanguage) || '' }, ...prevHist].slice(0, 20);
      const mergedData = { ...prevData, ...(submissionData || {}), history: nextHist };

      const row = {
        event_id: eventId,
        round_id: roundDbId,
        participant_id: teamId ? null : participantId,
        team_id: teamId || null,
        submitted_by: uid,
        submission_type: submissionType || 'general',
        submission_data: mergedData,
        submission_status: submissionStatus || 'Submitted',
        submitted_at: nowIso
      };

      if (exRes.data && exRes.data.id) {
        return sb.from('round_submissions').update(row).eq('id', exRes.data.id).select('*').single();
      }
      const ins = await sb.from('round_submissions').insert(row).select('*').single();
      if (!ins.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'submission_recorded', 'submission', ins.data.id, { roundId: roundDbId });
      }
      return ins;
    }, 'Failed to save round submission.');
  }

  async function updateSubmissionStatus(submissionId, submissionStatus) {
    return runDb(async (sb) => {
      return sb.from('round_submissions').update({ submission_status: submissionStatus }).eq('id', submissionId).select('*').single();
    }, 'Failed to update submission status.');
  }

  return {
    fetchRoundSubmissions,
    upsertSubmission,
    updateSubmissionStatus
  };
})();

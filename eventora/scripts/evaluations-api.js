/* ==========================================================================
   EVENTORA PHASE 10: EVALUATIONS API MODULE
   Supports evaluator assignment, rubric/manual scoring, and publication.
   SECURITY: Participant reads strictly invoke get_participant_published_results
   RPC which omits private_notes at the database level.
   ========================================================================== */

window.EventoraEvaluationsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchOrganizerEvaluations(eventId, roundDbId) {
    return runDb(async (sb) => {
      let query = sb.from('evaluations').select('*').eq('event_id', eventId);
      if (roundDbId) query = query.eq('round_id', roundDbId);
      return query.order('updated_at', { ascending: false });
    }, 'Failed to load round evaluations.');
  }

  async function fetchParticipantPublishedResults(eventId) {
    return runDb(async (sb) => {
      return sb.rpc('get_participant_published_results', { p_event_id: eventId });
    }, 'Failed to fetch published evaluation results.');
  }

  async function saveEvaluation({ eventId, roundDbId, submissionId, participantId, teamId, evaluatorId, score, maxMarks, evaluationStatus, feedback, privateNotes, rubricScores, isPublished }) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = evaluatorId || (authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null);

      let findQuery = sb.from('evaluations').select('id').eq('round_id', roundDbId);
      findQuery = teamId ? findQuery.eq('team_id', teamId) : findQuery.eq('participant_id', participantId).is('team_id', null);
      const exRes = await findQuery.maybeSingle();

      const row = {
        event_id: eventId,
        round_id: roundDbId,
        submission_id: submissionId || null,
        participant_id: teamId ? null : participantId,
        team_id: teamId || null,
        evaluator_id: uid,
        score: Math.max(0, Number(score) || 0),
        max_marks: Math.max(1, Number(maxMarks) || 100),
        evaluation_status: evaluationStatus || 'Evaluated',
        feedback: String(feedback || ''),
        private_notes: String(privateNotes || ''),
        rubric_scores: rubricScores && typeof rubricScores === 'object' ? rubricScores : {},
        is_published: Boolean(isPublished),
        evaluated_at: new Date().toISOString()
      };

      const res = exRes.data && exRes.data.id
        ? await sb.from('evaluations').update(row).eq('id', exRes.data.id).select('*').single()
        : await sb.from('evaluations').insert(row).select('*').single();

      if (!res.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'evaluation_saved', 'evaluation', res.data.id, { roundId: roundDbId, score: row.score });
      }
      return res;
    }, 'Failed to persist evaluation.');
  }

  async function publishRoundEvaluations(eventId, roundDbId, isPublished = true) {
    return runDb(async (sb) => {
      const res = await sb
        .from('evaluations')
        .update({ is_published: Boolean(isPublished) })
        .eq('event_id', eventId)
        .eq('round_id', roundDbId)
        .select('*');
      if (!res.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, isPublished ? 'results_published' : 'results_unpublished', 'round', roundDbId, {});
      }
      return res;
    }, 'Failed to update evaluation publication state.');
  }

  return {
    fetchOrganizerEvaluations,
    fetchParticipantPublishedResults,
    saveEvaluation,
    publishRoundEvaluations
  };
})();

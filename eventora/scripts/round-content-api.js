/* ==========================================================================
   EVENTORA PHASE 10: ROUND CONTENT, QUESTIONS & STORAGE MEDIA API MODULE
   Integrates PostgreSQL round_contents + round_questions + private
   `eventora-media` Storage paths. Participants use sanitized RPC readers.
   ========================================================================== */

window.EventoraRoundContentApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchOrganizerRoundContent(eventId, roundDbId) {
    return runDb(async (sb) => {
      const cRes = await sb.from('round_contents').select('*').eq('event_id', eventId).eq('round_id', roundDbId).order('created_at', { ascending: true });
      if (cRes.error) return cRes;
      const qRes = await sb.from('round_questions').select('*').eq('event_id', eventId).eq('round_id', roundDbId).order('order_number', { ascending: true });
      if (qRes.error) return qRes;
      return { data: { contents: cRes.data || [], questions: qRes.data || [] }, error: null };
    }, 'Failed to fetch organizer round content.');
  }

  async function fetchParticipantRoundContent(eventId, roundDbId) {
    return runDb(async (sb) => {
      const cRes = await sb.from('round_contents').select('*').eq('event_id', eventId).eq('round_id', roundDbId).order('created_at', { ascending: true });
      if (cRes.error) return cRes;
      const qRes = await sb.rpc('get_participant_round_questions', { p_event_id: eventId, p_round_id: roundDbId });
      if (qRes.error) return qRes;
      return { data: { contents: cRes.data || [], questions: qRes.data || [] }, error: null };
    }, 'Failed to fetch participant round materials.');
  }

  async function saveRoundContentItem(eventId, roundDbId, item) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null;
      const row = {
        event_id: eventId,
        round_id: roundDbId,
        content_type: item.contentType || 'pdf_document',
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim(),
        file_path: String(item.filePath || '').trim(),
        content_data: item.contentData && typeof item.contentData === 'object' ? item.contentData : {},
        visibility: item.visibility || 'when_unlocked',
        release_status: item.releaseStatus || 'Draft',
        created_by: uid
      };
      if (item.dbId && window.EventoraSupabase.db.isUuid(item.dbId)) {
        return sb.from('round_contents').update(row).eq('id', item.dbId).select('*').single();
      }
      return sb.from('round_contents').insert(row).select('*').single();
    }, 'Failed to save round content record.');
  }

  async function deleteRoundContentItem(contentDbId, storagePath) {
    if (storagePath && window.EventoraSupabase && window.EventoraSupabase.storage) {
      await window.EventoraSupabase.storage.removeMedia([storagePath]);
    }
    return runDb(async (sb) => sb.from('round_contents').delete().eq('id', contentDbId), 'Failed to delete round content.');
  }

  async function releaseRoundContent(eventId, roundDbId, releaseStatus) {
    return runDb(async (sb) => {
      const nextStatus = releaseStatus || 'Published';
      const res = await sb
        .from('round_contents')
        .update({ release_status: nextStatus })
        .eq('event_id', eventId)
        .eq('round_id', roundDbId)
        .select('*');
      if (!res.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'round_content_' + nextStatus.toLowerCase(), 'round_content', roundDbId, { status: nextStatus });
      }
      return res;
    }, 'Failed to update round content release status.');
  }

  async function syncRoundQuestions(eventId, roundDbId, questionsList) {
    return runDb(async (sb) => {
      const delRes = await sb.from('round_questions').delete().eq('event_id', eventId).eq('round_id', roundDbId);
      if (delRes.error) return delRes;
      if (!Array.isArray(questionsList) || !questionsList.length) return { data: [], error: null };

      const rows = questionsList.map((q, idx) => ({
        event_id: eventId,
        round_id: roundDbId,
        question_type: q.questionType || 'mcq',
        question_text: String(q.prompt || q.questionText || '').trim(),
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: {
          correctOptionIndex: Number.isInteger(q.correctOptionIndex) ? q.correctOptionIndex : 0,
          correctOptionIndices: Array.isArray(q.correctOptionIndices) ? q.correctOptionIndices : [],
          acceptedAnswer: String(q.acceptedAnswer || '')
        },
        marks: Math.max(0.5, Number(q.marks) || 1),
        negative_marks: Math.max(0, Number(q.negativeMarks) || 0),
        explanation: String(q.explanation || ''),
        order_number: idx + 1,
        settings: {
          clientId: q.id || '',
          mandatory: q.mandatory !== false,
          codeSnippet: q.codeSnippet || '',
          difficulty: q.difficulty || 'Medium',
          imageFilePath: q.imageFilePath || '',
          imageName: q.imageName || '',
          tags: Array.isArray(q.tags) ? q.tags : []
        }
      }));
      return sb.from('round_questions').insert(rows).select('*');
    }, 'Failed to save round question bank.');
  }

  async function uploadRoundFile({ category, eventId, roundId, file, onProgress }) {
    if (!window.EventoraSupabase || !window.EventoraSupabase.storage) {
      return { ok: false, error: 'Supabase Storage module unavailable.' };
    }
    return window.EventoraSupabase.storage.uploadMedia({
      category: category || 'content',
      eventId,
      roundId,
      file,
      onProgress
    });
  }

  async function getSignedDownloadUrl(filePath, expiresSeconds = 900) {
    if (!window.EventoraSupabase || !window.EventoraSupabase.storage) {
      return { ok: false, url: '', error: 'Supabase Storage module unavailable.' };
    }
    return window.EventoraSupabase.storage.createSignedUrl(filePath, expiresSeconds);
  }

  return {
    fetchOrganizerRoundContent,
    fetchParticipantRoundContent,
    saveRoundContentItem,
    deleteRoundContentItem,
    releaseRoundContent,
    syncRoundQuestions,
    uploadRoundFile,
    getSignedDownloadUrl
  };
})();

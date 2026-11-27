/* ==========================================================================
   EVENTORA PHASE 10: POSTGRESQL HYDRATION & WRITE-THROUGH SYNC COORDINATOR
   Coordinates Supabase Auth + DB schema probing + authoritative PostgreSQL
   hydration + write-through mutations + Realtime updates without mixing local
   prototype noise when Supabase PostgreSQL is active.
   ========================================================================== */

window.EventoraSync = (function () {
  let syncState = {
    initialized: false,
    mode: 'local_prototype', // 'supabase' | 'local_prototype'
    loading: false,
    saving: false,
    lastError: '',
    lastSyncedAt: '',
    dbStatus: null
  };

  const pendingSyncBySlug = new Map();
  const syncTimersBySlug = new Map();
  const pendingCreatesBySlug = new Map();
  let syncHookInstalled = false;

  function emitSyncStatus() {
    try {
      if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('eventora:syncstatus', { detail: { ...syncState } }));
      }
    } catch (_) {}
  }

  function showToast(msg) {
    if (window.EventoraUI && typeof window.EventoraUI.showToast === 'function') {
      window.EventoraUI.showToast(msg);
    }
  }

  function mapRoundContentRowsToPackageMap(roundsList, contentsRows, questionsRows) {
    const pkgByRoundId = {};
    const roundByDbId = new Map((roundsList || []).map((r) => [r.dbId, r]));

    (roundsList || []).forEach((r) => {
      pkgByRoundId[r.id] = {
        roundId: r.id,
        contentStatus: 'No Content',
        pdfs: [],
        attachments: [],
        questions: [],
        codingProblems: [],
        materials: [],
        challengeSpec: {},
        availability: { mode: 'locked', pausedAccessPolicy: 'restrict', completedAccessPolicy: 'allow', allowPdfDownload: true, allowAttachmentDownload: true }
      };
    });

    (contentsRows || []).forEach((row) => {
      const rnd = roundByDbId.get(row.round_id);
      if (!rnd) return;
      const pkg = pkgByRoundId[rnd.id];
      const d = row.content_data && typeof row.content_data === 'object' ? row.content_data : {};
      if (row.content_type === 'package_meta') {
        pkg.metaDbId = row.id;
        pkg.contentStatus = row.release_status || 'Draft';
        pkg.paperTitle = row.title || '';
        pkg.description = row.description || '';
        pkg.instructions = d.instructions || '';
        pkg.totalMarks = d.totalMarks != null ? d.totalMarks : pkg.totalMarks;
        pkg.durationLabel = d.durationLabel || '';
        pkg.declaredQuestionCount = d.declaredQuestionCount != null ? d.declaredQuestionCount : null;
        if (d.availability) pkg.availability = d.availability;
        if (d.challengeSpec) pkg.challengeSpec = d.challengeSpec;
      } else if (row.content_type === 'pdf_document') {
        pkg.pdfs.push({
          dbId: row.id,
          id: d.clientId || row.id,
          storagePath: row.file_path || '',
          fileName: d.fileName || row.title || 'paper.pdf',
          mimeType: d.mimeType || 'application/pdf',
          sizeBytes: Number(d.sizeBytes) || 0,
          category: d.category || 'Question Paper',
          title: row.title || 'Question Paper',
          description: row.description || '',
          instructions: d.instructions || '',
          totalMarks: d.totalMarks != null ? d.totalMarks : null,
          duration: d.duration || '',
          questionCount: d.questionCount != null ? d.questionCount : null,
          uploadedAt: row.created_at
        });
      } else if (row.content_type === 'attachment') {
        pkg.attachments.push({
          dbId: row.id,
          id: d.clientId || row.id,
          storagePath: row.file_path || '',
          fileName: d.fileName || row.title || 'asset',
          mimeType: d.mimeType || 'application/octet-stream',
          sizeBytes: Number(d.sizeBytes) || 0,
          category: d.category || 'Starter File',
          title: row.title || 'Attachment',
          description: row.description || '',
          visibility: row.visibility || 'when_unlocked',
          uploadedAt: row.created_at
        });
      } else if (row.content_type === 'coding_problem') {
        pkg.codingProblems.push({
          dbId: row.id,
          id: d.clientId || row.id,
          order: Number(d.order) || pkg.codingProblems.length + 1,
          problemTitle: row.title || 'Coding Problem',
          difficulty: d.difficulty || 'Medium',
          points: Number(d.points) || 100,
          timeLimit: d.timeLimit || '2 Seconds',
          statement: row.description || d.statement || '',
          inputFormat: d.inputFormat || '',
          outputFormat: d.outputFormat || '',
          constraints: d.constraints || '',
          sampleInput: d.sampleInput || '',
          sampleOutput: d.sampleOutput || '',
          explanation: d.explanation || '',
          evaluationRubric: d.evaluationRubric || '',
          submissionInstructions: d.submissionInstructions || '',
          problemPdfPath: row.file_path || '',
          problemPdfName: d.problemPdfName || '',
          allowedLanguages: Array.isArray(d.allowedLanguages) ? d.allowedLanguages : ['C', 'C++', 'Java', 'Python'],
          starterUrl: d.starterUrl || '',
          assetsNote: d.assetsNote || ''
        });
      } else if (row.content_type === 'material') {
        pkg.materials.push({
          dbId: row.id,
          id: d.clientId || row.id,
          category: d.category || 'Prompt / Brief',
          title: row.title || 'Reference',
          description: row.description || '',
          resourceUrl: d.resourceUrl || '',
          visibility: row.visibility || 'when_unlocked'
        });
      }
    });

    (questionsRows || []).forEach((qRow) => {
      const rnd = roundByDbId.get(qRow.round_id);
      if (!rnd) return;
      const pkg = pkgByRoundId[rnd.id];
      const ca = qRow.correct_answer && typeof qRow.correct_answer === 'object' ? qRow.correct_answer : {};
      const st = qRow.settings && typeof qRow.settings === 'object' ? qRow.settings : {};
      const item = {
        dbId: qRow.id,
        id: st.clientId || qRow.id,
        order: qRow.order_number || pkg.questions.length + 1,
        questionType: qRow.question_type || 'mcq',
        prompt: qRow.question_text || '',
        codeSnippet: st.codeSnippet || '',
        options: Array.isArray(qRow.options) ? qRow.options : [],
        marks: Number(qRow.marks) || 1,
        negativeMarks: Number(qRow.negative_marks) || 0,
        mandatory: st.mandatory !== false,
        imageFilePath: st.imageFilePath || '',
        imageName: st.imageName || '',
        difficulty: st.difficulty || 'Medium',
        tags: Array.isArray(st.tags) ? st.tags : []
      };
      if (Object.prototype.hasOwnProperty.call(qRow, 'correct_answer')) {
        item.correctOptionIndex = Number.isInteger(ca.correctOptionIndex) ? ca.correctOptionIndex : 0;
        item.correctOptionIndices = Array.isArray(ca.correctOptionIndices) ? ca.correctOptionIndices : [];
        item.acceptedAnswer = ca.acceptedAnswer || '';
        item.explanation = qRow.explanation || '';
      }
      pkg.questions.push(item);
    });

    return pkgByRoundId;
  }

  function installStoreWriteThrough() {
    if (syncHookInstalled || !window.EventoraStore || typeof window.EventoraStore.setSyncListener !== 'function') return;
    syncHookInstalled = true;
    window.EventoraStore.setSyncListener((op, evObj) => {
      if (syncState.mode !== 'supabase' || !evObj || !evObj.slug) return;
      if (op === 'delete') {
        if (evObj.dbId && window.EventoraEventsApi) {
          window.EventoraEventsApi.deleteEvent(evObj.dbId).then((res) => {
            if (!res.ok) showToast(res.error || 'Database delete rejected.');
          });
        }
        return;
      }
      if (op === 'create') {
        persistNewEventToDb(evObj);
        return;
      }
      queueEventWriteThrough(evObj.slug);
    });
  }

  async function persistNewEventToDb(evObj) {
    if (!evObj || !evObj.slug) return { ok: false, error: 'Missing event data.' };
    if (pendingCreatesBySlug.has(evObj.slug)) {
      return pendingCreatesBySlug.get(evObj.slug);
    }
    if (!window.EventoraEventsApi) return { ok: false, error: 'Events API unavailable.' };

    const p = (async () => {
      syncState.saving = true;
      emitSyncStatus();
      const res = await window.EventoraEventsApi.createEvent(evObj);
      if (!res.ok || !res.data) {
        syncState.saving = false;
        syncState.lastError = res.error || 'Failed to save event to PostgreSQL.';
        emitSyncStatus();
        showToast(syncState.lastError);
        return res;
      }
      const createdDbEv = res.data;
      if (Array.isArray(evObj.rounds) && evObj.rounds.length > 0 && window.EventoraRoundsApi) {
        const rRes = await window.EventoraRoundsApi.syncEventRoundsList(createdDbEv.dbId, evObj.rounds);
        if (rRes.ok && rRes.data) createdDbEv.rounds = rRes.data;
      }
      window.EventoraStore.upsertRemoteEvent({ ...evObj, dbId: createdDbEv.dbId, rounds: createdDbEv.rounds || evObj.rounds });
      syncState.saving = false;
      syncState.lastSyncedAt = new Date().toISOString();
      emitSyncStatus();
      return { ok: true, data: createdDbEv };
    })();

    pendingCreatesBySlug.set(evObj.slug, p);
    try {
      return await p;
    } finally {
      pendingCreatesBySlug.delete(evObj.slug);
    }
  }

  function queueEventWriteThrough(slug) {
    if (syncTimersBySlug.has(slug)) {
      window.clearTimeout(syncTimersBySlug.get(slug));
    }
    pendingSyncBySlug.set(slug, true);
    const tid = window.setTimeout(() => {
      syncTimersBySlug.delete(slug);
      flushEventWriteThrough(slug);
    }, 320);
    syncTimersBySlug.set(slug, tid);
  }

  async function flushEventWriteThrough(slug) {
    if (!pendingSyncBySlug.has(slug) || syncState.mode !== 'supabase') return;
    pendingSyncBySlug.delete(slug);
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!ev) return;
    if (!ev.dbId || !window.EventoraSupabase.db.isUuid(ev.dbId)) {
      await persistNewEventToDb(ev);
      return;
    }

    syncState.saving = true;
    emitSyncStatus();
    try {
      // 1. Core event + settings + live_ops
      const evUpd = await window.EventoraEventsApi.updateEvent(ev.dbId, ev);
      if (!evUpd.ok) {
        syncState.lastError = evUpd.error;
        showToast(evUpd.error || 'Database update failed.');
      }

      // 2. Rounds list + live round statuses
      if (window.EventoraRoundsApi && Array.isArray(ev.rounds)) {
        const liveRoundsMap = (ev.liveOps && ev.liveOps.roundsById) || {};
        const mergedRounds = ev.rounds.map((r) => {
          const op = liveRoundsMap[r.id];
          return op ? { ...r, status: op.roundStatus || r.status, timerState: op } : r;
        });
        const rSync = await window.EventoraRoundsApi.syncEventRoundsList(ev.dbId, mergedRounds);
        if (rSync.ok && Array.isArray(rSync.data)) {
          window.EventoraStore.upsertRemoteEvent({ ...ev, rounds: rSync.data });
        }
      }
      syncState.lastSyncedAt = new Date().toISOString();
    } catch (err) {
      syncState.lastError = (err && err.message) || 'Synchronization error.';
    } finally {
      syncState.saving = false;
      emitSyncStatus();
    }
  }

  async function initBackend(forceProbe) {
    installStoreWriteThrough();
    if (!window.EventoraSupabase || !window.EventoraSupabase.db) {
      syncState.initialized = true;
      syncState.mode = 'local_prototype';
      if (window.EventoraStore) window.EventoraStore.setBackendMode('local_prototype');
      emitSyncStatus();
      return { ...syncState };
    }

    const dbStatus = await window.EventoraSupabase.db.probeDatabase(forceProbe);
    syncState.initialized = true;
    syncState.dbStatus = dbStatus;
    if (dbStatus && dbStatus.ready) {
      syncState.mode = 'supabase';
      syncState.lastError = '';
      if (window.EventoraStore) window.EventoraStore.setBackendMode('supabase');
    } else {
      syncState.mode = 'local_prototype';
      syncState.lastError = (dbStatus && dbStatus.status === 'offline') ? dbStatus.errorMessage : '';
      if (window.EventoraStore) window.EventoraStore.setBackendMode('local_prototype');
    }
    emitSyncStatus();
    return { ...syncState };
  }

  async function hydratePublicCatalog(filters) {
    await initBackend();
    if (syncState.mode !== 'supabase' || !window.EventoraEventsApi) {
      return { ok: true, mode: 'local_prototype', events: window.EventoraStore ? window.EventoraStore.getAllEvents() : [] };
    }
    syncState.loading = true;
    emitSyncStatus();
    const res = await window.EventoraEventsApi.fetchPublicEvents(filters || {});
    syncState.loading = false;
    if (!res.ok) {
      syncState.lastError = res.error;
      emitSyncStatus();
      return { ok: false, mode: 'supabase', error: res.error, events: [] };
    }

    const eventsWithRounds = [];
    for (const ev of (res.data || [])) {
      const rRes = window.EventoraRoundsApi ? await window.EventoraRoundsApi.fetchEventRounds(ev.dbId) : { ok: true, data: [] };
      const fullEv = { ...ev, rounds: rRes.ok && Array.isArray(rRes.data) ? rRes.data : [] };
      const pathToSign = fullEv.posterPath || fullEv.coverPath;
      if (pathToSign && window.EventoraSupabase && window.EventoraSupabase.storage) {
        const sUrl = await window.EventoraSupabase.storage.createSignedUrl(pathToSign, 1800);
        if (sUrl.ok && sUrl.url) {
          fullEv.posterDataUrl = sUrl.url;
          fullEv.coverImage = sUrl.url;
        }
      }
      eventsWithRounds.push(fullEv);
    }
    if (window.EventoraStore) {
      window.EventoraStore.replaceRemoteCatalog(eventsWithRounds);
    }
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.lastError = '';
    emitSyncStatus();
    return { ok: true, mode: 'supabase', events: window.EventoraStore ? window.EventoraStore.getAllEvents() : eventsWithRounds };
  }

  async function hydrateEventBySlug(slug, user, opts) {
    const o = opts || {};
    await initBackend();
    if (syncState.mode !== 'supabase' || !window.EventoraEventsApi) {
      return { ok: true, mode: 'local_prototype', event: window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null };
    }
    const evRes = await window.EventoraEventsApi.fetchEventBySlug(slug);
    if (!evRes.ok) {
      syncState.lastError = evRes.error;
      emitSyncStatus();
      return { ok: false, error: evRes.error, event: null };
    }
    if (!evRes.data) {
      return { ok: true, mode: 'supabase', event: null };
    }

    const ev = evRes.data;
    const isManager = Boolean(o.organizerView) || (user && user.id === ev.organizerId);

    const [roundsRes, regRes, collabRes, annRes, logRes] = await Promise.all([
      window.EventoraRoundsApi ? window.EventoraRoundsApi.fetchEventRounds(ev.dbId) : Promise.resolve({ ok: true, data: [] }),
      window.EventoraRegistrationsApi ? window.EventoraRegistrationsApi.fetchEventRegistrations(ev.dbId) : Promise.resolve({ ok: true, data: [] }),
      isManager && window.EventoraCollaboratorsApi ? window.EventoraCollaboratorsApi.fetchCollaborators(ev.dbId) : Promise.resolve({ ok: true, data: [] }),
      window.EventoraAnnouncementsApi ? window.EventoraAnnouncementsApi.fetchAnnouncements(ev.dbId) : Promise.resolve({ ok: true, data: [] }),
      isManager ? window.EventoraEventsApi.fetchActivityLogs(ev.dbId, 30) : Promise.resolve({ ok: true, data: [] })
    ]);

    const rounds = roundsRes.ok && Array.isArray(roundsRes.data) ? roundsRes.data : [];
    const participants = regRes.ok && Array.isArray(regRes.data) ? regRes.data : [];
    const teamsRes = window.EventoraTeamsApi
      ? await window.EventoraTeamsApi.fetchEventTeams(ev.dbId, participants)
      : { ok: true, data: [] };
    const teams = teamsRes.ok && Array.isArray(teamsRes.data) ? teamsRes.data : [];

    // Hydrate Round Content + sanitized or organizer Questions per round
    const allContents = [];
    const allQuestions = [];
    if (window.EventoraRoundContentApi) {
      for (const r of rounds) {
        if (!r.dbId) continue;
        const cRes = isManager
          ? await window.EventoraRoundContentApi.fetchOrganizerRoundContent(ev.dbId, r.dbId)
          : await window.EventoraRoundContentApi.fetchParticipantRoundContent(ev.dbId, r.dbId);
        if (cRes.ok && cRes.data) {
          allContents.push(...(cRes.data.contents || []));
          allQuestions.push(...(cRes.data.questions || []));
        }
      }
    }
    const roundContentById = mapRoundContentRowsToPackageMap(rounds, allContents, allQuestions);

    // Hydrate Submissions, Evaluations/Published Results, Qualifications
    const subRes = window.EventoraSubmissionsApi
      ? await window.EventoraSubmissionsApi.fetchRoundSubmissions(ev.dbId)
      : { ok: true, data: [] };
    const qualRes = window.EventoraQualificationApi
      ? await window.EventoraQualificationApi.fetchQualificationResults(ev.dbId)
      : { ok: true, data: [] };
    const evalRes = isManager && window.EventoraEvaluationsApi
      ? await window.EventoraEvaluationsApi.fetchOrganizerEvaluations(ev.dbId)
      : (window.EventoraEvaluationsApi ? await window.EventoraEvaluationsApi.fetchParticipantPublishedResults(ev.dbId) : { ok: true, data: [] });

    const roundByDbId = new Map(rounds.map((r) => [r.dbId, r]));
    const evalState = ev.evaluationState && typeof ev.evaluationState === 'object'
      ? { ...ev.evaluationState, roundEvalsById: { ...(ev.evaluationState.roundEvalsById || {}) } }
      : { roundEvalsById: {}, overallConfig: {} };

    // Merge DB Submissions into evaluationState.roundEvalsById[r.id].submissionsByTarget
    (subRes.ok ? (subRes.data || []) : []).forEach((sRow) => {
      const rnd = roundByDbId.get(sRow.round_id);
      if (!rnd) return;
      const tk = sRow.team_id ? `team:${sRow.team_id}` : (sRow.participant_id ? `participant:${sRow.participant_id}` : '');
      if (!tk) return;
      if (!evalState.roundEvalsById[rnd.id]) evalState.roundEvalsById[rnd.id] = { submissionsByTarget: {}, scoresByTarget: {}, qualification: {}, publication: {} };
      const rPkg = evalState.roundEvalsById[rnd.id];
      if (!rPkg.submissionsByTarget) rPkg.submissionsByTarget = {};
      const sd = sRow.submission_data && typeof sRow.submission_data === 'object' ? sRow.submission_data : {};
      rPkg.submissionsByTarget[tk] = {
        dbId: sRow.id,
        targetKey: tk,
        submissionType: sRow.submission_type || 'general',
        submissionStatus: sRow.submission_status || 'Submitted',
        submittedAt: sRow.submitted_at || sRow.updated_at || '',
        ...sd
      };
    });

    // Merge DB Evaluations (organizer rows OR sanitized participant published results)
    (evalRes.ok ? (evalRes.data || []) : []).forEach((eRow) => {
      const rnd = roundByDbId.get(eRow.round_id);
      if (!rnd) return;
      const tk = eRow.team_id ? `team:${eRow.team_id}` : (eRow.participant_id ? `participant:${eRow.participant_id}` : '');
      if (!tk) return;
      if (!evalState.roundEvalsById[rnd.id]) evalState.roundEvalsById[rnd.id] = { submissionsByTarget: {}, scoresByTarget: {}, qualification: {}, publication: {} };
      const rPkg = evalState.roundEvalsById[rnd.id];
      if (!rPkg.scoresByTarget) rPkg.scoresByTarget = {};
      rPkg.scoresByTarget[tk] = {
        dbId: eRow.id || eRow.evaluation_id,
        targetKey: tk,
        targetKind: eRow.team_id ? 'team' : 'participant',
        targetId: eRow.team_id || eRow.participant_id,
        awardedMarks: Number(eRow.score) || 0,
        maxMarks: Number(eRow.max_marks) || 100,
        evaluationStatus: eRow.evaluation_status || 'Evaluated',
        criteriaMarks: eRow.rubric_scores && typeof eRow.rubric_scores === 'object' ? eRow.rubric_scores : {},
        publicFeedback: eRow.feedback || '',
        evaluationNotes: Object.prototype.hasOwnProperty.call(eRow, 'private_notes') ? (eRow.private_notes || '') : '',
        evaluatorId: eRow.evaluator_id || '',
        evaluatedAt: eRow.evaluated_at || '',
        updatedAt: eRow.updated_at || ''
      };
      if (eRow.is_published) {
        rPkg.publication = { ...(rPkg.publication || {}), roundPublished: true, leaderboardPublished: true };
      }
    });

    // Merge DB Qualification Results
    (qualRes.ok ? (qualRes.data || []) : []).forEach((qRow) => {
      const rnd = roundByDbId.get(qRow.round_id);
      if (!rnd) return;
      const tk = qRow.team_id ? `team:${qRow.team_id}` : (qRow.participant_id ? `participant:${qRow.participant_id}` : '');
      if (!tk) return;
      if (!evalState.roundEvalsById[rnd.id]) evalState.roundEvalsById[rnd.id] = { submissionsByTarget: {}, scoresByTarget: {}, qualification: {}, publication: {} };
      const rPkg = evalState.roundEvalsById[rnd.id];
      if (!rPkg.qualification) rPkg.qualification = {};
      if (!Array.isArray(rPkg.qualification.qualifiedKeys)) rPkg.qualification.qualifiedKeys = [];
      if (qRow.qualification_status === 'Qualified' && !rPkg.qualification.qualifiedKeys.includes(tk)) {
        rPkg.qualification.qualifiedKeys.push(tk);
      }
      if (qRow.finalized_at) {
        rPkg.qualification.finalized = true;
        rPkg.qualification.finalizedAt = qRow.finalized_at;
      }
      if (qRow.is_published) {
        rPkg.publication = { ...(rPkg.publication || {}), leaderboardPublished: true };
      }
    });

    const mappedCollabs = (collabRes.ok ? (collabRes.data || []) : []).map((c) => {
      const prof = c.profile && typeof c.profile === 'object' ? c.profile : {};
      const roleLabels = {
        co_organizer: 'Event Owner',
        manager: 'Event Manager',
        evaluator: 'Evaluator',
        coordinator: 'Coordinator',
        viewer: 'Viewer'
      };
      return {
        dbId: c.id,
        id: c.id,
        userId: c.user_id || '',
        name: prof.full_name || c.invited_email || 'Collaborator',
        email: prof.email || c.invited_email || '',
        role: roleLabels[c.collaborator_role] || c.collaborator_role || 'Event Manager',
        collaboratorRole: c.collaborator_role || 'manager',
        permissions: c.permissions || {},
        status: c.invitation_status || 'accepted',
        addedAt: c.created_at || ''
      };
    });

    const dbTimeline = (logRes.ok ? (logRes.data || []) : []).map((lg) => ({
      id: lg.id,
      activityType: lg.action || 'system',
      title: String(lg.action || 'activity').replace(/_/g, ' '),
      detail: lg.entity_type ? `${lg.entity_type} updated` : '',
      timestamp: lg.created_at || '',
      actorName: 'Database Log'
    }));

    const mappedEv = {
      ...ev,
      rounds,
      participants,
      teams,
      roundContentById,
      evaluationState: evalState,
      collaborators: mappedCollabs,
      _dbSubmissions: subRes.ok ? (subRes.data || []) : [],
      _dbQualifications: qualRes.ok ? (qualRes.data || []) : [],
      _dbEvaluations: evalRes.ok ? (evalRes.data || []) : [],
      _dbCollaborators: collabRes.ok ? (collabRes.data || []) : [],
      _dbActivityLogs: logRes.ok ? (logRes.data || []) : []
    };

    // Merge DB announcements cleanly into liveOps.announcements & round statuses
    const annList = annRes.ok && Array.isArray(annRes.data) ? annRes.data : [];
    const existingTimeline = Array.isArray(mappedEv.liveOps && mappedEv.liveOps.activityTimeline) ? mappedEv.liveOps.activityTimeline : [];
    mappedEv.liveOps = {
      ...(mappedEv.liveOps || {}),
      announcements: annList.map((a) => ({
        dbId: a.id,
        id: a.id,
        title: a.title,
        message: a.message,
        targetScope: a.round_id ? 'round' : 'event',
        roundId: (roundByDbId.get(a.round_id) && roundByDbId.get(a.round_id).id) || a.round_id || '',
        targetRoundId: a.round_id || '',
        audience: a.audience || 'all_participants',
        status: a.published_at ? 'Published' : 'Draft',
        published: Boolean(a.published_at),
        publishedAt: a.published_at || '',
        createdAt: a.created_at
      })),
      activityTimeline: existingTimeline.length > 0 ? existingTimeline : dbTimeline
    };

    const pathToSign = mappedEv.posterPath || mappedEv.coverPath;
    if (pathToSign && window.EventoraSupabase && window.EventoraSupabase.storage) {
      const sUrl = await window.EventoraSupabase.storage.createSignedUrl(pathToSign, 1800);
      if (sUrl.ok && sUrl.url) {
        mappedEv.posterDataUrl = sUrl.url;
        mappedEv.coverImage = sUrl.url;
      }
    }

    const stored = window.EventoraStore ? window.EventoraStore.upsertRemoteEvent(mappedEv) : mappedEv;
    syncState.lastSyncedAt = new Date().toISOString();
    syncState.lastError = '';
    emitSyncStatus();
    return { ok: true, mode: 'supabase', event: stored };
  }

  async function hydrateOrganizerWorkspace(user) {
    await initBackend();
    if (syncState.mode !== 'supabase' || !window.EventoraEventsApi || !user) {
      return { ok: true, mode: 'local_prototype' };
    }
    syncState.loading = true;
    emitSyncStatus();
    const res = await window.EventoraEventsApi.fetchOrganizerEvents(user.id);
    if (!res.ok) {
      syncState.loading = false;
      syncState.lastError = res.error;
      emitSyncStatus();
      return { ok: false, error: res.error };
    }

    const hydrated = [];
    for (const ev of (res.data || [])) {
      const full = await hydrateEventBySlug(ev.slug, user, { organizerView: true });
      if (full.ok && full.event) hydrated.push(full.event);
    }
    if (window.EventoraStore) window.EventoraStore.replaceRemoteCatalog(hydrated);
    syncState.loading = false;
    syncState.lastSyncedAt = new Date().toISOString();
    emitSyncStatus();
    return { ok: true, mode: 'supabase', events: hydrated };
  }

  async function hydrateParticipantWorkspace(user) {
    await initBackend();
    if (syncState.mode !== 'supabase' || !user) {
      return { ok: true, mode: 'local_prototype' };
    }
    syncState.loading = true;
    emitSyncStatus();
    const pub = await hydratePublicCatalog({});
    if (window.EventoraRegistrationsApi) {
      const myRegs = await window.EventoraRegistrationsApi.fetchUserRegistrations(user.id);
      if (myRegs.ok && Array.isArray(myRegs.data)) {
        const seen = new Set();
        for (const r of myRegs.data) {
          const slug = r.event && r.event.slug;
          if (slug && !seen.has(slug)) {
            seen.add(slug);
            await hydrateEventBySlug(slug, user, { organizerView: false });
          }
        }
      }
    }
    syncState.loading = false;
    emitSyncStatus();
    return pub;
  }

  function renderConnectionPillHTML() {
    const mode = syncState.mode;
    const db = syncState.dbStatus || (window.EventoraSupabase && window.EventoraSupabase.db ? window.EventoraSupabase.db.getStatus() : {});
    const rt = window.EventoraRealtime ? window.EventoraRealtime.getStatus() : { status: 'idle' };

    if (mode === 'supabase') {
      const rtLabel = rt.status === 'live' ? ' • Realtime Live' : (rt.status === 'connecting' ? ' • Syncing...' : '');
      return `<span class="ev-lc-pill" style="background:var(--ev-sage-tint);border-color:var(--ev-forest);color:var(--ev-forest);" title="Connected to Supabase PostgreSQL">Database Connected${rtLabel}</span>`;
    }
    if (db && db.status === 'migrations_pending') {
      return `<span class="ev-lc-pill" style="background:#fff6e5;border-color:#d9a441;color:#7a4f01;" title="${(db.errorMessage || '').replace(/"/g, '&quot;')}">SQL Migrations Pending (Prototype Fallback)</span>`;
    }
    if (db && db.status === 'offline') {
      return `<span class="ev-lc-pill" style="background:#fdeeee;border-color:#c94c4c;color:#8c1d18;">Database Offline</span>`;
    }
    return `<span class="ev-lc-pill">Local Prototype Mode</span>`;
  }

  function renderDatabaseErrorCardHTML({ title, message, retryButtonId }) {
    const esc = window.EventoraUI && window.EventoraUI.escapeHTML ? window.EventoraUI.escapeHTML : (s) => String(s || '');
    return `
      <div class="ev-ws-card" style="border-color:#e0a7a7;background:#fff8f8;">
        <span class="ev-badge ev-badge-closed" style="margin-bottom:0.5rem;">Connection Issue</span>
        <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;color:var(--ev-charcoal);margin-bottom:0.35rem;">${esc(title || 'Unable to Load Database Records')}</h3>
        <p style="font-size:0.86rem;color:var(--ev-muted);margin-bottom:0.9rem;">${esc(message || 'Network or PostgreSQL error occurred.')}</p>
        ${retryButtonId ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="${esc(retryButtonId)}">Retry Connection</button>` : ''}
      </div>
    `;
  }

  function renderLoadingCardHTML(message) {
    const esc = window.EventoraUI && window.EventoraUI.escapeHTML ? window.EventoraUI.escapeHTML : (s) => String(s || '');
    return `
      <div class="ev-ws-card" style="text-align:center;padding:2rem 1.25rem;">
        <span class="ev-badge ev-badge-sample" style="margin-bottom:0.5rem;">Synchronizing</span>
        <p style="font-size:0.88rem;color:var(--ev-muted);margin:0;">${esc(message || 'Loading authoritative data from PostgreSQL...')}</p>
      </div>
    `;
  }

  function isSupabaseActiveForEvent(ev) {
    return syncState.mode === 'supabase'
      && ev && ev.dbId
      && window.EventoraSupabase && window.EventoraSupabase.db && window.EventoraSupabase.db.isUuid(ev.dbId);
  }

  async function saveEventPosterFromFile(slug, file, category) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!ev || !file || !window.EventoraFileStore) {
      return { ok: false, error: 'Missing event or file store module.' };
    }
    const oldPath = ev.posterPath || ev.coverPath || '';
    const up = await window.EventoraFileStore.uploadFile(ev.dbId || ev.slug, null, file, {
      category: category || 'poster',
      eventSlug: ev.slug
    });
    if (!up.ok) return up;

    if (isSupabaseActiveForEvent(ev) && window.EventoraEventsApi) {
      if (oldPath && oldPath !== up.storagePath) {
        await window.EventoraFileStore.removeFile({ storagePath: oldPath });
      }
      const nextEv = {
        ...ev,
        posterPath: up.storagePath,
        coverPath: up.storagePath,
        coverImage: up.signedUrl || ev.coverImage,
        posterDataUrl: up.signedUrl || ''
      };
      const upd = await window.EventoraEventsApi.updateEvent(ev.dbId, nextEv);
      if (!upd.ok) return upd;
      window.EventoraStore.upsertRemoteEvent({ ...nextEv, coverImage: up.signedUrl || upd.data.coverImage });
      return { ok: true, storagePath: up.storagePath, signedUrl: up.signedUrl };
    }
    return up;
  }

  async function removeEventPoster(slug) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!ev) return { ok: false, error: 'Event not found.' };
    const oldPath = ev.posterPath || ev.coverPath || '';
    if (oldPath && window.EventoraFileStore) {
      await window.EventoraFileStore.removeFile({ storagePath: oldPath });
    }
    if (isSupabaseActiveForEvent(ev) && window.EventoraEventsApi) {
      const nextEv = { ...ev, posterPath: '', coverPath: '', coverImage: '', posterDataUrl: '', image: '' };
      const upd = await window.EventoraEventsApi.updateEvent(ev.dbId, nextEv);
      if (!upd.ok) return upd;
      window.EventoraStore.upsertRemoteEvent(nextEv);
    }
    return { ok: true };
  }

  async function syncLiveOpsNow(slug, changedRoundId) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!isSupabaseActiveForEvent(ev)) return { ok: true, mode: 'local_prototype' };
    try {
      if (changedRoundId && window.EventoraRoundsApi) {
        const rnd = (ev.rounds || []).find((r) => r.id === changedRoundId);
        const op = ev.liveOps && ev.liveOps.roundsById ? ev.liveOps.roundsById[changedRoundId] : null;
        if (rnd && rnd.dbId && op) {
          await window.EventoraRoundsApi.updateRoundStatus(rnd.dbId, op.roundStatus || rnd.status, op);
        }
      }
      const mappedEvStatus = ev.liveOps && ev.liveOps.operationalStatus === 'Live' ? 'live'
        : (ev.liveOps && ev.liveOps.operationalStatus === 'Paused' ? 'paused'
          : (ev.liveOps && ev.liveOps.operationalStatus === 'Completed' ? 'completed' : ev.statusKey));
      if (window.EventoraEventsApi) {
        return await window.EventoraEventsApi.updateEvent(ev.dbId, { ...ev, statusKey: mappedEvStatus });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err && err.message) || 'Failed to persist live operations.' };
    }
  }

  async function saveEvaluationDb(slug, roundId, targetKey, evalRecord) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!isSupabaseActiveForEvent(ev) || !window.EventoraEvaluationsApi) return { ok: true, local: true };
    const rnd = (ev.rounds || []).find((r) => r.id === roundId);
    if (!rnd || !rnd.dbId) return { ok: false, error: 'Round database ID missing; save Round Builder first.' };
    const [kind, rawId] = String(targetKey || '').split(':');
    const isTeam = kind === 'team';
    const rEval = ev.evaluationState && ev.evaluationState.roundEvalsById ? ev.evaluationState.roundEvalsById[roundId] : null;
    const sub = rEval && rEval.submissionsByTarget ? rEval.submissionsByTarget[targetKey] : null;
    const res = await window.EventoraEvaluationsApi.saveEvaluation({
      eventId: ev.dbId,
      roundDbId: rnd.dbId,
      submissionId: sub && sub.dbId ? sub.dbId : null,
      participantId: isTeam ? null : rawId,
      teamId: isTeam ? rawId : null,
      score: evalRecord.awardedMarks,
      maxMarks: evalRecord.maxMarks,
      evaluationStatus: evalRecord.evaluationStatus === 'Not Evaluated' ? 'Pending' : evalRecord.evaluationStatus,
      feedback: evalRecord.publicFeedback || '',
      privateNotes: evalRecord.evaluationNotes || '',
      rubricScores: evalRecord.criteriaMarks || {},
      isPublished: Boolean(rEval && rEval.publication && rEval.publication.roundPublished)
    });
    if (res.ok && res.data) {
      evalRecord.dbId = res.data.id;
    }
    return res;
  }

  async function publishRoundResultsDb(slug, roundId, isPublished) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!isSupabaseActiveForEvent(ev) || !window.EventoraEvaluationsApi) return { ok: true, local: true };
    const rnd = (ev.rounds || []).find((r) => r.id === roundId);
    if (!rnd || !rnd.dbId) return { ok: false, error: 'Round database ID missing.' };
    const eRes = await window.EventoraEvaluationsApi.publishRoundEvaluations(ev.dbId, rnd.dbId, isPublished);
    if (window.EventoraQualificationApi) {
      await window.EventoraQualificationApi.finalizeQualification(ev.dbId, rnd.dbId, isPublished);
    }
    return eRes;
  }

  async function finalizeQualificationDb(slug, roundId, qPreview, isPublished) {
    const ev = window.EventoraStore ? window.EventoraStore.getEventBySlug(slug) : null;
    if (!isSupabaseActiveForEvent(ev) || !window.EventoraQualificationApi) return { ok: true, local: true };
    const rnd = (ev.rounds || []).find((r) => r.id === roundId);
    if (!rnd || !rnd.dbId) return { ok: false, error: 'Round database ID missing.' };
    const nowIso = new Date().toISOString();
    const allRows = [...(qPreview.qualified || []), ...(qPreview.notQualified || [])];
    const entries = allRows.map((entry) => {
      const [kind, tid] = String(entry.targetKey || '').split(':');
      return {
        participantId: kind === 'team' ? null : tid,
        teamId: kind === 'team' ? tid : null,
        score: Number(entry.awardedMarks) || 0,
        rank: entry.rank || null,
        qualificationStatus: entry.qualified ? 'Qualified' : 'Not Qualified',
        qualificationReason: entry.qualificationReason || '',
        finalizedAt: nowIso
      };
    });
    const bRes = await window.EventoraQualificationApi.saveQualificationBatch(ev.dbId, rnd.dbId, entries, Boolean(isPublished));
    if (!bRes.ok) return bRes;
    return window.EventoraQualificationApi.finalizeQualification(ev.dbId, rnd.dbId, Boolean(isPublished));
  }

  return {
    initBackend,
    hydratePublicCatalog,
    hydrateEventBySlug,
    hydrateOrganizerWorkspace,
    hydrateParticipantWorkspace,
    persistNewEventToDb,
    queueEventWriteThrough,
    flushEventWriteThrough,
    isSupabaseActiveForEvent,
    saveEventPosterFromFile,
    removeEventPoster,
    syncLiveOpsNow,
    saveEvaluationDb,
    publishRoundResultsDb,
    finalizeQualificationDb,
    getStatus: () => ({ ...syncState }),
    renderConnectionPillHTML,
    renderDatabaseErrorCardHTML,
    renderLoadingCardHTML
  };
})();

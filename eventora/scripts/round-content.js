/* ==========================================================================
   EVENTORA PHASE 8: ROUND CONTENT, PDF UPLOAD & QUESTION MANAGEMENT
   Supports per-round IndexedDB-backed PDF question papers (drag-and-drop,
   preview, replace, download, metadata), MCQ/Quiz management + CSV import
   validation & preview, Coding problems (C/C++/Java/Python, problem PDFs,
   duplicate/reorder), Frontend/Technical attachments & submission specs,
   fine-grained release policies, and organizer preview simulation.
   ========================================================================== */

window.EventoraRoundContent = (function () {
  function esc(str) {
    return window.EventoraUI && window.EventoraUI.escapeHTML
      ? window.EventoraUI.escapeHTML(String(str == null ? '' : str))
      : String(str == null ? '' : str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  function toast(msg) {
    if (window.EventoraUI && window.EventoraUI.showToast) {
      window.EventoraUI.showToast(msg);
    }
  }

  function confirmAction(opts) {
    if (window.EventoraWorkspace && typeof window.EventoraWorkspace.openConfirm === 'function') {
      window.EventoraWorkspace.openConfirm(opts);
    } else if (typeof opts.onConfirm === 'function') {
      opts.onConfirm();
    }
  }

  function formatBytes(bytes) {
    const n = Math.max(0, Number(bytes) || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getContentStatusBadgeClass(status) {
    if (status === 'Published') return 'ev-lc-badge-live';
    if (status === 'Ready') return 'ev-lc-badge-submitted';
    if (status === 'Draft') return 'ev-lc-badge-paused';
    if (status === 'Archived') return 'ev-lc-badge-completed';
    return 'ev-lc-badge-upcoming';
  }

  function defaultContentTabForType(typeKey) {
    if (typeKey === 'coding' || typeKey === 'frontend') return 'problems';
    if (typeKey === 'presentation' || typeKey === 'workshop' || typeKey === 'treasure_hunt' || typeKey === 'manual') {
      return 'materials';
    }
    return 'questions';
  }

  function resolvePreferredTab(roundObj, pkg) {
    const typeTab = defaultContentTabForType(roundObj ? roundObj.typeKey : 'custom');
    if (!pkg) return typeTab;
    if (typeTab === 'problems' && pkg.codingProblems.length > 0) return 'problems';
    if (typeTab === 'questions' && pkg.questions.length > 0) return 'questions';
    if (typeTab === 'materials' && (pkg.materials.length > 0 || (pkg.attachments && pkg.attachments.length > 0)) && pkg.questions.length === 0 && pkg.codingProblems.length === 0) {
      return 'materials';
    }
    if (pkg.questions.length > 0) return 'questions';
    if (pkg.codingProblems.length > 0) return 'problems';
    if (pkg.materials.length > 0 || (pkg.attachments && pkg.attachments.length > 0)) return 'materials';
    return typeTab;
  }

  async function resolveBinaryUrl(fileId, inlineFallback, storagePath) {
    if (storagePath && window.EventoraRoundContentApi && typeof window.EventoraRoundContentApi.getSignedDownloadUrl === 'function') {
      const signed = await window.EventoraRoundContentApi.getSignedDownloadUrl(storagePath, 900);
      if (signed && signed.ok && signed.url) {
        return { url: signed.url, isBlobUrl: false, fileName: 'document.pdf', mimeType: 'application/pdf' };
      }
    }
    if (window.EventoraFiles && typeof window.EventoraFiles.resolveBlobUrl === 'function') {
      return window.EventoraFiles.resolveBlobUrl(fileId, inlineFallback);
    }
    return { url: inlineFallback || '', isBlobUrl: false, fileName: 'document.pdf', mimeType: 'application/pdf' };
  }

  function downloadCsvOrText(fileName, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8;' });
      const url = window.URL && window.URL.createObjectURL
        ? window.URL.createObjectURL(blob)
        : `data:${mime || 'text/csv'};charset=utf-8,${encodeURIComponent(content)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (url.startsWith('blob:') && window.URL.revokeObjectURL) {
        window.setTimeout(() => { try { window.URL.revokeObjectURL(url); } catch (_) {} }, 1200);
      }
    } catch (_) {
      toast('Could not download file.');
    }
  }

  function readAndStorePdf(file, eventSlug, roundId, callbacks) {
    const cb = callbacks || {};
    if (!file || !window.EventoraStore) {
      if (cb.onError) cb.onError('No PDF file provided.');
      return;
    }
    const check = window.EventoraStore.validatePdfDescriptor({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    });
    if (!check.ok) {
      if (cb.onError) cb.onError(check.error);
      return;
    }

    if (cb.onProgress) cb.onProgress(20);
    const headerSlice = file.slice(0, 5);
    const sigReader = new FileReader();
    sigReader.onload = async () => {
      const sigText = String(sigReader.result || '');
      if (!sigText.startsWith('%PDF-')) {
        if (cb.onError) cb.onError('Selected file does not contain a valid PDF binary header (%PDF-).');
        return;
      }
      if (cb.onProgress) cb.onProgress(60);

      let smallDataUrl = '';
      if (file.size <= 120000) {
        smallDataUrl = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result || ''));
          r.onerror = () => res('');
          r.readAsDataURL(file);
        });
      }

      const evObj = window.EventoraStore.getEventBySlug(eventSlug);
      const rndObj = evObj && (evObj.rounds || []).find((r) => r.id === roundId);
      const useSupabaseStorage = window.EventoraStore.getBackendMode && window.EventoraStore.getBackendMode() === 'supabase'
        && evObj && evObj.dbId && rndObj && rndObj.dbId && window.EventoraRoundContentApi;

      let fileId = '';
      let storagePath = '';
      if (useSupabaseStorage) {
        const up = await window.EventoraRoundContentApi.uploadRoundFile({
          category: 'content',
          eventId: evObj.dbId,
          roundId: rndObj.dbId,
          file,
          onProgress: (pct) => { if (cb.onProgress) cb.onProgress(pct); }
        });
        if (!up.ok) {
          if (cb.onError) cb.onError(up.error || 'Supabase Storage upload failed.');
          return;
        }
        storagePath = up.path;
      } else if (window.EventoraFiles && typeof window.EventoraFiles.saveFile === 'function') {
        const savedBin = await window.EventoraFiles.saveFile({
          eventSlug,
          roundId,
          fileName: file.name,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
          blob: file,
          dataUrl: smallDataUrl
        });
        if (savedBin && savedBin.ok) fileId = savedBin.id;
      }

      if (cb.onProgress) cb.onProgress(100);
      if (cb.onSuccess) {
        cb.onSuccess({
          fileId,
          storagePath,
          fileName: file.name,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
          dataUrl: useSupabaseStorage ? '' : smallDataUrl
        });
      }
    };
    sigReader.onerror = () => {
      if (cb.onError) cb.onError('Failed to verify PDF signature.');
    };
    sigReader.readAsText(headerSlice);
  }

  async function readAndStoreBinaryAttachment(file, eventSlug, roundId) {
    if (!file || !window.EventoraStore) return { ok: false, error: 'Missing file.' };
    if (file.size > window.EventoraStore.MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: 'File exceeds 25 MB limit.' };
    }
    let smallDataUrl = '';
    if (file.size <= 90000 && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      smallDataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ''));
        r.onerror = () => res('');
        r.readAsDataURL(file);
      });
    }
    const evObj = window.EventoraStore.getEventBySlug(eventSlug);
    const rndObj = evObj && (evObj.rounds || []).find((r) => r.id === roundId);
    const useSupabaseStorage = window.EventoraStore.getBackendMode && window.EventoraStore.getBackendMode() === 'supabase'
      && evObj && evObj.dbId && rndObj && rndObj.dbId && window.EventoraRoundContentApi;

    let fileId = '';
    let storagePath = '';
    if (useSupabaseStorage) {
      const up = await window.EventoraRoundContentApi.uploadRoundFile({
        category: 'attachments',
        eventId: evObj.dbId,
        roundId: rndObj.dbId,
        file
      });
      if (!up.ok) return { ok: false, error: up.error || 'Supabase Storage upload failed.' };
      storagePath = up.path;
    } else if (window.EventoraFiles && typeof window.EventoraFiles.saveFile === 'function') {
      const saved = await window.EventoraFiles.saveFile({
        eventSlug,
        roundId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        blob: file,
        dataUrl: smallDataUrl
      });
      if (saved && saved.ok) fileId = saved.id;
    }
    return {
      ok: true,
      fileId,
      storagePath,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      dataUrl: useSupabaseStorage ? '' : smallDataUrl
    };
  }

  function mount(mountEl, options) {
    if (!mountEl || !window.EventoraStore) return;
    const cfg = options || {};
    const slug = cfg.slug || '';
    const readOnly = Boolean(cfg.readOnly);
    const onJumpSection = typeof cfg.onJumpSection === 'function' ? cfg.onJumpSection : null;
    const onUpdated = typeof cfg.onUpdated === 'function' ? cfg.onUpdated : null;

    const uiState = {
      selectedRoundId: cfg.initialRoundId || '',
      studioTab: '', // 'questions' | 'problems' | 'materials'
      questionSearch: '',
      showImportDrawer: false,
      importText: '',
      importPreview: null, // { ok, valid, errors, totalRows }
      // PDF draft inputs
      pdfCategory: 'Question Paper',
      pdfTitle: '',
      pdfMarks: '',
      pdfDuration: '',
      pdfQuestionCount: '',
      pdfDescription: '',
      pdfInstructions: '',
      editingPdfId: '',
      uploadProgressPct: 0,
      uploadError: '',
      previewPdf: null,
      previewPdfUrl: '',
      previewPdfUrlIsBlob: false,
      previewModalRole: 'none', // 'none' | 'participant_sim'
      simPreviewSubTab: 'overview', // 'overview' | 'quiz' | 'coding' | 'challenge'
      // Question form state
      editingQuestionId: '',
      qType: 'mcq',
      qPrompt: '',
      qCodeSnippet: '',
      qOptions: ['', '', '', ''],
      qCorrectIndex: 0,
      qCorrectIndices: [0],
      qAcceptedAnswer: '',
      qExplanation: '',
      qMarks: '2',
      qNegMarks: '0',
      qMandatory: true,
      qDifficulty: 'Medium',
      qImageFileId: '',
      qImageName: '',
      qImageDataUrl: '',
      // Coding problem form state
      editingProblemId: '',
      prTitle: '',
      prDifficulty: 'Medium',
      prPoints: '100',
      prTimeLimit: '2 Seconds',
      prStatement: '',
      prInputFormat: '',
      prOutputFormat: '',
      prConstraints: '',
      prSampleInput: '',
      prSampleOutput: '',
      prExplanation: '',
      prSubInstructions: '',
      prRubric: '',
      prLanguages: ['C', 'C++', 'Java', 'Python'],
      prStarterUrl: '',
      prPdfFileId: '',
      prPdfName: '',
      // General Attachment & Material form state
      attCategory: 'Design Image',
      attTitle: '',
      attDesc: '',
      attVisibility: 'when_unlocked',
      matCategory: 'Prompt / Brief',
      matTitle: '',
      matDescription: '',
      matUrl: '',
      matVisibility: 'when_unlocked'
    };

    function resetQuestionDraft(keepOpen) {
      uiState.editingQuestionId = '';
      uiState.qType = 'mcq';
      uiState.qPrompt = '';
      uiState.qCodeSnippet = '';
      uiState.qOptions = ['', '', '', ''];
      uiState.qCorrectIndex = 0;
      uiState.qCorrectIndices = [0];
      uiState.qAcceptedAnswer = '';
      uiState.qExplanation = '';
      uiState.qMarks = '2';
      uiState.qNegMarks = '0';
      uiState.qMandatory = true;
      uiState.qDifficulty = 'Medium';
      uiState.qImageFileId = '';
      uiState.qImageName = '';
      uiState.qImageDataUrl = '';
      if (!keepOpen) {
        uiState.showImportDrawer = false;
        uiState.importPreview = null;
      }
    }

    function resetProblemDraft() {
      uiState.editingProblemId = '';
      uiState.prTitle = '';
      uiState.prDifficulty = 'Medium';
      uiState.prPoints = '100';
      uiState.prTimeLimit = '2 Seconds';
      uiState.prStatement = '';
      uiState.prInputFormat = '';
      uiState.prOutputFormat = '';
      uiState.prConstraints = '';
      uiState.prSampleInput = '';
      uiState.prSampleOutput = '';
      uiState.prExplanation = '';
      uiState.prSubInstructions = '';
      uiState.prRubric = '';
      uiState.prLanguages = ['C', 'C++', 'Java', 'Python'];
      uiState.prStarterUrl = '';
      uiState.prPdfFileId = '';
      uiState.prPdfName = '';
    }

    function selectRound(roundObj, pkgObj) {
      uiState.selectedRoundId = roundObj ? roundObj.id : '';
      uiState.studioTab = resolvePreferredTab(roundObj, pkgObj);
      uiState.uploadError = '';
      uiState.uploadProgressPct = 0;
      uiState.editingPdfId = '';
      resetQuestionDraft();
      resetProblemDraft();
    }

    async function pushRoundPackageToPostgreSql(targetRoundId) {
      if (!window.EventoraStore.getBackendMode || window.EventoraStore.getBackendMode() !== 'supabase') return;
      if (!window.EventoraRoundContentApi) return;
      const freshEv = window.EventoraStore.getEventBySlug(slug);
      const rndObj = freshEv && (freshEv.rounds || []).find((r) => r.id === targetRoundId);
      const freshPkg = window.EventoraStore.getRoundContentPackage(slug, targetRoundId);
      if (!freshEv || !freshEv.dbId || !rndObj || !rndObj.dbId || !freshPkg) return;

      const relStat = freshPkg.contentStatus === 'Published' ? 'Published' : (freshPkg.contentStatus === 'Archived' ? 'Archived' : 'Draft');
      const metaRes = await window.EventoraRoundContentApi.saveRoundContentItem(freshEv.dbId, rndObj.dbId, {
        dbId: freshPkg.metaDbId,
        contentType: 'package_meta',
        title: freshPkg.paperTitle || `Round ${rndObj.order}`,
        description: freshPkg.description || '',
        releaseStatus: relStat,
        contentData: {
          instructions: freshPkg.instructions || '',
          totalMarks: freshPkg.totalMarks,
          durationLabel: freshPkg.durationLabel,
          declaredQuestionCount: freshPkg.declaredQuestionCount,
          availability: freshPkg.availability,
          challengeSpec: freshPkg.challengeSpec
        }
      });
      if (metaRes.ok && metaRes.data) freshPkg.metaDbId = metaRes.data.id;

      for (const p of (freshPkg.pdfs || [])) {
        const pRes = await window.EventoraRoundContentApi.saveRoundContentItem(freshEv.dbId, rndObj.dbId, {
          dbId: p.dbId,
          contentType: 'pdf_document',
          title: p.title || p.fileName,
          description: p.description || '',
          filePath: p.storagePath || '',
          releaseStatus: relStat,
          contentData: { clientId: p.id, fileName: p.fileName, mimeType: p.mimeType, sizeBytes: p.sizeBytes, category: p.category, instructions: p.instructions, totalMarks: p.totalMarks, duration: p.duration, questionCount: p.questionCount }
        });
        if (pRes.ok && pRes.data) p.dbId = pRes.data.id;
      }

      for (const att of (freshPkg.attachments || [])) {
        const aRes = await window.EventoraRoundContentApi.saveRoundContentItem(freshEv.dbId, rndObj.dbId, {
          dbId: att.dbId,
          contentType: 'attachment',
          title: att.title || att.fileName,
          description: att.description || '',
          filePath: att.storagePath || '',
          visibility: att.visibility || 'when_unlocked',
          releaseStatus: relStat,
          contentData: { clientId: att.id, fileName: att.fileName, mimeType: att.mimeType, sizeBytes: att.sizeBytes, category: att.category }
        });
        if (aRes.ok && aRes.data) att.dbId = aRes.data.id;
      }

      for (const prob of (freshPkg.codingProblems || [])) {
        const prRes = await window.EventoraRoundContentApi.saveRoundContentItem(freshEv.dbId, rndObj.dbId, {
          dbId: prob.dbId,
          contentType: 'coding_problem',
          title: prob.problemTitle,
          description: prob.statement || '',
          filePath: prob.problemPdfPath || '',
          releaseStatus: relStat,
          contentData: { ...prob, clientId: prob.id }
        });
        if (prRes.ok && prRes.data) prob.dbId = prRes.data.id;
      }

      for (const mat of (freshPkg.materials || [])) {
        const mRes = await window.EventoraRoundContentApi.saveRoundContentItem(freshEv.dbId, rndObj.dbId, {
          dbId: mat.dbId,
          contentType: 'material',
          title: mat.title,
          description: mat.description || '',
          visibility: mat.visibility || 'when_unlocked',
          releaseStatus: relStat,
          contentData: { clientId: mat.id, category: mat.category, resourceUrl: mat.resourceUrl || '' }
        });
        if (mRes.ok && mRes.data) mat.dbId = mRes.data.id;
      }

      const qRes = await window.EventoraRoundContentApi.syncRoundQuestions(freshEv.dbId, rndObj.dbId, freshPkg.questions || []);
      if (!qRes.ok) toast(qRes.error || 'Failed to sync questions to PostgreSQL.');
    }

    function applyResult(res, msg) {
      if (!res || !res.ok) {
        if (res && res.error) toast(res.error);
        return false;
      }
      if (msg) toast(msg);
      if (onUpdated && res.event) onUpdated(res.event);
      if (uiState.activeRoundId) pushRoundPackageToPostgreSql(uiState.activeRoundId);
      render();
      return true;
    }

    function renderParticipantPreviewModal(ev, round, pkg) {
      const av = pkg.availability || { mode: 'locked' };
      const isPublished = pkg.contentStatus === 'Published';
      const liveOp = ev.liveOps && ev.liveOps.roundsById[round.id];
      const isLiveNow = liveOp && liveOp.roundStatus === 'Live';

      return `
        <div class="ev-rc-modal-backdrop" id="evRcSimModal">
          <div class="ev-rc-modal ev-rc-modal-lg" role="dialog" aria-modal="true" aria-label="Organizer Content Preview">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <span class="ev-badge ev-badge-category">Organizer Preview Only (Does Not Expose to Participants)</span>
                <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;margin-top:0.25rem;">
                  Participant Experience Preview &bull; R${round.order}: ${esc(round.name)}
                </h3>
                <p style="font-size:0.82rem;color:var(--ev-muted);">
                  Release Status: <strong>${esc(pkg.contentStatus)}</strong> &bull; Rule: <strong>${esc(av.mode)}</strong> &bull;
                  PDF Download: <strong>${av.allowPdfDownload !== false ? 'Enabled' : 'Disabled'}</strong> &bull;
                  Live Round State: <strong>${esc(liveOp ? liveOp.roundStatus : 'Upcoming')}</strong>
                </p>
              </div>
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcCloseSimModalBtn">Close Preview</button>
            </div>

            <div class="ev-lc-proto-banner" style="margin-bottom:0.85rem;">
              ${!isPublished || av.mode === 'locked' || ((av.mode === 'on_round_start' || av.mode === 'live_only') && !isLiveNow)
                ? '<strong>Currently Hidden From Participants:</strong> Participants see the Lock Notice until Published AND unlocked per Live Control.'
                : '<strong>Currently Accessible to Eligible Participants:</strong> Answer keys & organizer-only materials remain stripped.'}
            </div>

            <div class="ev-lc-seg" style="margin-bottom:0.85rem;">
              <button type="button" class="ev-btn ev-btn-xs ${uiState.simPreviewSubTab === 'overview' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-sim-tab="overview">PDFs &amp; Brief</button>
              <button type="button" class="ev-btn ev-btn-xs ${uiState.simPreviewSubTab === 'quiz' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-sim-tab="quiz">Quiz Screen (${pkg.questions.length})</button>
              <button type="button" class="ev-btn ev-btn-xs ${uiState.simPreviewSubTab === 'coding' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-sim-tab="coding">Coding Screen (${pkg.codingProblems.length})</button>
              <button type="button" class="ev-btn ev-btn-xs ${uiState.simPreviewSubTab === 'challenge' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-sim-tab="challenge">Challenge Submission UI</button>
            </div>

            <div style="max-height:54vh;overflow-y:auto;display:flex;flex-direction:column;gap:0.75rem;">
              ${uiState.simPreviewSubTab === 'overview' ? `
                <div>
                  <strong style="font-size:0.95rem;">${esc(pkg.paperTitle || round.name)}</strong>
                  <p style="font-size:0.83rem;color:var(--ev-muted);margin-top:0.2rem;">${esc(pkg.instructions || round.instructions || 'No instructions entered.')}</p>
                </div>
                ${pkg.pdfs.length ? `
                  <div>
                    <div style="font-size:0.76rem;font-weight:700;text-transform:uppercase;color:var(--ev-primary);margin-bottom:0.35rem;">PDF Documents (${av.allowPdfDownload !== false ? 'Downloadable' : 'View Only — Download Disabled'})</div>
                    ${pkg.pdfs.map((p) => `<div class="ev-lc-pill" style="margin-right:0.35rem;">${esc(p.category)}: ${esc(p.title)} (${formatBytes(p.sizeBytes)})</div>`).join('')}
                  </div>
                ` : '<p style="font-size:0.82rem;color:var(--ev-muted);">No PDFs attached to preview.</p>'}
              ` : (uiState.simPreviewSubTab === 'quiz' ? `
                ${pkg.questions.length ? pkg.questions.map((q) => `
                  <div style="padding:0.7rem 0.85rem;border:1px solid var(--ev-border);border-radius:var(--ev-radius-sm);background:var(--ev-cream);">
                    <div style="font-weight:600;font-size:0.86rem;">Q${q.order}. ${esc(q.prompt)} <span class="ev-lc-pill">${q.marks}m${q.mandatory !== false ? ' • Required' : ''}</span></div>
                    ${q.options.length ? `<ul style="margin:0.35rem 0 0 1.2rem;font-size:0.8rem;color:var(--ev-muted);">${q.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
                  </div>
                `).join('') : '<p style="font-size:0.82rem;color:var(--ev-muted);">No quiz questions added.</p>'}
              ` : (uiState.simPreviewSubTab === 'coding' ? `
                ${pkg.codingProblems.length ? pkg.codingProblems.map((pr) => `
                  <div style="padding:0.75rem 0.9rem;border:1px solid var(--ev-border);border-radius:var(--ev-radius-sm);background:var(--ev-cream);">
                    <strong>${esc(pr.problemTitle)}</strong> &bull; ${esc(pr.difficulty)} &bull; ${pr.points} pts &bull; ${esc(pr.timeLimit)}
                    <p style="font-size:0.82rem;margin:0.35rem 0;">${esc(pr.statement || 'No statement.')}</p>
                    <div style="font-size:0.76rem;color:var(--ev-forest);">Participant Languages: ${esc((pr.allowedLanguages || []).join(', '))}</div>
                  </div>
                `).join('') : '<p style="font-size:0.82rem;color:var(--ev-muted);">No coding problems added.</p>'}
                <div class="ev-rc-subpanel">
                  <div style="font-size:0.82rem;font-weight:600;">Simulated Coding Submission Box</div>
                  <select class="ev-select" disabled style="margin-top:0.4rem;max-width:220px;"><option>Python (Preview)</option></select>
                  <textarea class="ev-textarea" rows="3" disabled style="margin-top:0.4rem;">// Participant code editor preview</textarea>
                </div>
              ` : `
                <div class="ev-rc-subpanel">
                  <div style="font-weight:600;font-size:0.9rem;">Participant Technical Challenge Submission Form Preview</div>
                  <p style="font-size:0.8rem;color:var(--ev-muted);margin-top:0.2rem;">${esc((pkg.challengeSpec && pkg.challengeSpec.submissionRequirements) || 'Participants submit GitHub Repo URL, Live URL, file attachment, and description.')}</p>
                  <input class="ev-input" disabled value="https://github.com/team/project (Preview)" style="margin-top:0.4rem;">
                  <input class="ev-input" disabled value="https://demo.example.com (Preview)" style="margin-top:0.4rem;">
                </div>
              `))}
            </div>
          </div>
        </div>
      `;
    }

    function renderPdfPreviewModal() {
      if (!uiState.previewPdf) return '';
      const pdf = uiState.previewPdf;
      const previewUrl = uiState.previewPdfUrl;
      return `
        <div class="ev-rc-modal-backdrop" id="evRcPdfModal">
          <div class="ev-rc-modal ev-rc-modal-lg" role="dialog" aria-modal="true" aria-label="PDF Document Preview">
            <div class="ev-ws-card-head" style="margin-bottom:0.8rem;">
              <div style="min-width:0;">
                <span class="ev-badge ev-badge-open">${esc(pdf.category)}</span>
                <h3 class="ev-display" style="font-size:1.22rem;font-weight:600;margin-top:0.25rem;">${esc(pdf.title)}</h3>
                <p style="font-size:0.8rem;color:var(--ev-muted);">${esc(pdf.fileName)} &bull; ${formatBytes(pdf.sizeBytes)} &bull; ${pdf.totalMarks || 0} marks</p>
              </div>
              <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                ${previewUrl ? `<a href="${esc(previewUrl)}" download="${esc(pdf.fileName)}" class="ev-btn ev-btn-forest ev-btn-sm">Download PDF</a>` : ''}
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcClosePdfModalBtn">Close Preview</button>
              </div>
            </div>

            ${previewUrl ? `
              <div class="ev-rc-pdf-frame-wrap">
                <iframe src="${esc(previewUrl)}" title="PDF Preview: ${esc(pdf.title)}" class="ev-rc-pdf-frame"></iframe>
              </div>
            ` : `
              <div class="ev-lc-inline-note">
                <span>Loading PDF binary payload or no PDF file attached. Upload via Replace PDF to preview inline.</span>
              </div>
            `}
          </div>
        </div>
      `;
    }

    function render() {
      const ev = window.EventoraStore.getEventBySlug(slug);
      if (!ev) {
        mountEl.innerHTML = `<div class="ev-ws-card"><p style="color:var(--ev-muted);">Event not found in EventoraStore.</p></div>`;
        return;
      }

      const rounds = Array.isArray(ev.rounds) ? ev.rounds : [];
      if (rounds.length === 0) {
        mountEl.innerHTML = `
          <div class="ev-ws-card">
            ${window.EventoraWorkspace.renderEmptyState({
              iconName: 'rounds',
              title: 'Configure Rounds First',
              message: 'Add quiz, coding, MCQ, presentation, or challenge rounds in the Phase 4 Dynamic Round Builder before attaching question papers and round materials.',
              actionHTML: onJumpSection ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRcJumpRoundsBtn">Open Round Builder &rarr;</button>' : ''
            })}
          </div>
        `;
        document.getElementById('evRcJumpRoundsBtn')?.addEventListener('click', () => onJumpSection('rounds'));
        return;
      }

      if (!uiState.selectedRoundId || !rounds.some((r) => r.id === uiState.selectedRoundId)) {
        const firstR = rounds[0];
        selectRound(firstR, window.EventoraStore.getRoundContentPackage(slug, firstR.id));
      }

      const round = rounds.find((r) => r.id === uiState.selectedRoundId) || rounds[0];
      const pkg = window.EventoraStore.getRoundContentPackage(slug, round.id);
      const summary = window.EventoraStore.getRoundContentSummary(ev, round.id);
      if (!uiState.studioTab) {
        uiState.studioTab = resolvePreferredTab(round, pkg);
      }

      const activeTab = uiState.studioTab;
      const totalQMarks = pkg.questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
      const qFilter = uiState.questionSearch.trim().toLowerCase();
      const filteredQuestions = qFilter
        ? pkg.questions.filter((q) => q.prompt.toLowerCase().includes(qFilter) || q.difficulty.toLowerCase().includes(qFilter))
        : pkg.questions;
      const chSpec = pkg.challengeSpec || {};
      const atts = Array.isArray(pkg.attachments) ? pkg.attachments : [];

      mountEl.innerHTML = `
        <div class="ev-rc-shell">
          <div class="ev-lc-proto-banner">
            <strong>IndexedDB + Local Session Prototype:</strong> Larger PDFs, reference images, ZIP files, and binary attachments store locally in browser <code>IndexedDB</code>; structured questions, coding specs, and access rules persist per event &amp; round in <code>EventoraStore</code> (not cloud-synced).
          </div>

          ${readOnly ? `
            <div class="ev-auth-status is-info">
              <span>Manager Scope active: inspect round readiness and configured materials. Modifying or publishing papers requires Event Organizer owner permissions.</span>
            </div>
          ` : ''}

          <!-- ROUND SELECTOR TABS -->
          <section class="ev-ws-card">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Phase 8 &bull; Round Content Studio</span>
                <h2 class="ev-display" style="font-size:1.45rem;font-weight:600;">${esc(ev.name)} — Round Materials &amp; Papers</h2>
                <p style="font-size:0.84rem;color:var(--ev-muted);">Manage IndexedDB PDF papers, CSV/manual MCQ banks, coding problems, challenge assets, and participant release rules.</p>
              </div>
              <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcOpenSimModalBtn">Preview Participant Screen</button>
                ${onJumpSection ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcGoBuilderBtn">Round Builder</button>` : ''}
                ${onJumpSection ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcGoLiveBtn">Live Control &rarr;</button>` : ''}
              </div>
            </div>

            <div class="ev-rc-round-tabs" role="tablist" aria-label="Configured rounds">
              ${rounds.map((r) => {
                const sm = window.EventoraStore.getRoundContentSummary(ev, r.id);
                const isSel = r.id === round.id;
                const itemCountTxt = sm.pdfCount || sm.questionCount || sm.problemCount || sm.materialCount
                  ? `${sm.pdfCount} PDF &bull; ${sm.questionCount + sm.problemCount} Q/P`
                  : 'Empty';
                return `
                  <button type="button" class="ev-rc-round-tab ${isSel ? 'is-selected' : ''}" data-rc-select-round="${esc(r.id)}" role="tab" aria-selected="${isSel ? 'true' : 'false'}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                      <span style="font-size:0.74rem;font-weight:700;color:var(--ev-primary);">Round ${r.order} &bull; ${esc(r.typeLabel)}</span>
                      <span class="ev-lc-badge ${getContentStatusBadgeClass(sm.status)}">${esc(sm.status)}</span>
                    </div>
                    <div style="font-weight:600;color:var(--ev-charcoal);font-size:0.9rem;margin-top:0.2rem;">${esc(r.name)}</div>
                    <div style="font-size:0.74rem;color:var(--ev-muted);margin-top:0.15rem;">${itemCountTxt}</div>
                  </button>
                `;
              }).join('')}
            </div>

            <div class="ev-rc-summary-strip">
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Selected Round</div>
                <div class="ev-lc-stat-val">R${round.order}: ${esc(round.name)}</div>
                <div class="ev-lc-stat-sub">${esc(round.typeLabel)} &bull; ${esc(round.duration)}</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Content Status</div>
                <div class="ev-lc-stat-val">${esc(pkg.contentStatus)}</div>
                <div class="ev-lc-stat-sub">${esc(summary.availabilityLabel.split('(')[0].trim())}</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Uploaded PDFs &amp; Assets</div>
                <div class="ev-lc-stat-val">${pkg.pdfs.length} PDF / ${atts.length} Files</div>
                <div class="ev-lc-stat-sub">Downloads: ${pkg.availability.allowPdfDownload !== false ? 'Permitted' : 'Disabled'}</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Questions &amp; Problems</div>
                <div class="ev-lc-stat-val">${pkg.questions.length} Q / ${pkg.codingProblems.length} Prob</div>
                <div class="ev-lc-stat-sub">${pkg.declaredQuestionCount != null ? `Declared paper count: ${pkg.declaredQuestionCount}` : `${totalQMarks} total question marks`}</div>
              </div>
            </div>
          </section>

          <!-- TWO-COLUMN: METADATA / RELEASE RULES & MULTI-PDF UPLOAD -->
          <div class="ev-lc-two-col">
            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                <div>
                  <span class="ev-badge ev-badge-sample" style="margin-bottom:0.3rem;">Release &amp; Live Integration</span>
                  <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Content Metadata &amp; Access Rules</h3>
                </div>
              </div>

              <form id="evRcMetaForm" style="display:flex;flex-direction:column;gap:0.72rem;" novalidate>
                <div class="ev-lc-ann-grid">
                  <div>
                    <label class="ev-field-label" for="evRcStatusSelect">Content Status</label>
                    <select class="ev-select" id="evRcStatusSelect" ${readOnly ? 'disabled' : ''}>
                      ${window.EventoraStore.CONTENT_STATUSES.map((st) => `
                        <option value="${esc(st)}" ${pkg.contentStatus === st ? 'selected' : ''}>${esc(st)}</option>
                      `).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcAvMode">Content Release Trigger</label>
                    <select class="ev-select" id="evRcAvMode" ${readOnly ? 'disabled' : ''}>
                      ${window.EventoraStore.CONTENT_AVAILABILITY_MODES.map((m) => `
                        <option value="${esc(m.key)}" ${pkg.availability.mode === m.key ? 'selected' : ''}>${esc(m.label)}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>

                <div class="ev-lc-ann-grid">
                  <div>
                    <label class="ev-field-label" for="evRcPausedPolicy">When Round Paused</label>
                    <select class="ev-select" id="evRcPausedPolicy" ${readOnly ? 'disabled' : ''}>
                      <option value="restrict" ${pkg.availability.pausedAccessPolicy !== 'allow' ? 'selected' : ''}>Restrict Access While Paused</option>
                      <option value="allow" ${pkg.availability.pausedAccessPolicy === 'allow' ? 'selected' : ''}>Allow Viewing While Paused</option>
                    </select>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcCompPolicy">After Round Completed</label>
                    <select class="ev-select" id="evRcCompPolicy" ${readOnly ? 'disabled' : ''}>
                      <option value="allow" ${pkg.availability.completedAccessPolicy !== 'restrict' ? 'selected' : ''}>Keep Readable (No New Submissions)</option>
                      <option value="restrict" ${pkg.availability.completedAccessPolicy === 'restrict' ? 'selected' : ''}>Lock Content After Completion</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="ev-field-label" for="evRcPaperTitle">Paper / Content Bundle Title</label>
                  <input type="text" class="ev-input" id="evRcPaperTitle" placeholder="e.g. Round ${round.order} Official Question Paper" value="${esc(pkg.paperTitle)}" ${readOnly ? 'disabled' : ''}>
                </div>

                <div>
                  <label class="ev-field-label" for="evRcDescription">Summary / Description</label>
                  <textarea class="ev-textarea" id="evRcDescription" rows="2" placeholder="Topics covered, paper structure, or scoring breakdown..." ${readOnly ? 'disabled' : ''}>${esc(pkg.description)}</textarea>
                </div>

                <div>
                  <label class="ev-field-label" for="evRcInstructions">Participant Instructions</label>
                  <textarea class="ev-textarea" id="evRcInstructions" rows="2" placeholder="Specific instructions shown once materials unlock..." ${readOnly ? 'disabled' : ''}>${esc(pkg.instructions)}</textarea>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.6rem;">
                  <div>
                    <label class="ev-field-label" for="evRcTotalMarks">Total Marks</label>
                    <input type="number" min="0" class="ev-input" id="evRcTotalMarks" value="${esc(pkg.totalMarks)}" ${readOnly ? 'disabled' : ''}>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcDurLabel">Duration</label>
                    <input type="text" class="ev-input" id="evRcDurLabel" value="${esc(pkg.durationLabel)}" placeholder="${esc(round.duration)}" ${readOnly ? 'disabled' : ''}>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcDeclaredCount">Question Count</label>
                    <input type="number" min="0" class="ev-input" id="evRcDeclaredCount" value="${pkg.declaredQuestionCount != null ? esc(pkg.declaredQuestionCount) : ''}" placeholder="${pkg.questions.length || 'Auto'}" ${readOnly ? 'disabled' : ''}>
                  </div>
                </div>

                <div>
                  <label class="ev-field-label" for="evRcReleaseAt">Scheduled Unlock Time (When Scheduled Mode Active)</label>
                  <input type="datetime-local" class="ev-input" id="evRcReleaseAt" value="${esc(pkg.availability.releaseAt)}" ${readOnly ? 'disabled' : ''}>
                </div>

                <div style="display:flex;flex-direction:column;gap:0.38rem;">
                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.81rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evRcAllowPdfDl" ${pkg.availability.allowPdfDownload !== false ? 'checked' : ''} ${readOnly ? 'disabled' : ''}>
                    <span>Permit Participants to Download PDFs</span>
                  </label>
                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.81rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evRcAllowAttDl" ${pkg.availability.allowAttachmentDownload !== false ? 'checked' : ''} ${readOnly ? 'disabled' : ''}>
                    <span>Permit Participants to Download Starter Files &amp; Attachments</span>
                  </label>
                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.81rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evRcReqApproved" ${pkg.availability.requireApprovedRegistration !== false ? 'checked' : ''} ${readOnly ? 'disabled' : ''}>
                    <span>Require Approved Registration before access</span>
                  </label>
                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.81rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evRcHideKeys" ${pkg.availability.hideAnswerKeysFromParticipants !== false ? 'checked' : ''} ${readOnly ? 'disabled' : ''}>
                    <span>Strip answer keys &amp; explanations from participant exports</span>
                  </label>
                </div>

                ${!readOnly ? `
                  <div style="display:flex;justify-content:flex-end;">
                    <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Save Content &amp; Release Rules</button>
                  </div>
                ` : ''}
              </form>
            </section>

            <!-- PANEL 2: MULTI-PDF QUESTION PAPER & DOCUMENT UPLOAD -->
            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                <div>
                  <span class="ev-badge ev-badge-open" style="margin-bottom:0.3rem;">IndexedDB Multi-PDF</span>
                  <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">PDF Question Papers &amp; Docs</h3>
                </div>
                <span class="ev-lc-pill">${pkg.pdfs.length} Uploaded</span>
              </div>

              ${!readOnly ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;margin-bottom:0.65rem;">
                  <div>
                    <label class="ev-field-label" for="evRcPdfCat">Document Role</label>
                    <select class="ev-select" id="evRcPdfCat">
                      ${window.EventoraStore.PDF_CATEGORIES.map((c) => `<option value="${esc(c)}" ${uiState.pdfCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcPdfTitle">Document Title</label>
                    <input type="text" class="ev-input" id="evRcPdfTitle" placeholder="Defaults to filename" value="${esc(uiState.pdfTitle)}">
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.55rem;margin-bottom:0.75rem;">
                  <div>
                    <label class="ev-field-label" for="evRcPdfMarks">Marks</label>
                    <input type="number" min="0" class="ev-input" id="evRcPdfMarks" placeholder="${pkg.totalMarks || 100}" value="${esc(uiState.pdfMarks)}">
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcPdfDur">Duration</label>
                    <input type="text" class="ev-input" id="evRcPdfDur" placeholder="${esc(round.duration)}" value="${esc(uiState.pdfDuration)}">
                  </div>
                  <div>
                    <label class="ev-field-label" for="evRcPdfQCount">Questions</label>
                    <input type="number" min="0" class="ev-input" id="evRcPdfQCount" placeholder="e.g. 30" value="${esc(uiState.pdfQuestionCount)}">
                  </div>
                </div>

                <div class="ev-rc-dropzone" id="evRcDropzone" tabindex="0" role="button" aria-label="Drag and drop PDF file or click to select">
                  <input type="file" id="evRcPdfInput" accept=".pdf,application/pdf" hidden>
                  <input type="file" id="evRcPdfReplaceInput" accept=".pdf,application/pdf" hidden>
                  <div style="font-weight:700;color:var(--ev-forest);font-size:0.92rem;">Drag &amp; Drop PDF Here or Browse File</div>
                  <div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.25rem;">Validates <code>%PDF-</code> signature &bull; Max 20 MB via IndexedDB &bull; Supports multiple PDFs per round</div>
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcBrowsePdfBtn" style="margin-top:0.55rem;">Choose PDF File</button>
                </div>

                ${uiState.uploadProgressPct > 0 ? `
                  <div style="margin-top:0.6rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--ev-forest);margin-bottom:0.25rem;">
                      <span>Storing PDF binary in local IndexedDB...</span>
                      <strong>${uiState.uploadProgressPct}%</strong>
                    </div>
                    <div class="ev-tm-cap-bar"><div class="ev-tm-cap-fill" style="width:${uiState.uploadProgressPct}%;"></div></div>
                  </div>
                ` : ''}

                ${uiState.uploadError ? `
                  <div class="ev-lc-alert ev-lc-alert-danger" style="margin-top:0.6rem;">${esc(uiState.uploadError)}</div>
                ` : ''}
              ` : ''}

              <div class="ev-rc-pdf-list" style="margin-top:0.9rem;">
                ${pkg.pdfs.length === 0 ? `
                  <div class="ev-lc-inline-note">
                    <span>No PDF files attached to Round ${round.order} yet.</span>
                  </div>
                ` : pkg.pdfs.map((pdf) => `
                  <article class="ev-rc-pdf-card">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
                      <div style="min-width:0;flex:1;">
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.25rem;">
                          <span class="ev-lc-badge ev-lc-badge-submitted">${esc(pdf.category)}</span>
                          <span class="ev-lc-pill">${formatBytes(pdf.sizeBytes)}</span>
                          ${pdf.fileId ? '<span class="ev-lc-pill">IndexedDB</span>' : ''}
                          ${pdf.totalMarks ? `<span class="ev-lc-pill">${pdf.totalMarks} marks</span>` : ''}
                          ${pdf.questionCount != null ? `<span class="ev-lc-pill">${pdf.questionCount} Q</span>` : ''}
                        </div>
                        <strong style="display:block;font-size:0.94rem;color:var(--ev-charcoal);">${esc(pdf.title)}</strong>
                        <div style="font-size:0.76rem;color:var(--ev-muted);margin-top:0.12rem;">
                          ${esc(pdf.fileName)} &bull; Uploaded ${formatDateShort(pdf.uploadedAt)}
                        </div>
                        ${pdf.description ? `<p style="font-size:0.8rem;color:var(--ev-muted);margin-top:0.3rem;">${esc(pdf.description)}</p>` : ''}
                      </div>
                      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-rc-pdf-preview="${esc(pdf.id)}">Preview</button>
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pdf-dl="${esc(pdf.id)}">Download</button>
                        ${!readOnly ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pdf-replace="${esc(pdf.id)}">Replace</button>` : ''}
                        ${!readOnly ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pdf-edit="${esc(pdf.id)}">Edit Meta</button>` : ''}
                        ${!readOnly ? `<button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-rc-pdf-del="${esc(pdf.id)}">Remove</button>` : ''}
                      </div>
                    </div>

                    ${uiState.editingPdfId === pdf.id && !readOnly ? `
                      <div class="ev-rc-pdf-meta-edit">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                          <input type="text" class="ev-input" data-rc-pdf-mf="title" value="${esc(pdf.title)}" placeholder="Title">
                          <select class="ev-select" data-rc-pdf-mf="category">
                            ${window.EventoraStore.PDF_CATEGORIES.map((c) => `<option value="${esc(c)}" ${pdf.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                          </select>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-top:0.45rem;">
                          <input type="number" class="ev-input" data-rc-pdf-mf="totalMarks" value="${esc(pdf.totalMarks)}" placeholder="Marks">
                          <input type="text" class="ev-input" data-rc-pdf-mf="duration" value="${esc(pdf.duration)}" placeholder="Duration">
                          <input type="number" class="ev-input" data-rc-pdf-mf="questionCount" value="${pdf.questionCount != null ? esc(pdf.questionCount) : ''}" placeholder="Question count">
                        </div>
                        <input type="text" class="ev-input" style="margin-top:0.45rem;" data-rc-pdf-mf="description" value="${esc(pdf.description)}" placeholder="PDF notes / description">
                        <input type="text" class="ev-input" style="margin-top:0.45rem;" data-rc-pdf-mf="instructions" value="${esc(pdf.instructions)}" placeholder="PDF participant instructions">
                        <div style="display:flex;gap:0.4rem;justify-content:flex-end;margin-top:0.5rem;">
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcCancelPdfMetaBtn">Cancel</button>
                          <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-rc-save-pdf-meta="${esc(pdf.id)}">Save PDF Info</button>
                        </div>
                      </div>
                    ` : ''}
                  </article>
                `).join('')}
              </div>
            </section>
          </div>

          <!-- SECTION 3: AUTHORING STUDIO (MCQ + CSV, CODING, CHALLENGE ASSETS) -->
          <section class="ev-ws-card">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Authoring Studio &bull; ${esc(round.typeLabel)}</span>
                <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;">Questions, Coding Tasks &amp; Challenge Materials</h3>
              </div>
              <div class="ev-lc-seg">
                <button type="button" class="ev-btn ev-btn-sm ${activeTab === 'questions' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-tab="questions">
                  Questions (${pkg.questions.length})
                </button>
                <button type="button" class="ev-btn ev-btn-sm ${activeTab === 'problems' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-tab="problems">
                  Coding Problems (${pkg.codingProblems.length})
                </button>
                <button type="button" class="ev-btn ev-btn-sm ${activeTab === 'materials' ? 'ev-btn-forest' : 'ev-btn-outline'}" data-rc-tab="materials">
                  Challenge Assets &amp; Files (${atts.length + pkg.materials.length})
                </button>
              </div>
            </div>

            ${activeTab === 'questions' ? `
              ${!readOnly ? `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.65rem;flex-wrap:wrap;margin-bottom:0.9rem;">
                  <div style="font-size:0.84rem;color:var(--ev-muted);">
                    <strong>${pkg.questions.length}</strong> question(s) &bull; Total Quiz Marks: <strong>${totalQMarks}</strong>
                  </div>
                  <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcToggleImportBtn">
                      ${uiState.showImportDrawer ? 'Hide CSV / JSON Import' : '+ Import CSV Questions'}
                    </button>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcSaveDraftQuizBtn">Save Draft</button>
                    <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRcPublishQuizBtn">Publish Round Content</button>
                  </div>
                </div>

                ${uiState.showImportDrawer ? `
                  <div class="ev-rc-subpanel" style="margin-bottom:1.1rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                      <strong style="font-size:0.92rem;color:var(--ev-forest);">CSV / Pipe / JSON Question Import</strong>
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcDlSampleCsvBtn">Download Sample CSV</button>
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcBrowseCsvBtn">Upload .CSV File</button>
                        <input type="file" id="evRcCsvFileInput" accept=".csv,text/csv" hidden>
                      </div>
                    </div>
                    <p style="font-size:0.78rem;color:var(--ev-muted);margin-bottom:0.5rem;">
                      Validates missing questions, missing options, invalid answers, duplicate prompts, and invalid marks before importing.
                    </p>
                    <textarea class="ev-textarea" id="evRcImportTextarea" rows="4" placeholder="question_type,prompt,option_a,option_b,option_c,option_d,correct_answer,marks,negative_marks,mandatory,explanation">${esc(uiState.importText)}</textarea>
                    <div style="display:flex;justify-content:flex-end;gap:0.45rem;margin-top:0.55rem;flex-wrap:wrap;">
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRcPreviewCsvBtn">1. Validate &amp; Preview Rows</button>
                      ${uiState.importPreview && uiState.importPreview.valid.length > 0 ? `
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRcConfirmImportBtn">2. Confirm Import (${uiState.importPreview.valid.length} Valid)</button>
                      ` : ''}
                    </div>
                    ${uiState.importPreview ? `
                      <div style="margin-top:0.65rem;padding:0.65rem 0.8rem;border-radius:var(--ev-radius-sm);background:var(--ev-cream);border:1px solid var(--ev-border);font-size:0.8rem;">
                        <div><strong>Preview Result:</strong> ${uiState.importPreview.valid.length} valid question(s) ready &bull; ${uiState.importPreview.errors.length} error(s)/duplicate(s)</div>
                        ${uiState.importPreview.errors.length ? `
                          <ul style="margin:0.35rem 0 0 1.2rem;color:#9e2a20;">
                            ${uiState.importPreview.errors.slice(0, 8).map((er) => `<li>${esc(er)}</li>`).join('')}
                          </ul>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <form id="evRcQuestionForm" class="ev-rc-subpanel" style="margin-bottom:1.15rem;" novalidate>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.65rem;">
                    <strong style="font-size:0.94rem;color:var(--ev-charcoal);">
                      ${uiState.editingQuestionId ? 'Edit Question' : 'Add Manual Question'}
                    </strong>
                    ${uiState.editingQuestionId ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcCancelEditQBtn">Cancel Edit</button>` : ''}
                  </div>

                  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcQType">Type</label>
                      <select class="ev-select" id="evRcQType">
                        ${window.EventoraStore.QUESTION_TYPES.map((t) => `<option value="${esc(t.key)}" ${uiState.qType === t.key ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcQDiff">Difficulty</label>
                      <select class="ev-select" id="evRcQDiff">
                        ${window.EventoraStore.DIFFICULTY_LEVELS.map((d) => `<option value="${esc(d)}" ${uiState.qDifficulty === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcQMarks">Marks</label>
                      <input type="number" min="0" step="0.5" class="ev-input" id="evRcQMarks" value="${esc(uiState.qMarks)}">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcQNegMarks">Negative Marks</label>
                      <input type="number" min="0" step="0.25" class="ev-input" id="evRcQNegMarks" value="${esc(uiState.qNegMarks)}">
                    </div>
                  </div>

                  <div style="margin-top:0.65rem;">
                    <label class="ev-field-label" for="evRcQPrompt">Question Prompt *</label>
                    <textarea class="ev-textarea" id="evRcQPrompt" rows="2" placeholder="Write question statement clearly...">${esc(uiState.qPrompt)}</textarea>
                  </div>

                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcQCode">Code / Logic Snippet (Optional)</label>
                      <textarea class="ev-textarea" id="evRcQCode" rows="2" style="font-family:monospace;font-size:0.82rem;">${esc(uiState.qCodeSnippet)}</textarea>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcQImgInput">Optional Question Image (IndexedDB)</label>
                      <div style="display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;">
                        <input type="file" id="evRcQImgInput" accept="image/*" class="ev-input" style="padding:0.35rem;font-size:0.78rem;flex:1;">
                        ${uiState.qImageName ? `<span class="ev-lc-pill">${esc(uiState.qImageName)}</span><button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcClearQImgBtn">Clear</button>` : ''}
                      </div>
                      <label style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;margin-top:0.45rem;">
                        <input type="checkbox" id="evRcQMandatory" ${uiState.qMandatory ? 'checked' : ''}>
                        <span>Mandatory Question</span>
                      </label>
                    </div>
                  </div>

                  ${uiState.qType === 'short_answer' ? `
                    <div style="margin-top:0.6rem;">
                      <label class="ev-field-label" for="evRcQAcceptedAns">Expected Answer / Solution Key (Hidden from Participants)</label>
                      <input type="text" class="ev-input" id="evRcQAcceptedAns" value="${esc(uiState.qAcceptedAnswer)}" placeholder="e.g. O(log n)">
                    </div>
                  ` : `
                    <div style="margin-top:0.65rem;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
                        <label class="ev-field-label" style="margin:0;">Options (${uiState.qType === 'mcq_multi' ? 'Select all correct answers' : 'Select Correct Answer'} — stripped from participants)</label>
                        ${(uiState.qType === 'mcq' || uiState.qType === 'mcq_multi') && uiState.qOptions.length < 6 ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcAddOptBtn">+ Option</button>` : ''}
                      </div>
                      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.5rem;">
                        ${(uiState.qType === 'true_false' ? ['True', 'False'] : uiState.qOptions).map((optVal, oIdx) => `
                          <div style="display:flex;align-items:center;gap:0.45rem;">
                            ${uiState.qType === 'mcq_multi'
                              ? `<input type="checkbox" name="evRcCorrectMultiOpt" value="${oIdx}" ${(uiState.qCorrectIndices || []).includes(oIdx) ? 'checked' : ''}>`
                              : `<input type="radio" name="evRcCorrectOpt" value="${oIdx}" ${uiState.qCorrectIndex === oIdx ? 'checked' : ''}>`}
                            <input type="text" class="ev-input" data-rc-opt-idx="${oIdx}" value="${esc(optVal)}" placeholder="Option ${String.fromCharCode(65 + oIdx)}" ${uiState.qType === 'true_false' ? 'readonly' : ''}>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `}

                  <div style="margin-top:0.6rem;">
                    <label class="ev-field-label" for="evRcQExplanation">Solution Explanation (Organizer Only)</label>
                    <input type="text" class="ev-input" id="evRcQExplanation" value="${esc(uiState.qExplanation)}" placeholder="Visible only in organizer review">
                  </div>

                  <div style="display:flex;justify-content:flex-end;margin-top:0.75rem;">
                    <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">${uiState.editingQuestionId ? 'Save Question Changes' : '+ Add Question'}</button>
                  </div>
                </form>
              ` : ''}

              ${pkg.questions.length > 0 ? `
                <div style="display:flex;gap:0.6rem;margin-bottom:0.75rem;flex-wrap:wrap;">
                  <input type="search" class="ev-input" id="evRcQSearch" value="${esc(uiState.questionSearch)}" placeholder="Search saved questions..." style="max-width:340px;">
                </div>
              ` : ''}

              ${filteredQuestions.length === 0 ? `
                <div class="ev-lc-inline-note">
                  <span>${pkg.questions.length === 0 ? 'No structured questions created yet for this round. Add questions manually, import CSV, or attach a PDF paper above.' : 'No questions match your search.'}</span>
                </div>
              ` : `
                <div class="ev-rc-items-list">
                  ${filteredQuestions.map((q, idx) => `
                    <article class="ev-rc-item-card">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.6rem;flex-wrap:wrap;">
                        <div style="min-width:0;flex:1;">
                          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;margin-bottom:0.25rem;">
                            <span class="ev-lc-badge ev-lc-badge-upcoming">Q${q.order}</span>
                            <span class="ev-lc-pill">${esc(q.questionType.toUpperCase())}</span>
                            <span class="ev-lc-pill">${esc(q.difficulty)}</span>
                            <span class="ev-lc-pill">${q.marks}m${q.negativeMarks ? ` (-${q.negativeMarks})` : ''}</span>
                            ${q.mandatory !== false ? '<span class="ev-lc-pill">Required</span>' : '<span class="ev-lc-pill">Optional</span>'}
                            ${q.imageName ? `<span class="ev-lc-pill">Img: ${esc(q.imageName)}</span>` : ''}
                          </div>
                          <div style="font-weight:600;color:var(--ev-charcoal);font-size:0.94rem;">${esc(q.prompt)}</div>
                          ${q.codeSnippet ? `<pre class="ev-rc-code">${esc(q.codeSnippet)}</pre>` : ''}
                          ${q.options.length ? `
                            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.35rem;margin-top:0.45rem;">
                              ${q.options.map((opt, oi) => {
                                const isCorr = q.questionType === 'mcq_multi'
                                  ? (Array.isArray(q.correctOptionIndices) && q.correctOptionIndices.includes(oi))
                                  : (oi === q.correctOptionIndex);
                                return `
                                  <div class="ev-rc-opt-chip ${isCorr ? 'is-correct' : ''}">
                                    <strong>${String.fromCharCode(65 + oi)}.</strong> ${esc(opt)}
                                    ${isCorr ? ' &check;' : ''}
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          ` : ''}
                          ${q.acceptedAnswer ? `<div style="font-size:0.8rem;color:var(--ev-forest);margin-top:0.35rem;"><strong>Key:</strong> ${esc(q.acceptedAnswer)}</div>` : ''}
                          ${q.explanation ? `<div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.2rem;">Note: ${esc(q.explanation)}</div>` : ''}
                        </div>
                        ${!readOnly ? `
                          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-q-up="${esc(q.id)}" ${idx === 0 ? 'disabled' : ''}>&uarr;</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-q-down="${esc(q.id)}" ${idx === filteredQuestions.length - 1 ? 'disabled' : ''}>&darr;</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-q-dup="${esc(q.id)}">Duplicate</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-q-edit="${esc(q.id)}">Edit</button>
                            <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-rc-q-del="${esc(q.id)}">Delete</button>
                          </div>
                        ` : ''}
                      </div>
                    </article>
                  `).join('')}
                </div>
              `}
            ` : (activeTab === 'problems' ? `
              ${!readOnly ? `
                <form id="evRcProblemForm" class="ev-rc-subpanel" style="margin-bottom:1.15rem;" novalidate>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem;">
                    <strong style="font-size:0.94rem;color:var(--ev-charcoal);">
                      ${uiState.editingProblemId ? 'Edit Coding Problem' : 'Add Coding Competition Problem'}
                    </strong>
                    ${uiState.editingProblemId ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRcCancelEditPBtn">Cancel Edit</button>` : ''}
                  </div>
                  <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrTitle">Problem Title *</label>
                      <input type="text" class="ev-input" id="evRcPrTitle" value="${esc(uiState.prTitle)}" placeholder="e.g. Campus Shuttle Graph Optimizer">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrDiff">Difficulty</label>
                      <select class="ev-select" id="evRcPrDiff">
                        ${window.EventoraStore.DIFFICULTY_LEVELS.map((d) => `<option value="${esc(d)}" ${uiState.prDifficulty === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrPts">Max Marks</label>
                      <input type="number" min="1" class="ev-input" id="evRcPrPts" value="${esc(uiState.prPoints)}">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrTimeLimit">Time Limit</label>
                      <input type="text" class="ev-input" id="evRcPrTimeLimit" value="${esc(uiState.prTimeLimit)}" placeholder="2 Seconds">
                    </div>
                  </div>
                  <div style="margin-top:0.55rem;">
                    <label class="ev-field-label" for="evRcPrStmt">Problem Description / Statement</label>
                    <textarea class="ev-textarea" id="evRcPrStmt" rows="3">${esc(uiState.prStatement)}</textarea>
                  </div>
                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrInputFmt">Input Format</label>
                      <textarea class="ev-textarea" id="evRcPrInputFmt" rows="2">${esc(uiState.prInputFormat)}</textarea>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrOutputFmt">Output Format</label>
                      <textarea class="ev-textarea" id="evRcPrOutputFmt" rows="2">${esc(uiState.prOutputFormat)}</textarea>
                    </div>
                  </div>
                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrConstraints">Constraints</label>
                      <input type="text" class="ev-input" id="evRcPrConstraints" value="${esc(uiState.prConstraints)}" placeholder="1 <= N <= 10^5">
                    </div>
                    <div>
                      <label class="ev-field-label">Allowed Programming Languages</label>
                      <div style="display:flex;gap:0.65rem;flex-wrap:wrap;padding-top:0.3rem;">
                        ${window.EventoraStore.CODING_LANGUAGES.map((lang) => `
                          <label style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.82rem;">
                            <input type="checkbox" name="evRcPrLang" value="${esc(lang)}" ${(uiState.prLanguages || []).includes(lang) ? 'checked' : ''}>
                            ${esc(lang)}
                          </label>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrSampleIn">Sample Input</label>
                      <textarea class="ev-textarea" id="evRcPrSampleIn" rows="2" style="font-family:monospace;font-size:0.8rem;">${esc(uiState.prSampleInput)}</textarea>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrSampleOut">Sample Output</label>
                      <textarea class="ev-textarea" id="evRcPrSampleOut" rows="2" style="font-family:monospace;font-size:0.8rem;">${esc(uiState.prSampleOutput)}</textarea>
                    </div>
                  </div>
                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrExplanation">Sample Explanation</label>
                      <input type="text" class="ev-input" id="evRcPrExplanation" value="${esc(uiState.prExplanation)}" placeholder="Explain sample I/O walkthrough">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrPdfInput">Problem-Specific PDF (IndexedDB)</label>
                      <div style="display:flex;gap:0.4rem;align-items:center;">
                        <input type="file" id="evRcPrPdfInput" accept=".pdf,application/pdf" class="ev-input" style="padding:0.35rem;font-size:0.78rem;flex:1;">
                        ${uiState.prPdfName ? `<span class="ev-lc-pill">${esc(uiState.prPdfName)}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evRcPrSubInst">Submission Instructions</label>
                      <input type="text" class="ev-input" id="evRcPrSubInst" value="${esc(uiState.prSubInstructions)}" placeholder="Include helper complexity comments">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evRcPrStarterUrl">Starter Repo / Reference Link</label>
                      <input type="url" class="ev-input" id="evRcPrStarterUrl" value="${esc(uiState.prStarterUrl)}" placeholder="https://...">
                    </div>
                  </div>
                  <div style="display:flex;justify-content:flex-end;margin-top:0.75rem;">
                    <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">${uiState.editingProblemId ? 'Update Problem' : '+ Add Coding Problem'}</button>
                  </div>
                </form>
              ` : ''}

              ${pkg.codingProblems.length === 0 ? `
                <div class="ev-lc-inline-note">
                  <span>No coding problems configured for Round ${round.order} yet.</span>
                </div>
              ` : `
                <div class="ev-rc-items-list">
                  ${pkg.codingProblems.map((pr, pIdx) => `
                    <article class="ev-rc-item-card">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.6rem;flex-wrap:wrap;">
                        <div style="min-width:0;flex:1;">
                          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;margin-bottom:0.25rem;">
                            <span class="ev-lc-badge ev-lc-badge-submitted">Problem ${pr.order}</span>
                            <span class="ev-lc-pill">${esc(pr.difficulty)}</span>
                            <span class="ev-lc-pill">${pr.points} pts</span>
                            <span class="ev-lc-pill">${esc(pr.timeLimit || '2s')}</span>
                            <span class="ev-lc-pill">${esc((pr.allowedLanguages || []).join('/'))}</span>
                            ${pr.problemPdfName ? `<span class="ev-lc-pill">PDF: ${esc(pr.problemPdfName)}</span>` : ''}
                          </div>
                          <strong style="font-size:0.98rem;color:var(--ev-charcoal);">${esc(pr.problemTitle)}</strong>
                          ${pr.statement ? `<p style="font-size:0.83rem;color:var(--ev-body);margin-top:0.3rem;white-space:pre-line;">${esc(pr.statement)}</p>` : ''}
                          ${pr.constraints ? `<div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.25rem;"><strong>Constraints:</strong> ${esc(pr.constraints)}</div>` : ''}
                          ${(pr.sampleInput || pr.sampleOutput) ? `
                            <div class="ev-lc-ann-grid" style="margin-top:0.45rem;">
                              <pre class="ev-rc-code">Input:\n${esc(pr.sampleInput || '—')}</pre>
                              <pre class="ev-rc-code">Output:\n${esc(pr.sampleOutput || '—')}</pre>
                            </div>
                          ` : ''}
                          ${pr.explanation ? `<div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.25rem;">Explanation: ${esc(pr.explanation)}</div>` : ''}
                        </div>
                        ${!readOnly ? `
                          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pr-up="${esc(pr.id)}" ${pIdx === 0 ? 'disabled' : ''}>&uarr;</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pr-down="${esc(pr.id)}" ${pIdx === pkg.codingProblems.length - 1 ? 'disabled' : ''}>&darr;</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pr-dup="${esc(pr.id)}">Duplicate</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-pr-edit="${esc(pr.id)}">Edit</button>
                            <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-rc-pr-del="${esc(pr.id)}">Delete</button>
                          </div>
                        ` : ''}
                      </div>
                    </article>
                  `).join('')}
                </div>
              `}
            ` : `
              <!-- CHALLENGE MATERIALS, FRONTEND ASSETS, ZIPs, IMAGES & SUBMISSION RULES -->
              <div class="ev-lc-two-col">
                <div>
                  ${!readOnly ? `
                    <form id="evRcChallengeSpecForm" class="ev-rc-subpanel" style="margin-bottom:1rem;" novalidate>
                      <strong style="display:block;font-size:0.94rem;color:var(--ev-charcoal);margin-bottom:0.55rem;">Frontend / Technical / Stage Submission Rules</strong>
                      <div style="margin-bottom:0.55rem;">
                        <label class="ev-field-label" for="evRcChTaskDesc">Challenge Brief / Task Description</label>
                        <textarea class="ev-textarea" id="evRcChTaskDesc" rows="2">${esc(chSpec.taskDescription || '')}</textarea>
                      </div>
                      <div class="ev-lc-ann-grid" style="margin-bottom:0.55rem;">
                        <div>
                          <label class="ev-field-label" for="evRcChSubReq">Submission Requirements</label>
                          <input type="text" class="ev-input" id="evRcChSubReq" value="${esc(chSpec.submissionRequirements || '')}" placeholder="e.g. Live deployed URL + GitHub repo">
                        </div>
                        <div>
                          <label class="ev-field-label" for="evRcChEvalGuide">Evaluation Guidelines</label>
                          <input type="text" class="ev-input" id="evRcChEvalGuide" value="${esc(chSpec.evaluationGuidelines || '')}" placeholder="UI Craft, Responsiveness, Accessibility">
                        </div>
                      </div>
                      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;font-size:0.8rem;margin-bottom:0.6rem;">
                        <label><input type="checkbox" id="evRcChRepo" ${chSpec.allowRepoUrl !== false ? 'checked' : ''}> GitHub Repo URL</label>
                        <label><input type="checkbox" id="evRcChLive" ${chSpec.allowLiveUrl !== false ? 'checked' : ''}> Live Website URL</label>
                        <label><input type="checkbox" id="evRcChFile" ${chSpec.allowFileAttachment !== false ? 'checked' : ''}> File Attachment</label>
                        <label><input type="checkbox" id="evRcChText" ${chSpec.allowTextDescription !== false ? 'checked' : ''}> Text Description</label>
                      </div>
                      <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Save Challenge Specs</button>
                    </form>

                    <form id="evRcMatForm" class="ev-rc-subpanel" novalidate>
                      <strong style="display:block;font-size:0.94rem;color:var(--ev-charcoal);margin-bottom:0.55rem;">Add Reference Link / Rubric Note</strong>
                      <div class="ev-lc-ann-grid">
                        <div>
                          <label class="ev-field-label" for="evRcMatCat">Material Category</label>
                          <select class="ev-select" id="evRcMatCat">
                            ${window.EventoraStore.MATERIAL_CATEGORIES.map((c) => `<option value="${esc(c)}" ${uiState.matCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                          </select>
                        </div>
                        <div>
                          <label class="ev-field-label" for="evRcMatVis">Visibility</label>
                          <select class="ev-select" id="evRcMatVis">
                            <option value="when_unlocked" ${uiState.matVisibility === 'when_unlocked' ? 'selected' : ''}>Show When Round Unlocks</option>
                            <option value="organizer_only" ${uiState.matVisibility === 'organizer_only' ? 'selected' : ''}>Organizer / Jury Internal Only</option>
                          </select>
                        </div>
                      </div>
                      <div class="ev-lc-ann-grid" style="margin-top:0.55rem;">
                        <div>
                          <label class="ev-field-label" for="evRcMatTitle">Title *</label>
                          <input type="text" class="ev-input" id="evRcMatTitle" value="${esc(uiState.matTitle)}" placeholder="e.g. Figma Design Kit / Rubric">
                        </div>
                        <div>
                          <label class="ev-field-label" for="evRcMatUrl">Reference URL (Optional)</label>
                          <input type="url" class="ev-input" id="evRcMatUrl" value="${esc(uiState.matUrl)}" placeholder="https://...">
                        </div>
                      </div>
                      <div style="margin-top:0.55rem;">
                        <label class="ev-field-label" for="evRcMatDesc">Instructions / Notes</label>
                        <textarea class="ev-textarea" id="evRcMatDesc" rows="2">${esc(uiState.matDescription)}</textarea>
                      </div>
                      <div style="display:flex;justify-content:flex-end;margin-top:0.65rem;">
                        <button type="submit" class="ev-btn ev-btn-outline ev-btn-sm">+ Add Material</button>
                      </div>
                    </form>
                  ` : ''}
                </div>

                <div>
                  ${!readOnly ? `
                    <div class="ev-rc-subpanel" style="margin-bottom:1rem;">
                      <strong style="display:block;font-size:0.94rem;color:var(--ev-charcoal);margin-bottom:0.55rem;">Upload Starter Files, Design Images, ZIPs &amp; Assets (IndexedDB)</strong>
                      <div class="ev-lc-ann-grid" style="margin-bottom:0.55rem;">
                        <div>
                          <label class="ev-field-label" for="evRcAttCat">Attachment Type</label>
                          <select class="ev-select" id="evRcAttCat">
                            ${window.EventoraStore.ATTACHMENT_CATEGORIES.map((c) => `<option value="${esc(c)}" ${uiState.attCategory === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                          </select>
                        </div>
                        <div>
                          <label class="ev-field-label" for="evRcAttTitle">Label (Optional)</label>
                          <input type="text" class="ev-input" id="evRcAttTitle" value="${esc(uiState.attTitle)}" placeholder="e.g. Starter Boilerplate ZIP">
                        </div>
                      </div>
                      <input type="file" id="evRcAttFileInput" class="ev-input" accept="image/*,.zip,.pdf,.txt,.json,.md,.html,.css,.js" style="padding:0.4rem;">
                    </div>
                  ` : ''}

                  <div class="ev-rc-items-list">
                    ${atts.map((att) => `
                      <article class="ev-rc-item-card">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
                          <div>
                            <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.2rem;">
                              <span class="ev-lc-badge ev-lc-badge-submitted">${esc(att.category)}</span>
                              <span class="ev-lc-pill">${formatBytes(att.sizeBytes)}</span>
                            </div>
                            <strong style="font-size:0.9rem;">${esc(att.title)}</strong>
                            <div style="font-size:0.76rem;color:var(--ev-muted);">${esc(att.fileName)}</div>
                          </div>
                          <div style="display:flex;gap:0.3rem;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rc-att-dl="${esc(att.id)}">Download</button>
                            ${!readOnly ? `<button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-rc-att-del="${esc(att.id)}">Remove</button>` : ''}
                          </div>
                        </div>
                      </article>
                    `).join('')}

                    ${pkg.materials.map((m) => `
                      <article class="ev-rc-item-card">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
                          <div>
                            <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.2rem;">
                              <span class="ev-lc-badge ev-lc-badge-upcoming">${esc(m.category)}</span>
                              <span class="ev-lc-pill">${m.visibility === 'organizer_only' ? 'Internal Only' : 'Participant Visible'}</span>
                            </div>
                            <strong style="font-size:0.9rem;">${esc(m.title)}</strong>
                            ${m.description ? `<p style="font-size:0.8rem;color:var(--ev-muted);margin:0.2rem 0;">${esc(m.description)}</p>` : ''}
                            ${m.resourceUrl ? `<a href="${esc(m.resourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:var(--ev-forest);font-weight:600;">${esc(m.resourceUrl)} &rarr;</a>` : ''}
                          </div>
                          ${!readOnly ? `<button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-rc-mat-del="${esc(m.id)}">Remove</button>` : ''}
                        </div>
                      </article>
                    `).join('')}

                    ${(atts.length === 0 && pkg.materials.length === 0) ? `
                      <div class="ev-lc-inline-note"><span>No design images, starter ZIPs, or challenge materials added yet.</span></div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `)}
          </section>
        </div>

        ${uiState.previewModalRole === 'participant_sim' ? renderParticipantPreviewModal(ev, round, pkg) : ''}
        ${renderPdfPreviewModal()}
      `;

      bindEvents(ev, round, pkg);
    }

    function bindEvents(ev, round, pkg) {
      let pendingReplacePdfId = '';

      document.getElementById('evRcGoBuilderBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('rounds'));
      document.getElementById('evRcGoLiveBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('live'));

      document.getElementById('evRcOpenSimModalBtn')?.addEventListener('click', () => {
        uiState.previewModalRole = 'participant_sim';
        render();
      });
      document.getElementById('evRcCloseSimModalBtn')?.addEventListener('click', () => {
        uiState.previewModalRole = 'none';
        render();
      });
      mountEl.querySelectorAll('[data-rc-sim-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.simPreviewSubTab = btn.dataset.rcSimTab;
          render();
        });
      });

      document.getElementById('evRcClosePdfModalBtn')?.addEventListener('click', () => {
        if (uiState.previewPdfUrl && uiState.previewPdfUrlIsBlob && window.URL && window.URL.revokeObjectURL) {
          try { window.URL.revokeObjectURL(uiState.previewPdfUrl); } catch (_) {}
        }
        uiState.previewPdf = null;
        uiState.previewPdfUrl = '';
        uiState.previewPdfUrlIsBlob = false;
        render();
      });

      mountEl.querySelectorAll('[data-rc-select-round]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rObj = (ev.rounds || []).find((r) => r.id === btn.dataset.rcSelectRound);
          if (rObj) {
            selectRound(rObj, window.EventoraStore.getRoundContentPackage(slug, rObj.id));
            render();
          }
        });
      });

      mountEl.querySelectorAll('[data-rc-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.studioTab = btn.dataset.rcTab;
          render();
        });
      });

      // Metadata & Release Rules Form
      document.getElementById('evRcMetaForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (readOnly) return;
        const declVal = document.getElementById('evRcDeclaredCount')?.value;
        const patch = {
          contentStatus: document.getElementById('evRcStatusSelect')?.value || pkg.contentStatus,
          paperTitle: document.getElementById('evRcPaperTitle')?.value || '',
          description: document.getElementById('evRcDescription')?.value || '',
          instructions: document.getElementById('evRcInstructions')?.value || '',
          totalMarks: Number(document.getElementById('evRcTotalMarks')?.value || 0),
          durationLabel: document.getElementById('evRcDurLabel')?.value || '',
          declaredQuestionCount: declVal !== '' && declVal != null ? Number(declVal) : null,
          availability: {
            mode: document.getElementById('evRcAvMode')?.value || 'locked',
            releaseAt: document.getElementById('evRcReleaseAt')?.value || '',
            pausedAccessPolicy: document.getElementById('evRcPausedPolicy')?.value || 'restrict',
            completedAccessPolicy: document.getElementById('evRcCompPolicy')?.value || 'allow',
            allowPdfDownload: Boolean(document.getElementById('evRcAllowPdfDl')?.checked),
            allowAttachmentDownload: Boolean(document.getElementById('evRcAllowAttDl')?.checked),
            requireApprovedRegistration: Boolean(document.getElementById('evRcReqApproved')?.checked),
            hideAnswerKeysFromParticipants: Boolean(document.getElementById('evRcHideKeys')?.checked)
          }
        };
        applyResult(window.EventoraStore.saveRoundContentMeta(slug, round.id, patch), `Saved Round ${round.order} release & metadata settings.`);
      });

      document.getElementById('evRcSaveDraftQuizBtn')?.addEventListener('click', () => {
        applyResult(window.EventoraStore.saveRoundContentMeta(slug, round.id, { contentStatus: 'Draft' }), 'Saved round content as Draft.');
      });
      document.getElementById('evRcPublishQuizBtn')?.addEventListener('click', () => {
        applyResult(window.EventoraStore.saveRoundContentMeta(slug, round.id, { contentStatus: 'Published' }), 'Round content marked Published (respects configured release rule).');
      });

      // PDF draft field tracking & upload
      document.getElementById('evRcPdfCat')?.addEventListener('change', (e) => { uiState.pdfCategory = e.target.value; });
      document.getElementById('evRcPdfTitle')?.addEventListener('input', (e) => { uiState.pdfTitle = e.target.value; });
      document.getElementById('evRcPdfMarks')?.addEventListener('input', (e) => { uiState.pdfMarks = e.target.value; });
      document.getElementById('evRcPdfDur')?.addEventListener('input', (e) => { uiState.pdfDuration = e.target.value; });
      document.getElementById('evRcPdfQCount')?.addEventListener('input', (e) => { uiState.pdfQuestionCount = e.target.value; });

      function handleIncomingPdf(file, replaceId) {
        if (!file || readOnly) return;
        uiState.uploadError = '';
        uiState.uploadProgressPct = 15;
        render();

        readAndStorePdf(file, slug, round.id, {
          onProgress: (pct) => { uiState.uploadProgressPct = pct; },
          onError: (errMsg) => {
            uiState.uploadProgressPct = 0;
            uiState.uploadError = errMsg;
            toast(errMsg);
            render();
          },
          onSuccess: (payload) => {
            let res;
            if (replaceId) {
              const old = pkg.pdfs.find((x) => x.id === replaceId);
              if (old && old.fileId && window.EventoraFiles) window.EventoraFiles.deleteFile(old.fileId);
              res = window.EventoraStore.replaceRoundPdf(slug, round.id, replaceId, payload);
            } else {
              res = window.EventoraStore.addRoundPdf(slug, round.id, {
                ...payload,
                category: uiState.pdfCategory,
                title: uiState.pdfTitle.trim() || file.name.replace(/\.pdf$/i, ''),
                totalMarks: uiState.pdfMarks !== '' ? Number(uiState.pdfMarks) : pkg.totalMarks,
                duration: uiState.pdfDuration.trim() || pkg.durationLabel || round.duration,
                questionCount: uiState.pdfQuestionCount !== '' ? Number(uiState.pdfQuestionCount) : null
              });
            }
            uiState.uploadProgressPct = 0;
            if (res && res.ok) {
              uiState.pdfTitle = '';
              uiState.pdfMarks = '';
              uiState.pdfDuration = '';
              uiState.pdfQuestionCount = '';
              uiState.uploadError = '';
              applyResult(res, replaceId ? 'PDF replaced in IndexedDB.' : `Uploaded "${res.pdf.title}" cleanly.`);
            } else {
              uiState.uploadError = (res && res.error) || 'Failed to store PDF.';
              render();
            }
          }
        });
      }

      const fileInput = document.getElementById('evRcPdfInput');
      const replaceInput = document.getElementById('evRcPdfReplaceInput');
      const dropzone = document.getElementById('evRcDropzone');

      document.getElementById('evRcBrowsePdfBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput?.click();
      });
      dropzone?.addEventListener('click', () => fileInput?.click());
      dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
      dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleIncomingPdf(f, '');
      });
      fileInput?.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f) handleIncomingPdf(f, '');
      });
      replaceInput?.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (f && pendingReplacePdfId) handleIncomingPdf(f, pendingReplacePdfId);
      });

      mountEl.querySelectorAll('[data-rc-pdf-preview]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const found = pkg.pdfs.find((p) => p.id === btn.dataset.rcPdfPreview);
          if (!found) return;
          uiState.previewPdf = found;
          const resolved = await resolveBinaryUrl(found.fileId, found.dataUrl, found.storagePath);
          uiState.previewPdfUrl = resolved.url;
          uiState.previewPdfUrlIsBlob = resolved.isBlobUrl;
          render();
        });
      });

      mountEl.querySelectorAll('[data-rc-pdf-dl]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const found = pkg.pdfs.find((p) => p.id === btn.dataset.rcPdfDl);
          if (!found) return;
          const resolved = await resolveBinaryUrl(found.fileId, found.dataUrl, found.storagePath);
          if (!resolved.url) {
            toast('No PDF payload available to download.');
            return;
          }
          const a = document.createElement('a');
          a.href = resolved.url;
          a.download = found.fileName || 'round-document.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (resolved.isBlobUrl && window.URL.revokeObjectURL) {
            window.setTimeout(() => { try { window.URL.revokeObjectURL(resolved.url); } catch (_) {} }, 1500);
          }
        });
      });

      mountEl.querySelectorAll('[data-rc-pdf-replace]').forEach((btn) => {
        btn.addEventListener('click', () => {
          pendingReplacePdfId = btn.dataset.rcPdfReplace;
          replaceInput?.click();
        });
      });
      mountEl.querySelectorAll('[data-rc-pdf-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.editingPdfId = uiState.editingPdfId === btn.dataset.rcPdfEdit ? '' : btn.dataset.rcPdfEdit;
          render();
        });
      });
      document.getElementById('evRcCancelPdfMetaBtn')?.addEventListener('click', () => {
        uiState.editingPdfId = '';
        render();
      });
      mountEl.querySelectorAll('[data-rc-save-pdf-meta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pdfId = btn.dataset.rcSavePdfMeta;
          const container = btn.closest('.ev-rc-pdf-meta-edit');
          if (!container) return;
          const patch = {};
          container.querySelectorAll('[data-rc-pdf-mf]').forEach((el) => { patch[el.dataset.rcPdfMf] = el.value; });
          if (applyResult(window.EventoraStore.updateRoundPdfMeta(slug, round.id, pdfId, patch), 'Updated PDF info.')) {
            uiState.editingPdfId = '';
          }
        });
      });
      mountEl.querySelectorAll('[data-rc-pdf-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pdfObj = pkg.pdfs.find((p) => p.id === btn.dataset.rcPdfDel);
          confirmAction({
            title: 'Remove Uploaded PDF',
            body: `Remove "${pdfObj ? pdfObj.title : 'PDF'}" from Round ${round.order}?`,
            confirmLabel: 'Remove PDF',
            danger: true,
            onConfirm: () => {
              if (pdfObj && pdfObj.fileId && window.EventoraFiles) window.EventoraFiles.deleteFile(pdfObj.fileId);
              applyResult(window.EventoraStore.removeRoundPdf(slug, round.id, btn.dataset.rcPdfDel), 'PDF removed.');
            }
          });
        });
      });

      // CSV & Question Import Studio Events
      document.getElementById('evRcToggleImportBtn')?.addEventListener('click', () => {
        uiState.showImportDrawer = !uiState.showImportDrawer;
        uiState.importPreview = null;
        render();
      });
      document.getElementById('evRcDlSampleCsvBtn')?.addEventListener('click', () => {
        const csv = window.EventoraStore.buildSampleQuestionsCsv();
        downloadCsvText('eventora-sample-questions.csv', csv, 'text/csv;charset=utf-8;');
        toast('Downloaded sample CSV template.');
      });
      const csvFileInp = document.getElementById('evRcCsvFileInput');
      document.getElementById('evRcBrowseCsvBtn')?.addEventListener('click', () => csvFileInp?.click());
      csvFileInp?.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          uiState.importText = String(r.result || '');
          uiState.importPreview = window.EventoraStore.parseQuestionImportText(uiState.importText, pkg.questions);
          render();
        };
        r.readAsText(f);
      });
      const impTa = document.getElementById('evRcImportTextarea');
      impTa?.addEventListener('input', () => { uiState.importText = impTa.value; });
      document.getElementById('evRcPreviewCsvBtn')?.addEventListener('click', () => {
        uiState.importPreview = window.EventoraStore.parseQuestionImportText(uiState.importText, pkg.questions);
        render();
      });
      document.getElementById('evRcConfirmImportBtn')?.addEventListener('click', () => {
        const res = window.EventoraStore.importRoundQuestions(slug, round.id, uiState.importText);
        if (!res.ok) { toast(res.error); return; }
        uiState.importText = '';
        uiState.importPreview = null;
        applyResult(res, `Imported ${res.importedCount} question(s).`);
      });

      // Question Form Controls
      document.getElementById('evRcQType')?.addEventListener('change', (e) => {
        uiState.qType = e.target.value;
        uiState.qCorrectIndex = 0;
        render();
      });
      document.getElementById('evRcQDiff')?.addEventListener('change', (e) => { uiState.qDifficulty = e.target.value; });
      document.getElementById('evRcQMarks')?.addEventListener('input', (e) => { uiState.qMarks = e.target.value; });
      document.getElementById('evRcQNegMarks')?.addEventListener('input', (e) => { uiState.qNegMarks = e.target.value; });
      document.getElementById('evRcQMandatory')?.addEventListener('change', (e) => { uiState.qMandatory = Boolean(e.target.checked); });
      document.getElementById('evRcQPrompt')?.addEventListener('input', (e) => { uiState.qPrompt = e.target.value; });
      document.getElementById('evRcQCode')?.addEventListener('input', (e) => { uiState.qCodeSnippet = e.target.value; });
      document.getElementById('evRcQAcceptedAns')?.addEventListener('input', (e) => { uiState.qAcceptedAnswer = e.target.value; });
      document.getElementById('evRcQExplanation')?.addEventListener('input', (e) => { uiState.qExplanation = e.target.value; });

      document.getElementById('evRcQImgInput')?.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const res = await readAndStoreBinaryAttachment(f, slug, round.id);
        if (res.ok) {
          uiState.qImageFileId = res.fileId;
          uiState.qImageName = res.fileName;
          uiState.qImageDataUrl = res.dataUrl;
          toast(`Attached image "${f.name}".`);
          render();
        }
      });
      document.getElementById('evRcClearQImgBtn')?.addEventListener('click', () => {
        uiState.qImageFileId = '';
        uiState.qImageName = '';
        uiState.qImageDataUrl = '';
        render();
      });

      mountEl.querySelectorAll('input[name="evRcCorrectOpt"]').forEach((rad) => {
        rad.addEventListener('change', () => { uiState.qCorrectIndex = Number(rad.value) || 0; });
      });
      mountEl.querySelectorAll('input[name="evRcCorrectMultiOpt"]').forEach((chk) => {
        chk.addEventListener('change', () => {
          const checked = Array.from(mountEl.querySelectorAll('input[name="evRcCorrectMultiOpt"]:checked')).map((c) => Number(c.value));
          uiState.qCorrectIndices = checked.length ? checked : [0];
        });
      });
      mountEl.querySelectorAll('[data-rc-opt-idx]').forEach((inp) => {
        inp.addEventListener('input', () => { uiState.qOptions[Number(inp.dataset.rcOptIdx)] = inp.value; });
      });
      document.getElementById('evRcAddOptBtn')?.addEventListener('click', () => {
        if (uiState.qOptions.length < 6) { uiState.qOptions.push(''); render(); }
      });
      document.getElementById('evRcCancelEditQBtn')?.addEventListener('click', () => {
        resetQuestionDraft(true);
        render();
      });
      document.getElementById('evRcQuestionForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (readOnly) return;
        const payload = {
          questionType: uiState.qType,
          prompt: uiState.qPrompt,
          codeSnippet: uiState.qCodeSnippet,
          options: uiState.qType === 'true_false' ? ['True', 'False'] : uiState.qOptions,
          correctOptionIndex: uiState.qCorrectIndex,
          correctOptionIndices: uiState.qType === 'mcq_multi' ? [...(uiState.qCorrectIndices || [0])] : [],
          acceptedAnswer: uiState.qAcceptedAnswer,
          explanation: uiState.qExplanation,
          marks: Number(uiState.qMarks) || 1,
          negativeMarks: Number(uiState.qNegMarks) || 0,
          mandatory: uiState.qMandatory,
          difficulty: uiState.qDifficulty,
          imageFileId: uiState.qImageFileId,
          imageName: uiState.qImageName,
          imageDataUrl: uiState.qImageDataUrl
        };
        const res = uiState.editingQuestionId
          ? window.EventoraStore.updateRoundQuestion(slug, round.id, uiState.editingQuestionId, payload)
          : window.EventoraStore.addRoundQuestion(slug, round.id, payload);
        if (applyResult(res, uiState.editingQuestionId ? 'Question updated.' : 'Question added.')) {
          resetQuestionDraft(true);
        }
      });

      const qSearchEl = document.getElementById('evRcQSearch');
      qSearchEl?.addEventListener('input', () => {
        uiState.questionSearch = qSearchEl.value;
        render();
        const ref = document.getElementById('evRcQSearch');
        if (ref) { ref.focus(); ref.setSelectionRange(ref.value.length, ref.value.length); }
      });

      mountEl.querySelectorAll('[data-rc-q-dup]').forEach((btn) => {
        btn.addEventListener('click', () => applyResult(window.EventoraStore.duplicateRoundQuestion(slug, round.id, btn.dataset.rcQDup), 'Question duplicated.'));
      });
      mountEl.querySelectorAll('[data-rc-q-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const q = pkg.questions.find((x) => x.id === btn.dataset.rcQEdit);
          if (!q) return;
          uiState.editingQuestionId = q.id;
          uiState.qType = q.questionType;
          uiState.qPrompt = q.prompt;
          uiState.qCodeSnippet = q.codeSnippet || '';
          uiState.qOptions = q.options.length ? [...q.options] : ['', '', '', ''];
          uiState.qCorrectIndex = q.correctOptionIndex != null ? q.correctOptionIndex : 0;
          uiState.qCorrectIndices = Array.isArray(q.correctOptionIndices) && q.correctOptionIndices.length ? [...q.correctOptionIndices] : [uiState.qCorrectIndex];
          uiState.qAcceptedAnswer = q.acceptedAnswer || '';
          uiState.qExplanation = q.explanation || '';
          uiState.qMarks = String(q.marks);
          uiState.qNegMarks = String(q.negativeMarks || 0);
          uiState.qMandatory = q.mandatory !== false;
          uiState.qDifficulty = q.difficulty || 'Medium';
          uiState.qImageFileId = q.imageFileId || '';
          uiState.qImageName = q.imageName || '';
          uiState.qImageDataUrl = q.imageDataUrl || '';
          render();
        });
      });
      mountEl.querySelectorAll('[data-rc-q-up], [data-rc-q-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const isUp = btn.dataset.rcQUp != null;
          const qId = isUp ? btn.dataset.rcQUp : btn.dataset.rcQDown;
          const ids = pkg.questions.map((x) => x.id);
          const idx = ids.indexOf(qId);
          const swapIdx = isUp ? idx - 1 : idx + 1;
          if (idx < 0 || swapIdx < 0 || swapIdx >= ids.length) return;
          const tmp = ids[idx]; ids[idx] = ids[swapIdx]; ids[swapIdx] = tmp;
          applyResult(window.EventoraStore.reorderRoundQuestions(slug, round.id, ids), 'Question order updated.');
        });
      });
      mountEl.querySelectorAll('[data-rc-q-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          confirmAction({
            title: 'Delete Question',
            body: `Remove this question from Round ${round.order}?`,
            confirmLabel: 'Delete Question',
            danger: true,
            onConfirm: () => applyResult(window.EventoraStore.deleteRoundQuestion(slug, round.id, btn.dataset.rcQDel), 'Question deleted.')
          });
        });
      });

      // Coding Problems Studio Events
      document.getElementById('evRcPrTitle')?.addEventListener('input', (e) => { uiState.prTitle = e.target.value; });
      document.getElementById('evRcPrDiff')?.addEventListener('change', (e) => { uiState.prDifficulty = e.target.value; });
      document.getElementById('evRcPrPts')?.addEventListener('input', (e) => { uiState.prPoints = e.target.value; });
      document.getElementById('evRcPrTimeLimit')?.addEventListener('input', (e) => { uiState.prTimeLimit = e.target.value; });
      document.getElementById('evRcPrStmt')?.addEventListener('input', (e) => { uiState.prStatement = e.target.value; });
      document.getElementById('evRcPrInputFmt')?.addEventListener('input', (e) => { uiState.prInputFormat = e.target.value; });
      document.getElementById('evRcPrOutputFmt')?.addEventListener('input', (e) => { uiState.prOutputFormat = e.target.value; });
      document.getElementById('evRcPrConstraints')?.addEventListener('input', (e) => { uiState.prConstraints = e.target.value; });
      document.getElementById('evRcPrSampleIn')?.addEventListener('input', (e) => { uiState.prSampleInput = e.target.value; });
      document.getElementById('evRcPrSampleOut')?.addEventListener('input', (e) => { uiState.prSampleOutput = e.target.value; });
      document.getElementById('evRcPrExplanation')?.addEventListener('input', (e) => { uiState.prExplanation = e.target.value; });
      document.getElementById('evRcPrSubInst')?.addEventListener('input', (e) => { uiState.prSubInstructions = e.target.value; });
      document.getElementById('evRcPrStarterUrl')?.addEventListener('input', (e) => { uiState.prStarterUrl = e.target.value; });

      mountEl.querySelectorAll('input[name="evRcPrLang"]').forEach((chk) => {
        chk.addEventListener('change', () => {
          const picked = Array.from(mountEl.querySelectorAll('input[name="evRcPrLang"]:checked')).map((c) => c.value);
          uiState.prLanguages = picked.length ? picked : ['C', 'C++', 'Java', 'Python'];
        });
      });

      document.getElementById('evRcPrPdfInput')?.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        readAndStorePdf(f, slug, round.id, {
          onError: (err) => toast(err),
          onSuccess: (resPdf) => {
            uiState.prPdfFileId = resPdf.fileId;
            uiState.prPdfName = resPdf.fileName;
            toast(`Attached problem PDF "${resPdf.fileName}".`);
            render();
          }
        });
      });

      document.getElementById('evRcCancelEditPBtn')?.addEventListener('click', () => { resetProblemDraft(); render(); });
      document.getElementById('evRcProblemForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (readOnly) return;
        const payload = {
          problemTitle: uiState.prTitle,
          difficulty: uiState.prDifficulty,
          points: Number(uiState.prPoints) || 100,
          timeLimit: uiState.prTimeLimit || '2 Seconds',
          statement: uiState.prStatement,
          inputFormat: uiState.prInputFormat,
          outputFormat: uiState.prOutputFormat,
          constraints: uiState.prConstraints,
          allowedLanguages: [...uiState.prLanguages],
          sampleInput: uiState.prSampleInput,
          sampleOutput: uiState.prSampleOutput,
          explanation: uiState.prExplanation,
          submissionInstructions: uiState.prSubInstructions,
          starterUrl: uiState.prStarterUrl,
          problemPdfFileId: uiState.prPdfFileId,
          problemPdfName: uiState.prPdfName
        };
        const res = uiState.editingProblemId
          ? window.EventoraStore.updateCodingProblem(slug, round.id, uiState.editingProblemId, payload)
          : window.EventoraStore.addCodingProblem(slug, round.id, payload);
        if (applyResult(res, uiState.editingProblemId ? 'Problem updated.' : 'Problem added.')) {
          resetProblemDraft();
        }
      });

      mountEl.querySelectorAll('[data-rc-pr-up], [data-rc-pr-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const isUp = btn.dataset.rcPrUp != null;
          const pid = isUp ? btn.dataset.rcPrUp : btn.dataset.rcPrDown;
          const ids = pkg.codingProblems.map((x) => x.id);
          const idx = ids.indexOf(pid);
          const swap = isUp ? idx - 1 : idx + 1;
          if (idx < 0 || swap < 0 || swap >= ids.length) return;
          const tmp = ids[idx]; ids[idx] = ids[swap]; ids[swap] = tmp;
          applyResult(window.EventoraStore.reorderCodingProblems(slug, round.id, ids), 'Problem order updated.');
        });
      });
      mountEl.querySelectorAll('[data-rc-pr-dup]').forEach((btn) => {
        btn.addEventListener('click', () => applyResult(window.EventoraStore.duplicateCodingProblem(slug, round.id, btn.dataset.rcPrDup), 'Problem duplicated.'));
      });
      mountEl.querySelectorAll('[data-rc-pr-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = pkg.codingProblems.find((x) => x.id === btn.dataset.rcPrEdit);
          if (!p) return;
          uiState.editingProblemId = p.id;
          uiState.prTitle = p.problemTitle;
          uiState.prDifficulty = p.difficulty;
          uiState.prPoints = String(p.points);
          uiState.prTimeLimit = p.timeLimit || '2 Seconds';
          uiState.prStatement = p.statement;
          uiState.prInputFormat = p.inputFormat;
          uiState.prOutputFormat = p.outputFormat;
          uiState.prConstraints = p.constraints;
          uiState.prLanguages = p.allowedLanguages && p.allowedLanguages.length ? [...p.allowedLanguages] : ['C', 'C++', 'Java', 'Python'];
          uiState.prSampleInput = p.sampleInput;
          uiState.prSampleOutput = p.sampleOutput;
          uiState.prExplanation = p.explanation || '';
          uiState.prSubInstructions = p.submissionInstructions || '';
          uiState.prStarterUrl = p.starterUrl;
          uiState.prPdfFileId = p.problemPdfFileId || '';
          uiState.prPdfName = p.problemPdfName || '';
          render();
        });
      });
      mountEl.querySelectorAll('[data-rc-pr-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          confirmAction({
            title: 'Delete Coding Problem',
            body: `Remove this problem from Round ${round.order}?`,
            confirmLabel: 'Delete Problem',
            danger: true,
            onConfirm: () => applyResult(window.EventoraStore.deleteCodingProblem(slug, round.id, btn.dataset.rcPrDel), 'Problem removed.')
          });
        });
      });

      // Challenge Specs & Multi-Type Attachments
      document.getElementById('evRcChallengeSpecForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (readOnly) return;
        applyResult(window.EventoraStore.saveRoundContentMeta(slug, round.id, {
          challengeSpec: {
            taskDescription: document.getElementById('evRcChTaskDesc')?.value || '',
            submissionRequirements: document.getElementById('evRcChSubReq')?.value || '',
            evaluationGuidelines: document.getElementById('evRcChEvalGuide')?.value || '',
            allowRepoUrl: Boolean(document.getElementById('evRcChRepo')?.checked),
            allowLiveUrl: Boolean(document.getElementById('evRcChLive')?.checked),
            allowFileAttachment: Boolean(document.getElementById('evRcChFile')?.checked),
            allowTextDescription: Boolean(document.getElementById('evRcChText')?.checked)
          }
        }), 'Saved challenge & submission requirements.');
      });

      document.getElementById('evRcAttCat')?.addEventListener('change', (e) => { uiState.attCategory = e.target.value; });
      document.getElementById('evRcAttTitle')?.addEventListener('input', (e) => { uiState.attTitle = e.target.value; });
      document.getElementById('evRcAttFileInput')?.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f || readOnly) return;
        const binRes = await readAndStoreBinaryAttachment(f, slug, round.id);
        if (!binRes.ok) { toast(binRes.error); return; }
        const saveRes = window.EventoraStore.addRoundAttachment(slug, round.id, {
          ...binRes,
          category: uiState.attCategory,
          title: uiState.attTitle.trim() || f.name
        });
        if (applyResult(saveRes, `Uploaded "${f.name}" to IndexedDB.`)) {
          uiState.attTitle = '';
        }
      });

      mountEl.querySelectorAll('[data-rc-att-dl]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const att = (pkg.attachments || []).find((a) => a.id === btn.dataset.rcAttDl);
          if (!att) return;
          const resolved = await resolveBinaryUrl(att.fileId, att.dataUrl, att.storagePath);
          if (!resolved.url) { toast('No file payload found.'); return; }
          const a = document.createElement('a');
          a.href = resolved.url;
          a.download = att.fileName || 'attachment';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
      });
      mountEl.querySelectorAll('[data-rc-att-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const att = (pkg.attachments || []).find((a) => a.id === btn.dataset.rcAttDel);
          if (att && att.fileId && window.EventoraFiles) window.EventoraFiles.deleteFile(att.fileId);
          applyResult(window.EventoraStore.removeRoundAttachment(slug, round.id, btn.dataset.rcAttDel), 'Attachment removed.');
        });
      });

      // Reference Materials
      document.getElementById('evRcMatCat')?.addEventListener('change', (e) => { uiState.matCategory = e.target.value; });
      document.getElementById('evRcMatVis')?.addEventListener('change', (e) => { uiState.matVisibility = e.target.value; });
      document.getElementById('evRcMatTitle')?.addEventListener('input', (e) => { uiState.matTitle = e.target.value; });
      document.getElementById('evRcMatUrl')?.addEventListener('input', (e) => { uiState.matUrl = e.target.value; });
      document.getElementById('evRcMatDesc')?.addEventListener('input', (e) => { uiState.matDescription = e.target.value; });

      document.getElementById('evRcMatForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (readOnly) return;
        const res = window.EventoraStore.addRoundMaterial(slug, round.id, {
          category: uiState.matCategory,
          visibility: uiState.matVisibility,
          title: uiState.matTitle,
          resourceUrl: uiState.matUrl,
          description: uiState.matDescription
        });
        if (applyResult(res, 'Added round material.')) {
          uiState.matTitle = ''; uiState.matUrl = ''; uiState.matDescription = '';
        }
      });
      mountEl.querySelectorAll('[data-rc-mat-del]').forEach((btn) => {
        btn.addEventListener('click', () => applyResult(window.EventoraStore.deleteRoundMaterial(slug, round.id, btn.dataset.rcMatDel), 'Material removed.'));
      });
    }

    render();
  }

  return {
    mount,
    formatBytes,
    defaultContentTabForType
  };
})();

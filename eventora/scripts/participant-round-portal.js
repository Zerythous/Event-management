/* ==========================================================================
   EVENTORA PHASE 8: PARTICIPANT ROUND CONTENT & SUBMISSION PORTAL
   Provides registered, eligible participants gated access to released PDFs,
   Quiz/MCQ attempts, Coding Problem interfaces (C/C++/Java/Python), Frontend
   and technical challenge submissions, integrated cleanly with Live Control.
   ========================================================================== */

window.EventoraParticipantPortal = (function () {
  let portalTickerId = null;

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

  function formatHMS(totalSecs) {
    const clean = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const hrs = Math.floor(clean / 3600);
    const mins = Math.floor((clean % 3600) / 60);
    const secs = clean % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  }

  function formatBytes(bytes) {
    const n = Math.max(0, Number(bytes) || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function stopTicker() {
    if (portalTickerId) {
      window.clearInterval(portalTickerId);
      portalTickerId = null;
    }
  }

  async function triggerFileDownload(fileId, fallbackUrl, fileName, storagePath) {
    if (storagePath && window.EventoraRoundContentApi && typeof window.EventoraRoundContentApi.getSignedDownloadUrl === 'function') {
      const signed = await window.EventoraRoundContentApi.getSignedDownloadUrl(storagePath, 900);
      if (signed && signed.ok && signed.url) {
        const a = document.createElement('a');
        a.href = signed.url;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }
    if (window.EventoraFiles && typeof window.EventoraFiles.resolveBlobUrl === 'function') {
      const resolved = await window.EventoraFiles.resolveBlobUrl(fileId, fallbackUrl);
      if (!resolved.url) {
        toast('File binary is unavailable in this session.');
        return;
      }
      const a = document.createElement('a');
      a.href = resolved.url;
      a.download = fileName || resolved.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (resolved.isBlobUrl && window.URL.revokeObjectURL) {
        window.setTimeout(() => { try { window.URL.revokeObjectURL(resolved.url); } catch (_) {} }, 1500);
      }
      return;
    }
    if (fallbackUrl) {
      const a = document.createElement('a');
      a.href = fallbackUrl;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast('No file payload attached.');
    }
  }

  function openRoundPortal(options) {
    const cfg = options || {};
    const slug = cfg.slug || '';
    const roundId = cfg.roundId || '';
    const user = cfg.user || (window.EventoraAuth && window.EventoraAuth.getSession ? window.EventoraAuth.getSession() : null);
    const onSubmitted = typeof cfg.onSubmitted === 'function' ? cfg.onSubmitted : null;
    if (!window.EventoraStore || !slug || !roundId) return;

    stopTicker();
    let hostEl = document.getElementById('evParticipantPortalMount');
    if (!hostEl) {
      hostEl = document.createElement('div');
      hostEl.id = 'evParticipantPortalMount';
      document.body.appendChild(hostEl);
    }

    const portalState = {
      selectedProblemId: '',
      codingLang: 'Python',
      codeDraft: '',
      repoUrl: '',
      liveUrl: '',
      chalDesc: '',
      chalFileName: '',
      quizAnswers: {},
      pdfPreviewUrl: '',
      pdfPreviewTitle: '',
      pdfPreviewIsBlob: false
    };

    function closePortal() {
      stopTicker();
      if (portalState.pdfPreviewUrl && portalState.pdfPreviewIsBlob && window.URL && window.URL.revokeObjectURL) {
        try { window.URL.revokeObjectURL(portalState.pdfPreviewUrl); } catch (_) {}
      }
      if (hostEl) hostEl.innerHTML = '';
    }

    function renderPortal() {
      const snap = window.EventoraStore.getParticipantRoundPortalSnapshot(slug, roundId, user);
      if (!snap || !snap.ok) {
        hostEl.innerHTML = '';
        stopTicker();
        return;
      }

      const ev = snap.event;
      const round = snap.round;
      const roundOp = snap.roundOp;
      const timerSnap = snap.timerSnapshot;
      const access = snap.access;
      const pkg = access.allowed ? access.content : null;
      const sub = snap.mySubmission;

      if (pkg && pkg.codingProblems && pkg.codingProblems.length && !portalState.selectedProblemId) {
        portalState.selectedProblemId = pkg.codingProblems[0].id;
      }
      if (sub) {
        if (!portalState.codeDraft && sub.submittedCode) portalState.codeDraft = sub.submittedCode;
        if (sub.selectedLanguage) portalState.codingLang = sub.selectedLanguage;
        if (!portalState.repoUrl && sub.repoUrl) portalState.repoUrl = sub.repoUrl;
        if (!portalState.liveUrl && sub.liveUrl) portalState.liveUrl = sub.liveUrl;
        if (!portalState.chalDesc && sub.description) portalState.chalDesc = sub.description;
      }

      const isCompletedRound = roundOp && roundOp.roundStatus === 'Completed';
      const isReadOnlySub = isCompletedRound;

      hostEl.innerHTML = `
        <div class="ev-rc-modal-backdrop" id="evPpModalRoot">
          <div class="ev-rc-modal ev-rc-modal-lg" role="dialog" aria-modal="true" aria-label="Participant Round Workspace">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:0.3rem;">
                  <span class="ev-badge ev-badge-open">Stage ${round.order} &bull; ${esc(round.typeLabel)}</span>
                  <span class="ev-lc-badge ${roundOp && roundOp.roundStatus === 'Live' ? 'ev-lc-badge-live' : 'ev-lc-badge-upcoming'}">
                    Round: ${esc(roundOp ? roundOp.roundStatus : 'Upcoming')}
                  </span>
                  <span class="ev-lc-pill">Submission: ${esc(snap.submissionStatus)}</span>
                </div>
                <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;color:var(--ev-charcoal);">${esc(round.name)} — ${esc(ev.name)}</h2>
              </div>
              <div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">
                ${timerSnap && (roundOp && (roundOp.roundStatus === 'Live' || roundOp.roundStatus === 'Paused')) ? `
                  <div style="padding:0.35rem 0.7rem;border-radius:var(--ev-radius-sm);background:var(--ev-cream);border:1px solid var(--ev-border);text-align:right;">
                    <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--ev-primary);">${timerSnap.isExpired ? 'Expired' : 'Remaining'}</div>
                    <strong id="evPpTimerText" style="font-family:monospace;font-size:1.05rem;">${timerSnap.hasDuration ? formatHMS(timerSnap.remainingSeconds) : formatHMS(timerSnap.elapsedSeconds)}</strong>
                  </div>
                ` : ''}
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evPpCloseBtn">Close</button>
              </div>
            </div>

            ${!access.allowed || !pkg ? `
              <div class="ev-lc-inline-note" style="flex-direction:column;align-items:flex-start;gap:0.5rem;">
                <span class="ev-lc-badge ev-lc-badge-danger">Access Restricted</span>
                <strong>Round Content Locked</strong>
                <p style="font-size:0.86rem;color:var(--ev-muted);margin:0;">${esc(access.reason)}</p>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:1rem;max-height:70vh;overflow-y:auto;padding-right:0.2rem;">
                ${(pkg.instructions || round.instructions || pkg.paperTitle) ? `
                  <div class="ev-rc-subpanel" style="margin-top:0;">
                    <strong style="font-size:0.95rem;color:var(--ev-charcoal);">${esc(pkg.paperTitle || round.name)}</strong>
                    <p style="font-size:0.83rem;color:var(--ev-muted);margin:0.3rem 0 0;">${esc(pkg.instructions || round.instructions || pkg.description)}</p>
                  </div>
                ` : ''}

                <!-- UNLOCKED PDFs & ATTACHMENTS -->
                ${(pkg.pdfs.length > 0 || (pkg.attachments && pkg.attachments.length > 0) || (pkg.materials && pkg.materials.length > 0)) ? `
                  <div class="ev-rc-subpanel" style="margin-top:0;">
                    <strong style="display:block;font-size:0.9rem;color:var(--ev-forest);margin-bottom:0.55rem;">Question Papers, Reference Assets &amp; Downloads</strong>
                    <div class="ev-rc-items-list">
                      ${pkg.pdfs.map((p) => `
                        <div class="ev-rc-item-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                          <div>
                            <span class="ev-lc-badge ev-lc-badge-submitted">${esc(p.category)}</span>
                            <strong style="margin-left:0.35rem;font-size:0.88rem;">${esc(p.title)}</strong>
                            <span style="font-size:0.75rem;color:var(--ev-muted);margin-left:0.35rem;">(${esc(p.fileName)} &bull; ${formatBytes(p.sizeBytes)})</span>
                          </div>
                          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pp-pdf-view="${esc(p.id)}">View PDF</button>
                            ${p.allowDownload
                              ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-pp-pdf-dl="${esc(p.id)}">Download PDF</button>`
                              : `<span class="ev-lc-pill">Download Restricted</span>`}
                          </div>
                        </div>
                      `).join('')}

                      ${(pkg.attachments || []).map((a) => `
                        <div class="ev-rc-item-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                          <div>
                            <span class="ev-lc-badge ev-lc-badge-upcoming">${esc(a.category)}</span>
                            <strong style="margin-left:0.35rem;font-size:0.88rem;">${esc(a.title)}</strong>
                            <span style="font-size:0.75rem;color:var(--ev-muted);margin-left:0.35rem;">(${esc(a.fileName)} &bull; ${formatBytes(a.sizeBytes)})</span>
                          </div>
                          ${a.allowDownload
                            ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pp-att-dl="${esc(a.id)}">Download File</button>`
                            : `<span class="ev-lc-pill">Download Restricted</span>`}
                        </div>
                      `).join('')}

                      ${(pkg.materials || []).map((m) => `
                        <div class="ev-rc-item-card">
                          <span class="ev-lc-pill">${esc(m.category)}</span>
                          <strong style="margin-left:0.35rem;font-size:0.88rem;">${esc(m.title)}</strong>
                          ${m.description ? `<p style="font-size:0.8rem;color:var(--ev-muted);margin:0.25rem 0 0;">${esc(m.description)}</p>` : ''}
                          ${m.resourceUrl ? `<a href="${esc(m.resourceUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem;color:var(--ev-forest);font-weight:600;">Open Material Link &rarr;</a>` : ''}
                        </div>
                      `).join('')}
                    </div>

                    ${portalState.pdfPreviewUrl ? `
                      <div style="margin-top:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
                          <strong style="font-size:0.84rem;">Preview: ${esc(portalState.pdfPreviewTitle)}</strong>
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evPpCloseInlinePdfBtn">Hide Preview</button>
                        </div>
                        <div class="ev-rc-pdf-frame-wrap">
                          <iframe src="${esc(portalState.pdfPreviewUrl)}" title="Round PDF Viewer" class="ev-rc-pdf-frame" style="height:42vh;"></iframe>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <!-- QUIZ / MCQ PARTICIPANT INTERFACE -->
                ${pkg.questions && pkg.questions.length > 0 ? `
                  <form id="evPpQuizForm" class="ev-rc-subpanel" style="margin-top:0;" novalidate>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;flex-wrap:wrap;">
                      <strong style="font-size:0.95rem;color:var(--ev-charcoal);">Quiz / MCQ Assessment (${pkg.questions.length} Questions)</strong>
                      <span class="ev-lc-pill">Total Marks: ${pkg.questions.reduce((s, q) => s + q.marks, 0)}</span>
                    </div>
                    <div class="ev-rc-items-list">
                      ${pkg.questions.map((q) => {
                        const savedAns = (sub && sub.mcqAnswers && sub.mcqAnswers[q.id] !== undefined)
                          ? sub.mcqAnswers[q.id]
                          : portalState.quizAnswers[q.id];
                        return `
                          <div class="ev-rc-item-card">
                            <div style="font-weight:600;font-size:0.9rem;color:var(--ev-charcoal);">
                              Q${q.order}. ${esc(q.prompt)}
                              <span class="ev-lc-pill" style="margin-left:0.35rem;">${q.marks}m${q.mandatory !== false ? ' • Required' : ''}</span>
                            </div>
                            ${q.codeSnippet ? `<pre class="ev-rc-code">${esc(q.codeSnippet)}</pre>` : ''}
                            ${q.imageDataUrl ? `<img src="${esc(q.imageDataUrl)}" alt="Question visual" style="max-width:100%;max-height:200px;margin-top:0.45rem;border-radius:6px;border:1px solid var(--ev-border);">` : ''}
                            ${q.questionType === 'short_answer' ? `
                              <input type="text" class="ev-input" style="margin-top:0.45rem;" data-pp-q-ans="${esc(q.id)}" value="${esc(savedAns || '')}" placeholder="Enter your answer..." ${isReadOnlySub ? 'disabled' : ''}>
                            ` : `
                              <div style="display:flex;flex-direction:column;gap:0.35rem;margin-top:0.45rem;">
                                ${q.options.map((opt, oi) => {
                                  const isChecked = q.questionType === 'mcq_multi'
                                    ? (Array.isArray(savedAns) && savedAns.includes(oi))
                                    : (savedAns !== undefined && savedAns !== '' && Number(savedAns) === oi);
                                  return `
                                    <label style="display:flex;align-items:center;gap:0.45rem;font-size:0.84rem;padding:0.42rem 0.6rem;border-radius:6px;background:var(--ev-white);border:1px solid var(--ev-border);">
                                      <input type="${q.questionType === 'mcq_multi' ? 'checkbox' : 'radio'}" name="evPpQ_${esc(q.id)}" data-pp-q-opt="${esc(q.id)}" value="${oi}" ${isChecked ? 'checked' : ''} ${isReadOnlySub ? 'disabled' : ''}>
                                      <span>${esc(opt)}</span>
                                    </label>
                                  `;
                                }).join('')}
                              </div>
                            `}
                          </div>
                        `;
                      }).join('')}
                    </div>
                    ${!isReadOnlySub ? `
                      <div style="display:flex;justify-content:flex-end;margin-top:0.75rem;">
                        <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Submit Quiz Responses</button>
                      </div>
                    ` : ''}
                  </form>
                ` : ''}

                <!-- CODING COMPETITION INTERFACE -->
                ${(pkg.codingProblems && pkg.codingProblems.length > 0) || round.typeKey === 'coding' ? `
                  <div class="ev-rc-subpanel" style="margin-top:0;">
                    <strong style="display:block;font-size:0.95rem;color:var(--ev-charcoal);margin-bottom:0.55rem;">Coding Problem Statements &amp; Code Submission</strong>
                    ${pkg.codingProblems.map((pr) => `
                      <div class="ev-rc-item-card" style="margin-bottom:0.65rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
                          <strong style="font-size:0.94rem;">Problem ${pr.order}: ${esc(pr.problemTitle)}</strong>
                          <div style="display:flex;gap:0.35rem;">
                            <span class="ev-lc-pill">${esc(pr.difficulty)}</span>
                            <span class="ev-lc-pill">${pr.points} pts</span>
                            <span class="ev-lc-pill">${esc(pr.timeLimit)}</span>
                          </div>
                        </div>
                        ${pr.statement ? `<p style="font-size:0.83rem;margin:0.35rem 0;white-space:pre-line;">${esc(pr.statement)}</p>` : ''}
                        ${pr.constraints ? `<div style="font-size:0.78rem;color:var(--ev-muted);"><strong>Constraints:</strong> ${esc(pr.constraints)}</div>` : ''}
                        ${(pr.sampleInput || pr.sampleOutput) ? `
                          <div class="ev-lc-ann-grid" style="margin-top:0.4rem;">
                            <pre class="ev-rc-code">Input:\n${esc(pr.sampleInput || '—')}</pre>
                            <pre class="ev-rc-code">Output:\n${esc(pr.sampleOutput || '—')}</pre>
                          </div>
                        ` : ''}
                        ${pr.problemPdfFileId && pr.allowDownload ? `
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" style="margin-top:0.45rem;" data-pp-prob-pdf="${esc(pr.id)}">Download Problem PDF (${esc(pr.problemPdfName || 'PDF')})</button>
                        ` : ''}
                      </div>
                    `).join('')}

                    <form id="evPpCodeSubForm" style="display:flex;flex-direction:column;gap:0.55rem;margin-top:0.65rem;" novalidate>
                      <div class="ev-lc-ann-grid">
                        <div>
                          <label class="ev-field-label" for="evPpCodeProbSel">Problem</label>
                          <select class="ev-select" id="evPpCodeProbSel" ${isReadOnlySub ? 'disabled' : ''}>
                            ${pkg.codingProblems.length
                              ? pkg.codingProblems.map((p) => `<option value="${esc(p.id)}" ${portalState.selectedProblemId === p.id ? 'selected' : ''}>${esc(p.problemTitle)}</option>`).join('')
                              : '<option value="general">Coding Round Solution</option>'}
                          </select>
                        </div>
                        <div>
                          <label class="ev-field-label" for="evPpCodeLangSel">Programming Language</label>
                          <select class="ev-select" id="evPpCodeLangSel" ${isReadOnlySub ? 'disabled' : ''}>
                            ${(window.EventoraStore.CODING_LANGUAGES || ['C', 'C++', 'Java', 'Python']).map((l) => `
                              <option value="${esc(l)}" ${portalState.codingLang === l ? 'selected' : ''}>${esc(l)}</option>
                            `).join('')}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label class="ev-field-label" for="evPpCodeEditor">Write or Paste Your Solution Code</label>
                        <textarea class="ev-textarea" id="evPpCodeEditor" rows="5" style="font-family:monospace;font-size:0.82rem;" placeholder="Paste source code for organizer review..." ${isReadOnlySub ? 'disabled' : ''}>${esc(portalState.codeDraft)}</textarea>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                        <span style="font-size:0.75rem;color:var(--ev-muted);">Reviewed manually by organizers (no automated remote code execution).</span>
                        ${!isReadOnlySub ? `<button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Submit Code Solution</button>` : ''}
                      </div>
                    </form>
                  </div>
                ` : ''}

                <!-- FRONTEND / TECHNICAL CHALLENGE / PROJECT SUBMISSION PANEL -->
                ${(pkg.challengeSpec && (pkg.challengeSpec.taskDescription || pkg.challengeSpec.submissionRequirements)) || (round.typeKey !== 'quiz' && round.typeKey !== 'mcq' && round.typeKey !== 'coding') ? `
                  <form id="evPpChallengeForm" class="ev-rc-subpanel" style="margin-top:0;display:flex;flex-direction:column;gap:0.55rem;" novalidate>
                    <strong style="font-size:0.95rem;color:var(--ev-charcoal);">Project / Technical Challenge Submission</strong>
                    ${pkg.challengeSpec && pkg.challengeSpec.taskDescription ? `<p style="font-size:0.83rem;color:var(--ev-body);margin:0;">${esc(pkg.challengeSpec.taskDescription)}</p>` : ''}
                    ${pkg.challengeSpec && pkg.challengeSpec.submissionRequirements ? `<div style="font-size:0.78rem;color:var(--ev-forest);"><strong>Requirements:</strong> ${esc(pkg.challengeSpec.submissionRequirements)}</div>` : ''}
                    <div class="ev-lc-ann-grid">
                      ${!pkg.challengeSpec || pkg.challengeSpec.allowRepoUrl !== false ? `
                        <div>
                          <label class="ev-field-label" for="evPpRepoUrl">GitHub Repository URL</label>
                          <input type="url" class="ev-input" id="evPpRepoUrl" value="${esc(portalState.repoUrl)}" placeholder="https://github.com/..." ${isReadOnlySub ? 'disabled' : ''}>
                        </div>
                      ` : ''}
                      ${!pkg.challengeSpec || pkg.challengeSpec.allowLiveUrl !== false ? `
                        <div>
                          <label class="ev-field-label" for="evPpLiveUrl">Live Website / Demo URL</label>
                          <input type="url" class="ev-input" id="evPpLiveUrl" value="${esc(portalState.liveUrl)}" placeholder="https://..." ${isReadOnlySub ? 'disabled' : ''}>
                        </div>
                      ` : ''}
                    </div>
                    ${!pkg.challengeSpec || pkg.challengeSpec.allowFileAttachment !== false ? `
                      <div>
                        <label class="ev-field-label" for="evPpChalFile">Optional File Attachment</label>
                        <input type="file" id="evPpChalFile" class="ev-input" style="padding:0.35rem;" ${isReadOnlySub ? 'disabled' : ''}>
                        ${portalState.chalFileName ? `<div style="font-size:0.75rem;color:var(--ev-forest);margin-top:0.2rem;">Attached: ${esc(portalState.chalFileName)}</div>` : ''}
                      </div>
                    ` : ''}
                    ${!pkg.challengeSpec || pkg.challengeSpec.allowTextDescription !== false ? `
                      <div>
                        <label class="ev-field-label" for="evPpChalDesc">Submission Summary / Notes</label>
                        <textarea class="ev-textarea" id="evPpChalDesc" rows="2" placeholder="Describe your build, architecture, or findings..." ${isReadOnlySub ? 'disabled' : ''}>${esc(portalState.chalDesc)}</textarea>
                      </div>
                    ` : ''}
                    ${!isReadOnlySub ? `
                      <div style="display:flex;justify-content:flex-end;">
                        <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Submit Challenge Deliverable</button>
                      </div>
                    ` : ''}
                  </form>
                ` : ''}

                <!-- SUBMISSION HISTORY -->
                ${sub && sub.submissionHistory && sub.submissionHistory.length ? `
                  <div class="ev-rc-subpanel" style="margin-top:0;">
                    <strong style="display:block;font-size:0.86rem;margin-bottom:0.35rem;">Your Submission History (${sub.submissionHistory.length})</strong>
                    ${sub.submissionHistory.map((h) => `
                      <div style="font-size:0.77rem;padding:0.35rem 0.55rem;background:var(--ev-cream);border-radius:6px;margin-bottom:0.3rem;">
                        <strong>${esc(h.note)}</strong>${h.selectedLanguage ? ` (${esc(h.selectedLanguage)})` : ''} &bull; ${esc(new Date(h.submittedAt).toLocaleString())}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `}
          </div>
        </div>
      `;

      bindPortalEvents(snap, pkg);
    }

    function bindPortalEvents(snap, pkg) {
      document.getElementById('evPpCloseBtn')?.addEventListener('click', closePortal);
      document.getElementById('evPpCloseInlinePdfBtn')?.addEventListener('click', () => {
        portalState.pdfPreviewUrl = '';
        portalState.pdfPreviewTitle = '';
        renderPortal();
      });

      if (!pkg) return;

      mountElOrDoc('[data-pp-pdf-view]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const p = pkg.pdfs.find((x) => x.id === btn.dataset.ppPdfView);
          if (!p) return;
          if (p.storagePath && window.EventoraRoundContentApi) {
            const signed = await window.EventoraRoundContentApi.getSignedDownloadUrl(p.storagePath, 900);
            if (signed.ok && signed.url) {
              portalState.pdfPreviewUrl = signed.url;
              portalState.pdfPreviewTitle = p.title;
              portalState.pdfPreviewIsBlob = false;
              renderPortal();
              return;
            }
          }
          if (window.EventoraFiles) {
            const res = await window.EventoraFiles.resolveBlobUrl(p.fileId, p.dataUrl);
            portalState.pdfPreviewUrl = res.url;
            portalState.pdfPreviewTitle = p.title;
            portalState.pdfPreviewIsBlob = res.isBlobUrl;
            renderPortal();
          } else if (p.dataUrl) {
            portalState.pdfPreviewUrl = p.dataUrl;
            portalState.pdfPreviewTitle = p.title;
            renderPortal();
          }
        });
      });

      mountElOrDoc('[data-pp-pdf-dl]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = pkg.pdfs.find((x) => x.id === btn.dataset.ppPdfDl);
          if (p && p.allowDownload) triggerFileDownload(p.fileId, p.dataUrl, p.fileName, p.storagePath);
        });
      });

      mountElOrDoc('[data-pp-att-dl]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const a = (pkg.attachments || []).find((x) => x.id === btn.dataset.ppAttDl);
          if (a && a.allowDownload) triggerFileDownload(a.fileId, a.dataUrl, a.fileName, a.storagePath);
        });
      });

      mountElOrDoc('[data-pp-prob-pdf]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pr = pkg.codingProblems.find((x) => x.id === btn.dataset.ppProbPdf);
          if (pr && pr.allowDownload) triggerFileDownload(pr.problemPdfFileId, '', pr.problemPdfName, pr.problemPdfPath);
        });
      });

      // Quiz response bindings
      mountElOrDoc('[data-pp-q-ans]').forEach((inp) => {
        inp.addEventListener('input', () => { portalState.quizAnswers[inp.dataset.ppQAns] = inp.value; });
      });
      mountElOrDoc('[data-pp-q-opt]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const qId = inp.dataset.ppQOpt;
          if (inp.type === 'checkbox') {
            portalState.quizAnswers[qId] = Array.from(hostEl.querySelectorAll(`[data-pp-q-opt="${qId}"]:checked`)).map((el) => Number(el.value));
          } else {
            portalState.quizAnswers[qId] = Number(inp.value);
          }
        });
      });

      async function persistSubmissionToDb(subType, subData) {
        if (!window.EventoraStore.getBackendMode || window.EventoraStore.getBackendMode() !== 'supabase') return { ok: true };
        if (!snap.event.dbId || !snap.round.dbId || !window.EventoraSubmissionsApi) return { ok: true };
        const regRec = (snap.event.participants || []).find((p) => p.userId === (user && user.id) || p.email === (user && user.email));
        const parts = String(snap.targetKey || '').split(':');
        const teamId = parts[0] === 'team' && window.EventoraSupabase.db.isUuid(parts[1]) ? parts[1] : null;
        const participantId = !teamId && regRec && regRec.dbId ? regRec.dbId : null;
        return window.EventoraSubmissionsApi.upsertSubmission({
          eventId: snap.event.dbId,
          roundDbId: snap.round.dbId,
          participantId,
          teamId,
          submissionType: subType,
          submissionData: subData,
          submissionStatus: 'Submitted'
        });
      }

      document.getElementById('evPpQuizForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!snap.targetKey) return;
        const missingReq = (pkg.questions || []).find((q) => {
          if (q.mandatory === false) return false;
          const v = portalState.quizAnswers[q.id];
          return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        });
        if (missingReq) {
          toast(`Please answer mandatory question Q${missingReq.order}.`);
          return;
        }
        const dbRes = await persistSubmissionToDb('quiz', { answers: portalState.quizAnswers, historyNote: 'Participant submitted MCQ quiz responses' });
        if (!dbRes.ok) {
          toast(dbRes.error || 'Database rejected quiz submission.');
          return;
        }
        const res = window.EventoraStore.autoEvaluateRoundMcq(slug, roundId, snap.targetKey, portalState.quizAnswers, user, {
          submittedAt: new Date().toISOString()
        });
        if (res.ok) {
          toast('Quiz submission recorded! Scores appear after organizer publication.');
          if (onSubmitted) onSubmitted();
          renderPortal();
        } else {
          toast(res.error || 'Could not record quiz submission.');
        }
      });

      // Coding submission
      document.getElementById('evPpCodeProbSel')?.addEventListener('change', (e) => { portalState.selectedProblemId = e.target.value; });
      document.getElementById('evPpCodeLangSel')?.addEventListener('change', (e) => { portalState.codingLang = e.target.value; });
      document.getElementById('evPpCodeEditor')?.addEventListener('input', (e) => { portalState.codeDraft = e.target.value; });
      document.getElementById('evPpCodeSubForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!portalState.codeDraft.trim()) {
          toast('Enter or paste your solution code before submitting.');
          return;
        }
        const payload = {
          submissionType: 'coding',
          problemId: portalState.selectedProblemId,
          selectedLanguage: portalState.codingLang,
          submittedCode: portalState.codeDraft,
          historyNote: 'Participant submitted coding solution'
        };
        const dbRes = await persistSubmissionToDb('coding', payload);
        if (!dbRes.ok) {
          toast(dbRes.error || 'Database rejected coding submission.');
          return;
        }
        const res = window.EventoraStore.recordRoundSubmission(slug, roundId, snap.targetKey, payload, user);
        if (res.ok) {
          toast('Coding solution submitted cleanly for organizer evaluation.');
          if (onSubmitted) onSubmitted();
          renderPortal();
        }
      });

      // Technical challenge submission
      document.getElementById('evPpRepoUrl')?.addEventListener('input', (e) => { portalState.repoUrl = e.target.value; });
      document.getElementById('evPpLiveUrl')?.addEventListener('input', (e) => { portalState.liveUrl = e.target.value; });
      document.getElementById('evPpChalDesc')?.addEventListener('input', (e) => { portalState.chalDesc = e.target.value; });
      document.getElementById('evPpChalFile')?.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        portalState.chalFileName = f.name;
        if (window.EventoraStore.getBackendMode && window.EventoraStore.getBackendMode() === 'supabase' && snap.event.dbId && snap.round.dbId && window.EventoraSupabase && window.EventoraSupabase.storage) {
          const up = await window.EventoraSupabase.storage.uploadMedia({
            category: 'submissions',
            eventId: snap.event.dbId,
            roundId: snap.round.dbId,
            file: f
          });
          if (!up.ok) {
            toast(up.error || 'Submission file upload failed.');
            return;
          }
          portalState.chalStoragePath = up.path;
        } else if (window.EventoraFiles) {
          await window.EventoraFiles.saveFile({ eventSlug: slug, roundId, fileName: f.name, mimeType: f.type, sizeBytes: f.size, blob: f });
        }
        renderPortal();
      });

      document.getElementById('evPpChallengeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          submissionType: snap.round.typeKey,
          repoUrl: portalState.repoUrl,
          liveUrl: portalState.liveUrl,
          attachedFiles: portalState.chalFileName ? [portalState.chalFileName] : [],
          attachmentPaths: portalState.chalStoragePath ? [portalState.chalStoragePath] : [],
          description: portalState.chalDesc,
          historyNote: 'Participant submitted challenge deliverable'
        };
        const dbRes = await persistSubmissionToDb(snap.round.typeKey, payload);
        if (!dbRes.ok) {
          toast(dbRes.error || 'Database rejected challenge submission.');
          return;
        }
        const res = window.EventoraStore.recordRoundSubmission(slug, roundId, snap.targetKey, payload, user);
        if (res.ok) {
          toast('Challenge submission saved cleanly.');
          if (onSubmitted) onSubmitted();
          renderPortal();
        }
      });

      function mountElOrDoc(sel) {
        return hostEl ? hostEl.querySelectorAll(sel) : [];
      }
    }

    renderPortal();
    portalTickerId = window.setInterval(() => {
      const timerEl = document.getElementById('evPpTimerText');
      if (!timerEl) return;
      const ev = window.EventoraStore.getEventBySlug(slug);
      const rOp = ev && ev.liveOps && ev.liveOps.roundsById[roundId];
      if (rOp && (rOp.roundStatus === 'Live' || rOp.roundStatus === 'Paused')) {
        const snap = window.EventoraStore.computeTimerSnapshot(rOp, Date.now());
        timerEl.textContent = snap.hasDuration ? formatHMS(snap.remainingSeconds) : formatHMS(snap.elapsedSeconds);
      }
    }, 1000);
  }

  return {
    openRoundPortal,
    stopTicker
  };
})();

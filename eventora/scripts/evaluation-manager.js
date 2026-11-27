/* ==========================================================================
   EVENTORA PHASE 9: EVALUATION, SCORING, QUALIFICATION & LEADERBOARDS
   Supports round-wise manual & rubric scoring, Phase 8 MCQ auto-evaluation
   (single, multi-correct, T/F, negative marking), coding & frontend reviews,
   tie-breakers, qualification progression, weighted overall scoring & CSVs.
   ========================================================================== */

window.EventoraEvaluation = (function () {
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

  function getActor() {
    if (window.EventoraAuth && typeof window.EventoraAuth.getSession === 'function') {
      return window.EventoraAuth.getSession() || null;
    }
    return null;
  }

  function confirmAction(opts) {
    if (window.EventoraWorkspace && typeof window.EventoraWorkspace.openConfirm === 'function') {
      window.EventoraWorkspace.openConfirm(opts);
    } else if (typeof opts.onConfirm === 'function') {
      opts.onConfirm();
    }
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getEvalBadgeClass(status) {
    if (status === 'Evaluated' || status === 'Approved') return 'ev-lc-badge-live';
    if (status === 'Under Review') return 'ev-lc-badge-paused';
    if (status === 'Rejected') return 'ev-lc-badge-danger';
    return 'ev-lc-badge-upcoming';
  }

  function downloadCsvText(fileName, csvText) {
    try {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL && window.URL.createObjectURL
        ? window.URL.createObjectURL(blob)
        : `data:text/csv;charset=utf-8,${encodeURIComponent(csvText)}`;
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
      toast('Failed to trigger CSV download.');
    }
  }

  function mount(mountEl, options) {
    if (!mountEl || !window.EventoraStore) return;
    const cfg = options || {};
    const slug = cfg.slug || '';
    const onJumpSection = typeof cfg.onJumpSection === 'function' ? cfg.onJumpSection : null;
    const onUpdated = typeof cfg.onUpdated === 'function' ? cfg.onUpdated : null;

    const uiState = {
      selectedRoundId: cfg.initialRoundId || '',
      activeTab: 'evaluate', // 'evaluate' | 'rubric' | 'scores' | 'qualification' | 'leaderboards'
      searchQuery: '',
      statusFilter: 'ALL',
      scoreSortBy: 'rank', // 'rank' | 'name' | 'score_desc' | 'score_asc'
      inspectTargetKey: '', // open score/submission modal
      recordSubTargetKey: '', // open manual submission recorder
      critTitle: '',
      critMaxMarks: '20',
      critDesc: '',
      editingCritId: '',
      scoreError: '',
      selectedNextRoundId: '',
      mcqTargetKey: '',
      mcqDraftAnswers: {},
      lbScope: 'round' // 'round' | 'overall'
    };

    function applyResult(res, msg) {
      if (!res || !res.ok) {
        if (res && res.error) toast(res.error);
        return false;
      }
      if (msg) toast(msg);
      if (onUpdated && res.event) onUpdated(res.event);
      render();
      return true;
    }

    function renderInspectScoreModal(ev, round, rEval, targetRow) {
      if (!targetRow) return '';
      const sub = targetRow.submission;
      const rec = targetRow.evaluation;
      const criteria = rEval.rubric.criteria || [];
      const hasRubric = criteria.length > 0;
      const maxTotal = hasRubric
        ? criteria.reduce((s, c) => s + c.maxMarks, 0)
        : (rec ? rec.maxMarks : rEval.rubric.maxScore);
      const currentAwarded = rec ? rec.awardedMarks : 0;
      const pkg = window.EventoraStore.getRoundContentPackage(slug, round.id);
      const isCoding = round.typeKey === 'coding';
      const isFrontend = round.typeKey === 'frontend';

      return `
        <div class="ev-rc-modal-backdrop" id="evEvScoreModal">
          <div class="ev-rc-modal ev-rc-modal-lg" role="dialog" aria-modal="true" aria-label="Evaluation &amp; Score Entry">
            <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
              <div>
                <span class="ev-badge ev-badge-open">Round ${round.order}: ${esc(round.name)}</span>
                <h3 class="ev-display" style="font-size:1.28rem;font-weight:600;margin-top:0.25rem;">
                  Evaluate: ${esc(targetRow.name)}
                </h3>
                <p style="font-size:0.8rem;color:var(--ev-muted);">
                  ID: <code>${esc(targetRow.displayId)}</code> &bull; Live: ${esc(targetRow.liveStatus)}
                  ${targetRow.submittedAt ? ` &bull; Submitted ${formatDateShort(targetRow.submittedAt)}` : ' &bull; No submission recorded'}
                </p>
              </div>
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvCloseScoreModalBtn">Close</button>
            </div>

            ${sub ? `
              <div class="ev-rc-subpanel" style="margin-bottom:0.9rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.45rem;">
                  <strong style="font-size:0.88rem;color:var(--ev-forest);">Submitted Material (${esc(sub.submissionType)})</strong>
                  <span style="font-size:0.75rem;color:var(--ev-muted);">Timestamp: ${formatDateShort(sub.submittedAt)}</span>
                </div>
                ${isCoding ? `
                  <div style="font-size:0.8rem;color:var(--ev-charcoal);margin-bottom:0.35rem;">
                    Language: <strong>${esc(sub.selectedLanguage || 'Not specified')}</strong>
                    ${sub.problemId && pkg ? ` &bull; Problem: <strong>${esc((pkg.codingProblems.find((p) => p.id === sub.problemId) || {}).problemTitle || sub.problemId)}</strong>` : ''}
                  </div>
                  <div class="ev-lc-proto-banner" style="margin-bottom:0.45rem;font-size:0.76rem;">
                    Manual Code Evaluation Only — Automated code execution and synthetic test-case passes are intentionally disabled.
                  </div>
                  ${sub.submittedCode ? `<pre class="ev-rc-code">${esc(sub.submittedCode)}</pre>` : '<p style="font-size:0.8rem;color:var(--ev-muted);">No source code snippet pasted.</p>'}
                ` : ''}
                ${isFrontend || sub.repoUrl || sub.liveUrl ? `
                  <div style="display:flex;gap:0.75rem;flex-wrap:wrap;font-size:0.82rem;margin-bottom:0.35rem;">
                    ${sub.repoUrl ? `<a href="${esc(sub.repoUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--ev-forest);font-weight:600;">GitHub Repository &rarr;</a>` : ''}
                    ${sub.liveUrl ? `<a href="${esc(sub.liveUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--ev-forest);font-weight:600;">Live Project URL &rarr;</a>` : ''}
                  </div>
                ` : ''}
                ${sub.attachedFiles && sub.attachedFiles.length ? `
                  <div style="font-size:0.78rem;color:var(--ev-muted);margin-bottom:0.3rem;">Files: ${sub.attachedFiles.map(esc).join(', ')}</div>
                ` : ''}
                ${sub.description ? `<p style="font-size:0.82rem;color:var(--ev-charcoal);margin:0;">${esc(sub.description)}</p>` : ''}
                ${rec && rec.mcqBreakdown ? `
                  <div style="margin-top:0.45rem;font-size:0.8rem;color:var(--ev-forest);">
                    Auto MCQ Breakdown: <strong>${rec.mcqBreakdown.correctCount}</strong> correct &bull;
                    <strong>${rec.mcqBreakdown.partialCount || 0}</strong> partial &bull;
                    <strong>${rec.mcqBreakdown.wrongCount}</strong> wrong &bull;
                    <strong>${rec.mcqBreakdown.unansweredCount}</strong> unanswered
                    (Rule: ${esc(rec.mcqBreakdown.multiAnswerRule)})
                  </div>
                ` : ''}
              </div>
            ` : ''}

            ${uiState.scoreError ? `<div class="ev-lc-alert ev-lc-alert-danger" style="margin-bottom:0.75rem;">${esc(uiState.scoreError)}</div>` : ''}

            <form id="evEvScoreForm" style="display:flex;flex-direction:column;gap:0.75rem;" novalidate>
              ${hasRubric ? `
                <div class="ev-rc-subpanel">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
                    <strong style="font-size:0.9rem;color:var(--ev-charcoal);">Rubric Criteria Scoring</strong>
                    <span class="ev-lc-pill" id="evEvLiveSumBadge">Total: ${currentAwarded} / ${maxTotal} marks</span>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    ${criteria.map((c) => {
                      const cVal = rec && rec.criteriaMarks && rec.criteriaMarks[c.id] != null ? rec.criteriaMarks[c.id] : 0;
                      return `
                        <div style="display:grid;grid-template-columns:1fr 120px;gap:0.65rem;align-items:center;padding:0.5rem 0.65rem;background:var(--ev-cream);border-radius:var(--ev-radius-sm);border:1px solid var(--ev-border);">
                          <div>
                            <div style="font-weight:600;font-size:0.86rem;color:var(--ev-charcoal);">${esc(c.title)} <span style="color:var(--ev-muted);font-weight:400;">(Max ${c.maxMarks})</span></div>
                            ${c.description ? `<div style="font-size:0.75rem;color:var(--ev-muted);">${esc(c.description)}</div>` : ''}
                          </div>
                          <input type="number" class="ev-input" data-ev-crit-input="${esc(c.id)}" min="0" max="${c.maxMarks}" step="0.5" value="${esc(cVal)}" aria-label="${esc(c.title)} marks">
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : `
                <div class="ev-lc-ann-grid">
                  <div>
                    <label class="ev-field-label" for="evEvManualAwarded">Awarded Marks (0 – ${maxTotal})</label>
                    <input type="number" class="ev-input" id="evEvManualAwarded" min="0" max="${maxTotal}" step="0.5" value="${esc(currentAwarded)}">
                  </div>
                  <div>
                    <label class="ev-field-label" for="evEvManualMax">Maximum Marks</label>
                    <input type="number" class="ev-input" id="evEvManualMax" min="1" step="1" value="${esc(maxTotal)}">
                  </div>
                </div>
              `}

              <div class="ev-lc-ann-grid">
                <div>
                  <label class="ev-field-label" for="evEvScoreStatus">Evaluation Status</label>
                  <select class="ev-select" id="evEvScoreStatus">
                    ${window.EventoraStore.EVALUATION_STATUSES.map((st) => `
                      <option value="${esc(st)}" ${(rec ? rec.evaluationStatus : 'Evaluated') === st ? 'selected' : ''}>${esc(st)}</option>
                    `).join('')}
                  </select>
                </div>
                <div style="display:flex;align-items:flex-end;font-size:0.78rem;color:var(--ev-muted);">
                  ${rec && rec.evaluatorName ? `Last evaluated by ${esc(rec.evaluatorName)} (${formatDateShort(rec.updatedAt)})` : 'New evaluation entry'}
                </div>
              </div>

              <div>
                <label class="ev-field-label" for="evEvPublicFeedback">Public Participant Feedback (Only visible if Results Publish enables Feedback)</label>
                <textarea class="ev-textarea" id="evEvPublicFeedback" rows="2" placeholder="Constructive feedback summary...">${esc(rec ? rec.publicFeedback : '')}</textarea>
              </div>

              <div>
                <label class="ev-field-label" for="evEvPrivateNotes">Internal Evaluator Notes / Code Review Remarks (Never Shown Publicly)</label>
                <textarea class="ev-textarea" id="evEvPrivateNotes" rows="2" placeholder="Internal judge observations...">${esc(rec ? rec.evaluationNotes : '')}</textarea>
              </div>

              <div style="display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;margin-top:0.25rem;">
                ${rec && (rec.evaluationStatus === 'Evaluated' || rec.evaluationStatus === 'Approved' || rec.evaluationStatus === 'Rejected') ? `
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvReopenEvalBtn">Reopen as Under Review</button>
                ` : ''}
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvSaveDraftEvalBtn">Save Draft (Under Review)</button>
                <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Save &amp; Finalize Evaluation</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    function renderRecordSubmissionModal(ev, round, targetRow) {
      if (!targetRow) return '';
      const pkg = window.EventoraStore.getRoundContentPackage(slug, round.id);
      return `
        <div class="ev-rc-modal-backdrop" id="evEvSubModal">
          <div class="ev-rc-modal" role="dialog" aria-modal="true" aria-label="Record Submission for Review">
            <div class="ev-ws-card-head" style="margin-bottom:0.8rem;">
              <div>
                <span class="ev-badge ev-badge-sample">Submission Intake</span>
                <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;margin-top:0.2rem;">Record Submission: ${esc(targetRow.name)}</h3>
              </div>
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvCloseSubModalBtn">Close</button>
            </div>
            <form id="evEvSubForm" style="display:flex;flex-direction:column;gap:0.65rem;" novalidate>
              ${round.typeKey === 'coding' ? `
                <div class="ev-lc-ann-grid">
                  <div>
                    <label class="ev-field-label" for="evEvSubLang">Programming Language</label>
                    <input type="text" class="ev-input" id="evEvSubLang" placeholder="e.g. Python 3.11 / C++20" value="Python">
                  </div>
                  <div>
                    <label class="ev-field-label" for="evEvSubProb">Problem</label>
                    <select class="ev-select" id="evEvSubProb">
                      <option value="">General Round Submission</option>
                      ${(pkg ? pkg.codingProblems : []).map((pr) => `<option value="${esc(pr.id)}">${esc(pr.problemTitle)}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div>
                  <label class="ev-field-label" for="evEvSubCode">Submitted Source Code</label>
                  <textarea class="ev-textarea" id="evEvSubCode" rows="4" style="font-family:monospace;font-size:0.82rem;" placeholder="Paste participant or team code for manual review..."></textarea>
                </div>
              ` : ''}
              <div class="ev-lc-ann-grid">
                <div>
                  <label class="ev-field-label" for="evEvSubRepo">GitHub / Repo URL (Optional)</label>
                  <input type="url" class="ev-input" id="evEvSubRepo" placeholder="https://github.com/...">
                </div>
                <div>
                  <label class="ev-field-label" for="evEvSubLive">Live Project / Submission URL (Optional)</label>
                  <input type="url" class="ev-input" id="evEvSubLive" placeholder="https://...">
                </div>
              </div>
              <div>
                <label class="ev-field-label" for="evEvSubDesc">Submission Notes / Files Summary</label>
                <textarea class="ev-textarea" id="evEvSubDesc" rows="2" placeholder="Description, attached filenames, or presentation notes..."></textarea>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">Save Submission Record</button>
              </div>
            </form>
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
              message: 'Add rounds in the Dynamic Round Builder before entering evaluations, setting rubrics, or publishing leaderboards.',
              actionHTML: onJumpSection ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvJumpRoundsBtn">Open Round Builder &rarr;</button>' : ''
            })}
          </div>
        `;
        document.getElementById('evEvJumpRoundsBtn')?.addEventListener('click', () => onJumpSection('rounds'));
        return;
      }

      if (!uiState.selectedRoundId || !rounds.some((r) => r.id === uiState.selectedRoundId)) {
        const activeLiveId = ev.liveOps && ev.liveOps.currentRoundId;
        uiState.selectedRoundId = activeLiveId && rounds.some((r) => r.id === activeLiveId) ? activeLiveId : rounds[0].id;
      }

      const round = rounds.find((r) => r.id === uiState.selectedRoundId) || rounds[0];
      const evalState = ev.evaluationState;
      const rEval = evalState.roundEvalsById[round.id];
      const standings = window.EventoraStore.computeRoundStandings(ev, round.id);
      const qPreview = window.EventoraStore.computeQualificationPreview(ev, round.id);
      const overallBoard = window.EventoraStore.computeOverallLeaderboard(ev);
      const roundPkg = window.EventoraStore.getRoundContentPackage(slug, round.id);

      const totalTargets = standings.length;
      const completedRoundCount = standings.filter((s) => s.liveStatus === 'Completed' || s.liveStatus === 'Submitted').length;
      const submissionsCount = standings.filter((s) => s.hasSubmission).length;
      const evaluatedCount = standings.filter((s) => s.isEvaluated).length;
      const pendingEvalCount = Math.max(0, totalTargets - evaluatedCount);
      const qualifiedCount = rEval.qualification.finalized ? rEval.qualification.qualifiedKeys.length : (qPreview ? qPreview.qualified.length : 0);
      const disqualifiedCount = standings.filter((s) => s.liveStatus === 'Disqualified' || s.evaluationStatus === 'Rejected').length;

      const qLower = uiState.searchQuery.trim().toLowerCase();
      let filteredStandings = standings.filter((row) => {
        if (uiState.statusFilter !== 'ALL' && row.evaluationStatus !== uiState.statusFilter) return false;
        if (qLower && !row.name.toLowerCase().includes(qLower) && !row.displayId.toLowerCase().includes(qLower)) return false;
        return true;
      });
      if (uiState.scoreSortBy === 'name') {
        filteredStandings = [...filteredStandings].sort((a, b) => a.name.localeCompare(b.name));
      } else if (uiState.scoreSortBy === 'score_asc') {
        filteredStandings = [...filteredStandings].sort((a, b) => a.awardedMarks - b.awardedMarks);
      } else if (uiState.scoreSortBy === 'score_desc') {
        filteredStandings = [...filteredStandings].sort((a, b) => b.awardedMarks - a.awardedMarks);
      }

      const downstreamRounds = rounds.filter((r) => r.order > round.order && r.enabled !== false);
      if (!uiState.selectedNextRoundId || !downstreamRounds.some((r) => r.id === uiState.selectedNextRoundId)) {
        uiState.selectedNextRoundId = downstreamRounds[0] ? downstreamRounds[0].id : '';
      }

      const weightCheck = window.EventoraStore.validateOverallWeights(ev, {});
      const inspectRow = uiState.inspectTargetKey ? standings.find((r) => r.targetKey === uiState.inspectTargetKey) : null;
      const recordSubRow = uiState.recordSubTargetKey ? standings.find((r) => r.targetKey === uiState.recordSubTargetKey) : null;

      mountEl.innerHTML = `
        <div class="ev-ev-shell">
          <div class="ev-lc-proto-banner">
            <strong>Local Evaluation &amp; Scoring Prototype:</strong> Rubrics, scores, MCQ auto-grading, qualification history, and published leaderboards persist in browser <code>sessionStorage</code>. Code review and technical assessments are manual (no fabricated execution passes).
          </div>

          <!-- HEADER & EVALUATION OVERVIEW -->
          <section class="ev-ws-card">
            <div class="ev-ws-card-head" style="margin-bottom:0.9rem;">
              <div>
                <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.35rem;">
                  <span class="ev-badge ev-badge-open">Phase 9 &bull; Evaluation &amp; Results</span>
                  <span class="ev-lc-badge ${evalState.overallConfig.published ? 'ev-lc-badge-live' : 'ev-lc-badge-upcoming'}">
                    Overall Results: ${evalState.overallConfig.published ? 'Published' : 'Unpublished'}
                  </span>
                </div>
                <h2 class="ev-display" style="font-size:1.45rem;font-weight:600;">${esc(ev.name)} — Scoring, Qualification &amp; Leaderboards</h2>
                <p style="font-size:0.84rem;color:var(--ev-muted);">Evaluate round submissions, run automatic MCQ grading, apply tie-breakers, advance qualifiers, and publish leaderboards.</p>
              </div>
              <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                ${onJumpSection ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvGoContentBtn">Round Content</button>` : ''}
                ${onJumpSection ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvGoLiveBtn">Live Control &rarr;</button>` : ''}
              </div>
            </div>

            <div class="ev-rc-round-tabs" style="margin-bottom:0.85rem;">
              ${rounds.map((r) => {
                const isSel = r.id === round.id;
                const re = evalState.roundEvalsById[r.id];
                const scoredN = Object.values(re.scoresByTarget || {}).filter((s) => s.evaluationStatus === 'Evaluated' || s.evaluationStatus === 'Approved').length;
                return `
                  <button type="button" class="ev-rc-round-tab ${isSel ? 'is-selected' : ''}" data-ev-select-round="${esc(r.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;">
                      <span style="font-size:0.74rem;font-weight:700;color:var(--ev-primary);">Round ${r.order} &bull; ${esc(r.typeLabel)}</span>
                      <span class="ev-lc-badge ${re.publication.roundPublished ? 'ev-lc-badge-live' : 'ev-lc-badge-upcoming'}">${re.publication.roundPublished ? 'Published' : 'Draft'}</span>
                    </div>
                    <div style="font-weight:600;color:var(--ev-charcoal);font-size:0.9rem;margin-top:0.2rem;">${esc(r.name)}</div>
                    <div style="font-size:0.74rem;color:var(--ev-muted);margin-top:0.15rem;">${scoredN} scored &bull; Max ${re.rubric.maxScore}</div>
                  </button>
                `;
              }).join('')}
            </div>

            <div class="ev-ev-overview-grid">
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Round Scope Roster</div>
                <div class="ev-lc-stat-val">${totalTargets} ${ev.teamConfig.supported ? 'Teams' : 'Participants'}</div>
                <div class="ev-lc-stat-sub">${completedRoundCount} completed/submitted live</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Submissions Received</div>
                <div class="ev-lc-stat-val">${submissionsCount} Recorded</div>
                <div class="ev-lc-stat-sub">${evaluatedCount} evaluated &bull; ${pendingEvalCount} pending</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Qualification Status</div>
                <div class="ev-lc-stat-val">${qualifiedCount} Qualified</div>
                <div class="ev-lc-stat-sub">${rEval.qualification.finalized ? 'Finalized' : 'Preview Mode'} &bull; ${disqualifiedCount} disqualified/rejected</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Round Results Status</div>
                <div class="ev-lc-stat-val">${rEval.publication.roundPublished ? 'Published' : 'Hidden'}</div>
                <div class="ev-lc-stat-sub">${rEval.publication.leaderboardPublished ? 'Round Leaderboard Public' : 'Leaderboard Private'}</div>
              </div>
            </div>

            <div class="ev-ev-subnav">
              ${[
                ['evaluate', 'Evaluate &amp; Submissions'],
                ['rubric', (round.typeKey === 'quiz' || round.typeKey === 'mcq') ? 'MCQ &amp; Rubric Rules' : 'Rubric Criteria'],
                ['scores', 'Score Table &amp; CSV'],
                ['qualification', 'Qualification &amp; Progression'],
                ['leaderboards', 'Leaderboards &amp; Publish']
              ].map(([id, lbl]) => `
                <button type="button" class="ev-btn ev-btn-sm ${uiState.activeTab === id ? 'ev-btn-forest' : 'ev-btn-outline'}" data-ev-tab="${id}">${lbl}</button>
              `).join('')}
            </div>
          </section>

          <!-- TAB 1: ROUND-WISE EVALUATION & SUBMISSIONS -->
          ${uiState.activeTab === 'evaluate' ? `
            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
                <div>
                  <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;">Round ${round.order}: ${esc(round.name)} — Evaluation Queue</h3>
                  <p style="font-size:0.82rem;color:var(--ev-muted);">
                    Scoring mode: <strong>${esc(rEval.rubric.mode)}</strong> &bull; Max Marks: <strong>${rEval.rubric.maxScore}</strong>
                    ${rEval.rubric.criteria.length ? ` (${rEval.rubric.criteria.length} rubric criteria)` : ''}
                  </p>
                </div>
              </div>

              ${totalTargets === 0 ? window.EventoraWorkspace.renderEmptyState({
                iconName: 'participants',
                title: 'No Eligible Participants or Teams Found',
                message: 'Participants or teams must be registered (or progressed from a prior round) before evaluations can be entered.',
                actionHTML: onJumpSection ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvJumpRosterBtn">Open Participants / Teams</button>' : ''
              }) : `
                <div class="ev-lc-filter-bar">
                  <input type="search" class="ev-input" id="evEvSearchInput" placeholder="Search participant, team, or ID..." value="${esc(uiState.searchQuery)}" style="flex:1;min-width:210px;">
                  <select class="ev-select" id="evEvStatusFilter" style="width:auto;min-width:180px;">
                    <option value="ALL" ${uiState.statusFilter === 'ALL' ? 'selected' : ''}>All Evaluation Statuses</option>
                    ${window.EventoraStore.EVALUATION_STATUSES.map((st) => `<option value="${esc(st)}" ${uiState.statusFilter === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
                  </select>
                </div>

                <div class="ev-lc-table-wrap">
                  <table class="ev-lc-table">
                    <thead>
                      <tr>
                        <th>Participant / Team</th>
                        <th>Submission</th>
                        <th>Score</th>
                        <th>Evaluation Status</th>
                        <th>Evaluator</th>
                        <th style="text-align:right;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredStandings.map((row) => `
                        <tr>
                          <td>
                            <div style="font-weight:600;color:var(--ev-charcoal);">${esc(row.name)}</div>
                            <div style="font-size:0.75rem;color:var(--ev-muted);"><code>${esc(row.displayId)}</code> &bull; ${esc(row.secondaryLabel)}</div>
                          </td>
                          <td>
                            ${row.hasSubmission
                              ? `<span class="ev-lc-badge ev-lc-badge-submitted">${esc(row.submission.submissionType)}</span> <span style="font-size:0.74rem;color:var(--ev-muted);">${formatDateShort(row.submittedAt)}</span>`
                              : `<span class="ev-lc-pill">No submission</span>`}
                          </td>
                          <td>
                            <strong>${row.isEvaluated || row.evaluation ? `${row.awardedMarks} / ${row.maxMarks}` : `— / ${row.maxMarks}`}</strong>
                            ${row.evaluation ? `<div style="font-size:0.74rem;color:var(--ev-muted);">${row.percentage}%</div>` : ''}
                          </td>
                          <td><span class="ev-lc-badge ${getEvalBadgeClass(row.evaluationStatus)}">${esc(row.evaluationStatus)}</span></td>
                          <td style="font-size:0.78rem;color:var(--ev-muted);">${esc(row.evaluatorName || '—')}</td>
                          <td>
                            <div class="ev-lc-row-btns">
                              <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-open-sub="${esc(row.targetKey)}">${row.hasSubmission ? 'Update Sub' : 'Record Sub'}</button>
                              <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-ev-inspect="${esc(row.targetKey)}">Inspect &amp; Score</button>
                            </div>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </section>
          ` : ''}

          <!-- TAB 2: RUBRIC CRITERIA & MCQ AUTO-EVALUATION RULES -->
          ${uiState.activeTab === 'rubric' ? `
            <div class="ev-lc-two-col">
              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <span class="ev-badge ev-badge-open" style="margin-bottom:0.3rem;">Custom Criteria Builder</span>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Round ${round.order} Rubric Criteria</h3>
                    <p style="font-size:0.82rem;color:var(--ev-muted);">Total Computed Max Marks: <strong>${rEval.rubric.maxScore}</strong> (${rEval.rubric.criteria.length} criteria)</p>
                  </div>
                </div>

                <form id="evEvCritForm" class="ev-rc-subpanel" style="margin-bottom:0.9rem;" novalidate>
                  <strong style="display:block;font-size:0.9rem;color:var(--ev-charcoal);margin-bottom:0.55rem;">${uiState.editingCritId ? 'Edit Criterion' : 'Add Rubric Criterion'}</strong>
                  <div class="ev-lc-ann-grid">
                    <div>
                      <label class="ev-field-label" for="evEvCritTitle">Criterion Name *</label>
                      <input type="text" class="ev-input" id="evEvCritTitle" placeholder="e.g. UI Design / Functionality" value="${esc(uiState.critTitle)}">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evEvCritMax">Maximum Marks *</label>
                      <input type="number" min="1" class="ev-input" id="evEvCritMax" value="${esc(uiState.critMaxMarks)}">
                    </div>
                  </div>
                  <div style="margin-top:0.55rem;">
                    <label class="ev-field-label" for="evEvCritDesc">Evaluation Guide (Optional)</label>
                    <input type="text" class="ev-input" id="evEvCritDesc" placeholder="What judges look for..." value="${esc(uiState.critDesc)}">
                  </div>
                  <div style="display:flex;justify-content:flex-end;gap:0.45rem;margin-top:0.65rem;">
                    ${uiState.editingCritId ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evEvCancelCritBtn">Cancel</button>` : ''}
                    <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm">${uiState.editingCritId ? 'Update Criterion' : '+ Add Criterion'}</button>
                  </div>
                </form>

                ${rEval.rubric.criteria.length === 0 ? `
                  <div class="ev-lc-inline-note">
                    <span>No custom criteria defined — single manual score (0–${rEval.rubric.maxScore}) or MCQ grading applies. Add criteria anytime for rubric scoring.</span>
                  </div>
                ` : `
                  <div class="ev-rc-items-list">
                    ${rEval.rubric.criteria.map((c, idx) => `
                      <div class="ev-rc-item-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        <div>
                          <div style="font-weight:600;color:var(--ev-charcoal);font-size:0.9rem;">${idx + 1}. ${esc(c.title)} <span class="ev-lc-pill">${c.maxMarks} marks</span></div>
                          ${c.description ? `<div style="font-size:0.77rem;color:var(--ev-muted);">${esc(c.description)}</div>` : ''}
                        </div>
                        <div style="display:flex;gap:0.3rem;">
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-crit-up="${esc(c.id)}" ${idx === 0 ? 'disabled' : ''}>&uarr;</button>
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-crit-down="${esc(c.id)}" ${idx === rEval.rubric.criteria.length - 1 ? 'disabled' : ''}>&darr;</button>
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-crit-edit="${esc(c.id)}">Edit</button>
                          <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-ev-crit-del="${esc(c.id)}">Delete</button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </section>

              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <span class="ev-badge ev-badge-sample" style="margin-bottom:0.3rem;">Phase 8 MCQ Auto-Evaluator</span>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Quiz &amp; MCQ Grading Configuration</h3>
                    <p style="font-size:0.82rem;color:var(--ev-muted);">${roundPkg ? roundPkg.questions.length : 0} structured question(s) in Round ${round.order}.</p>
                  </div>
                </div>

                <form id="evEvMcqConfigForm" style="display:flex;flex-direction:column;gap:0.7rem;" novalidate>
                  <div>
                    <label class="ev-field-label" for="evEvMultiRuleSel">Multiple-Correct Scoring Rule</label>
                    <select class="ev-select" id="evEvMultiRuleSel">
                      ${window.EventoraStore.MULTI_ANSWER_SCORING_RULES.map((m) => `
                        <option value="${esc(m.key)}" ${rEval.rubric.multiAnswerRule === m.key ? 'selected' : ''}>${esc(m.label)}</option>
                      `).join('')}
                    </select>
                  </div>
                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.84rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evEvApplyNegChk" ${rEval.rubric.applyNegativeMarking ? 'checked' : ''}>
                    <span>Apply Negative Marking for Wrong Answers</span>
                  </label>
                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="submit" class="ev-btn ev-btn-outline ev-btn-sm">Save MCQ Scoring Rules</button>
                    <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvRecalcMcqBtn">Recalculate Submitted MCQs</button>
                  </div>
                </form>

                <hr style="border:0;border-top:1px solid var(--ev-border);margin:1rem 0;">

                <div>
                  <div style="font-weight:600;font-size:0.9rem;color:var(--ev-charcoal);margin-bottom:0.45rem;">Grade / Record Individual MCQ Attempt</div>
                  ${!roundPkg || roundPkg.questions.length === 0 ? `
                    <div class="ev-lc-inline-note"><span>Add questions inside Phase 8 Round Content first to run automated MCQ grading.</span></div>
                  ` : (totalTargets === 0 ? `<div class="ev-lc-inline-note"><span>No participants/teams registered yet.</span></div>` : `
                    <div style="display:flex;flex-direction:column;gap:0.55rem;">
                      <select class="ev-select" id="evEvMcqTargetSel">
                        <option value="">Select Participant / Team...</option>
                        ${standings.map((t) => `<option value="${esc(t.targetKey)}" ${uiState.mcqTargetKey === t.targetKey ? 'selected' : ''}>${esc(t.name)} (${esc(t.displayId)})</option>`).join('')}
                      </select>
                      ${uiState.mcqTargetKey ? `
                        <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.45rem;padding:0.5rem;background:var(--ev-cream);border-radius:var(--ev-radius-sm);border:1px solid var(--ev-border);">
                          ${roundPkg.questions.map((q) => {
                            const draftVal = uiState.mcqDraftAnswers[q.id];
                            return `
                              <div style="padding:0.5rem;background:var(--ev-white);border-radius:6px;border:1px solid var(--ev-border);">
                                <div style="font-size:0.82rem;font-weight:600;">Q${q.order}. ${esc(q.prompt)} <span class="ev-lc-pill">${q.marks}m</span></div>
                                ${q.questionType === 'short_answer' ? `
                                  <input type="text" class="ev-input" style="margin-top:0.35rem;" data-ev-mcq-ans="${esc(q.id)}" value="${esc(draftVal || '')}" placeholder="Answer response">
                                ` : `
                                  <div style="display:flex;gap:0.55rem;flex-wrap:wrap;margin-top:0.35rem;">
                                    ${q.options.map((o, oi) => {
                                      const checked = q.questionType === 'mcq_multi'
                                        ? (Array.isArray(draftVal) && draftVal.includes(oi))
                                        : (Number(draftVal) === oi);
                                      return `
                                        <label style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.78rem;">
                                          <input type="${q.questionType === 'mcq_multi' ? 'checkbox' : 'radio'}" name="evMcqQ_${esc(q.id)}" data-ev-mcq-opt="${esc(q.id)}" value="${oi}" ${checked ? 'checked' : ''}>
                                          ${esc(o)}
                                        </label>
                                      `;
                                    }).join('')}
                                  </div>
                                `}
                              </div>
                            `;
                          }).join('')}
                        </div>
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvRunAutoMcqBtn">Auto-Evaluate MCQ Attempt</button>
                      ` : ''}
                    </div>
                  `)}
                </div>
              </section>
            </div>
          ` : ''}

          <!-- TAB 3: SCORE MANAGEMENT & CSV EXPORTS -->
          ${uiState.activeTab === 'scores' ? `
            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
                <div>
                  <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;">Score Management &amp; CSV Exports — Round ${round.order}</h3>
                  <p style="font-size:0.82rem;color:var(--ev-muted);">Deterministic single-record-per-target scores with live sorting, editing, and CSV reporting.</p>
                </div>
                <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-csv="round_scores">Export Round Scores CSV</button>
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-csv="evaluations">Export Full Evaluations CSV</button>
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-csv="qualified">Export Qualified CSV</button>
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-ev-csv="overall_leaderboard">Export Overall CSV</button>
                </div>
              </div>

              <div class="ev-lc-filter-bar">
                <input type="search" class="ev-input" id="evEvSearchInput" placeholder="Search name or ID..." value="${esc(uiState.searchQuery)}" style="flex:1;min-width:200px;">
                <select class="ev-select" id="evEvScoreSortSel" style="width:auto;min-width:170px;">
                  <option value="rank" ${uiState.scoreSortBy === 'rank' ? 'selected' : ''}>Sort by Rank</option>
                  <option value="score_desc" ${uiState.scoreSortBy === 'score_desc' ? 'selected' : ''}>Highest Score</option>
                  <option value="score_asc" ${uiState.scoreSortBy === 'score_asc' ? 'selected' : ''}>Lowest Score</option>
                  <option value="name" ${uiState.scoreSortBy === 'name' ? 'selected' : ''}>Name (A–Z)</option>
                </select>
              </div>

              ${filteredStandings.length === 0 ? `
                <div class="ev-lc-inline-note"><span>No scores recorded matching current filters.</span></div>
              ` : `
                <div class="ev-lc-table-wrap">
                  <table class="ev-lc-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Participant / Team</th>
                        <th>Round</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Status</th>
                        <th style="text-align:right;">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredStandings.map((row) => `
                        <tr>
                          <td><strong>${row.rank != null ? `#${row.rank}${row.isTied ? ' (Tied)' : ''}` : '—'}</strong></td>
                          <td>
                            <div style="font-weight:600;color:var(--ev-charcoal);">${esc(row.name)}</div>
                            <div style="font-size:0.74rem;color:var(--ev-muted);"><code>${esc(row.displayId)}</code></div>
                          </td>
                          <td>R${round.order}</td>
                          <td><strong>${row.awardedMarks}</strong> / ${row.maxMarks}</td>
                          <td>${row.percentage}%</td>
                          <td><span class="ev-lc-badge ${getEvalBadgeClass(row.evaluationStatus)}">${esc(row.evaluationStatus)}</span></td>
                          <td style="text-align:right;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-ev-inspect="${esc(row.targetKey)}">Edit Score</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </section>
          ` : ''}

          <!-- TAB 4: QUALIFICATION RULES, TIE-BREAKERS & PROGRESSION -->
          ${uiState.activeTab === 'qualification' && qPreview ? `
            <div class="ev-lc-two-col">
              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <span class="ev-badge ev-badge-open" style="margin-bottom:0.3rem;">Qualification &amp; Tie Rules</span>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Round ${round.order} Qualification</h3>
                  </div>
                  <span class="ev-lc-badge ${rEval.qualification.finalized ? 'ev-lc-badge-live' : 'ev-lc-badge-paused'}">
                    ${rEval.qualification.finalized ? 'Finalized' : 'Preview Mode'}
                  </span>
                </div>

                <form id="evEvQualForm" style="display:flex;flex-direction:column;gap:0.72rem;" novalidate>
                  <div class="ev-lc-ann-grid">
                    <div>
                      <label class="ev-field-label" for="evEvQualStrat">Qualification Strategy</label>
                      <select class="ev-select" id="evEvQualStrat">
                        ${window.EventoraStore.QUALIFICATION_STRATEGIES.map((s) => `
                          <option value="${esc(s.key)}" ${rEval.qualification.strategy === s.key ? 'selected' : ''}>${esc(s.label)}</option>
                        `).join('')}
                      </select>
                    </div>
                    <div>
                      <label class="ev-field-label" for="evEvTieRuleSel">Tie-Breaker Rule</label>
                      <select class="ev-select" id="evEvTieRuleSel">
                        ${window.EventoraStore.TIE_BREAKER_MODES.map((m) => `
                          <option value="${esc(m.key)}" ${rEval.tieBreaker.primaryRule === m.key ? 'selected' : ''}>${esc(m.label)}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>

                  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.55rem;">
                    <div>
                      <label class="ev-field-label" for="evEvTopN">Top N Cutoff</label>
                      <input type="number" min="1" class="ev-input" id="evEvTopN" value="${esc(rEval.qualification.topN)}">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evEvMinScore">Min Score</label>
                      <input type="number" min="0" step="0.5" class="ev-input" id="evEvMinScore" value="${esc(rEval.qualification.minScore)}">
                    </div>
                    <div>
                      <label class="ev-field-label" for="evEvMinPct">Min Percentage (%)</label>
                      <input type="number" min="0" max="100" step="1" class="ev-input" id="evEvMinPct" value="${esc(rEval.qualification.minPercentage)}">
                    </div>
                  </div>

                  ${rEval.tieBreaker.primaryRule === 'criterion_score' && rEval.rubric.criteria.length ? `
                    <div>
                      <label class="ev-field-label" for="evEvTieCritSel">Tie-Break Criterion</label>
                      <select class="ev-select" id="evEvTieCritSel">
                        ${rEval.rubric.criteria.map((c) => `<option value="${esc(c.id)}" ${rEval.tieBreaker.criterionId === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}
                      </select>
                    </div>
                  ` : ''}

                  ${rEval.tieBreaker.primaryRule === 'other_round_score' ? `
                    <div>
                      <label class="ev-field-label" for="evEvTieRndSel">Tie-Break Reference Round</label>
                      <select class="ev-select" id="evEvTieRndSel">
                        ${rounds.filter((r) => r.id !== round.id).map((r) => `<option value="${esc(r.id)}" ${rEval.tieBreaker.refRoundId === r.id ? 'selected' : ''}>R${r.order}: ${esc(r.name)}</option>`).join('')}
                      </select>
                    </div>
                  ` : ''}

                  <label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.82rem;color:var(--ev-charcoal);">
                    <input type="checkbox" id="evEvAllowPendChk" ${rEval.qualification.allowPendingEvaluation ? 'checked' : ''}>
                    <span>Allow incomplete/pending evaluation entries to qualify (not recommended)</span>
                  </label>

                  ${rEval.qualification.strategy === 'manual' ? `
                    <div class="ev-rc-subpanel">
                      <div style="font-size:0.78rem;font-weight:700;color:var(--ev-primary);margin-bottom:0.4rem;">Manual Qualifier Checkboxes</div>
                      <div style="max-height:175px;overflow-y:auto;display:flex;flex-direction:column;gap:0.35rem;">
                        ${standings.map((row) => `
                          <label style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;">
                            <span>
                              <input type="checkbox" data-ev-manual-q="${esc(row.targetKey)}" ${(rEval.qualification.manualSelectedKeys || []).includes(row.targetKey) ? 'checked' : ''}>
                              <strong>${esc(row.name)}</strong> (${row.awardedMarks}/${row.maxMarks})
                            </span>
                            <span class="ev-lc-pill">${esc(row.evaluationStatus)}</span>
                          </label>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="submit" class="ev-btn ev-btn-outline ev-btn-sm">Save Qualification Rules</button>
                    ${!rEval.qualification.finalized ? `
                      <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvFinalizeQualBtn">Finalize Qualification (${qPreview.qualified.length})</button>
                    ` : `
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvReopenQualBtn">Reopen Qualification</button>
                    `}
                  </div>
                </form>

                ${qPreview.boundaryTieWarning ? `
                  <div class="ev-lc-alert ev-lc-alert-warn">
                    <strong>Tie At Cutoff Detected:</strong> ${esc(qPreview.boundaryTieWarning)}
                  </div>
                ` : ''}

                <hr style="border:0;border-top:1px solid var(--ev-border);margin:1rem 0;">

                <div>
                  <strong style="display:block;font-size:0.9rem;color:var(--ev-charcoal);margin-bottom:0.45rem;">Next Round Progression</strong>
                  ${downstreamRounds.length === 0 ? `
                    <div class="ev-lc-inline-note"><span>Round ${round.order} is the final enabled round. Proceed to Overall Leaderboard to publish final results.</span></div>
                  ` : `
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                      <select class="ev-select" id="evEvNextRoundSel" style="flex:1;min-width:180px;">
                        ${downstreamRounds.map((dr) => `<option value="${esc(dr.id)}" ${uiState.selectedNextRoundId === dr.id ? 'selected' : ''}>Round ${dr.order}: ${esc(dr.name)}</option>`).join('')}
                      </select>
                      <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evEvMoveNextBtn">Move Qualified (${qPreview.qualified.length}) to Next Round &rarr;</button>
                    </div>
                    <p style="font-size:0.75rem;color:var(--ev-muted);margin-top:0.35rem;">Preserves identities &amp; registrations cleanly without duplicates. Next round remains Upcoming until manually started in Live Control.</p>
                  `}
                </div>
              </section>

              <section class="ev-ws-card">
                <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;margin-bottom:0.75rem;">Qualification Preview</h3>
                <div class="ev-lc-ann-grid" style="margin-bottom:0.85rem;">
                  <div class="ev-lc-stat-tile">
                    <div class="ev-lc-stat-label">Qualified Preview</div>
                    <div class="ev-lc-stat-val" style="color:var(--ev-forest);">${qPreview.qualified.length}</div>
                    <div class="ev-lc-stat-sub">${qPreview.notQualified.length} not qualified &bull; ${qPreview.pendingEvaluations.length} pending</div>
                  </div>
                  <div class="ev-lc-stat-tile">
                    <div class="ev-lc-stat-label">Tied Entries</div>
                    <div class="ev-lc-stat-val">${qPreview.allTiedKeys.length}</div>
                    <div class="ev-lc-stat-sub">${qPreview.tiedBoundaryKeys.length} at qualification cutoff</div>
                  </div>
                </div>

                ${qPreview.qualified.length === 0 ? `
                  <div class="ev-lc-inline-note" style="margin-bottom:0.85rem;"><span>No evaluated participants currently satisfy the configured qualification rule.</span></div>
                ` : `
                  <div class="ev-rc-items-list" style="margin-bottom:0.9rem;">
                    ${qPreview.qualified.map((q) => `
                      <div class="ev-rc-item-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
                        <div>
                          <strong>#${q.rank || '—'}${q.isTied ? ' (Tied)' : ''} &bull; ${esc(q.name)}</strong>
                          <span style="display:block;font-size:0.75rem;color:var(--ev-muted);">${q.awardedMarks}/${q.maxMarks} (${q.percentage}%)</span>
                        </div>
                        <span class="ev-lc-badge ev-lc-badge-live">Qualified</span>
                      </div>
                    `).join('')}
                  </div>
                `}

                <div style="font-size:0.8rem;font-weight:700;color:var(--ev-charcoal);margin-bottom:0.4rem;">Qualification Audit History (${rEval.qualification.history.length})</div>
                ${rEval.qualification.history.length === 0 ? `<p style="font-size:0.78rem;color:var(--ev-muted);">No finalized qualification actions yet.</p>` : `
                  <div style="display:flex;flex-direction:column;gap:0.4rem;">
                    ${rEval.qualification.history.map((h) => `
                      <div style="font-size:0.78rem;padding:0.45rem 0.65rem;background:var(--ev-cream);border-radius:6px;border:1px solid var(--ev-border);">
                        <strong>${esc(h.summary)}</strong> &bull; <span style="color:var(--ev-muted);">${formatDateShort(h.timestamp)}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </section>
            </div>
          ` : ''}

          <!-- TAB 5: LEADERBOARDS, WEIGHTED OVERALL SCORING & PUBLICATION -->
          ${uiState.activeTab === 'leaderboards' ? `
            <div class="ev-lc-two-col">
              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <span class="ev-badge ev-badge-open" style="margin-bottom:0.3rem;">Multi-Round Formula</span>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Overall Event Scoring &amp; Publication</h3>
                  </div>
                </div>

                <form id="evEvOverallForm" style="display:flex;flex-direction:column;gap:0.7rem;" novalidate>
                  <div>
                    <label class="ev-field-label" for="evEvOvModeSel">Overall Aggregation Method</label>
                    <select class="ev-select" id="evEvOvModeSel">
                      ${window.EventoraStore.OVERALL_SCORING_MODES.map((m) => `
                        <option value="${esc(m.key)}" ${evalState.overallConfig.mode === m.key ? 'selected' : ''}>${esc(m.label)}</option>
                      `).join('')}
                    </select>
                  </div>

                  <div class="ev-rc-subpanel">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
                      <strong style="font-size:0.84rem;color:var(--ev-charcoal);">Included Rounds &amp; Normalized Weights (%)</strong>
                      <span class="ev-lc-badge ${weightCheck.ok ? 'ev-lc-badge-live' : 'ev-lc-badge-danger'}">Sum: ${weightCheck.totalWeight}%</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.45rem;">
                      ${rounds.map((r) => {
                        const inc = (evalState.overallConfig.includedRoundIds || []).includes(r.id);
                        const w = evalState.overallConfig.weightsByRoundId && evalState.overallConfig.weightsByRoundId[r.id] != null
                          ? evalState.overallConfig.weightsByRoundId[r.id]
                          : 0;
                        return `
                          <div style="display:grid;grid-template-columns:1fr 96px;gap:0.5rem;align-items:center;">
                            <label style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;">
                              <input type="checkbox" data-ev-ov-inc="${esc(r.id)}" ${inc ? 'checked' : ''}>
                              R${r.order}: ${esc(r.name)} (Max ${evalState.roundEvalsById[r.id].rubric.maxScore})
                            </label>
                            <input type="number" class="ev-input" data-ev-ov-wt="${esc(r.id)}" min="0" max="100" step="1" value="${esc(w)}" aria-label="Weight % for round ${r.order}">
                          </div>
                        `;
                      }).join('')}
                    </div>
                    <p style="font-size:0.74rem;color:var(--ev-muted);margin:0.45rem 0 0;">Weighted mode normalizes each round to 0–100% before multiplying weights so rounds with different max marks score accurately.</p>
                  </div>

                  <button type="submit" class="ev-btn ev-btn-outline ev-btn-sm">Save Overall Scoring Formula</button>
                </form>

                <hr style="border:0;border-top:1px solid var(--ev-border);margin:1rem 0;">

                <div style="display:flex;flex-direction:column;gap:0.55rem;">
                  <strong style="font-size:0.9rem;color:var(--ev-charcoal);">Results Publication Controls</strong>
                  <p style="font-size:0.78rem;color:var(--ev-muted);margin:0;">Unpublished scores stay strictly hidden from Participant Dashboards &amp; public event pages. Private internal evaluator notes are never exposed.</p>
                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button type="button" class="ev-btn ${rEval.publication.roundPublished ? 'ev-btn-danger-ghost' : 'ev-btn-forest'} ev-btn-sm" id="evEvToggleRoundPubBtn">
                      ${rEval.publication.roundPublished ? `Unpublish Round ${round.order} Results` : `Publish Round ${round.order} Results`}
                    </button>
                    <button type="button" class="ev-btn ${evalState.overallConfig.published ? 'ev-btn-danger-ghost' : 'ev-btn-forest'} ev-btn-sm" id="evEvToggleOverallPubBtn">
                      ${evalState.overallConfig.published ? 'Unpublish Overall Leaderboard' : 'Publish Overall Leaderboard'}
                    </button>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evEvToggleFeedbackBtn">
                      Public Feedback: ${rEval.publication.showPublicFeedback ? 'Shown' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </section>

              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">
                      ${uiState.lbScope === 'overall' ? 'Overall Event Leaderboard' : `Round ${round.order} Standings`}
                    </h3>
                  </div>
                  <div class="ev-lc-seg">
                    <button type="button" class="ev-btn ev-btn-xs ${uiState.lbScope === 'round' ? 'ev-btn-forest' : 'ev-btn-outline'}" id="evEvLbScopeRoundBtn">Round ${round.order}</button>
                    <button type="button" class="ev-btn ev-btn-xs ${uiState.lbScope === 'overall' ? 'ev-btn-forest' : 'ev-btn-outline'}" id="evEvLbScopeOverallBtn">Overall Event</button>
                  </div>
                </div>

                <div class="ev-lc-table-wrap">
                  <table class="ev-lc-table" style="min-width:460px;">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Participant / Team</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${uiState.lbScope === 'overall' ? overallBoard.map((row) => `
                        <tr>
                          <td><strong>#${row.rank}${row.isTied ? ' (Tied)' : ''}</strong></td>
                          <td><strong>${esc(row.name)}</strong></td>
                          <td>${row.overallScore} / ${row.overallMax}</td>
                          <td>${row.overallPercentage}%</td>
                          <td>${row.isQualifiedLatest ? `<span class="ev-lc-badge ev-lc-badge-live">Qual R${row.latestQualifiedRoundOrder}</span>` : '<span class="ev-lc-pill">Active</span>'}</td>
                        </tr>
                      `).join('') : standings.filter((r) => r.isEvaluated).map((row) => `
                        <tr>
                          <td><strong>#${row.rank}${row.isTied ? ' (Tied)' : ''}</strong></td>
                          <td><strong>${esc(row.name)}</strong></td>
                          <td>${row.awardedMarks} / ${row.maxMarks}</td>
                          <td>${row.percentage}%</td>
                          <td>${(rEval.qualification.qualifiedKeys || []).includes(row.targetKey) ? '<span class="ev-lc-badge ev-lc-badge-live">Qualified</span>' : '<span class="ev-lc-pill">Evaluated</span>'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ` : ''}
        </div>

        ${inspectRow ? renderInspectScoreModal(ev, round, rEval, inspectRow) : ''}
        ${recordSubRow ? renderRecordSubmissionModal(ev, round, recordSubRow) : ''}
      `;

      bindEvents(ev, round, rEval, qPreview);
    }

    function bindEvents(ev, round, rEval, qPreview) {
      const actor = getActor();

      document.getElementById('evEvGoContentBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('content', round.id));
      document.getElementById('evEvGoLiveBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('live'));
      document.getElementById('evEvJumpRosterBtn')?.addEventListener('click', () => onJumpSection && onJumpSection(ev.teamConfig.supported ? 'teams' : 'participants'));

      mountEl.querySelectorAll('[data-ev-select-round]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.selectedRoundId = btn.dataset.evSelectRound;
          uiState.inspectTargetKey = '';
          uiState.recordSubTargetKey = '';
          uiState.mcqTargetKey = '';
          uiState.mcqDraftAnswers = {};
          uiState.scoreError = '';
          render();
        });
      });

      mountEl.querySelectorAll('[data-ev-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.activeTab = btn.dataset.evTab;
          render();
        });
      });

      const searchEl = document.getElementById('evEvSearchInput');
      searchEl?.addEventListener('input', () => {
        uiState.searchQuery = searchEl.value;
        render();
        const ref = document.getElementById('evEvSearchInput');
        if (ref) { ref.focus(); ref.setSelectionRange(ref.value.length, ref.value.length); }
      });

      document.getElementById('evEvStatusFilter')?.addEventListener('change', (e) => {
        uiState.statusFilter = e.target.value;
        render();
      });

      document.getElementById('evEvScoreSortSel')?.addEventListener('change', (e) => {
        uiState.scoreSortBy = e.target.value;
        render();
      });

      mountEl.querySelectorAll('[data-ev-csv]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const scope = btn.dataset.evCsv;
          const csv = window.EventoraStore.buildResultsCsv(slug, scope, round.id);
          downloadCsvText(`${ev.slug}-${scope}.csv`, csv);
          toast(`Downloaded ${scope} CSV.`);
        });
      });

      // Score modal open/close/save
      mountEl.querySelectorAll('[data-ev-inspect]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.inspectTargetKey = btn.dataset.evInspect;
          uiState.scoreError = '';
          render();
        });
      });
      document.getElementById('evEvCloseScoreModalBtn')?.addEventListener('click', () => {
        uiState.inspectTargetKey = '';
        uiState.scoreError = '';
        render();
      });

      // Live rubric sum update inside modal
      const critInputs = mountEl.querySelectorAll('[data-ev-crit-input]');
      critInputs.forEach((inp) => {
        inp.addEventListener('input', () => {
          const maxTotal = (rEval.rubric.criteria || []).reduce((s, c) => s + c.maxMarks, 0);
          let sum = 0;
          critInputs.forEach((el) => { sum += Number(el.value) || 0; });
          const badge = document.getElementById('evEvLiveSumBadge');
          if (badge) badge.textContent = `Total: ${Math.round(sum * 100) / 100} / ${maxTotal} marks`;
        });
      });

      function submitScoreModal(overrideStatus) {
        const statusSel = document.getElementById('evEvScoreStatus');
        const notesEl = document.getElementById('evEvPrivateNotes');
        const pubFbEl = document.getElementById('evEvPublicFeedback');
        const payload = {
          evaluationStatus: overrideStatus || (statusSel ? statusSel.value : 'Evaluated'),
          evaluationNotes: notesEl ? notesEl.value : '',
          publicFeedback: pubFbEl ? pubFbEl.value : ''
        };
        if (rEval.rubric.criteria && rEval.rubric.criteria.length > 0) {
          payload.criteriaMarks = {};
          critInputs.forEach((el) => {
            payload.criteriaMarks[el.dataset.evCritInput] = Number(el.value);
          });
        } else {
          payload.awardedMarks = Number(document.getElementById('evEvManualAwarded')?.value);
          payload.maxMarks = Number(document.getElementById('evEvManualMax')?.value);
        }

        const res = window.EventoraStore.saveEvaluationScore(slug, round.id, uiState.inspectTargetKey, payload, actor);
        if (!res.ok) {
          uiState.scoreError = res.error;
          toast(res.error);
          render();
          return;
        }
        uiState.scoreError = '';
        uiState.inspectTargetKey = '';
        applyResult(res, 'Evaluation score saved.');
        // DB write-through: sync evaluation record to PostgreSQL
        if (window.EventoraSync && typeof window.EventoraSync.saveEvaluationDb === 'function' && res.evaluation) {
          window.EventoraSync.saveEvaluationDb(slug, round.id, uiState.inspectTargetKey || res.evaluation.targetKey, res.evaluation).catch(() => {});
        }
      }

      document.getElementById('evEvScoreForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitScoreModal(null);
      });
      document.getElementById('evEvSaveDraftEvalBtn')?.addEventListener('click', () => submitScoreModal('Under Review'));
      document.getElementById('evEvReopenEvalBtn')?.addEventListener('click', () => {
        if (applyResult(window.EventoraStore.reopenEvaluation(slug, round.id, uiState.inspectTargetKey, actor), 'Evaluation reopened as Under Review.')) {
          uiState.scoreError = '';
        }
      });

      // Record submission modal
      mountEl.querySelectorAll('[data-ev-open-sub]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.recordSubTargetKey = btn.dataset.evOpenSub;
          render();
        });
      });
      document.getElementById('evEvCloseSubModalBtn')?.addEventListener('click', () => {
        uiState.recordSubTargetKey = '';
        render();
      });
      document.getElementById('evEvSubForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = {
          submissionType: round.typeKey,
          selectedLanguage: document.getElementById('evEvSubLang')?.value || '',
          problemId: document.getElementById('evEvSubProb')?.value || '',
          submittedCode: document.getElementById('evEvSubCode')?.value || '',
          repoUrl: document.getElementById('evEvSubRepo')?.value || '',
          liveUrl: document.getElementById('evEvSubLive')?.value || '',
          description: document.getElementById('evEvSubDesc')?.value || ''
        };
        const res = window.EventoraStore.recordRoundSubmission(slug, round.id, uiState.recordSubTargetKey, payload, actor);
        if (applyResult(res, 'Submission recorded for review.')) {
          uiState.recordSubTargetKey = '';
        }
      });

      // Rubric Criteria Events
      document.getElementById('evEvCritTitle')?.addEventListener('input', (e) => { uiState.critTitle = e.target.value; });
      document.getElementById('evEvCritMax')?.addEventListener('input', (e) => { uiState.critMaxMarks = e.target.value; });
      document.getElementById('evEvCritDesc')?.addEventListener('input', (e) => { uiState.critDesc = e.target.value; });
      document.getElementById('evEvCancelCritBtn')?.addEventListener('click', () => {
        uiState.editingCritId = '';
        uiState.critTitle = '';
        uiState.critMaxMarks = '20';
        uiState.critDesc = '';
        render();
      });

      document.getElementById('evEvCritForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = { title: uiState.critTitle, maxMarks: Number(uiState.critMaxMarks), description: uiState.critDesc };
        const res = uiState.editingCritId
          ? window.EventoraStore.updateRubricCriterion(slug, round.id, uiState.editingCritId, data, actor)
          : window.EventoraStore.addRubricCriterion(slug, round.id, data, actor);
        if (applyResult(res, uiState.editingCritId ? 'Criterion updated.' : 'Rubric criterion added.')) {
          uiState.editingCritId = '';
          uiState.critTitle = '';
          uiState.critMaxMarks = '20';
          uiState.critDesc = '';
        }
      });

      mountEl.querySelectorAll('[data-ev-crit-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = rEval.rubric.criteria.find((x) => x.id === btn.dataset.evCritEdit);
          if (!c) return;
          uiState.editingCritId = c.id;
          uiState.critTitle = c.title;
          uiState.critMaxMarks = String(c.maxMarks);
          uiState.critDesc = c.description || '';
          render();
        });
      });

      mountEl.querySelectorAll('[data-ev-crit-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          applyResult(window.EventoraStore.deleteRubricCriterion(slug, round.id, btn.dataset.evCritDel, actor), 'Criterion removed.');
        });
      });

      mountEl.querySelectorAll('[data-ev-crit-up], [data-ev-crit-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const isUp = btn.dataset.evCritUp != null;
          const cid = isUp ? btn.dataset.evCritUp : btn.dataset.evCritDown;
          const ids = rEval.rubric.criteria.map((c) => c.id);
          const idx = ids.indexOf(cid);
          const swap = isUp ? idx - 1 : idx + 1;
          if (idx < 0 || swap < 0 || swap >= ids.length) return;
          const tmp = ids[idx];
          ids[idx] = ids[swap];
          ids[swap] = tmp;
          applyResult(window.EventoraStore.reorderRubricCriteria(slug, round.id, ids, actor), 'Criterion order updated.');
        });
      });

      // MCQ rules & Auto-Eval runner
      document.getElementById('evEvMcqConfigForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const rule = document.getElementById('evEvMultiRuleSel')?.value || 'exact_match';
        const neg = Boolean(document.getElementById('evEvApplyNegChk')?.checked);
        applyResult(window.EventoraStore.saveRoundRubric(slug, round.id, { multiAnswerRule: rule, applyNegativeMarking: neg }, actor), 'MCQ grading rules saved.');
      });

      document.getElementById('evEvRecalcMcqBtn')?.addEventListener('click', () => {
        const rule = document.getElementById('evEvMultiRuleSel')?.value || rEval.rubric.multiAnswerRule;
        const neg = Boolean(document.getElementById('evEvApplyNegChk')?.checked);
        const res = window.EventoraStore.recalculateRoundMcqScores(slug, round.id, actor, { multiAnswerRule: rule, applyNegativeMarking: neg });
        if (res.ok) {
          toast(`Recalculated ${res.recalculatedCount} MCQ evaluation(s).`);
          render();
        }
      });

      document.getElementById('evEvMcqTargetSel')?.addEventListener('change', (e) => {
        uiState.mcqTargetKey = e.target.value;
        const prevSub = uiState.mcqTargetKey ? rEval.submissionsByTarget[uiState.mcqTargetKey] : null;
        uiState.mcqDraftAnswers = prevSub && prevSub.mcqAnswers ? { ...prevSub.mcqAnswers } : {};
        render();
      });

      mountEl.querySelectorAll('[data-ev-mcq-ans]').forEach((inp) => {
        inp.addEventListener('input', () => {
          uiState.mcqDraftAnswers[inp.dataset.evMcqAns] = inp.value;
        });
      });
      mountEl.querySelectorAll('[data-ev-mcq-opt]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const qId = inp.dataset.evMcqOpt;
          if (inp.type === 'checkbox') {
            const vals = Array.from(mountEl.querySelectorAll(`[data-ev-mcq-opt="${qId}"]:checked`)).map((el) => Number(el.value));
            uiState.mcqDraftAnswers[qId] = vals;
          } else {
            uiState.mcqDraftAnswers[qId] = Number(inp.value);
          }
        });
      });

      document.getElementById('evEvRunAutoMcqBtn')?.addEventListener('click', () => {
        if (!uiState.mcqTargetKey) return;
        const rule = document.getElementById('evEvMultiRuleSel')?.value || rEval.rubric.multiAnswerRule;
        const neg = Boolean(document.getElementById('evEvApplyNegChk')?.checked);
        const res = window.EventoraStore.autoEvaluateRoundMcq(slug, round.id, uiState.mcqTargetKey, uiState.mcqDraftAnswers, actor, {
          multiAnswerRule: rule,
          applyNegativeMarking: neg
        });
        applyResult(res, res.ok ? `Auto-scored ${res.evaluation.awardedMarks} / ${res.evaluation.maxMarks}` : '');
      });

      // Qualification & Tie-Breaker Events
      document.getElementById('evEvQualForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const manualKeys = Array.from(mountEl.querySelectorAll('[data-ev-manual-q]:checked')).map((el) => el.dataset.evManualQ);
        const qPatch = {
          strategy: document.getElementById('evEvQualStrat')?.value || rEval.qualification.strategy,
          topN: Number(document.getElementById('evEvTopN')?.value || 10),
          minScore: Number(document.getElementById('evEvMinScore')?.value || 0),
          minPercentage: Number(document.getElementById('evEvMinPct')?.value || 0),
          allowPendingEvaluation: Boolean(document.getElementById('evEvAllowPendChk')?.checked),
          manualSelectedKeys: manualKeys
        };
        const tiePatch = {
          primaryRule: document.getElementById('evEvTieRuleSel')?.value || rEval.tieBreaker.primaryRule,
          criterionId: document.getElementById('evEvTieCritSel')?.value || rEval.tieBreaker.criterionId,
          refRoundId: document.getElementById('evEvTieRndSel')?.value || rEval.tieBreaker.refRoundId
        };
        window.EventoraStore.saveTieBreakerConfig(slug, round.id, tiePatch, actor);
        applyResult(window.EventoraStore.saveQualificationConfig(slug, round.id, qPatch, actor), 'Qualification & tie-breaker rules saved.');
      });

      document.getElementById('evEvFinalizeQualBtn')?.addEventListener('click', () => {
        const res = window.EventoraStore.finalizeRoundQualification(slug, round.id, {}, actor);
        if (res && res.requiresTieResolution) {
          confirmAction({
            title: 'Tie at Qualification Cutoff',
            body: `${res.error} Include all tied boundary participants cleanly, or resolve using tie-breakers first?`,
            confirmLabel: 'Include Tied Entries & Finalize',
            onConfirm: () => {
              const tieRes = applyResult(window.EventoraStore.finalizeRoundQualification(slug, round.id, { allowTiesIncluded: true, includeBoundaryTies: true }, actor), 'Finalized including tied cutoff entries.');
              if (tieRes && window.EventoraSync && typeof window.EventoraSync.finalizeQualificationDb === 'function') {
                const qPrev = window.EventoraStore.computeQualificationPreview(window.EventoraStore.getEventBySlug(slug), round.id);
                window.EventoraSync.finalizeQualificationDb(slug, round.id, qPrev, true).catch(() => {});
              }
            }
          });
          return;
        }
        if (applyResult(res, 'Round qualification finalized.') && window.EventoraSync && typeof window.EventoraSync.finalizeQualificationDb === 'function') {
          const qPrev = window.EventoraStore.computeQualificationPreview(window.EventoraStore.getEventBySlug(slug), round.id);
          window.EventoraSync.finalizeQualificationDb(slug, round.id, qPrev, true).catch(() => {});
        }
      });

      document.getElementById('evEvReopenQualBtn')?.addEventListener('click', () => {
        applyResult(window.EventoraStore.reopenRoundQualification(slug, round.id, actor), 'Reopened qualification settings.');
      });

      document.getElementById('evEvNextRoundSel')?.addEventListener('change', (e) => { uiState.selectedNextRoundId = e.target.value; });
      document.getElementById('evEvMoveNextBtn')?.addEventListener('click', () => {
        if (!uiState.selectedNextRoundId) return;
        confirmAction({
          title: 'Advance Qualifiers to Next Round',
          body: `Move ${qPreview ? qPreview.qualified.length : 0} qualified entry(ies) into the next round? Identities and registrations remain preserved without duplicates, and the next round will not auto-start.`,
          confirmLabel: 'Confirm Progression',
          onConfirm: () => {
            const res = window.EventoraStore.progressQualifiedToNextRound(slug, round.id, uiState.selectedNextRoundId, actor);
            applyResult(res, res.ok ? `Moved ${res.progressedCount} qualifier(s) (${res.newlyAddedCount} newly added).` : '');
          }
        });
      });

      // Overall & Publication Events
      document.getElementById('evEvOverallForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const mode = document.getElementById('evEvOvModeSel')?.value || 'weighted_percentage';
        const incIds = Array.from(mountEl.querySelectorAll('[data-ev-ov-inc]:checked')).map((el) => el.dataset.evOvInc);
        const weights = {};
        mountEl.querySelectorAll('[data-ev-ov-wt]').forEach((inp) => {
          weights[inp.dataset.evOvWt] = Number(inp.value) || 0;
        });
        applyResult(window.EventoraStore.saveOverallScoringConfig(slug, { mode, includedRoundIds: incIds, weightsByRoundId: weights }, actor), 'Overall weighted formula saved.');
      });

      document.getElementById('evEvToggleRoundPubBtn')?.addEventListener('click', () => {
        const nextPub = !rEval.publication.roundPublished;
        const pubRes = applyResult(
          window.EventoraStore.publishRoundResults(slug, round.id, { roundPublished: nextPub, leaderboardPublished: nextPub }, actor),
          nextPub ? `Published Round ${round.order} results & leaderboard.` : `Unpublished Round ${round.order} results.`
        );
        // DB write-through: sync publication state
        if (pubRes && window.EventoraSync && typeof window.EventoraSync.publishRoundResultsDb === 'function') {
          window.EventoraSync.publishRoundResultsDb(slug, round.id, nextPub).catch(() => {});
        }
      });

      document.getElementById('evEvToggleOverallPubBtn')?.addEventListener('click', () => {
        const nextPub = !evalState.overallConfig.published;
        applyResult(
          window.EventoraStore.publishOverallResults(slug, { published: nextPub }, actor),
          nextPub ? 'Published Overall Event Leaderboard!' : 'Unpublished Overall Event Leaderboard.'
        );
      });

      document.getElementById('evEvToggleFeedbackBtn')?.addEventListener('click', () => {
        const nextFb = !rEval.publication.showPublicFeedback;
        applyResult(window.EventoraStore.publishRoundResults(slug, round.id, { showPublicFeedback: nextFb }, actor), `Public participant feedback ${nextFb ? 'enabled' : 'hidden'}.`);
      });

      document.getElementById('evEvLbScopeRoundBtn')?.addEventListener('click', () => {
        uiState.lbScope = 'round';
        render();
      });
      document.getElementById('evEvLbScopeOverallBtn')?.addEventListener('click', () => {
        uiState.lbScope = 'overall';
        render();
      });
    }

    render();
  }

  return {
    mount
  };
})();

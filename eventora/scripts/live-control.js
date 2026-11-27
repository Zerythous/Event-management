/* ==========================================================================
   EVENTORA PHASE 7: LIVE ROUND CONTROL & EVENT OPERATIONS WORKSPACE
   Reuses EventoraStore timestamp-based live operations, round-type context,
   per-round participant/team statuses, local announcements, and timeline.
   ========================================================================== */

window.EventoraLiveControl = (function () {
  let activeTickerId = null;

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

  function getCurrentActor() {
    if (window.EventoraAuth && typeof window.EventoraAuth.getSession === 'function') {
      return window.EventoraAuth.getSession() || null;
    }
    return null;
  }

  function formatHMS(totalSecs) {
    const clean = Math.max(0, Math.floor(Number(totalSecs) || 0));
    const hrs = Math.floor(clean / 3600);
    const mins = Math.floor((clean % 3600) / 60);
    const secs = clean % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function formatDurationLabel(totalSecs) {
    const clean = Math.max(0, Math.round(Number(totalSecs) || 0));
    if (clean === 0) return 'Untimed';
    const hrs = Math.floor(clean / 3600);
    const mins = Math.floor((clean % 3600) / 60);
    const secs = clean % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    if (mins > 0) return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
    return `${secs}s`;
  }

  function formatShortTimestamp(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDateTimeShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getEventStatusClass(status) {
    if (status === 'Live') return 'ev-lc-badge-live';
    if (status === 'Paused') return 'ev-lc-badge-paused';
    if (status === 'Completed') return 'ev-lc-badge-completed';
    if (status === 'Cancelled') return 'ev-lc-badge-cancelled';
    return 'ev-lc-badge-upcoming';
  }

  function getParticipantStatusBadgeClass(status) {
    if (status === 'Active') return 'ev-lc-badge-live';
    if (status === 'Submitted') return 'ev-lc-badge-submitted';
    if (status === 'Completed') return 'ev-lc-badge-completed';
    if (status === 'Absent') return 'ev-lc-badge-paused';
    if (status === 'Disqualified') return 'ev-lc-badge-danger';
    return 'ev-lc-badge-upcoming';
  }

  function stopActiveTicker() {
    if (activeTickerId) {
      window.clearInterval(activeTickerId);
      activeTickerId = null;
    }
  }

  function confirmAction(opts) {
    if (window.EventoraWorkspace && typeof window.EventoraWorkspace.openConfirm === 'function') {
      window.EventoraWorkspace.openConfirm(opts);
    } else if (typeof opts.onConfirm === 'function') {
      opts.onConfirm();
    }
  }

  function getActivityCategoryLabel(activityType) {
    const t = String(activityType || '');
    if (t.startsWith('event_')) return { label: 'Event', cls: 'ev-lc-badge-live' };
    if (t.startsWith('timer_')) return { label: 'Timer', cls: 'ev-lc-badge-paused' };
    if (t.startsWith('round_') || t === 'presentation_order_updated') return { label: 'Round', cls: 'ev-lc-badge-submitted' };
    if (t.startsWith('participant_disqualified') || t.startsWith('team_disqualified')) return { label: 'Disqualified', cls: 'ev-lc-badge-danger' };
    if (t.startsWith('participant_') || t.startsWith('team_')) return { label: 'Roster', cls: 'ev-lc-badge-completed' };
    if (t.startsWith('announcement_')) return { label: 'Announcement', cls: 'ev-lc-badge-upcoming' };
    return { label: 'System', cls: 'ev-lc-badge-upcoming' };
  }

  function mount(mountEl, options) {
    if (!mountEl || !window.EventoraStore) return;
    stopActiveTicker();

    const cfg = options || {};
    const slug = cfg.slug || '';
    const isManager = Boolean(cfg.isManager);
    const onJumpSection = typeof cfg.onJumpSection === 'function' ? cfg.onJumpSection : null;
    const onUpdated = typeof cfg.onUpdated === 'function' ? cfg.onUpdated : null;

    const uiState = {
      focusedRoundId: null,
      rosterView: 'auto', // 'auto' | 'teams' | 'participants'
      searchQuery: '',
      statusFilter: 'ALL',
      teamFilter: 'ALL',
      extCustomMins: '10',
      extReason: '',
      annEditingId: '',
      annTemplate: 'Round Starting',
      annTitle: '',
      annMessage: '',
      annRoundId: '',
      annPreviewOpen: false
    };

    /** Fire-and-forget DB sync after any live-ops mutation. Safe to call in local prototype mode. */
    function dbSyncLiveOps(roundId) {
      if (window.EventoraSync && typeof window.EventoraSync.syncLiveOpsNow === 'function') {
        window.EventoraSync.syncLiveOpsNow(slug, roundId || null).catch(() => {});
      }
    }

    /** Fire-and-forget DB sync for announcements (uses full event flush). */
    function dbSyncAnnouncements() {
      if (window.EventoraSync && typeof window.EventoraSync.flushEventWriteThrough === 'function') {
        const ev = window.EventoraStore.getEventBySlug(slug);
        if (ev && window.EventoraSync.isSupabaseActiveForEvent(ev)) {
          window.EventoraSync.flushEventWriteThrough(slug);
        }
      }
    }

    function pickInitialRoundId(ev, ops) {
      const rounds = Array.isArray(ev.rounds) ? ev.rounds : [];
      if (!rounds.length) return null;
      if (uiState.focusedRoundId && rounds.some((r) => r.id === uiState.focusedRoundId)) {
        return uiState.focusedRoundId;
      }
      if (ops.currentRoundId && rounds.some((r) => r.id === ops.currentRoundId)) {
        return ops.currentRoundId;
      }
      const nextUpcoming = rounds.find((r) => ops.roundsById[r.id] && ops.roundsById[r.id].roundStatus === 'Upcoming');
      if (nextUpcoming) return nextUpcoming.id;
      return rounds[0].id;
    }

    function computeParticipationSummary(ev, round, roundOp) {
      const activeParts = (ev.participants || []).filter((p) => p.registrationStatus !== 'Cancelled' && p.registrationStatus !== 'Rejected');
      const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
      const map = useTeams ? roundOp.teamStatuses : roundOp.participantStatuses;
      const items = useTeams ? (ev.teams || []) : activeParts;
      const counts = { total: items.length, active: 0, submitted: 0, completed: 0, absent: 0, disqualified: 0, notStarted: 0 };
      items.forEach((item) => {
        const st = map[item.id] || 'Not Started';
        if (st === 'Active') counts.active += 1;
        else if (st === 'Submitted') counts.submitted += 1;
        else if (st === 'Completed') counts.completed += 1;
        else if (st === 'Absent') counts.absent += 1;
        else if (st === 'Disqualified') counts.disqualified += 1;
        else counts.notStarted += 1;
      });
      return counts;
    }

    function renderRoundTypePanel(ev, round, roundOp, timerSnap) {
      const typeKey = round.typeKey || 'custom';
      const tc = round.typeConfig || {};
      const counts = computeParticipationSummary(ev, round, roundOp);
      const instructionsText = round.instructions || 'No round instructions specified in Round Builder yet.';
      const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);

      if (typeKey === 'presentation') {
        const queue = Array.isArray(roundOp.presentationOrder) && roundOp.presentationOrder.length
          ? roundOp.presentationOrder
          : [];
        const slotDur = tc.durationPerPresentationMin || 8;
        const canReorder = ev.liveOps.operationalStatus !== 'Completed';

        return `
          <div class="ev-ws-card">
            <div class="ev-ws-card-head">
              <div>
                <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Round-Type Workspace &bull; ${esc(round.typeLabel || 'Presentation')}</span>
                <h3 class="ev-display" style="font-size:1.22rem;font-weight:600;">Presentation &amp; Demo Queue</h3>
                <p style="font-size:0.84rem;color:var(--ev-muted);">Manage live speaker / demo order (${esc(slotDur)} mins/slot) without modifying permanent registrations.</p>
              </div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcSyncQueueBtn" ${canReorder ? '' : 'disabled'}>
                  Sync Queue from Roster
                </button>
              </div>
            </div>

            <div class="ev-lc-context-grid">
              <div class="ev-lc-context-box">
                <div class="ev-lc-context-label">Round Instructions</div>
                <p class="ev-lc-context-text">${esc(instructionsText)}</p>
              </div>
              <div class="ev-lc-context-box">
                <div class="ev-lc-context-label">Jury Rubric &amp; Submission Notes</div>
                <p class="ev-lc-context-text">
                  Slot allowance: <strong>${esc(slotDur)} mins</strong> &bull;
                  Deck required: <strong>${tc.requiresDeck ? 'Yes' : 'Optional'}</strong> &bull;
                  Completed presentations: <strong>${counts.completed} / ${counts.total}</strong>
                </p>
              </div>
            </div>

            ${queue.length === 0 ? `
              <div class="ev-lc-inline-note" style="margin-top:0.85rem;">
                <div>
                  <strong>No presentation queue initialized yet.</strong>
                  <span style="display:block;font-size:0.82rem;color:var(--ev-muted);margin-top:0.18rem;">
                    ${useTeams ? 'Ensure teams exist in Roster or click "Sync Queue from Roster" to build the demo sequence.' : 'Ensure approved participants exist or click "Sync Queue from Roster" to build the demo sequence.'}
                  </span>
                </div>
                <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcInitQueueEmptyBtn" ${canReorder ? '' : 'disabled'}>Build Queue</button>
              </div>
            ` : `
              <div class="ev-lc-queue-list" style="margin-top:0.9rem;">
                ${queue.map((slot, idx) => `
                  <div class="ev-lc-queue-item">
                    <div class="ev-lc-queue-order">#${idx + 1}</div>
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:600;color:var(--ev-charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(slot.label)}</div>
                      <div style="font-size:0.78rem;color:var(--ev-muted);">${slot.kind === 'team' ? 'Team Slot' : 'Individual Slot'} &bull; ${esc(slot.slotMinutes)} mins</div>
                    </div>
                    <span class="ev-lc-badge ${getParticipantStatusBadgeClass(slot.status)}">${esc(slot.status)}</span>
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-queue-up="${idx}" ${idx === 0 || !canReorder ? 'disabled' : ''} title="Move Earlier">&uarr;</button>
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-queue-down="${idx}" ${idx === queue.length - 1 || !canReorder ? 'disabled' : ''} title="Move Later">&darr;</button>
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-queue-status="${esc(slot.key)}" data-next-status="Active" ${!canReorder ? 'disabled' : ''}>On Stage</button>
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-queue-status="${esc(slot.key)}" data-next-status="Completed" ${!canReorder ? 'disabled' : ''}>Done</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `;
      }

      // Build unified structured operational panel tailored to all 9 remaining round archetypes cleanly
      const specByType = {
        quiz: {
          title: 'Timed Quiz Operations',
          meta: [
            `Questions: ${tc.questionCount || 20}`,
            `Marks / Question: ${tc.marksPerQuestion || 1}`,
            `Time Limit: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`
          ],
          placeholderTitle: 'Quiz Submission & Auto-Grading Placeholder',
          placeholderDesc: `${counts.submitted + counts.completed} of ${counts.total} marked Submitted/Completed manually. Automated question delivery and score syncing are out of prototype scope.`
        },
        mcq: {
          title: 'Objective MCQ Assessment Operations',
          meta: [
            `Questions: ${tc.questionCount || 25}`,
            `Negative Marking: ${tc.negativeMarking ? 'Enabled' : 'Disabled'}`,
            `Duration: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`
          ],
          placeholderTitle: 'MCQ Answer Sheet Submission Placeholder',
          placeholderDesc: `${counts.submitted + counts.completed} of ${counts.total} tracked as Submitted/Completed. Proctoring locks and automated answer validation connect in future phases.`
        },
        coding: {
          title: 'Coding Competition Operations',
          meta: [
            `Problems: ${tc.problemCount || 3}`,
            `Languages: ${Array.isArray(tc.allowedLanguages) && tc.allowedLanguages.length ? tc.allowedLanguages.join(', ') : (tc.languages || 'Any standard language')}`,
            `Max Score: ${round.scoring ? round.scoring.maxScore : 300} ${round.scoring ? round.scoring.pointsLabel : 'pts'}`
          ],
          placeholderTitle: 'Code Submission & Evaluation Status Placeholder (No Execution)',
          placeholderDesc: `${counts.submitted} submitted & ${counts.completed} evaluated out of ${counts.total}. Code execution runners are disabled in frontend prototype; update live team/participant statuses manually below.`
        },
        frontend: {
          title: 'Frontend Build Operations',
          meta: [
            `Allowed Stack: ${tc.stackRule || 'HTML/CSS/JS or Framework'}`,
            `Submission Mode: ${tc.submissionType || 'Repository + Live URL'}`,
            `Duration: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`
          ],
          placeholderTitle: 'UI Submission & Review Tracking Placeholder',
          placeholderDesc: `${counts.submitted + counts.completed} of ${counts.total} marked Submitted/Completed. Repository and deployment preview review workflows connect in later phases.`
        },
        workshop: {
          title: 'Hands-On Workshop Session Control',
          meta: [
            `Venue / Link: ${round.venueOrOnline || 'TBD by Organizer'}`,
            `Session Duration: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`,
            `Checked In / Completed: ${counts.active + counts.completed} / ${counts.total}`
          ],
          placeholderTitle: 'Attendance & Session Completion Control',
          placeholderDesc: `Mark attendees Active upon check-in or Completed once hands-on milestones finish. Absent marks require organizer confirmation.`
        },
        treasure_hunt: {
          title: 'Treasure Hunt Checkpoint Operations',
          meta: [
            `Total Clues / Checkpoints: ${tc.clueCount || 5}`,
            `Verification Mode: ${tc.clueMode || 'Organizer Desk Code'}`,
            `Round Duration: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`
          ],
          placeholderTitle: 'Checkpoint Progress Placeholder (No GPS / Automated Clues)',
          placeholderDesc: `${counts.active} actively hunting, ${counts.submitted + counts.completed} submitted/cleared out of ${counts.total}. GPS tracking and clue push are excluded from prototype scope.`
        },
        puzzle: {
          title: 'Puzzle & Logical Challenge Operations',
          meta: [
            `Puzzle Count: ${tc.puzzleCount || 4}`,
            `Timer Window: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`,
            `Max Score: ${round.scoring ? round.scoring.maxScore : 100} pts`
          ],
          placeholderTitle: 'Puzzle Verification & Submission Placeholder',
          placeholderDesc: `${counts.submitted + counts.completed} of ${counts.total} verified Submitted/Completed. Automated answer-key verification is deferred.`
        },
        manual: {
          title: 'Manual Jury Evaluation Operations',
          meta: [
            `Evaluation Criteria: ${tc.rubricSummary || 'Organizer / Judge Scorecard'}`,
            `Window: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`,
            `Completed Reviews: ${counts.completed} / ${counts.total}`
          ],
          placeholderTitle: 'Judge Scorecard Status Placeholder',
          placeholderDesc: `Track whether teams or participants are awaiting jury review (Active/Submitted) or finalized (Completed). Full numeric scoring connects in Phase 8.`
        },
        custom: {
          title: `${round.typeLabel || 'Custom Round'} Operations`,
          meta: [
            `Duration: ${formatDurationLabel(timerSnap.totalDurationSeconds)}`,
            `Schedule: ${round.startTime || 'Flexible'}`,
            `Active / Completed: ${counts.active + counts.completed} / ${counts.total}`
          ],
          placeholderTitle: 'Custom Stage Manual Operations',
          placeholderDesc: `Track stage participation status, extend timer windows, and record announcements using the shared controls below.`
        }
      };

      const spec = specByType[typeKey] || specByType.custom;

      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Round-Type Workspace &bull; ${esc(round.typeLabel || 'Round')}</span>
              <h3 class="ev-display" style="font-size:1.22rem;font-weight:600;">${esc(spec.title)}</h3>
              <div class="ev-lc-meta-pills" style="margin-top:0.35rem;">
                ${spec.meta.map((item) => `<span class="ev-lc-pill">${esc(item)}</span>`).join('')}
              </div>
            </div>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
              ${roundOp.roundStatus === 'Upcoming' ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" data-lc-round-action="start" data-round-id="${esc(round.id)}">Start Round</button>` : ''}
              ${roundOp.roundStatus === 'Live' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" data-lc-round-action="complete" data-round-id="${esc(round.id)}">Mark Completed</button>` : ''}
            </div>
          </div>
          <div class="ev-lc-context-grid">
            <div class="ev-lc-context-box">
              <div class="ev-lc-context-label">Round Instructions</div>
              <p class="ev-lc-context-text">${esc(instructionsText)}</p>
            </div>
            <div class="ev-lc-context-box">
              <div class="ev-lc-context-label">${esc(spec.placeholderTitle)}</div>
              <p class="ev-lc-context-text">${esc(spec.placeholderDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    function render() {
      const snapAll = window.EventoraStore.getLiveOperationsSnapshot(slug);
      if (!snapAll || !snapAll.event) {
        mountEl.innerHTML = `<div class="ev-ws-card"><p style="color:var(--ev-muted);">Event could not be found in EventoraStore.</p></div>`;
        return;
      }

      const ev = snapAll.event;
      const ops = snapAll.liveOps;
      const rounds = Array.isArray(ev.rounds) ? ev.rounds : [];
      const participants = Array.isArray(ev.participants) ? ev.participants : [];
      const teams = Array.isArray(ev.teams) ? ev.teams : [];
      const partStats = window.EventoraStore.getParticipantStats(participants);
      const teamStats = window.EventoraStore.getTeamStats(teams, ev.teamConfig);

      const focusedRoundId = pickInitialRoundId(ev, ops);
      uiState.focusedRoundId = focusedRoundId;
      const focusedRound = focusedRoundId ? rounds.find((r) => r.id === focusedRoundId) : null;
      const focusedRoundOp = focusedRound ? ops.roundsById[focusedRound.id] : null;
      const focusedTimer = focusedRound ? snapAll.timersByRoundId[focusedRound.id] : null;

      const completedRoundsCount = rounds.filter((r) => ops.roundsById[r.id] && ops.roundsById[r.id].roundStatus === 'Completed').length;
      const upcomingRoundsCount = rounds.filter((r) => ops.roundsById[r.id] && ops.roundsById[r.id].roundStatus === 'Upcoming').length;
      const currentRoundObj = ops.currentRoundId ? rounds.find((r) => r.id === ops.currentRoundId) : null;
      const currentRoundTimer = currentRoundObj ? snapAll.timersByRoundId[currentRoundObj.id] : null;
      const currentRoundOp = currentRoundObj ? ops.roundsById[currentRoundObj.id] : null;

      const isEventCompleted = ops.operationalStatus === 'Completed';
      const isEventPaused = ops.operationalStatus === 'Paused';
      const isEventLive = ops.operationalStatus === 'Live';
      const isEventUpcoming = ops.operationalStatus === 'Upcoming';

      const enabledRounds = rounds.filter((r) => r.enabled !== false && r.status !== 'Disabled' && ops.roundsById[r.id] && ops.roundsById[r.id].roundStatus !== 'Cancelled');
      let canAdvanceNext = false;
      if (!isEventCompleted && !isEventPaused && enabledRounds.length > 0) {
        if (ops.currentRoundId) {
          const curIdx = enabledRounds.findIndex((r) => r.id === ops.currentRoundId);
          canAdvanceNext = curIdx >= 0 && curIdx < enabledRounds.length - 1;
        } else {
          const lastDoneIdx = enabledRounds.reduce((acc, r, i) => (ops.roundsById[r.id].roundStatus === 'Completed' ? i : acc), -1);
          canAdvanceNext = lastDoneIdx + 1 < enabledRounds.length;
        }
      }

      const useTeams = Boolean(ev.teamConfig && ev.teamConfig.supported);
      const effectiveRosterView = !useTeams
        ? 'participants'
        : (uiState.rosterView === 'auto' ? (teams.length > 0 ? 'teams' : 'participants') : uiState.rosterView);

      const nonCancelledParticipants = participants.filter((p) => p.registrationStatus !== 'Cancelled');
      const teamNameMap = new Map(teams.map((t) => [t.id, t.teamName || t.name || 'Team']));

      // Filter roster rows cleanly according to user search / status / team filters
      const qLower = uiState.searchQuery.trim().toLowerCase();
      let filteredRoster = [];
      if (focusedRound && focusedRoundOp) {
        if (effectiveRosterView === 'teams') {
          filteredRoster = teams.filter((t) => {
            const tLabel = (t.teamName || t.name || '').toLowerCase();
            const st = focusedRoundOp.teamStatuses[t.id] || 'Not Started';
            if (uiState.statusFilter !== 'ALL' && st !== uiState.statusFilter) return false;
            if (uiState.teamFilter !== 'ALL' && uiState.teamFilter !== 'ASSIGNED' && uiState.teamFilter !== 'UNASSIGNED' && t.id !== uiState.teamFilter) return false;
            if (qLower) {
              const memberMatch = (t.memberIds || []).some((mid) => {
                const mp = participants.find((p) => p.id === mid);
                return mp && (mp.fullName.toLowerCase().includes(qLower) || mp.email.toLowerCase().includes(qLower));
              });
              if (!tLabel.includes(qLower) && !memberMatch) return false;
            }
            return true;
          });
        } else {
          filteredRoster = nonCancelledParticipants.filter((p) => {
            const st = focusedRoundOp.participantStatuses[p.id] || 'Not Started';
            if (uiState.statusFilter !== 'ALL' && st !== uiState.statusFilter) return false;
            if (uiState.teamFilter === 'UNASSIGNED' && p.teamId) return false;
            if (uiState.teamFilter === 'ASSIGNED' && !p.teamId) return false;
            if (uiState.teamFilter !== 'ALL' && uiState.teamFilter !== 'ASSIGNED' && uiState.teamFilter !== 'UNASSIGNED' && p.teamId !== uiState.teamFilter) return false;
            if (qLower) {
              const tName = p.teamId ? (teamNameMap.get(p.teamId) || '').toLowerCase() : '';
              const match = p.fullName.toLowerCase().includes(qLower)
                || p.email.toLowerCase().includes(qLower)
                || (p.registrationId || '').toLowerCase().includes(qLower)
                || tName.includes(qLower);
              if (!match) return false;
            }
            return true;
          });
        }
      }

      const timerHeroStateClass = focusedTimer
        ? (focusedTimer.isExpired ? 'is-expired' : (focusedTimer.isLowTime ? 'is-low-time' : (focusedTimer.state === 'Running' ? 'is-running' : (focusedTimer.state === 'Paused' ? 'is-paused' : 'is-idle'))))
        : 'is-idle';

      mountEl.innerHTML = `
        <div class="ev-lc-shell">
          <div class="ev-lc-proto-banner">
            <div>
              <strong>Local Prototype Operations Mode:</strong> Event status, timestamp countdown clocks, per-round participant/team statuses, local announcements, and timeline events save in browser <code>sessionStorage</code>. Cross-device realtime sync, email/push notifications, and code execution are not active in this phase.
            </div>
          </div>

          <!-- SECTION A: EVENT LIVE OVERVIEW & MASTER CONTROLS -->
          <section class="ev-ws-card">
            <div class="ev-lc-overview-head">
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;margin-bottom:0.45rem;">
                  <span class="ev-lc-badge ${getEventStatusClass(ops.operationalStatus)}">
                    ${isEventLive ? '<span class="ev-lc-pulse-dot" aria-hidden="true"></span>' : ''}
                    Event: ${esc(ops.operationalStatus)}
                  </span>
                  ${ev.date ? `<span class="ev-lc-pill">${esc(ev.date)}</span>` : ''}
                  ${ops.completedAt ? `<span class="ev-lc-pill">Completed ${esc(formatDateTimeShort(ops.completedAt))}</span>` : ''}
                </div>
                <h2 class="ev-display" style="font-size:1.5rem;font-weight:600;color:var(--ev-charcoal);">${esc(ev.name)}</h2>
                <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.2rem;">
                  ${esc(ev.categoryLabel || 'Event')} &bull; ${esc(ev.venue || ev.mode || 'Event Operations')}
                </p>
              </div>

              <div class="ev-lc-master-actions">
                ${isEventUpcoming ? `
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcStartEventBtn">Start Event (Go Live)</button>
                ` : ''}
                ${isEventLive ? `
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcPauseEventBtn">Pause Event</button>
                ` : ''}
                ${isEventPaused ? `
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcResumeEventBtn">Resume Event</button>
                ` : ''}
                ${!isEventCompleted && canAdvanceNext ? `
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcAdvanceRoundBtn">Start Next Round &rarr;</button>
                ` : ''}
                ${!isEventCompleted ? `
                  <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-sm" id="evLcCompleteEventBtn" ${isManager ? 'disabled title="Event completion requires Organizer permissions"' : ''}>Complete Event</button>
                ` : `
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcReopenEventBtn" ${isManager ? 'disabled title="Reopening requires Organizer permissions"' : ''}>Reopen Event...</button>
                `}
              </div>
            </div>

            ${isEventCompleted ? `
              <div class="ev-lc-alert ev-lc-alert-completed">
                <strong>Event Finalized:</strong> Operations are locked to prevent accidental changes. Completed rounds, participant records, permanent registrations, and timeline logs remain preserved.
              </div>
            ` : ''}

            <div class="ev-lc-stats-grid">
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Current Active Round</div>
                <div class="ev-lc-stat-val">${currentRoundObj ? `R${currentRoundObj.order}: ${esc(currentRoundObj.name)}` : 'None Active'}</div>
                <div class="ev-lc-stat-sub">${currentRoundOp ? esc(currentRoundOp.roundStatus) : 'Select or start a round below'}</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Configured Rounds</div>
                <div class="ev-lc-stat-val">${rounds.length} Total</div>
                <div class="ev-lc-stat-sub">${completedRoundsCount} completed &bull; ${upcomingRoundsCount} upcoming</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Approved Participants</div>
                <div class="ev-lc-stat-val">${partStats.approved} <span style="font-size:0.85rem;font-weight:500;color:var(--ev-muted);">/ ${partStats.total}</span></div>
                <div class="ev-lc-stat-sub">${partStats.pending} pending &bull; ${partStats.waitlisted} waitlisted</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">${useTeams ? 'Registered Teams' : 'Participation Mode'}</div>
                <div class="ev-lc-stat-val">${useTeams ? `${teamStats.total} Teams` : 'Individual'}</div>
                <div class="ev-lc-stat-sub">${useTeams ? `${teamStats.active + teamStats.full} ready teams` : 'Individual registrations'}</div>
              </div>
              <div class="ev-lc-stat-tile">
                <div class="ev-lc-stat-label">Active Round Timer</div>
                <div class="ev-lc-stat-val">${currentRoundTimer ? formatDurationLabel(currentRoundTimer.totalDurationSeconds) : '—'}</div>
                <div class="ev-lc-stat-sub">${currentRoundTimer ? esc(currentRoundTimer.state) : 'No timer running'}</div>
              </div>
            </div>

            <div class="ev-lc-concurrent-bar">
              <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.84rem;color:var(--ev-charcoal);cursor:${isManager || isEventCompleted ? 'not-allowed' : 'pointer'};">
                <input type="checkbox" id="evLcConcurrentToggle" ${ops.allowConcurrentRounds ? 'checked' : ''} ${isManager || isEventCompleted ? 'disabled' : ''}>
                <span>Allow simultaneous active rounds (Concurrent Mode)</span>
              </label>
              <span style="font-size:0.78rem;color:var(--ev-muted);">
                ${isManager ? 'Manager Scope active: Event completion & deletion controls locked.' : 'Sequential mode prevents accidental double-starts by default.'}
              </span>
            </div>
          </section>

          ${rounds.length === 0 ? `
            <section class="ev-ws-card">
              ${window.EventoraWorkspace.renderEmptyState({
                iconName: 'rounds',
                title: 'No Configured Rounds Found',
                message: 'Configure at least one round in the Phase 4 Dynamic Round Builder before operating timers and live round transitions.',
                actionHTML: onJumpSection ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcJumpRoundsBtn">Open Round Builder &rarr;</button>` : ''
              })}
            </section>
          ` : `
            <!-- SECTION B & C: LIVE TIMER + ROUND PROGRESSION SEQUENCE -->
            <div class="ev-lc-two-col">
              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
                  <div>
                    <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Focused Round Stage</span>
                    <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;">
                      ${focusedRound ? `Round ${focusedRound.order}: ${esc(focusedRound.name)}` : 'Select a Round'}
                    </h3>
                    <p style="font-size:0.82rem;color:var(--ev-muted);">
                      ${focusedRound ? `${esc(focusedRound.typeLabel)} &bull; ${esc(focusedRound.eligibility || 'All registered participants')}` : ''}
                    </p>
                  </div>
                  <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    ${(() => {
                      const rcSum = focusedRound && window.EventoraStore.getRoundContentSummary ? window.EventoraStore.getRoundContentSummary(ev, focusedRound.id) : null;
                      return rcSum ? `<span class="ev-lc-pill">Content: ${esc(rcSum.status)}${rcSum.totalItems ? ` (${rcSum.pdfCount} PDF, ${rcSum.questionCount + rcSum.problemCount} Q/P)` : ''}</span>` : '';
                    })()}
                    ${focusedRoundOp ? `<span class="ev-lc-badge ${getEventStatusClass(focusedRoundOp.roundStatus)}">${esc(focusedRoundOp.roundStatus)}</span>` : ''}
                  </div>
                </div>

                ${focusedRound && focusedRoundOp && focusedTimer ? `
                  <div class="ev-lc-timer-card ${timerHeroStateClass}" data-lc-timer-round="${esc(focusedRound.id)}">
                    <div class="ev-lc-timer-top">
                      <div>
                        <div class="ev-lc-timer-state-lbl" data-lc-timer-state>
                          ${focusedTimer.isExpired ? 'TIME EXPIRED' : (focusedTimer.isLowTime ? 'LOW TIME WARNING' : `TIMER ${focusedTimer.state.toUpperCase()}`)}
                        </div>
                        <div class="ev-lc-clock" data-lc-timer-clock>
                          ${focusedTimer.hasDuration ? formatHMS(focusedTimer.remainingSeconds) : formatHMS(focusedTimer.elapsedSeconds)}
                        </div>
                        <div class="ev-lc-timer-caption" data-lc-timer-caption>
                          ${focusedTimer.hasDuration
                            ? `Remaining of ${formatDurationLabel(focusedTimer.totalDurationSeconds)} total (${focusedTimer.addedExtensionSeconds > 0 ? `+${Math.round(focusedTimer.addedExtensionSeconds / 60)}m extended` : 'configured'})`
                            : 'Untimed session &bull; Elapsed live time shown'}
                        </div>
                      </div>
                      <div class="ev-lc-timer-meta">
                        <div><span>Started:</span> <strong data-lc-timer-started>${esc(formatShortTimestamp(focusedRoundOp.startedAt))}</strong></div>
                        <div><span>Elapsed:</span> <strong data-lc-timer-elapsed>${formatHMS(focusedTimer.elapsedSeconds)}</strong></div>
                        <div><span>Paused Total:</span> <strong>${Math.round((focusedRoundOp.accumulatedPausedMs || 0) / 1000)}s</strong></div>
                      </div>
                    </div>

                    ${focusedTimer.isExpired ? `
                      <div class="ev-lc-alert ev-lc-alert-danger" style="margin-top:0.75rem;">
                        Round duration reached zero. Extend the clock below or mark the round Completed.
                      </div>
                    ` : (focusedTimer.isLowTime ? `
                      <div class="ev-lc-alert ev-lc-alert-warn" style="margin-top:0.75rem;">
                        Final time window active (${formatDurationLabel(focusedTimer.remainingSeconds)} remaining). Consider sending a local submission reminder.
                      </div>
                    ` : '')}

                    <div class="ev-lc-round-controls">
                      ${focusedRoundOp.roundStatus === 'Upcoming' ? `
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" data-lc-round-action="start" data-round-id="${esc(focusedRound.id)}" ${isEventCompleted || isEventPaused ? 'disabled' : ''}>Start Round</button>
                      ` : ''}
                      ${focusedRoundOp.roundStatus === 'Live' ? `
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" data-lc-round-action="pause" data-round-id="${esc(focusedRound.id)}">Pause Round</button>
                      ` : ''}
                      ${focusedRoundOp.roundStatus === 'Paused' && focusedRoundOp.timerState !== 'Ended' ? `
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" data-lc-round-action="resume" data-round-id="${esc(focusedRound.id)}" ${isEventCompleted || isEventPaused ? 'disabled' : ''}>Resume Round</button>
                      ` : ''}
                      ${(focusedRoundOp.roundStatus === 'Live' || focusedRoundOp.roundStatus === 'Paused') && focusedRoundOp.timerState !== 'Ended' ? `
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" data-lc-round-action="end" data-round-id="${esc(focusedRound.id)}">End Timer</button>
                      ` : ''}
                      ${(focusedRoundOp.roundStatus === 'Live' || focusedRoundOp.roundStatus === 'Paused') ? `
                        <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" data-lc-round-action="complete" data-round-id="${esc(focusedRound.id)}">Mark Completed</button>
                      ` : ''}
                      ${focusedRoundOp.roundStatus === 'Completed' ? `
                        <span class="ev-lc-pill">Round Completed &bull; Re-start locked cleanly</span>
                      ` : ''}
                      ${focusedRoundOp.roundStatus === 'Cancelled' ? `
                        <span class="ev-lc-pill">Round Disabled / Cancelled in Round Builder</span>
                      ` : ''}
                    </div>

                    ${(focusedRoundOp.roundStatus === 'Live' || focusedRoundOp.roundStatus === 'Paused') ? `
                      <div class="ev-lc-ext-panel">
                        <div style="font-size:0.78rem;font-weight:600;color:var(--ev-charcoal);margin-bottom:0.4rem;">Organizer Timer Extensions</div>
                        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-ext-quick="5" data-round-id="${esc(focusedRound.id)}">+5 mins</button>
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-ext-quick="15" data-round-id="${esc(focusedRound.id)}">+15 mins</button>
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-ext-quick="30" data-round-id="${esc(focusedRound.id)}">+30 mins</button>
                          <input type="number" class="ev-input" id="evLcExtCustomInput" min="1" max="720" value="${esc(uiState.extCustomMins)}" style="width:78px;padding:0.32rem 0.5rem;font-size:0.82rem;" aria-label="Extension minutes">
                          <input type="text" class="ev-input" id="evLcExtReasonInput" placeholder="Extension reason (optional)" value="${esc(uiState.extReason)}" style="flex:1;min-width:150px;padding:0.32rem 0.55rem;font-size:0.82rem;">
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcExtApplyBtn" data-round-id="${esc(focusedRound.id)}">Apply Extension</button>
                        </div>
                        ${focusedRoundOp.extensionHistory.length ? `
                          <div style="margin-top:0.45rem;font-size:0.76rem;color:var(--ev-muted);">
                            Extensions granted: ${focusedRoundOp.extensionHistory.map((ex) => `+${Math.round(ex.addedSeconds / 60)}m (${esc(ex.reason)})`).join(' &bull; ')}
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
              </section>

              <!-- SECTION C: ROUND PROGRESSION RAIL -->
              <section class="ev-ws-card">
                <div class="ev-ws-card-head" style="margin-bottom:0.75rem;">
                  <div>
                    <span class="ev-badge ev-badge-sample" style="margin-bottom:0.35rem;">Phase 4 Integrated Sequence</span>
                    <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Round Sequence &amp; Progression</h3>
                    <p style="font-size:0.82rem;color:var(--ev-muted);">Uses existing Round Builder order without duplicating definitions.</p>
                  </div>
                  ${onJumpSection ? `
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcJumpContentBtn">Round Content</button>
                      ${!isManager ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcJumpResultsBtn">Results</button>` : ''}
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcEditRoundsLink">Edit Rounds</button>
                    </div>
                  ` : ''}
                </div>

                <div class="ev-lc-round-list">
                  ${rounds.map((r) => {
                    const rOp = ops.roundsById[r.id];
                    const rSnap = snapAll.timersByRoundId[r.id];
                    const isFocused = focusedRound && focusedRound.id === r.id;
                    return `
                      <div class="ev-lc-round-row ${isFocused ? 'is-focused' : ''}">
                        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.65rem;">
                          <div style="min-width:0;">
                            <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                              <span style="font-weight:700;color:var(--ev-forest);font-size:0.82rem;">Round ${r.order}</span>
                              <strong style="font-size:0.94rem;color:var(--ev-charcoal);">${esc(r.name)}</strong>
                              <span class="ev-lc-badge ${getEventStatusClass(rOp.roundStatus)}">${esc(rOp.roundStatus)}</span>
                            </div>
                            <div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.2rem;">
                              ${esc(r.typeLabel)} &bull; ${esc(r.duration || '60 Mins')} ${r.startTime ? `&bull; ${esc(r.startTime)}` : ''}
                            </div>
                            ${r.description ? `<p style="font-size:0.8rem;color:var(--ev-muted);margin-top:0.25rem;line-height:1.4;">${esc(r.description)}</p>` : ''}
                            <div style="font-size:0.75rem;color:var(--ev-muted);margin-top:0.2rem;">Qualification: ${esc(r.eligibility || 'Open to all registered')}</div>
                          </div>
                          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;flex-shrink:0;">
                            <span style="font-family:monospace;font-size:0.84rem;font-weight:600;color:var(--ev-charcoal);" data-lc-mini-timer="${esc(r.id)}">
                              ${rSnap && rSnap.hasDuration ? formatHMS(rSnap.remainingSeconds) : (rSnap && rSnap.state !== 'Idle' ? formatHMS(rSnap.elapsedSeconds) : (r.duration || 'Untimed'))}
                            </span>
                            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;justify-content:flex-end;">
                              <button type="button" class="ev-btn ${isFocused ? 'ev-btn-forest' : 'ev-btn-outline'} ev-btn-xs" data-lc-focus-round="${esc(r.id)}">${isFocused ? 'Focused' : 'Operate'}</button>
                              ${rOp.roundStatus === 'Upcoming' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-round-action="start" data-round-id="${esc(r.id)}" ${isEventCompleted || isEventPaused ? 'disabled' : ''}>Start</button>` : ''}
                              ${rOp.roundStatus === 'Live' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-round-action="pause" data-round-id="${esc(r.id)}">Pause</button>` : ''}
                              ${rOp.roundStatus === 'Paused' && rOp.timerState !== 'Ended' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-round-action="resume" data-round-id="${esc(r.id)}" ${isEventCompleted || isEventPaused ? 'disabled' : ''}>Resume</button>` : ''}
                              ${(rOp.roundStatus === 'Live' || rOp.roundStatus === 'Paused') ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-round-action="complete" data-round-id="${esc(r.id)}">Complete</button>` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>
            </div>

            <!-- SECTION D: ROUND-TYPE-AWARE OPERATIONS -->
            ${focusedRound && focusedRoundOp && focusedTimer ? renderRoundTypePanel(ev, focusedRound, focusedRoundOp, focusedTimer) : ''}

            <!-- SECTION E: LIVE PARTICIPANT & TEAM ROSTER MONITORING -->
            <section class="ev-ws-card">
              <div class="ev-ws-card-head">
                <div>
                  <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Round-Scoped Live Roster &bull; Round ${focusedRound ? focusedRound.order : ''}</span>
                  <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;">
                    ${effectiveRosterView === 'teams' ? 'Team Live Participation' : 'Participant Live Participation'}
                  </h3>
                  <p style="font-size:0.84rem;color:var(--ev-muted);">
                    Updates apply strictly to <strong>${focusedRound ? esc(focusedRound.name) : 'the active round'}</strong>. Permanent registration records and other rounds are never overwritten.
                  </p>
                </div>
                ${useTeams ? `
                  <div class="ev-lc-seg">
                    <button type="button" class="ev-btn ev-btn-xs ${effectiveRosterView === 'teams' ? 'ev-btn-forest' : 'ev-btn-outline'}" id="evLcViewTeamsBtn">Teams (${teams.length})</button>
                    <button type="button" class="ev-btn ev-btn-xs ${effectiveRosterView === 'participants' ? 'ev-btn-forest' : 'ev-btn-outline'}" id="evLcViewPartsBtn">Participants (${nonCancelledParticipants.length})</button>
                  </div>
                ` : ''}
              </div>

              ${(effectiveRosterView === 'teams' && teams.length === 0) || (effectiveRosterView === 'participants' && nonCancelledParticipants.length === 0) ? (
                window.EventoraWorkspace.renderEmptyState({
                  iconName: effectiveRosterView === 'teams' ? 'teams' : 'participants',
                  title: effectiveRosterView === 'teams' ? 'No Teams Created for This Event' : 'No Registered Participants Yet',
                  message: effectiveRosterView === 'teams'
                    ? 'Create teams or load demo roster inside Phase 5 Teams Management before monitoring live team progression.'
                    : 'Participants appear here once registrations arrive or demo participants are loaded in the Participants section.',
                  actionHTML: onJumpSection ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcJumpRosterBtn">Open ${effectiveRosterView === 'teams' ? 'Teams' : 'Participants'} &rarr;</button>` : ''
                })
              ) : `
                <div class="ev-lc-filter-bar">
                  <input type="search" class="ev-input" id="evLcRosterSearch" placeholder="Search by name, email, registration ID, or team..." value="${esc(uiState.searchQuery)}" style="flex:1;min-width:210px;">
                  <select class="ev-select" id="evLcRosterStatusFilter" style="width:auto;min-width:175px;" aria-label="Filter by round live status">
                    <option value="ALL" ${uiState.statusFilter === 'ALL' ? 'selected' : ''}>All Round Statuses</option>
                    ${window.EventoraStore.LIVE_PARTICIPATION_STATUSES.map((st) => `
                      <option value="${esc(st)}" ${uiState.statusFilter === st ? 'selected' : ''}>${esc(st)}</option>
                    `).join('')}
                  </select>
                  ${useTeams && effectiveRosterView === 'participants' ? `
                    <select class="ev-select" id="evLcRosterTeamFilter" style="width:auto;min-width:185px;" aria-label="Filter by team assignment">
                      <option value="ALL" ${uiState.teamFilter === 'ALL' ? 'selected' : ''}>All Participants</option>
                      <option value="ASSIGNED" ${uiState.teamFilter === 'ASSIGNED' ? 'selected' : ''}>Assigned to a Team</option>
                      <option value="UNASSIGNED" ${uiState.teamFilter === 'UNASSIGNED' ? 'selected' : ''}>Unassigned Only</option>
                      ${teams.map((t) => `<option value="${esc(t.id)}" ${uiState.teamFilter === t.id ? 'selected' : ''}>Team: ${esc(t.teamName || t.name || 'Team')}</option>`).join('')}
                    </select>
                  ` : ''}
                </div>

                ${filteredRoster.length === 0 ? `
                  <div class="ev-lc-inline-note" style="margin-top:0.85rem;">
                    <span>No roster entries match your current filter criteria.</span>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcResetRosterFilterBtn">Clear Filters</button>
                  </div>
                ` : `
                  <div class="ev-lc-table-wrap">
                    <table class="ev-lc-table">
                      <thead>
                        <tr>
                          <th>${effectiveRosterView === 'teams' ? 'Team' : 'Participant'}</th>
                          <th>${effectiveRosterView === 'teams' ? 'Members' : 'Team'}</th>
                          <th>Registration</th>
                          <th>Round ${focusedRound.order} Status</th>
                          <th style="text-align:right;">Live Controls</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${effectiveRosterView === 'teams' ? filteredRoster.map((t) => {
                          const liveSt = focusedRoundOp.teamStatuses[t.id] || 'Not Started';
                          return `
                            <tr>
                              <td>
                                <div style="font-weight:600;color:var(--ev-charcoal);">${esc(t.teamName || t.name || 'Team')}</div>
                                <div style="font-size:0.75rem;color:var(--ev-muted);">${esc(t.status || 'Active')}</div>
                              </td>
                              <td>${(t.memberIds || []).length} / ${t.maxTeamSize}</td>
                              <td><span class="ev-lc-pill">Team Roster</span></td>
                              <td><span class="ev-lc-badge ${getParticipantStatusBadgeClass(liveSt)}">${esc(liveSt)}</span></td>
                              <td>
                                <div class="ev-lc-row-btns">
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-team-st="${esc(t.id)}" data-st="Active">Active</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-team-st="${esc(t.id)}" data-st="Submitted">Submitted</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-team-st="${esc(t.id)}" data-st="Completed">Completed</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-team-st="${esc(t.id)}" data-st="Absent" data-confirm="true">Absent</button>
                                  <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-lc-team-st="${esc(t.id)}" data-st="Disqualified" data-confirm="true">Disqualify</button>
                                </div>
                              </td>
                            </tr>
                          `;
                        }).join('') : filteredRoster.map((p) => {
                          const liveSt = focusedRoundOp.participantStatuses[p.id] || 'Not Started';
                          const teamLabel = p.teamId ? (teamNameMap.get(p.teamId) || 'Assigned') : 'Unassigned';
                          return `
                            <tr>
                              <td>
                                <div style="font-weight:600;color:var(--ev-charcoal);">${esc(p.fullName)}</div>
                                <div style="font-size:0.75rem;color:var(--ev-muted);">${esc(p.email || p.registrationId)}</div>
                              </td>
                              <td>${esc(teamLabel)}</td>
                              <td><span class="ev-lc-pill">${esc(p.registrationStatus)}</span></td>
                              <td><span class="ev-lc-badge ${getParticipantStatusBadgeClass(liveSt)}">${esc(liveSt)}</span></td>
                              <td>
                                <div class="ev-lc-row-btns">
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-part-st="${esc(p.id)}" data-st="Active">Active</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-part-st="${esc(p.id)}" data-st="Submitted">Submitted</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-part-st="${esc(p.id)}" data-st="Completed">Completed</button>
                                  <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-part-st="${esc(p.id)}" data-st="Absent" data-confirm="true">Absent</button>
                                  <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-lc-part-st="${esc(p.id)}" data-st="Disqualified" data-confirm="true">Disqualify</button>
                                </div>
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              `}
            </section>
          `}

          <!-- SECTION F & G: PROTOTYPE-LOCAL ANNOUNCEMENTS & EVENT ACTIVITY TIMELINE -->
          <div class="ev-lc-two-col">
            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
                <div>
                  <span class="ev-badge ev-badge-sample" style="margin-bottom:0.35rem;">Prototype-Local Notice Only</span>
                  <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Event Announcements</h3>
                  <p style="font-size:0.82rem;color:var(--ev-muted);">Stored locally per event. Prototype does not send emails, push alerts, or cross-device broadcasts.</p>
                </div>
              </div>

              <div class="ev-lc-ann-form">
                <div class="ev-lc-ann-grid">
                  <div>
                    <label class="ev-field-label" for="evLcAnnTemplate">Template</label>
                    <select class="ev-select" id="evLcAnnTemplate">
                      ${window.EventoraStore.ANNOUNCEMENT_TEMPLATES.map((tpl) => `
                        <option value="${esc(tpl.key)}" ${uiState.annTemplate === tpl.key ? 'selected' : ''}>${esc(tpl.key)}</option>
                      `).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="ev-field-label" for="evLcAnnRound">Associated Round (Optional)</label>
                    <select class="ev-select" id="evLcAnnRound">
                      <option value="">Event-Wide Announcement</option>
                      ${rounds.map((r) => `
                        <option value="${esc(r.id)}" ${uiState.annRoundId === r.id ? 'selected' : ''}>Round ${r.order}: ${esc(r.name)}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>

                <div>
                  <label class="ev-field-label" for="evLcAnnTitle">Announcement Title</label>
                  <input type="text" class="ev-input" id="evLcAnnTitle" placeholder="Enter concise headline..." value="${esc(uiState.annTitle)}">
                </div>

                <div>
                  <label class="ev-field-label" for="evLcAnnMessage">Message</label>
                  <textarea class="ev-textarea" id="evLcAnnMessage" rows="3" placeholder="Enter clear participant or venue instructions...">${esc(uiState.annMessage)}</textarea>
                </div>

                ${uiState.annPreviewOpen && (uiState.annTitle.trim() || uiState.annMessage.trim()) ? `
                  <div class="ev-lc-ann-preview">
                    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--ev-primary);margin-bottom:0.25rem;">Local Announcement Preview</div>
                    <strong style="display:block;color:var(--ev-charcoal);">${esc(uiState.annTitle || 'Untitled')}</strong>
                    <p style="font-size:0.84rem;color:var(--ev-muted);margin-top:0.2rem;white-space:pre-line;">${esc(uiState.annMessage || '')}</p>
                  </div>
                ` : ''}

                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcAnnPreviewBtn">${uiState.annPreviewOpen ? 'Hide Preview' : 'Preview'}</button>
                  <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evLcAnnSaveDraftBtn">${uiState.annEditingId ? 'Save Changes (Draft)' : 'Save Draft'}</button>
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evLcAnnPublishBtn">${uiState.annEditingId ? 'Update & Publish Locally' : 'Publish Locally'}</button>
                  ${uiState.annEditingId ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evLcAnnCancelEditBtn">Cancel Edit</button>` : ''}
                </div>
              </div>

              <div class="ev-lc-ann-history">
                <div style="font-size:0.82rem;font-weight:700;color:var(--ev-charcoal);margin-bottom:0.5rem;">Announcement History (${ops.announcements.length})</div>
                ${ops.announcements.length === 0 ? `
                  <p style="font-size:0.82rem;color:var(--ev-muted);">No local announcements drafted or published for this event yet.</p>
                ` : ops.announcements.map((ann) => {
                  const targetRnd = ann.roundId ? rounds.find((r) => r.id === ann.roundId) : null;
                  return `
                    <article class="ev-lc-ann-item">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
                        <div>
                          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:0.25rem;">
                            <span class="ev-lc-badge ${ann.status === 'Published' ? 'ev-lc-badge-live' : 'ev-lc-badge-upcoming'}">${esc(ann.status)} (Local)</span>
                            ${targetRnd ? `<span class="ev-lc-pill">R${targetRnd.order}: ${esc(targetRnd.name)}</span>` : '<span class="ev-lc-pill">Event-Wide</span>'}
                          </div>
                          <strong style="font-size:0.92rem;color:var(--ev-charcoal);">${esc(ann.title)}</strong>
                        </div>
                        <span style="font-size:0.74rem;color:var(--ev-muted);white-space:nowrap;">${esc(formatDateTimeShort(ann.updatedAt))}</span>
                      </div>
                      <p style="font-size:0.83rem;color:var(--ev-muted);margin-top:0.35rem;line-height:1.45;">${esc(ann.message)}</p>
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.55rem;">
                        <span style="font-size:0.74rem;color:var(--ev-muted);">By ${esc(ann.authorName || 'Organizer')}</span>
                        <div style="display:flex;gap:0.35rem;">
                          ${ann.status !== 'Published' ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-lc-ann-pub="${esc(ann.id)}">Publish</button>` : ''}
                          <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-lc-ann-edit="${esc(ann.id)}">Edit</button>
                          <button type="button" class="ev-btn ev-btn-danger-ghost ev-btn-xs" data-lc-ann-del="${esc(ann.id)}" ${isManager ? 'disabled title="Deletion requires Organizer permission"' : ''}>Delete</button>
                        </div>
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="ev-ws-card">
              <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
                <div>
                  <span class="ev-badge ev-badge-open" style="margin-bottom:0.35rem;">Audit &amp; Operations Log</span>
                  <h3 class="ev-display" style="font-size:1.2rem;font-weight:600;">Event Activity Timeline</h3>
                  <p style="font-size:0.82rem;color:var(--ev-muted);">Records real operations performed for "${esc(ev.name)}" in chronological sequence.</p>
                </div>
              </div>

              ${ops.activityTimeline.length === 0 ? `
                <div style="padding:1.25rem;border:1px dashed var(--ev-border);border-radius:var(--ev-radius-sm);text-align:center;">
                  <strong style="display:block;font-size:0.9rem;color:var(--ev-charcoal);">No Live Operations Recorded Yet</strong>
                  <p style="font-size:0.82rem;color:var(--ev-muted);margin-top:0.25rem;">Start an event, launch a round, extend a timer, or update statuses to record verified timeline entries here.</p>
                </div>
              ` : `
                <div class="ev-lc-timeline">
                  ${ops.activityTimeline.map((act) => {
                    const cat = getActivityCategoryLabel(act.activityType);
                    const relRound = act.roundId ? rounds.find((r) => r.id === act.roundId) : null;
                    return `
                      <div class="ev-lc-timeline-item">
                        <div class="ev-lc-timeline-dot" aria-hidden="true"></div>
                        <div style="min-width:0;flex:1;">
                          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;flex-wrap:wrap;">
                            <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
                              <span class="ev-lc-badge ${cat.cls}">${esc(cat.label)}</span>
                              ${relRound ? `<span class="ev-lc-pill">R${relRound.order}</span>` : ''}
                            </div>
                            <span style="font-size:0.74rem;color:var(--ev-muted);">${esc(formatShortTimestamp(act.timestamp))}</span>
                          </div>
                          <p style="font-size:0.84rem;color:var(--ev-charcoal);margin-top:0.28rem;line-height:1.42;">${esc(act.description)}</p>
                          <div style="font-size:0.73rem;color:var(--ev-muted);margin-top:0.15rem;">Actor: ${esc(act.actorName || 'Organizer')}</div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </section>
          </div>
        </div>
      `;

      bindHandlers();
    }

    function applyResult(res, successMsg) {
      if (!res || !res.ok) {
        if (res && res.error) toast(res.error);
        return false;
      }
      if (successMsg) toast(successMsg);
      if (onUpdated && res.event) onUpdated(res.event);
      render();
      return true;
    }

    function handleStartRound(roundId) {
      const actor = getCurrentActor();
      const res = window.EventoraStore.startLiveRound(slug, roundId, actor, {});
      if (res && res.requiresSkipConfirmation) {
        const skippedText = (res.skippedRounds || []).map((s) => `Round ${s.order} (${s.name})`).join(', ');
        confirmAction({
          title: 'Skip Earlier Rounds?',
          body: `${skippedText} has not been completed yet. Start this round out of sequence and record the skip in the Activity Timeline?`,
          confirmLabel: 'Confirm Skip & Start',
          danger: true,
          onConfirm: () => {
            const skipRes = window.EventoraStore.startLiveRound(slug, roundId, actor, { confirmSkip: true });
            if (applyResult(skipRes, 'Round started out of sequence (logged in timeline).')) {
              uiState.focusedRoundId = roundId;
              dbSyncLiveOps(roundId);
            }
          }
        });
        return;
      }
      if (applyResult(res, 'Round started and live clock active.')) {
        uiState.focusedRoundId = roundId;
        dbSyncLiveOps(roundId);
      }
    }

    function bindHandlers() {
      const actor = getCurrentActor();

      document.getElementById('evLcJumpRoundsBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('rounds'));
      document.getElementById('evLcEditRoundsLink')?.addEventListener('click', () => onJumpSection && onJumpSection('rounds'));
      document.getElementById('evLcJumpContentBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('content', uiState.focusedRoundId));
      document.getElementById('evLcJumpResultsBtn')?.addEventListener('click', () => onJumpSection && onJumpSection('results', uiState.focusedRoundId));
      document.getElementById('evLcJumpRosterBtn')?.addEventListener('click', () => {
        if (!onJumpSection) return;
        const ev = window.EventoraStore.getEventBySlug(slug);
        const goTeams = ev && ev.teamConfig && ev.teamConfig.supported && uiState.rosterView !== 'participants';
        onJumpSection(goTeams ? 'teams' : 'participants');
      });

      document.getElementById('evLcStartEventBtn')?.addEventListener('click', () => {
        if (applyResult(window.EventoraStore.startLiveEvent(slug, actor), 'Event marked Live.')) dbSyncLiveOps(null);
      });

      document.getElementById('evLcPauseEventBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Pause Event Operations',
          body: 'Pausing event operations freezes any running round countdown clocks cleanly until resumed. Continue?',
          confirmLabel: 'Pause Event',
          onConfirm: () => {
            if (applyResult(window.EventoraStore.pauseLiveEvent(slug, actor), 'Event operations paused.')) dbSyncLiveOps(null);
          }
        });
      });

      document.getElementById('evLcResumeEventBtn')?.addEventListener('click', () => {
        if (applyResult(window.EventoraStore.resumeLiveEvent(slug, actor), 'Event resumed Live.')) dbSyncLiveOps(null);
      });

      document.getElementById('evLcAdvanceRoundBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Advance to Next Round',
          body: 'Any currently running round will be marked Completed and the next configured round will start immediately. Continue?',
          confirmLabel: 'Start Next Round',
          onConfirm: () => {
            const res = window.EventoraStore.advanceToNextRound(slug, actor, {});
            if (applyResult(res, 'Advanced to next round.')) {
              uiState.focusedRoundId = res.event && res.event.liveOps ? res.event.liveOps.currentRoundId : uiState.focusedRoundId;
              dbSyncLiveOps(uiState.focusedRoundId);
              render();
            }
          }
        });
      });

      document.getElementById('evLcCompleteEventBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Complete Event Operations',
          body: 'Mark this event Completed? New round starts will be locked, while all completed rounds, participant statuses, registrations, and activity history stay preserved.',
          confirmLabel: 'Complete Event',
          danger: true,
          onConfirm: () => { if (applyResult(window.EventoraStore.completeLiveEvent(slug, actor), 'Event finalized as Completed.')) dbSyncLiveOps(null); }
        });
      });

      document.getElementById('evLcReopenEventBtn')?.addEventListener('click', () => {
        confirmAction({
          title: 'Deliberately Reopen Event?',
          body: 'This event is already Completed. Reopen into Paused mode for additional round adjustments? All historical records remain intact.',
          confirmLabel: 'Reopen to Paused',
          onConfirm: () => { if (applyResult(window.EventoraStore.reopenLiveEvent(slug, actor, { confirmed: true }), 'Event reopened in Paused state.')) dbSyncLiveOps(null); }
        });
      });

      document.getElementById('evLcConcurrentToggle')?.addEventListener('change', (e) => {
        applyResult(window.EventoraStore.setLiveConcurrentMode(slug, Boolean(e.target.checked), actor));
      });

      mountEl.querySelectorAll('[data-lc-focus-round]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.focusedRoundId = btn.dataset.lcFocusRound;
          render();
        });
      });

      mountEl.querySelectorAll('[data-lc-round-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.lcRoundAction;
          const rId = btn.dataset.roundId;
          if (action === 'start') {
            handleStartRound(rId);
          } else if (action === 'pause') {
            if (applyResult(window.EventoraStore.pauseLiveRound(slug, rId, actor), 'Round paused.')) dbSyncLiveOps(rId);
          } else if (action === 'resume') {
            if (applyResult(window.EventoraStore.resumeLiveRound(slug, rId, actor), 'Round resumed.')) dbSyncLiveOps(rId);
          } else if (action === 'end') {
            confirmAction({
              title: 'End Round Timer',
              body: 'Stop the countdown clock immediately and place this round into review before completion?',
              confirmLabel: 'End Timer',
              danger: true,
              onConfirm: () => { if (applyResult(window.EventoraStore.endLiveRound(slug, rId, actor), 'Round timer ended.')) dbSyncLiveOps(rId); }
            });
          } else if (action === 'complete') {
            confirmAction({
              title: 'Mark Round Completed',
              body: 'Mark this round Completed? Completed rounds preserve history and cannot be restarted.',
              confirmLabel: 'Mark Completed',
              onConfirm: () => { if (applyResult(window.EventoraStore.completeLiveRound(slug, rId, actor), 'Round marked Completed.')) dbSyncLiveOps(rId); }
            });
          }
        });
      });

      mountEl.querySelectorAll('[data-lc-ext-quick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mins = Number(btn.dataset.lcExtQuick);
          const rId = btn.dataset.roundId;
          applyResult(window.EventoraStore.extendRoundTimer(slug, rId, mins, `Quick +${mins}m extension`, actor), `Added +${mins} minute(s) to timer.`);
        });
      });

      const extCustomEl = document.getElementById('evLcExtCustomInput');
      const extReasonEl = document.getElementById('evLcExtReasonInput');
      extCustomEl?.addEventListener('input', () => { uiState.extCustomMins = extCustomEl.value; });
      extReasonEl?.addEventListener('input', () => { uiState.extReason = extReasonEl.value; });

      document.getElementById('evLcExtApplyBtn')?.addEventListener('click', (e) => {
        const rId = e.currentTarget.dataset.roundId;
        const mins = Number(uiState.extCustomMins);
        const reason = uiState.extReason.trim() || `Manual +${mins}m extension`;
        if (applyResult(window.EventoraStore.extendRoundTimer(slug, rId, mins, reason, actor), `Extended timer by +${mins}m.`)) {
          uiState.extReason = '';
        }
      });

      // Presentation queue buttons
      function handleSyncQueue() {
        applyResult(window.EventoraStore.syncPresentationQueue(slug, uiState.focusedRoundId, null, actor), 'Presentation order synced with current roster.');
      }
      document.getElementById('evLcSyncQueueBtn')?.addEventListener('click', handleSyncQueue);
      document.getElementById('evLcInitQueueEmptyBtn')?.addEventListener('click', handleSyncQueue);

      mountEl.querySelectorAll('[data-lc-queue-up], [data-lc-queue-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const evNow = window.EventoraStore.getEventBySlug(slug);
          const rOp = evNow && evNow.liveOps.roundsById[uiState.focusedRoundId];
          if (!rOp) return;
          const queue = [...(rOp.presentationOrder || [])];
          const isUp = btn.dataset.lcQueueUp != null;
          const idx = Number(isUp ? btn.dataset.lcQueueUp : btn.dataset.lcQueueDown);
          const targetIdx = isUp ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= queue.length) return;
          const tmp = queue[idx];
          queue[idx] = queue[targetIdx];
          queue[targetIdx] = tmp;
          applyResult(window.EventoraStore.syncPresentationQueue(slug, uiState.focusedRoundId, queue, actor), 'Presentation order updated.');
        });
      });

      mountEl.querySelectorAll('[data-lc-queue-status]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.lcQueueStatus;
          const nextSt = btn.dataset.nextStatus;
          const [kind, refId] = key.split(':');
          if (kind === 'team') {
            applyResult(window.EventoraStore.updateLiveTeamStatus(slug, uiState.focusedRoundId, refId, nextSt, actor), `Team marked ${nextSt}.`);
          } else {
            applyResult(window.EventoraStore.updateLiveParticipantStatus(slug, uiState.focusedRoundId, refId, nextSt, actor), `Participant marked ${nextSt}.`);
          }
        });
      });

      // Roster toggles & filters
      document.getElementById('evLcViewTeamsBtn')?.addEventListener('click', () => {
        uiState.rosterView = 'teams';
        render();
      });
      document.getElementById('evLcViewPartsBtn')?.addEventListener('click', () => {
        uiState.rosterView = 'participants';
        render();
      });

      const searchEl = document.getElementById('evLcRosterSearch');
      searchEl?.addEventListener('input', () => {
        uiState.searchQuery = searchEl.value;
        render();
        const ref = document.getElementById('evLcRosterSearch');
        if (ref) { ref.focus(); ref.setSelectionRange(ref.value.length, ref.value.length); }
      });

      document.getElementById('evLcRosterStatusFilter')?.addEventListener('change', (e) => {
        uiState.statusFilter = e.target.value;
        render();
      });

      document.getElementById('evLcRosterTeamFilter')?.addEventListener('change', (e) => {
        uiState.teamFilter = e.target.value;
        render();
      });

      document.getElementById('evLcResetRosterFilterBtn')?.addEventListener('click', () => {
        uiState.searchQuery = '';
        uiState.statusFilter = 'ALL';
        uiState.teamFilter = 'ALL';
        render();
      });

      function triggerRosterUpdate(isTeam, id, nextSt, needsConfirm) {
        const fn = () => {
          const res = isTeam
            ? window.EventoraStore.updateLiveTeamStatus(slug, uiState.focusedRoundId, id, nextSt, actor)
            : window.EventoraStore.updateLiveParticipantStatus(slug, uiState.focusedRoundId, id, nextSt, actor);
          applyResult(res, `Updated round status to ${nextSt}.`);
        };
        if (needsConfirm) {
          const isDisq = nextSt === 'Disqualified';
          confirmAction({
            title: isDisq ? 'Confirm Disqualification' : 'Mark Absent for Round',
            body: isDisq
              ? 'Disqualify this entry from the focused round? Their permanent registration remains intact and this status change is logged to the timeline.'
              : 'Mark this entry Absent for the focused round?',
            confirmLabel: isDisq ? 'Confirm Disqualification' : 'Mark Absent',
            danger: isDisq,
            onConfirm: fn
          });
        } else {
          fn();
        }
      }

      mountEl.querySelectorAll('[data-lc-team-st]').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerRosterUpdate(true, btn.dataset.lcTeamSt, btn.dataset.st, btn.dataset.confirm === 'true');
        });
      });

      mountEl.querySelectorAll('[data-lc-part-st]').forEach((btn) => {
        btn.addEventListener('click', () => {
          triggerRosterUpdate(false, btn.dataset.lcPartSt, btn.dataset.st, btn.dataset.confirm === 'true');
        });
      });

      // Announcement controls
      const tplEl = document.getElementById('evLcAnnTemplate');
      const roundSelEl = document.getElementById('evLcAnnRound');
      const titleEl = document.getElementById('evLcAnnTitle');
      const msgEl = document.getElementById('evLcAnnMessage');

      tplEl?.addEventListener('change', () => {
        uiState.annTemplate = tplEl.value;
        const found = window.EventoraStore.ANNOUNCEMENT_TEMPLATES.find((t) => t.key === tplEl.value);
        if (found && found.key !== 'Custom Announcement') {
          uiState.annTitle = found.title;
          uiState.annMessage = found.message;
          render();
        }
      });
      roundSelEl?.addEventListener('change', () => { uiState.annRoundId = roundSelEl.value; });
      titleEl?.addEventListener('input', () => { uiState.annTitle = titleEl.value; });
      msgEl?.addEventListener('input', () => { uiState.annMessage = msgEl.value; });

      document.getElementById('evLcAnnPreviewBtn')?.addEventListener('click', () => {
        uiState.annPreviewOpen = !uiState.annPreviewOpen;
        render();
      });

      function submitAnnouncement(status) {
        const title = uiState.annTitle.trim();
        const message = uiState.annMessage.trim();
        if (!title || !message) {
          toast('Enter both an announcement title and message.');
          return;
        }
        const payload = {
          template: uiState.annTemplate,
          roundId: uiState.annRoundId,
          title,
          message,
          status
        };
        const res = uiState.annEditingId
          ? window.EventoraStore.updateAnnouncement(slug, uiState.annEditingId, payload, actor)
          : window.EventoraStore.createAnnouncement(slug, payload, actor);
        if (applyResult(res, status === 'Published' ? 'Local announcement published.' : 'Announcement draft saved.')) {
          uiState.annEditingId = '';
          uiState.annTitle = '';
          uiState.annMessage = '';
          uiState.annPreviewOpen = false;
          render();
          // DB write-through for announcements
          if (status === 'Published') dbSyncAnnouncements();
        }
      }

      document.getElementById('evLcAnnSaveDraftBtn')?.addEventListener('click', () => submitAnnouncement('Draft'));
      document.getElementById('evLcAnnPublishBtn')?.addEventListener('click', () => submitAnnouncement('Published'));
      document.getElementById('evLcAnnCancelEditBtn')?.addEventListener('click', () => {
        uiState.annEditingId = '';
        uiState.annTitle = '';
        uiState.annMessage = '';
        uiState.annPreviewOpen = false;
        render();
      });

      mountEl.querySelectorAll('[data-lc-ann-pub]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (applyResult(window.EventoraStore.publishAnnouncement(slug, btn.dataset.lcAnnPub, actor), 'Announcement published locally.')) {
            dbSyncAnnouncements();
          }
        });
      });

      mountEl.querySelectorAll('[data-lc-ann-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const evNow = window.EventoraStore.getEventBySlug(slug);
          const ann = evNow && evNow.liveOps.announcements.find((a) => a.id === btn.dataset.lcAnnEdit);
          if (!ann) return;
          uiState.annEditingId = ann.id;
          uiState.annTemplate = ann.template || 'Custom Announcement';
          uiState.annRoundId = ann.roundId || '';
          uiState.annTitle = ann.title || '';
          uiState.annMessage = ann.message || '';
          uiState.annPreviewOpen = true;
          render();
        });
      });

      mountEl.querySelectorAll('[data-lc-ann-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          confirmAction({
            title: 'Delete Local Announcement',
            body: 'Remove this announcement from the event prototype log?',
            confirmLabel: 'Delete Announcement',
            danger: true,
            onConfirm: () => applyResult(window.EventoraStore.deleteAnnouncement(slug, btn.dataset.lcAnnDel, actor), 'Announcement deleted.')
          });
        });
      });
    }

    function updateTimerNodesOnly() {
      if (!document.body.contains(mountEl)) {
        stopActiveTicker();
        return;
      }
      const evNow = window.EventoraStore.getEventBySlug(slug);
      if (!evNow) return;
      const ops = evNow.liveOps;
      const nowMs = Date.now();
      let detectedTransition = false;

      (evNow.rounds || []).forEach((r) => {
        const rOp = ops.roundsById[r.id];
        if (!rOp) return;
        const snap = window.EventoraStore.computeTimerSnapshot(rOp, nowMs);
        if (rOp.roundStatus === 'Live' && rOp.timerState === 'Running' && snap.hasDuration && snap.isExpired) {
          detectedTransition = true;
        }
        const miniEl = mountEl.querySelector(`[data-lc-mini-timer="${r.id}"]`);
        if (miniEl && (rOp.roundStatus === 'Live' || rOp.roundStatus === 'Paused')) {
          miniEl.textContent = snap.hasDuration ? formatHMS(snap.remainingSeconds) : formatHMS(snap.elapsedSeconds);
        }
      });

      const heroEl = mountEl.querySelector('[data-lc-timer-round]');
      if (heroEl && uiState.focusedRoundId) {
        const fOp = ops.roundsById[uiState.focusedRoundId];
        if (fOp && (fOp.roundStatus === 'Live' || fOp.roundStatus === 'Paused')) {
          const snap = window.EventoraStore.computeTimerSnapshot(fOp, nowMs);
          const clockEl = heroEl.querySelector('[data-lc-timer-clock]');
          const elEl = heroEl.querySelector('[data-lc-timer-elapsed]');
          const lblEl = heroEl.querySelector('[data-lc-timer-state]');
          if (clockEl) clockEl.textContent = snap.hasDuration ? formatHMS(snap.remainingSeconds) : formatHMS(snap.elapsedSeconds);
          if (elEl) elEl.textContent = formatHMS(snap.elapsedSeconds);
          if (lblEl) {
            lblEl.textContent = snap.isExpired ? 'TIME EXPIRED' : (snap.isLowTime ? 'LOW TIME WARNING' : `TIMER ${snap.state.toUpperCase()}`);
          }
          if (snap.isLowTime && !heroEl.classList.contains('is-low-time')) {
            detectedTransition = true;
          }
        }
      }

      if (detectedTransition) {
        window.EventoraStore.syncExpiredRoundTimers(slug, nowMs, getCurrentActor());
        render();
      }
    }

    // Seed clean default announcement fields from default template if empty
    const initEv = window.EventoraStore.getEventBySlug(slug);
    if (initEv && (!uiState.annTitle && !uiState.annMessage)) {
      const defTpl = window.EventoraStore.ANNOUNCEMENT_TEMPLATES.find((t) => t.key === uiState.annTemplate);
      if (defTpl) {
        uiState.annTitle = defTpl.title;
        uiState.annMessage = defTpl.message;
      }
    }

    render();
    activeTickerId = window.setInterval(updateTimerNodesOnly, 1000);
  }

  return {
    mount,
    stopActiveTicker,
    formatHMS
  };
})();

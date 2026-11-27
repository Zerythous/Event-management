/* ==========================================================================
   EVENTORA PHASE 4 — REUSABLE DYNAMIC ROUND BUILDER
   Supports arbitrary multi-round configuration across 10 round archetypes,
   reordering (up/down + drag-and-drop), qualification rules, validation,
   read-only participant flow preview, and event-isolated storage.
   ========================================================================== */

window.EventoraRoundBuilder = (function () {
  const CODING_LANGUAGE_OPTIONS = [
    'Python',
    'C++',
    'Java',
    'JavaScript',
    'TypeScript',
    'Go',
    'Rust'
  ];

  const ROUND_STATUS_OPTIONS = ['Scheduled', 'Draft', 'Active', 'Completed'];

  function esc(val) {
    if (window.EventoraUI && typeof window.EventoraUI.escapeHTML === 'function') {
      return window.EventoraUI.escapeHTML(val);
    }
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function store() {
    return window.EventoraStore;
  }

  function cloneRounds(rounds, forceNewIds) {
    const s = store();
    if (s && typeof s.deepCloneRounds === 'function') {
      return s.deepCloneRounds(rounds || [], Boolean(forceNewIds));
    }
    return JSON.parse(JSON.stringify(Array.isArray(rounds) ? rounds : []));
  }

  function reindexRounds(rounds) {
    const s = store();
    return (Array.isArray(rounds) ? rounds : []).map((r, idx) => {
      const nextOrder = idx + 1;
      const qual = r.qualification && typeof r.qualification === 'object' ? { ...r.qualification } : { mode: 'all', minScore: 0, sourceRoundOrder: null, note: '' };
      if (qual.mode === 'previous_round') {
        if (nextOrder === 1) {
          qual.sourceRoundOrder = null;
        } else if (!qual.sourceRoundOrder || qual.sourceRoundOrder >= nextOrder) {
          qual.sourceRoundOrder = nextOrder - 1;
        }
      }
      const nextRound = {
        ...r,
        order: nextOrder,
        qualification: qual
      };
      if (s && typeof s.normalizeRound === 'function') {
        return s.normalizeRound(nextRound, idx, false);
      }
      return nextRound;
    });
  }

  /**
   * Validates draft round sequence before saving.
   * Returns { valid: boolean, error: string, invalidRoundId: string }.
   */
  function validateRounds(rounds) {
    const list = Array.isArray(rounds) ? rounds : [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!String(r.name || '').trim()) {
        return {
          valid: false,
          error: `Round ${i + 1} needs a round name before saving.`,
          invalidRoundId: r.id || ''
        };
      }
      if (r.startDateTime && r.endDateTime) {
        const sMs = new Date(r.startDateTime).getTime();
        const eMs = new Date(r.endDateTime).getTime();
        if (!Number.isNaN(sMs) && !Number.isNaN(eMs) && eMs < sMs) {
          return {
            valid: false,
            error: `Round ${i + 1} ("${r.name}") has an end date earlier than its start date.`,
            invalidRoundId: r.id || ''
          };
        }
      }
      if ((r.typeKey === 'quiz' || r.typeKey === 'mcq') && Number(r.typeConfig?.questionCount) < 1) {
        return {
          valid: false,
          error: `Round ${i + 1} ("${r.name}") requires at least 1 question.`,
          invalidRoundId: r.id || ''
        };
      }
      if (r.typeKey === 'coding' && (!Array.isArray(r.typeConfig?.languages) || r.typeConfig.languages.length === 0)) {
        return {
          valid: false,
          error: `Round ${i + 1} ("${r.name}") needs at least one programming language selected.`,
          invalidRoundId: r.id || ''
        };
      }
      if (r.qualification?.mode === 'min_score' && Number(r.qualification.minScore) < 0) {
        return {
          valid: false,
          error: `Round ${i + 1} ("${r.name}") minimum qualifying score cannot be negative.`,
          invalidRoundId: r.id || ''
        };
      }
    }
    return { valid: true, error: '', invalidRoundId: '' };
  }

  /**
   * Renders a read-only participant-facing round flow preview (no organizer controls).
   */
  function renderFlowPreviewHTML(ev, roundsInput, highlightRoundId) {
    const s = store();
    const list = Array.isArray(roundsInput) ? reindexRounds(cloneRounds(roundsInput, false)) : [];
    const enabledRounds = list.filter((r) => r.enabled !== false);
    const disabledCount = list.length - enabledRounds.length;

    if (list.length === 0) {
      return window.EventoraWorkspace.renderEmptyState({
        iconName: 'rounds',
        title: 'Single-Session Format (No Rounds Configured)',
        message: 'Participants see this event as an open single-session experience without multi-round progression gates.'
      });
    }

    return `
      <div class="ev-rb-preview-shell">
        <div class="ev-rb-preview-banner">
          <div>
            <span class="ev-badge ev-badge-open">Participant Flow Preview</span>
            <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;margin-top:0.35rem;">${esc(ev.name)} — Configured Round Sequence</h3>
            <p style="font-size:0.84rem;color:var(--ev-muted);margin-top:0.2rem;">
              Showing ${enabledRounds.length} enabled round${enabledRounds.length === 1 ? '' : 's'} as participants will view them${disabledCount > 0 ? ` (${disabledCount} disabled round${disabledCount === 1 ? '' : 's'} hidden from participants)` : ''}. Organizer edit controls are hidden here.
            </p>
          </div>
          <span style="font-size:0.78rem;color:var(--ev-muted);font-family:monospace;">ID: ${esc(ev.slug)}</span>
        </div>

        ${enabledRounds.length === 0 ? window.EventoraWorkspace.renderEmptyState({
          iconName: 'rounds',
          title: 'All Configured Rounds Are Disabled',
          message: 'Enable at least one round in Builder mode to display rounds inside the participant event flow.'
        }) : `
          <div class="ev-rb-preview-flow">
            ${enabledRounds.map((r, visibleIdx) => {
              const highlights = s && typeof s.getRoundHighlights === 'function' ? s.getRoundHighlights(r) : [];
              const qualLabel = s && typeof s.formatQualificationSummary === 'function'
                ? s.formatQualificationSummary(r.qualification, r.order)
                : r.eligibility;
              const timelineLabel = s && typeof s.formatScheduleDisplay === 'function'
                ? s.formatScheduleDisplay(r.startDateTime, r.endDateTime, r.startTime)
                : (r.startTime || 'Schedule TBD');
              const isFocus = highlightRoundId && highlightRoundId === r.id;

              return `
                <article class="ev-rb-preview-card ${isFocus ? 'is-highlighted' : ''}" data-rb-preview-card="${esc(r.id)}">
                  <div class="ev-rb-preview-step-col">
                    <div class="ev-rb-step-circle">${visibleIdx + 1}</div>
                    ${visibleIdx < enabledRounds.length - 1 ? '<div class="ev-rb-step-connector" aria-hidden="true"></div>' : ''}
                  </div>
                  <div class="ev-rb-preview-body">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <span class="ev-rb-kicker">Round ${esc(r.order)} &bull; ${esc(r.typeLabel || r.type)}</span>
                        <h4 class="ev-display" style="font-size:1.18rem;font-weight:600;color:var(--ev-charcoal);margin-top:0.15rem;">${esc(r.name)}</h4>
                      </div>
                      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span class="ev-badge ev-badge-open">${esc(r.status || 'Scheduled')}</span>
                        <span class="ev-badge ev-badge-category">${esc(qualLabel)}</span>
                      </div>
                    </div>

                    ${r.description ? `<p style="font-size:0.88rem;color:var(--ev-body);line-height:1.58;margin-top:0.55rem;">${esc(r.description)}</p>` : ''}
                    ${r.instructions ? `
                      <div style="margin-top:0.65rem;padding:0.7rem 0.9rem;border-radius:var(--ev-radius-sm);background:var(--ev-white);border:1px solid var(--ev-border);font-size:0.84rem;color:var(--ev-body);">
                        <strong style="color:var(--ev-forest);">Participant Instructions:</strong> ${esc(r.instructions)}
                      </div>
                    ` : ''}

                    <div class="ev-rb-preview-meta">
                      <span><strong>Duration:</strong> ${esc(r.duration || 'TBD')}</span>
                      <span><strong>Timeline:</strong> ${esc(timelineLabel)}</span>
                      ${r.venueOrOnline ? `<span><strong>Venue / Link:</strong> ${esc(r.venueOrOnline)}</span>` : ''}
                      ${r.maxParticipants ? `<span><strong>Capacity:</strong> Max ${esc(r.maxParticipants)}</span>` : ''}
                      ${r.scoring && r.scoring.enabled ? `<span><strong>Max Score:</strong> ${esc(r.scoring.maxScore)} ${esc(r.scoring.pointsLabel || 'pts')}</span>` : ''}
                    </div>

                    ${highlights.length > 0 ? `
                      <div class="ev-rb-chip-row">
                        ${highlights.map((chip) => `<span class="ev-rb-chip">${esc(chip)}</span>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderTypeSpecificFields(round) {
    const cfg = round.typeConfig || {};
    const t = round.typeKey;

    if (t === 'quiz' || t === 'mcq') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>${esc(round.typeLabel || round.type)} Configuration</span>
            <span class="ev-rb-subnote">Question bank editor connects in a later phase</span>
          </div>
          <div class="ev-rb-grid-3">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgQCount">Number of Questions</label>
              <input class="ev-input" id="evRbCfgQCount" type="number" min="1" max="500" data-rb-cfg="questionCount" value="${esc(cfg.questionCount)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgMarks">Marks per Question</label>
              <input class="ev-input" id="evRbCfgMarks" type="number" min="0.5" step="0.5" data-rb-cfg="marksPerQuestion" value="${esc(cfg.marksPerQuestion)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgTime">Time Limit (Minutes)</label>
              <input class="ev-input" id="evRbCfgTime" type="number" min="5" max="600" data-rb-cfg="timeLimitMinutes" value="${esc(cfg.timeLimitMinutes)}" />
            </div>
          </div>
          <div class="ev-rb-grid-2" style="margin-top:0.8rem;align-items:center;">
            <label class="ev-rb-checkline">
              <input type="checkbox" data-rb-cfg-bool="negativeMarking" ${cfg.negativeMarking ? 'checked' : ''} />
              <span>Enable negative marking for incorrect answers</span>
            </label>
            ${cfg.negativeMarking ? `
              <div class="ev-field">
                <label class="ev-label" for="evRbCfgNegVal">Penalty per Wrong Answer</label>
                <input class="ev-input" id="evRbCfgNegVal" type="number" min="0.25" step="0.25" data-rb-cfg="negativeMarkValue" value="${esc(cfg.negativeMarkValue)}" />
              </div>
            ` : '<div></div>'}
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgQPlaceholder">Question Configuration Placeholder</label>
            <textarea class="ev-textarea" id="evRbCfgQPlaceholder" rows="2" data-rb-cfg="questionPlaceholder" placeholder="Outline question topics, difficulty mix, or section breakdown...">${esc(cfg.questionPlaceholder)}</textarea>
          </div>
        </div>
      `;
    }

    if (t === 'coding') {
      const selectedLangs = new Set(Array.isArray(cfg.languages) ? cfg.languages : []);
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Coding Round Configuration</span>
            <span class="ev-rb-subnote">Code execution sandbox arrives in a later phase</span>
          </div>
          <div class="ev-field">
            <span class="ev-label">Programming Language Options</span>
            <div class="ev-rb-checkgrid">
              ${CODING_LANGUAGE_OPTIONS.map((lang) => `
                <label class="ev-rb-checkpill">
                  <input type="checkbox" data-rb-coding-lang="${esc(lang)}" ${selectedLangs.has(lang) ? 'checked' : ''} />
                  <span>${esc(lang)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="ev-rb-grid-3" style="margin-top:0.85rem;">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgCodeDur">Duration (Minutes)</label>
              <input class="ev-input" id="evRbCfgCodeDur" type="number" min="15" max="1440" data-rb-cfg="durationMinutes" value="${esc(cfg.durationMinutes)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgProbCount">Number of Problems (Placeholder)</label>
              <input class="ev-input" id="evRbCfgProbCount" type="number" min="1" max="50" data-rb-cfg="problemCount" value="${esc(cfg.problemCount)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgCodeMax">Maximum Score</label>
              <input class="ev-input" id="evRbCfgCodeMax" type="number" min="10" step="10" data-rb-cfg="maxScore" value="${esc(cfg.maxScore)}" />
            </div>
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgEvalMode">Evaluation Mode (Placeholder)</label>
            <select class="ev-select" id="evRbCfgEvalMode" data-rb-cfg="evaluationMode">
              ${['Automated Test Cases (Placeholder)', 'Hybrid Test Cases + Manual Code Review', 'IOI Partial Scoring (Placeholder)', 'Unrated / Practice Verification'].map((opt) => `
                <option value="${esc(opt)}" ${cfg.evaluationMode === opt ? 'selected' : ''}>${esc(opt)}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    }

    if (t === 'frontend') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Frontend Development Configuration</span>
            <span class="ev-rb-subnote">UI engineering task settings</span>
          </div>
          <div class="ev-rb-grid-2">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgFeDur">Round Duration</label>
              <input class="ev-input" id="evRbCfgFeDur" type="text" data-rb-cfg="duration" value="${esc(cfg.duration)}" placeholder="e.g. 2 Hours" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgFeStack">Allowed Technologies</label>
              <input class="ev-input" id="evRbCfgFeStack" type="text" data-rb-cfg="allowedTechnologies" value="${esc(cfg.allowedTechnologies)}" placeholder="HTML, CSS, JS, React..." />
            </div>
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgFeBrief">Design / Task Description</label>
            <textarea class="ev-textarea" id="evRbCfgFeBrief" rows="2" data-rb-cfg="designBrief" placeholder="Describe pages, responsive breakpoints, or design system targets...">${esc(cfg.designBrief)}</textarea>
          </div>
          <div class="ev-rb-grid-2" style="margin-top:0.8rem;">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgFeSub">Submission Instructions</label>
              <textarea class="ev-textarea" id="evRbCfgFeSub" rows="2" data-rb-cfg="submissionInstructions">${esc(cfg.submissionInstructions)}</textarea>
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgFeCrit">Evaluation Criteria</label>
              <textarea class="ev-textarea" id="evRbCfgFeCrit" rows="2" data-rb-cfg="evaluationCriteria">${esc(cfg.evaluationCriteria)}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    if (t === 'presentation') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Presentation Round Configuration</span>
            <span class="ev-rb-subnote">Pitch, demo &amp; panel settings</span>
          </div>
          <div class="ev-rb-grid-2">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPresDur">Presentation Duration</label>
              <input class="ev-input" id="evRbCfgPresDur" type="text" data-rb-cfg="presentationDuration" value="${esc(cfg.presentationDuration)}" placeholder="e.g. 8 mins pitch + 4 mins Q&amp;A" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPresFmt">Presenter Format</label>
              <select class="ev-select" id="evRbCfgPresFmt" data-rb-cfg="format">
                <option value="team" ${cfg.format === 'team' ? 'selected' : ''}>Team Presentation</option>
                <option value="individual" ${cfg.format === 'individual' ? 'selected' : ''}>Individual Presentation</option>
                <option value="either" ${cfg.format === 'either' ? 'selected' : ''}>Team or Individual</option>
              </select>
            </div>
          </div>
          <div class="ev-rb-grid-2" style="margin-top:0.8rem;">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPresCrit">Evaluation Criteria</label>
              <textarea class="ev-textarea" id="evRbCfgPresCrit" rows="2" data-rb-cfg="evaluationCriteria">${esc(cfg.evaluationCriteria)}</textarea>
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPresSub">Submission Instructions</label>
              <textarea class="ev-textarea" id="evRbCfgPresSub" rows="2" data-rb-cfg="submissionInstructions">${esc(cfg.submissionInstructions)}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    if (t === 'workshop') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Workshop Round Configuration</span>
            <span class="ev-rb-subnote">Session &amp; attendance placeholder</span>
          </div>
          <div class="ev-rb-grid-2">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgWsDur">Session Duration</label>
              <input class="ev-input" id="evRbCfgWsDur" type="text" data-rb-cfg="sessionDuration" value="${esc(cfg.sessionDuration)}" placeholder="e.g. 90 Mins" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgWsAtt">Attendance Configuration (Placeholder)</label>
              <select class="ev-select" id="evRbCfgWsAtt" data-rb-cfg="attendanceConfig">
                ${['QR Check-In (Placeholder)', 'Manual Organizer Roll Call (Placeholder)', 'Open Attendance (No Check-In Gate)'].map((opt) => `
                  <option value="${esc(opt)}" ${cfg.attendanceConfig === opt ? 'selected' : ''}>${esc(opt)}</option>
                `).join('')}
              </select>
            </div>
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgWsVenue">Venue or Meeting Information</label>
            <input class="ev-input" id="evRbCfgWsVenue" type="text" data-rb-cfg="venueOrMeetingInfo" value="${esc(cfg.venueOrMeetingInfo)}" placeholder="Room number, campus hall, or video meeting link..." />
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgWsInst">Workshop Instructions</label>
            <textarea class="ev-textarea" id="evRbCfgWsInst" rows="2" data-rb-cfg="workshopInstructions">${esc(cfg.workshopInstructions)}</textarea>
          </div>
        </div>
      `;
    }

    if (t === 'treasure_hunt') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Treasure Hunt Configuration</span>
            <span class="ev-rb-subnote">Clue sequence &amp; scoring settings</span>
          </div>
          <div class="ev-rb-grid-3">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgHuntDur">Hunt Duration</label>
              <input class="ev-input" id="evRbCfgHuntDur" type="text" data-rb-cfg="huntDuration" value="${esc(cfg.huntDuration)}" placeholder="e.g. 90 Mins" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgClues">Number of Clues (Placeholder)</label>
              <input class="ev-input" id="evRbCfgClues" type="number" min="1" max="100" data-rb-cfg="clueCount" value="${esc(cfg.clueCount)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgHuntScore">Scoring Configuration</label>
              <input class="ev-input" id="evRbCfgHuntScore" type="text" data-rb-cfg="scoringConfig" value="${esc(cfg.scoringConfig)}" />
            </div>
          </div>
          <div class="ev-field" style="margin-top:0.8rem;">
            <label class="ev-label" for="evRbCfgHuntInst">Hunt Instructions</label>
            <textarea class="ev-textarea" id="evRbCfgHuntInst" rows="2" data-rb-cfg="instructions">${esc(cfg.instructions)}</textarea>
          </div>
        </div>
      `;
    }

    if (t === 'puzzle') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Puzzle / Logical Round Configuration</span>
            <span class="ev-rb-subnote">Logical reasoning challenge settings</span>
          </div>
          <div class="ev-rb-grid-3">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPuzCount">Number of Puzzles</label>
              <input class="ev-input" id="evRbCfgPuzCount" type="number" min="1" max="100" data-rb-cfg="puzzleCount" value="${esc(cfg.puzzleCount)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPuzDur">Round Duration</label>
              <input class="ev-input" id="evRbCfgPuzDur" type="text" data-rb-cfg="duration" value="${esc(cfg.duration)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPuzDiff">Difficulty Level</label>
              <input class="ev-input" id="evRbCfgPuzDiff" type="text" data-rb-cfg="difficulty" value="${esc(cfg.difficulty)}" />
            </div>
          </div>
          <div class="ev-rb-grid-2" style="margin-top:0.8rem;">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPuzScore">Scoring Configuration</label>
              <input class="ev-input" id="evRbCfgPuzScore" type="text" data-rb-cfg="scoringConfig" value="${esc(cfg.scoringConfig)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgPuzInst">Puzzle Format Instructions</label>
              <input class="ev-input" id="evRbCfgPuzInst" type="text" data-rb-cfg="instructions" value="${esc(cfg.instructions)}" placeholder="e.g. Sequential ciphers unlocked per stage" />
            </div>
          </div>
        </div>
      `;
    }

    if (t === 'manual') {
      return `
        <div class="ev-rb-subpanel">
          <div class="ev-rb-subhead">
            <span>Manual Evaluation Configuration</span>
            <span class="ev-rb-subnote">Human judge &amp; rubric setup</span>
          </div>
          <div class="ev-rb-grid-2">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgManMarks">Maximum Marks</label>
              <input class="ev-input" id="evRbCfgManMarks" type="number" min="1" max="1000" data-rb-cfg="maxMarks" value="${esc(cfg.maxMarks)}" />
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgManSub">Submission Requirements</label>
              <input class="ev-input" id="evRbCfgManSub" type="text" data-rb-cfg="submissionRequirements" value="${esc(cfg.submissionRequirements)}" />
            </div>
          </div>
          <div class="ev-rb-grid-2" style="margin-top:0.8rem;">
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgManCrit">Evaluation Criteria</label>
              <textarea class="ev-textarea" id="evRbCfgManCrit" rows="2" data-rb-cfg="evaluationCriteria">${esc(cfg.evaluationCriteria)}</textarea>
            </div>
            <div class="ev-field">
              <label class="ev-label" for="evRbCfgManJudge">Judge Instructions</label>
              <textarea class="ev-textarea" id="evRbCfgManJudge" rows="2" data-rb-cfg="judgeInstructions">${esc(cfg.judgeInstructions)}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="ev-rb-subpanel">
        <div class="ev-rb-subhead">
          <span>Custom Round Configuration</span>
          <span class="ev-rb-subnote">Flexible format parameters</span>
        </div>
        <div class="ev-rb-grid-2">
          <div class="ev-field">
            <label class="ev-label" for="evRbCfgCustLabel">Custom Stage Label</label>
            <input class="ev-input" id="evRbCfgCustLabel" type="text" data-rb-cfg="customTypeLabel" value="${esc(cfg.customTypeLabel || round.typeLabel)}" placeholder="e.g. Debate Qualifier, Robotics Trial..." />
          </div>
          <div class="ev-field">
            <label class="ev-label" for="evRbCfgCustDur">Format Duration Summary</label>
            <input class="ev-input" id="evRbCfgCustDur" type="text" data-rb-cfg="duration" value="${esc(cfg.duration)}" placeholder="e.g. 60 Mins" />
          </div>
        </div>
        <div class="ev-field" style="margin-top:0.8rem;">
          <label class="ev-label" for="evRbCfgCustEval">Evaluation Settings</label>
          <textarea class="ev-textarea" id="evRbCfgCustEval" rows="2" data-rb-cfg="evaluationSettings">${esc(cfg.evaluationSettings)}</textarea>
        </div>
      </div>
    `;
  }

  /**
   * Mounts the interactive Dynamic Round Builder inside containerEl for an event slug.
   */
  function mount(containerEl, options = {}) {
    if (!containerEl) return null;
    const slug = String(options.slug || '').trim();
    const readOnly = Boolean(options.readOnly);
    const onSaved = typeof options.onSaved === 'function' ? options.onSaved : null;
    const onJumpSection = typeof options.onJumpSection === 'function' ? options.onJumpSection : null;
    const manageHref = options.manageHref || '';

    const s = store();
    const initialEv = s ? s.getEventBySlug(slug) : null;
    if (!initialEv) {
      containerEl.innerHTML = window.EventoraWorkspace.renderEmptyState({
        iconName: 'rounds',
        title: 'Select an Event for Round Builder',
        message: 'No matching event was found in this local workspace session.'
      });
      return null;
    }

    let draftRounds = reindexRounds(cloneRounds(initialEv.rounds, false));
    let selectedId = draftRounds[0] ? draftRounds[0].id : '';
    let viewMode = readOnly ? 'preview' : 'builder'; // 'builder' | 'preview'
    let showTypePicker = false;
    let isDirty = false;
    let validationError = '';
    let dragSourceIdx = null;
    let previewHighlightId = '';

    function getCurrentEvent() {
      return (s && s.getEventBySlug(slug)) || initialEv;
    }

    function getSelectedRound() {
      if (!draftRounds.length) return null;
      return draftRounds.find((r) => r.id === selectedId) || draftRounds[0];
    }

    function markDirty() {
      isDirty = true;
      validationError = '';
      syncStatusHeader();
    }

    function syncStatusHeader() {
      const statusBadge = containerEl.querySelector('#evRbConfigStatusBadge');
      const countLabel = containerEl.querySelector('#evRbRoundCountLabel');
      const saveBtn = containerEl.querySelector('#evRbSaveConfigBtn');
      const discardBtn = containerEl.querySelector('#evRbDiscardBtn');
      const errBox = containerEl.querySelector('#evRbErrorBanner');
      const enabledCount = draftRounds.filter((r) => r.enabled !== false).length;

      if (countLabel) {
        countLabel.textContent = `${draftRounds.length} Round${draftRounds.length === 1 ? '' : 's'} (${enabledCount} Enabled)`;
      }
      if (statusBadge) {
        if (readOnly) {
          statusBadge.className = 'ev-badge ev-badge-sample';
          statusBadge.textContent = 'Manager Read-Only View';
        } else if (isDirty) {
          statusBadge.className = 'ev-badge ev-badge-filling';
          statusBadge.textContent = 'Unsaved Changes';
        } else if (draftRounds.length === 0) {
          statusBadge.className = 'ev-badge ev-badge-sample';
          statusBadge.textContent = 'Single-Session (0 Rounds)';
        } else {
          statusBadge.className = 'ev-badge ev-badge-open';
          statusBadge.textContent = 'Configuration Saved';
        }
      }
      if (saveBtn) {
        saveBtn.classList.toggle('is-dirty', isDirty);
      }
      if (discardBtn) {
        discardBtn.hidden = !isDirty || readOnly;
      }
      if (errBox) {
        errBox.hidden = !validationError;
        errBox.textContent = validationError || '';
      }
    }

    function syncActiveCardInPlace(round) {
      if (!round) return;
      const card = containerEl.querySelector(`[data-rb-card="${round.id}"]`);
      if (card) {
        const titleEl = card.querySelector('.ev-rb-card-title');
        const metaEl = card.querySelector('.ev-rb-card-meta');
        const typeEl = card.querySelector('.ev-rb-card-type');
        const statusEl = card.querySelector('.ev-rb-card-status');
        if (titleEl) titleEl.textContent = round.name || `Round ${round.order}`;
        if (typeEl) typeEl.textContent = `Round ${round.order} • ${round.typeLabel || round.type}`;
        if (metaEl) metaEl.textContent = `${round.duration || 'TBD'} • ${round.eligibility}`;
        if (statusEl) {
          statusEl.textContent = round.enabled === false ? 'Disabled' : (round.status || 'Scheduled');
          statusEl.className = `ev-badge ${round.enabled === false ? 'ev-badge-closed' : 'ev-badge-open'} ev-rb-card-status`;
        }
        card.classList.toggle('is-disabled', round.enabled === false);
      }
      const seqNode = containerEl.querySelector(`[data-rb-seq-node="${round.id}"] .ev-rb-seq-name`);
      if (seqNode) seqNode.textContent = round.name || `Round ${round.order}`;
      const seqQual = containerEl.querySelector(`[data-rb-seq-node="${round.id}"] .ev-rb-seq-qual`);
      if (seqQual) seqQual.textContent = round.eligibility;
    }

    function addNewRound(typeKey) {
      if (readOnly) return;
      const created = s.createBlankRound(typeKey || 'custom', draftRounds.length + 1);
      draftRounds = reindexRounds([...draftRounds, created]);
      selectedId = created.id;
      showTypePicker = false;
      viewMode = 'builder';
      markDirty();
      render();
      const nameInput = containerEl.querySelector('#evRbFieldName');
      if (nameInput) nameInput.focus();
    }

    function duplicateRound(roundId) {
      if (readOnly) return;
      const idx = draftRounds.findIndex((r) => r.id === roundId);
      if (idx < 0) return;
      const source = draftRounds[idx];
      const copy = cloneRounds([source], true)[0];
      copy.name = `${source.name} (Copy)`;
      const next = [...draftRounds];
      next.splice(idx + 1, 0, copy);
      draftRounds = reindexRounds(next);
      selectedId = copy.id;
      markDirty();
      render();
      window.EventoraUI?.showToast(`Duplicated "${source.name}" into Round ${copy.order}. Save Configuration to persist.`);
    }

    function deleteRound(roundId) {
      if (readOnly) return;
      const target = draftRounds.find((r) => r.id === roundId);
      if (!target) return;
      window.EventoraWorkspace.openConfirm({
        title: 'Delete Round Configuration',
        body: `Remove Round ${target.order} ("${target.name}") from "${getCurrentEvent().name}"? Subsequent round numbers will shift automatically.`,
        confirmLabel: 'Delete Round',
        danger: true,
        onConfirm: () => {
          const next = draftRounds.filter((r) => r.id !== roundId);
          draftRounds = reindexRounds(next);
          if (selectedId === roundId) {
            selectedId = draftRounds[0] ? draftRounds[0].id : '';
          }
          markDirty();
          render();
          window.EventoraUI?.showToast(`Removed "${target.name}". Click Save Configuration to save.`);
        }
      });
    }

    function moveRound(fromIdx, toIdx) {
      if (readOnly) return;
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= draftRounds.length || toIdx >= draftRounds.length || fromIdx === toIdx) return;
      const next = [...draftRounds];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      draftRounds = reindexRounds(next);
      selectedId = item.id;
      markDirty();
      render();
    }

    function toggleRoundEnabled(roundId) {
      if (readOnly) return;
      const target = draftRounds.find((r) => r.id === roundId);
      if (!target) return;
      target.enabled = target.enabled === false;
      target.status = target.enabled ? (target.status === 'Disabled' ? 'Scheduled' : target.status) : 'Disabled';
      draftRounds = reindexRounds(draftRounds);
      markDirty();
      render();
    }

    function commitSaveConfiguration() {
      if (readOnly) return;
      const check = validateRounds(draftRounds);
      if (!check.valid) {
        validationError = check.error;
        if (check.invalidRoundId) {
          selectedId = check.invalidRoundId;
          viewMode = 'builder';
        }
        render();
        return;
      }
      const normalized = reindexRounds(draftRounds);
      const saveRes = s.saveEventRounds(slug, normalized);
      if (!saveRes.ok) {
        validationError = saveRes.error || 'Could not save rounds locally.';
        syncStatusHeader();
        return;
      }
      draftRounds = reindexRounds(cloneRounds(saveRes.event.rounds, false));
      if (!draftRounds.some((r) => r.id === selectedId)) {
        selectedId = draftRounds[0] ? draftRounds[0].id : '';
      }
      isDirty = false;
      validationError = '';
      render();
      window.EventoraUI?.showToast(`Saved ${draftRounds.length} round${draftRounds.length === 1 ? '' : 's'} for "${saveRes.event.name}".`);
      if (onSaved) onSaved(saveRes.event);
      // DB write-through: sync rounds to PostgreSQL when Supabase is active
      if (window.EventoraSync && window.EventoraSync.isSupabaseActiveForEvent(saveRes.event)) {
        window.EventoraSync.flushEventWriteThrough(slug);
      }
    }

    function discardUnsavedChanges() {
      const freshEv = getCurrentEvent();
      draftRounds = reindexRounds(cloneRounds(freshEv.rounds, false));
      selectedId = draftRounds[0] ? draftRounds[0].id : '';
      isDirty = false;
      validationError = '';
      render();
      window.EventoraUI?.showToast('Reverted to last saved round configuration.');
    }

    function renderInspector(round) {
      if (!round) return '';
      const roundTypes = s.getRoundTypeCatalog();
      const qualModes = s.QUALIFICATION_MODES;
      const q = round.qualification || { mode: 'all', minScore: 0, sourceRoundOrder: null, note: '' };
      const precedingRounds = draftRounds.filter((item) => item.order < round.order);

      return `
        <div class="ev-rb-inspector" id="evRbInspector">
          <div class="ev-rb-inspector-head">
            <div>
              <span class="ev-badge ev-badge-category">Editing Round ${esc(round.order)}</span>
              <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;margin-top:0.35rem;">${esc(round.name)}</h3>
            </div>
            <label class="ev-rb-toggle-label">
              <input type="checkbox" id="evRbFieldEnabled" ${round.enabled !== false ? 'checked' : ''} />
              <span>${round.enabled !== false ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>

          <!-- Group 1: Core Identity & Type -->
          <div class="ev-rb-group">
            <div class="ev-rb-grid-2">
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldName">Round Name *</label>
                <input class="ev-input" id="evRbFieldName" type="text" data-rb-field="name" value="${esc(round.name)}" placeholder="e.g. Qualifier Quiz" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldType">Round Type</label>
                <select class="ev-select" id="evRbFieldType">
                  ${roundTypes.map((rt) => `
                    <option value="${esc(rt.key)}" ${round.typeKey === rt.key ? 'selected' : ''}>${esc(rt.label)}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="ev-rb-grid-3" style="margin-top:0.8rem;">
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldStatus">Round Status</label>
                <select class="ev-select" id="evRbFieldStatus" data-rb-field="status">
                  ${ROUND_STATUS_OPTIONS.map((st) => `
                    <option value="${esc(st)}" ${round.status === st ? 'selected' : ''}>${esc(st)}</option>
                  `).join('')}
                </select>
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldDuration">Duration</label>
                <input class="ev-input" id="evRbFieldDuration" type="text" data-rb-field="duration" value="${esc(round.duration)}" placeholder="e.g. 60 Mins or 2 Hours" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldMaxPart">Max Participants (Optional)</label>
                <input class="ev-input" id="evRbFieldMaxPart" type="number" min="1" data-rb-field="maxParticipants" value="${round.maxParticipants != null ? esc(round.maxParticipants) : ''}" placeholder="Unlimited" />
              </div>
            </div>

            <div class="ev-field" style="margin-top:0.8rem;">
              <label class="ev-label" for="evRbFieldDesc">Round Description</label>
              <textarea class="ev-textarea" id="evRbFieldDesc" rows="2" data-rb-field="description" placeholder="Summarize what happens during this round...">${esc(round.description)}</textarea>
            </div>
          </div>

          <!-- Group 2: Timeline & Venue -->
          <div class="ev-rb-group">
            <div class="ev-rb-group-title">Schedule Timeline &amp; Venue</div>
            <div class="ev-rb-grid-3">
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldStartDt">Start Date &amp; Time</label>
                <input class="ev-input" id="evRbFieldStartDt" type="datetime-local" data-rb-field="startDateTime" value="${esc(round.startDateTime)}" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldEndDt">End Date &amp; Time</label>
                <input class="ev-input" id="evRbFieldEndDt" type="datetime-local" data-rb-field="endDateTime" value="${esc(round.endDateTime)}" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldVenue">Venue or Online Link Info</label>
                <input class="ev-input" id="evRbFieldVenue" type="text" data-rb-field="venueOrOnline" value="${esc(round.venueOrOnline)}" placeholder="Hall / Online Portal / Room" />
              </div>
            </div>
          </div>

          <!-- Group 3: Dynamic Type-Specific Parameters -->
          ${renderTypeSpecificFields(round)}

          <!-- Group 4: Scoring & Qualification Workflow -->
          <div class="ev-rb-subpanel">
            <div class="ev-rb-subhead">
              <span>Qualification Workflow &amp; Points</span>
              <span class="ev-rb-subnote">UI workflow rules (evaluated in live backend phase)</span>
            </div>
            <div class="ev-rb-grid-2">
              <div class="ev-field">
                <label class="ev-label" for="evRbFieldQualMode">Participant Eligibility</label>
                <select class="ev-select" id="evRbFieldQualMode">
                  ${qualModes.map((qm) => `
                    <option value="${esc(qm.key)}" ${q.mode === qm.key ? 'selected' : ''}>${esc(qm.label)}</option>
                  `).join('')}
                </select>
              </div>
              ${q.mode === 'min_score' ? `
                <div class="ev-field">
                  <label class="ev-label" for="evRbFieldMinScore">Minimum Qualifying Score</label>
                  <input class="ev-input" id="evRbFieldMinScore" type="number" min="0" data-rb-qual="minScore" value="${esc(q.minScore)}" />
                </div>
              ` : (q.mode === 'previous_round' && precedingRounds.length > 0 ? `
                <div class="ev-field">
                  <label class="ev-label" for="evRbFieldSourceRound">Qualifying Source Round</label>
                  <select class="ev-select" id="evRbFieldSourceRound" data-rb-qual="sourceRoundOrder">
                    ${precedingRounds.map((pr) => `
                      <option value="${esc(pr.order)}" ${Number(q.sourceRoundOrder || (round.order - 1)) === pr.order ? 'selected' : ''}>Round ${esc(pr.order)}: ${esc(pr.name)}</option>
                    `).join('')}
                  </select>
                </div>
              ` : `
                <div class="ev-field">
                  <label class="ev-label" for="evRbFieldQualNote">Qualification Criteria Note (Optional)</label>
                  <input class="ev-input" id="evRbFieldQualNote" type="text" data-rb-qual="note" value="${esc(q.note)}" placeholder="e.g. Top 20 squads advance" />
                </div>
              `)}
            </div>

            <div class="ev-rb-grid-3" style="margin-top:0.85rem;align-items:center;">
              <label class="ev-rb-checkline">
                <input type="checkbox" id="evRbFieldScoreEnabled" ${round.scoring && round.scoring.enabled ? 'checked' : ''} />
                <span>Configure score / points</span>
              </label>
              ${round.scoring && round.scoring.enabled ? `
                <div class="ev-field">
                  <label class="ev-label" for="evRbFieldScoreMax">Max Points</label>
                  <input class="ev-input" id="evRbFieldScoreMax" type="number" min="1" data-rb-score="maxScore" value="${esc(round.scoring.maxScore)}" />
                </div>
                <div class="ev-field">
                  <label class="ev-label" for="evRbFieldScoreUnit">Points Unit Label</label>
                  <input class="ev-input" id="evRbFieldScoreUnit" type="text" data-rb-score="pointsLabel" value="${esc(round.scoring.pointsLabel)}" placeholder="pts / marks" />
                </div>
              ` : '<div></div><div></div>'}
            </div>
            <p style="font-size:0.76rem;color:var(--ev-muted);margin-top:0.65rem;">
              Note: This panel stores round qualification rules on the event blueprint. Automated participant progression executes once registration &amp; live judging connect to Postgres.
            </p>
          </div>

          <!-- Group 5: Participant Instructions -->
          <div class="ev-rb-group" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">
            <div class="ev-field">
              <label class="ev-label" for="evRbFieldInstructions">Participant Round Instructions</label>
              <textarea class="ev-textarea" id="evRbFieldInstructions" rows="3" data-rb-field="instructions" placeholder="Clear check-in steps, submission format, and timing rules shown to participants...">${esc(round.instructions)}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    function render() {
      const ev = getCurrentEvent();
      const roundTypes = s.getRoundTypeCatalog();
      const selectedRound = getSelectedRound();
      const enabledCount = draftRounds.filter((r) => r.enabled !== false).length;

      containerEl.innerHTML = `
        <div class="ev-ws-card ev-rb-root">
          <!-- Header & Top Bar -->
          <div class="ev-rb-header">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                <span class="ev-badge ev-badge-category">Phase 4 Dynamic Round Builder</span>
                <span id="evRbConfigStatusBadge" class="ev-badge ev-badge-open">Configured</span>
                <span class="ev-rb-id-chip">Event ID: <code>${esc(ev.slug)}</code></span>
              </div>
              <h2 class="ev-display" style="font-size:1.5rem;font-weight:600;color:var(--ev-charcoal);">${esc(ev.name)}</h2>
              <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.2rem;">
                <strong id="evRbRoundCountLabel" style="color:var(--ev-forest);">${draftRounds.length} Round${draftRounds.length === 1 ? '' : 's'} (${enabledCount} Enabled)</strong>
                &bull; Unlimited custom stage formats, ordering, and qualification rules.
              </p>
            </div>

            <div class="ev-rb-header-actions">
              ${manageHref ? `<a href="${esc(manageHref)}" class="ev-btn ev-btn-outline ev-btn-sm">Manage Full Event &rarr;</a>` : ''}
              ${draftRounds.length > 0 ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRbContentJumpBtn">Round Content &rarr;</button>` : ''}
              ${!readOnly ? `
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRbPreviewToggleBtn">
                  ${viewMode === 'preview' ? '&larr; Back to Builder' : 'Preview Event Flow'}
                </button>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRbDiscardBtn" hidden>Discard Changes</button>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRbAddRoundBtn">+ Add Round</button>
                <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRbSaveConfigBtn">Save Configuration</button>
              ` : `
                <a href="event.html?slug=${encodeURIComponent(ev.slug)}" target="_blank" rel="noopener" class="ev-btn ev-btn-outline ev-btn-sm">Open Event Page &rarr;</a>
              `}
            </div>
          </div>

          <div id="evRbErrorBanner" class="ev-auth-status is-error" style="margin-bottom:1rem;" hidden></div>

          ${readOnly ? `
            <div class="ev-auth-status is-info" style="margin-bottom:1rem;">
              <span>Manager scope active: inspect configured stages and preview the participant round sequence. Full round structural editing requires Event Organizer permissions.</span>
            </div>
          ` : ''}

          <!-- Round Type Quick Picker Drawer -->
          ${(!readOnly && showTypePicker) ? `
            <div class="ev-rb-type-picker" id="evRbTypePicker">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap;">
                <div>
                  <div style="font-weight:700;font-size:0.9rem;color:var(--ev-forest);">Choose Round Type to Add</div>
                  <div style="font-size:0.78rem;color:var(--ev-muted);">Pick any competition, workshop, evaluation, or custom stage format.</div>
                </div>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRbClosePickerBtn">Close</button>
              </div>
              <div class="ev-rb-type-grid">
                ${roundTypes.map((rt) => `
                  <button type="button" class="ev-rb-type-tile" data-rb-add-type="${esc(rt.key)}">
                    <span class="ev-rb-type-title">${esc(rt.label)}</span>
                    <span class="ev-rb-type-desc">${esc(rt.description)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Sequence Timeline Bar -->
          ${draftRounds.length > 0 ? `
            <div class="ev-rb-sequence-bar" aria-label="Configured round timeline">
              ${draftRounds.map((r, i) => `
                <button type="button" class="ev-rb-seq-node ${selectedRound && selectedRound.id === r.id ? 'is-selected' : ''} ${r.enabled === false ? 'is-disabled' : ''}" data-rb-seq-node="${esc(r.id)}">
                  <span class="ev-rb-seq-num">R${esc(r.order)}</span>
                  <span class="ev-rb-seq-info">
                    <span class="ev-rb-seq-name">${esc(r.name)}</span>
                    <span class="ev-rb-seq-qual">${esc(r.eligibility)}</span>
                  </span>
                </button>
                ${i < draftRounds.length - 1 ? '<span class="ev-rb-seq-arrow" aria-hidden="true">&rarr;</span>' : ''}
              `).join('')}
            </div>
          ` : ''}

          <!-- Main Body: Builder Workspace OR Read-Only Preview -->
          ${viewMode === 'preview' ? renderFlowPreviewHTML(ev, draftRounds, previewHighlightId) : `
            ${draftRounds.length === 0 ? window.EventoraWorkspace.renderEmptyState({
              iconName: 'rounds',
              title: 'No rounds configured for this event yet',
              message: 'Add quiz, coding, presentation, workshop, treasure hunt, puzzle, manual evaluation, or custom rounds tailored to this event.',
              actionHTML: '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRbEmptyAddBtn">+ Add First Round</button>'
            }) : `
              <div class="ev-rb-workspace">
                <!-- Left Column: Reorderable Round Cards -->
                <div class="ev-rb-list-col" id="evRbListCol">
                  ${draftRounds.map((r, idx) => {
                    const isActive = selectedRound && selectedRound.id === r.id;
                    return `
                      <div class="ev-rb-card ${isActive ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}" data-rb-card="${esc(r.id)}" data-rb-idx="${idx}" draggable="true">
                        <div class="ev-rb-card-top">
                          <button type="button" class="ev-rb-card-select" data-rb-select="${esc(r.id)}">
                            <span class="ev-rb-card-type">Round ${esc(r.order)} &bull; ${esc(r.typeLabel || r.type)}</span>
                            <span class="ev-rb-card-title">${esc(r.name)}</span>
                            <span class="ev-rb-card-meta">${esc(r.duration || 'TBD')} &bull; ${esc(r.eligibility)}</span>
                          </button>
                          <span class="ev-badge ${r.enabled === false ? 'ev-badge-closed' : 'ev-badge-open'} ev-rb-card-status">${r.enabled === false ? 'Disabled' : esc(r.status || 'Scheduled')}</span>
                        </div>
                        <div class="ev-rb-card-actions">
                          <div class="ev-rb-order-btns">
                            <button type="button" class="ev-rb-icon-btn" data-rb-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move up" aria-label="Move round ${r.order} up">&uarr;</button>
                            <button type="button" class="ev-rb-icon-btn" data-rb-down="${idx}" ${idx === draftRounds.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move round ${r.order} down">&darr;</button>
                          </div>
                          <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rb-toggle="${esc(r.id)}">${r.enabled === false ? 'Enable' : 'Disable'}</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rb-select="${esc(r.id)}">Edit</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rb-preview="${esc(r.id)}">Preview</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rb-dup="${esc(r.id)}">Duplicate</button>
                            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-rb-del="${esc(r.id)}">Delete</button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Right Column: Selected Round Configuration Form -->
                <div class="ev-rb-editor-col">
                  ${renderInspector(selectedRound)}
                </div>
              </div>
            `}
          `}
        </div>
      `;

      syncStatusHeader();
      bindEvents();
    }

    function bindEvents() {
      containerEl.querySelector('#evRbAddRoundBtn')?.addEventListener('click', () => {
        showTypePicker = !showTypePicker;
        viewMode = 'builder';
        render();
      });

      containerEl.querySelector('#evRbClosePickerBtn')?.addEventListener('click', () => {
        showTypePicker = false;
        render();
      });

      containerEl.querySelector('#evRbEmptyAddBtn')?.addEventListener('click', () => {
        showTypePicker = true;
        render();
      });

      containerEl.querySelectorAll('[data-rb-add-type]').forEach((btn) => {
        btn.addEventListener('click', () => addNewRound(btn.dataset.rbAddType));
      });

      containerEl.querySelector('#evRbSaveConfigBtn')?.addEventListener('click', commitSaveConfiguration);
      containerEl.querySelector('#evRbDiscardBtn')?.addEventListener('click', discardUnsavedChanges);

      containerEl.querySelector('#evRbPreviewToggleBtn')?.addEventListener('click', () => {
        previewHighlightId = '';
        viewMode = viewMode === 'preview' ? 'builder' : 'preview';
        render();
      });

      containerEl.querySelector('#evRbContentJumpBtn')?.addEventListener('click', () => {
        if (onJumpSection) {
          onJumpSection('content', selectedId);
        } else {
          const rParam = selectedId ? `&roundId=${encodeURIComponent(selectedId)}` : '';
          window.location.href = `manage-event.html?slug=${encodeURIComponent(slug)}&section=content${rParam}`;
        }
      });

      containerEl.querySelectorAll('[data-rb-seq-node]').forEach((node) => {
        node.addEventListener('click', () => {
          const rid = node.dataset.rbSeqNode;
          selectedId = rid;
          if (viewMode === 'preview') {
            previewHighlightId = rid;
          }
          render();
        });
      });

      containerEl.querySelectorAll('[data-rb-select]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedId = btn.dataset.rbSelect;
          viewMode = 'builder';
          render();
        });
      });

      containerEl.querySelectorAll('[data-rb-preview]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rid = btn.dataset.rbPreview;
          selectedId = rid;
          previewHighlightId = rid;
          viewMode = 'preview';
          render();
        });
      });

      containerEl.querySelectorAll('[data-rb-up]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.rbUp);
          moveRound(idx, idx - 1);
        });
      });

      containerEl.querySelectorAll('[data-rb-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.rbDown);
          moveRound(idx, idx + 1);
        });
      });

      containerEl.querySelectorAll('[data-rb-dup]').forEach((btn) => {
        btn.addEventListener('click', () => duplicateRound(btn.dataset.rbDup));
      });

      containerEl.querySelectorAll('[data-rb-del]').forEach((btn) => {
        btn.addEventListener('click', () => deleteRound(btn.dataset.rbDel));
      });

      containerEl.querySelectorAll('[data-rb-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => toggleRoundEnabled(btn.dataset.rbToggle));
      });

      // Drag-and-drop reordering on round cards
      containerEl.querySelectorAll('.ev-rb-card').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
          if (readOnly) return;
          dragSourceIdx = Number(card.dataset.rbIdx);
          card.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(dragSourceIdx));
          }
        });
        card.addEventListener('dragover', (e) => {
          if (readOnly || dragSourceIdx == null) return;
          e.preventDefault();
          card.classList.add('is-drag-over');
        });
        card.addEventListener('dragleave', () => {
          card.classList.remove('is-drag-over');
        });
        card.addEventListener('drop', (e) => {
          if (readOnly) return;
          e.preventDefault();
          card.classList.remove('is-drag-over');
          const toIdx = Number(card.dataset.rbIdx);
          const fromIdx = dragSourceIdx != null ? dragSourceIdx : Number(e.dataTransfer?.getData('text/plain'));
          dragSourceIdx = null;
          moveRound(fromIdx, toIdx);
        });
        card.addEventListener('dragend', () => {
          dragSourceIdx = null;
          containerEl.querySelectorAll('.ev-rb-card').forEach((c) => c.classList.remove('is-dragging', 'is-drag-over'));
        });
      });

      // Inspector form field synchronization
      const round = getSelectedRound();
      if (!round || readOnly || viewMode !== 'builder') return;

      containerEl.querySelector('#evRbFieldEnabled')?.addEventListener('change', (e) => {
        round.enabled = e.target.checked;
        round.status = round.enabled ? (round.status === 'Disabled' ? 'Scheduled' : round.status) : 'Disabled';
        markDirty();
        render();
      });

      containerEl.querySelector('#evRbFieldType')?.addEventListener('change', (e) => {
        const nextType = e.target.value;
        const idx = draftRounds.findIndex((r) => r.id === round.id);
        const typeMeta = s.getRoundTypeMeta(nextType);
        const switched = s.normalizeRound({
          ...round,
          typeKey: nextType,
          type: typeMeta.label,
          typeLabel: typeMeta.label,
          typeConfig: {}
        }, idx >= 0 ? idx : 0, false);
        // Preserve round core name/description/instructions/schedule chosen by organizer
        switched.name = round.name;
        switched.description = round.description;
        switched.instructions = round.instructions;
        switched.startDateTime = round.startDateTime;
        switched.endDateTime = round.endDateTime;
        switched.venueOrOnline = round.venueOrOnline;
        switched.maxParticipants = round.maxParticipants;
        if (idx >= 0) draftRounds[idx] = switched;
        draftRounds = reindexRounds(draftRounds);
        markDirty();
        render();
      });

      containerEl.querySelector('#evRbFieldQualMode')?.addEventListener('change', (e) => {
        round.qualification.mode = e.target.value;
        if (round.qualification.mode === 'previous_round' && round.order > 1 && !round.qualification.sourceRoundOrder) {
          round.qualification.sourceRoundOrder = round.order - 1;
        }
        round.eligibility = s.formatQualificationSummary(round.qualification, round.order);
        markDirty();
        render();
      });

      containerEl.querySelector('#evRbFieldScoreEnabled')?.addEventListener('change', (e) => {
        round.scoring.enabled = e.target.checked;
        markDirty();
        render();
      });

      containerEl.querySelectorAll('[data-rb-field]').forEach((inp) => {
        const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          const key = inp.dataset.rbField;
          if (key === 'maxParticipants') {
            round.maxParticipants = inp.value ? Math.max(1, Number(inp.value)) : null;
          } else {
            round[key] = inp.value;
          }
          if (key === 'startDateTime' || key === 'endDateTime') {
            round.startTime = s.formatScheduleDisplay(round.startDateTime, round.endDateTime, round.startTime);
          }
          if (key === 'status' && inp.value !== 'Disabled') {
            round.enabled = true;
          }
          markDirty();
          syncActiveCardInPlace(round);
          const headTitle = containerEl.querySelector('.ev-rb-inspector-head h3');
          if (headTitle && key === 'name') headTitle.textContent = round.name || `Round ${round.order}`;
        });
      });

      containerEl.querySelectorAll('[data-rb-qual]').forEach((inp) => {
        const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          const k = inp.dataset.rbQual;
          round.qualification[k] = k === 'note' ? inp.value : Number(inp.value);
          round.eligibility = s.formatQualificationSummary(round.qualification, round.order);
          markDirty();
          syncActiveCardInPlace(round);
        });
      });

      containerEl.querySelectorAll('[data-rb-score]').forEach((inp) => {
        inp.addEventListener('input', () => {
          const k = inp.dataset.rbScore;
          round.scoring[k] = k === 'maxScore' ? Number(inp.value || 0) : inp.value;
          markDirty();
        });
      });

      containerEl.querySelectorAll('[data-rb-cfg]').forEach((inp) => {
        const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          const k = inp.dataset.rbCfg;
          const val = inp.type === 'number' ? Number(inp.value || 0) : inp.value;
          round.typeConfig[k] = val;
          if (k === 'customTypeLabel' && round.typeKey === 'custom') {
            const label = String(val || '').trim() || 'Custom Round';
            round.type = label;
            round.typeLabel = label;
          }
          if (k === 'durationMinutes' || k === 'timeLimitMinutes') {
            const minsText = val > 0 ? `${val} Mins` : round.duration;
            round.duration = minsText;
            const durField = containerEl.querySelector('#evRbFieldDuration');
            if (durField) durField.value = minsText;
          } else if (k === 'duration' || k === 'sessionDuration' || k === 'huntDuration') {
            if (String(val || '').trim()) {
              round.duration = String(val).trim();
              const durField = containerEl.querySelector('#evRbFieldDuration');
              if (durField) durField.value = round.duration;
            }
          }
          markDirty();
          syncActiveCardInPlace(round);
        });
      });

      containerEl.querySelectorAll('[data-rb-cfg-bool]').forEach((cb) => {
        cb.addEventListener('change', () => {
          round.typeConfig[cb.dataset.rbCfgBool] = cb.checked;
          markDirty();
          render();
        });
      });

      containerEl.querySelectorAll('[data-rb-coding-lang]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const set = new Set(Array.isArray(round.typeConfig.languages) ? round.typeConfig.languages : []);
          if (cb.checked) set.add(cb.dataset.rbCodingLang);
          else set.delete(cb.dataset.rbCodingLang);
          round.typeConfig.languages = Array.from(set);
          markDirty();
        });
      });
    }

    render();

    return {
      getDraftRounds: () => cloneRounds(draftRounds, false),
      save: commitSaveConfiguration,
      isDirty: () => isDirty
    };
  }

  return {
    mount,
    renderFlowPreviewHTML,
    validateRounds
  };
})();

/* ==========================================================================
   EVENTORA PHASE 6 — STEP-BY-STEP PARTICIPANT REGISTRATION FLOW
   Mounts inside register.html?slug=EVENT_SLUG:
   - Step 1: Event Overview & Registration Window/Capacity Summary
   - Step 2: Organizer-Configured Registration Form (profile pre-filled)
   - Step 3: Individual vs. Rule-Enforced Team Choice
   - Step 4: Full Review & Edit Jump Links
   - Step 5: Submission, Unique Reg ID, Status & Honest Prototype Confirmation
   ========================================================================== */

window.EventoraRegistrationFlow = (function () {
  const STEPS = [
    { num: 1, label: 'Event Overview' },
    { num: 2, label: 'Registration Form' },
    { num: 3, label: 'Participation Mode' },
    { num: 4, label: 'Review' },
    { num: 5, label: 'Confirmation' }
  ];

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

  function formatStatusBadgeClass(st) {
    if (st === 'Approved') return 'ev-badge-open';
    if (st === 'Waitlisted') return 'ev-badge-filling';
    if (st === 'Rejected' || st === 'Cancelled') return 'ev-badge-closed';
    return 'ev-badge-sample';
  }

  function mount(containerEl, { slug, user, isEditMode = false }) {
    if (!containerEl || !user) return null;
    const s = store();
    const ev = s ? s.getEventBySlug(slug) : null;

    if (!ev) {
      containerEl.innerHTML = `
        <div class="ev-container" style="max-width:680px;padding:3rem 1rem;">
          ${window.EventoraWorkspace.renderEmptyState({
            iconName: 'events',
            title: 'Event Not Found',
            message: 'The requested event does not exist or could not be loaded from this session.',
            actionHTML: '<a href="discover.html" class="ev-btn ev-btn-forest">Browse Upcoming Events</a>'
          })}
        </div>
      `;
      return null;
    }

    const avail = s.evaluateRegistrationAvailability(ev, user);
    const existingReg = avail.existingRegistration;
    const canEditExisting = Boolean(
      isEditMode
      && existingReg
      && existingReg.registrationStatus !== 'Cancelled'
      && existingReg.registrationStatus !== 'Rejected'
      && ev.statusKey !== 'cancelled'
      && ev.statusKey !== 'completed'
    );

    // Hydrate initial form values from existing submission or Supabase profile
    const seedValues = {};
    const fields = (ev.registrationConfig.formFields || []).filter((f) => f.enabled !== false);
    const prevData = (canEditExisting && existingReg.submittedData) || (existingReg && existingReg.submittedData) || {};
    fields.forEach((f) => {
      if (prevData[f.key] !== undefined && prevData[f.key] !== '') {
        seedValues[f.key] = prevData[f.key];
      } else if (f.key === 'fullName') {
        seedValues[f.key] = user.fullName || '';
      } else if (f.key === 'email') {
        seedValues[f.key] = user.email || '';
      } else if (f.key === 'institution') {
        seedValues[f.key] = user.institution || '';
      } else if (f.key === 'department') {
        seedValues[f.key] = user.department || '';
      } else if (f.key === 'city') {
        seedValues[f.key] = user.city || '';
      } else {
        seedValues[f.key] = f.fieldType === 'checkbox' ? false : '';
      }
    });

    let currentStep = canEditExisting ? 2 : 1;
    let formValues = { ...seedValues };
    let fieldErrors = {};
    let stepError = '';
    let isSubmitting = false;

    const tc = ev.teamConfig;
    let participationChoice = tc.supported
      ? (tc.locked || tc.creationMode === 'organizer_only' ? 'form_later' : 'form_later')
      : 'individual';
    let teamCreateName = '';
    let teamCreateDesc = '';
    let teamCreateMax = String(tc.maxSize || 4);
    let selectedJoinTeamId = '';
    let requestTeamNote = '';
    let submissionResult = null;

    function getEvFresh() {
      return s.getEventBySlug(slug) || ev;
    }

    function renderStepper() {
      return `
        <div class="ev-reg-stepper" role="navigation" aria-label="Registration progress">
          ${STEPS.map((st) => {
            const stateCls = st.num === currentStep ? 'is-current' : (st.num < currentStep ? 'is-done' : '');
            return `
              <div class="ev-reg-step-pill ${stateCls}">
                <span class="ev-reg-step-num">${st.num < currentStep ? '&check;' : st.num}</span>
                <span class="ev-reg-step-lbl">${esc(st.label)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderStep1(freshEv, freshAvail) {
      const rc = freshEv.registrationConfig;
      const blocked = !canEditExisting && !freshAvail.canRegister;
      const openTeamsCount = (freshEv.teams || []).filter((t) => t.memberIds.length < t.maxTeamSize).length;

      return `
        <div class="ev-ws-card">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.35rem;align-items:center;margin-bottom:1.25rem;">
            ${window.EventoraWorkspace.renderPosterThumbHTML(freshEv, 'border-radius:16px;aspect-ratio:16/9;')}
            <div>
              <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.45rem;">
                <span class="ev-badge ev-badge-category">${esc(freshEv.categoryLabel)}</span>
                <span class="ev-badge ${esc(freshEv.registrationBadgeClass || 'ev-badge-open')}">${esc(freshEv.registrationStatus)}</span>
              </div>
              <h2 class="ev-display" style="font-size:1.55rem;font-weight:600;color:var(--ev-charcoal);">${esc(freshEv.name)}</h2>
              <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.3rem;">${esc(freshEv.dateLabel)} &bull; ${esc(freshEv.location)} (${esc(freshEv.mode)})</p>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem;">
                <span class="ev-rb-chip">${esc(freshEv.teamConfig.label)}</span>
                <span class="ev-rb-chip">${rc.approvalMode === 'manual' ? 'Approval Required' : 'Auto Approval'}</span>
                <span class="ev-rb-chip">${rc.capacityEnabled ? (freshAvail.seatsRemaining > 0 ? `${freshAvail.seatsRemaining} of ${rc.maxRegistrations} slots left` : (rc.waitlistEnabled ? 'Waitlist Open' : 'Capacity Full')) : 'Unlimited Seats'}</span>
                ${tc.supported ? `<span class="ev-rb-chip">${openTeamsCount} open team(s)</span>` : ''}
              </div>
            </div>
          </div>

          <div class="ev-rb-subpanel" style="margin-bottom:1.2rem;">
            <div class="ev-rb-subhead">
              <span>Registration Information &amp; Requirements</span>
              <span class="ev-rb-subnote">${esc(freshEv.registrationDeadline)}</span>
            </div>
            <p style="font-size:0.86rem;color:var(--ev-body);line-height:1.58;">${esc(rc.registrationInstructions)}</p>
            <div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.55rem;">
              Cancellation Policy: <strong>${rc.cancellationAllowed ? (rc.cancellationDeadline ? `Allowed until ${new Date(rc.cancellationDeadline).toLocaleString()}` : 'Allowed from My Registrations') : 'Cancellation disabled by organizer'}</strong>
            </div>
          </div>

          ${blocked ? `
            <div class="ev-auth-status ${freshAvail.state === 'already_registered' ? 'is-info' : 'is-error'}" style="margin-bottom:1rem;">
              <span>${esc(freshAvail.reason)}</span>
            </div>
            <div style="display:flex;gap:0.65rem;flex-wrap:wrap;justify-content:flex-end;">
              <a href="event.html?slug=${encodeURIComponent(freshEv.slug)}" class="ev-btn ev-btn-outline">Back to Event</a>
              ${freshAvail.state === 'already_registered' ? `
                <a href="participant-dashboard.html?section=registrations" class="ev-btn ev-btn-forest">View My Registration &rarr;</a>
              ` : ''}
            </div>
          ` : `
            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;align-items:center;">
              <a href="event.html?slug=${encodeURIComponent(freshEv.slug)}" class="ev-btn ev-btn-outline">&larr; Back to Event</a>
              <button type="button" class="ev-btn ev-btn-forest" id="evRegStep1NextBtn">
                ${freshAvail.canWaitlist ? 'Continue to Waitlist Form' : 'Continue to Registration Form'} &rarr;
              </button>
            </div>
          `}
        </div>
      `;
    }

    function renderDynamicFieldInput(f) {
      const val = formValues[f.key];
      const err = fieldErrors[f.key] || '';
      const reqStar = f.required ? '<span style="color:#9E2A20;">*</span>' : '<span style="font-size:0.74rem;color:var(--ev-muted);font-weight:400;">(Optional)</span>';
      const help = f.helpText ? `<span style="font-size:0.76rem;color:var(--ev-muted);">${esc(f.helpText)}</span>` : '';
      const invalidCls = err ? 'is-invalid' : '';
      const errHtml = err ? `<div class="ev-field-err">${esc(err)}</div>` : '';

      if (f.fieldType === 'textarea') {
        return `
          <div class="ev-field">
            <label class="ev-label" for="evRegIn_${esc(f.key)}">${esc(f.label)} ${reqStar}</label>
            <textarea class="ev-textarea ${invalidCls}" id="evRegIn_${esc(f.key)}" data-reg-key="${esc(f.key)}" rows="3">${esc(val)}</textarea>
            ${help}${errHtml}
          </div>
        `;
      }
      if (f.fieldType === 'dropdown') {
        return `
          <div class="ev-field">
            <label class="ev-label" for="evRegIn_${esc(f.key)}">${esc(f.label)} ${reqStar}</label>
            <select class="ev-select ${invalidCls}" id="evRegIn_${esc(f.key)}" data-reg-key="${esc(f.key)}">
              <option value="">Select ${esc(f.label)}...</option>
              ${(f.options || []).map((o) => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select>
            ${help}${errHtml}
          </div>
        `;
      }
      if (f.fieldType === 'multiple_choice') {
        return `
          <div class="ev-field">
            <span class="ev-label">${esc(f.label)} ${reqStar}</span>
            <div style="display:flex;flex-wrap:wrap;gap:0.55rem;padding-top:0.2rem;">
              ${(f.options || []).map((o) => `
                <label class="ev-rb-checkpill">
                  <input type="radio" name="evRegRadio_${esc(f.key)}" data-reg-radio="${esc(f.key)}" value="${esc(o)}" ${val === o ? 'checked' : ''} />
                  <span>${esc(o)}</span>
                </label>
              `).join('')}
            </div>
            ${help}${errHtml}
          </div>
        `;
      }
      if (f.fieldType === 'checkbox') {
        return `
          <div class="ev-field">
            <label class="ev-rb-checkline">
              <input type="checkbox" id="evRegIn_${esc(f.key)}" data-reg-check="${esc(f.key)}" ${val ? 'checked' : ''} />
              <span>${esc(f.label)} ${reqStar}</span>
            </label>
            ${help}${errHtml}
          </div>
        `;
      }

      const htmlType = f.fieldType === 'email' ? 'email'
        : (f.fieldType === 'phone' ? 'tel' : (f.fieldType === 'number' ? 'number' : (f.fieldType === 'url' ? 'url' : 'text')));
      return `
        <div class="ev-field">
          <label class="ev-label" for="evRegIn_${esc(f.key)}">${esc(f.label)} ${reqStar}</label>
          <input type="${htmlType}" class="ev-input ${invalidCls}" id="evRegIn_${esc(f.key)}" data-reg-key="${esc(f.key)}" value="${esc(val)}" placeholder="${f.fieldType === 'url' ? 'https://...' : ''}" />
          ${help}${errHtml}
        </div>
      `;
    }

    function renderStep2(freshEv) {
      const enabledFields = (freshEv.registrationConfig.formFields || []).filter((f) => f.enabled !== false);
      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;">${canEditExisting ? 'Edit Your Registration Form Details' : 'Complete Registration Form'}</h2>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Pre-filled from your Eventora profile where available. Review and adjust before proceeding.</p>
            </div>
          </div>

          ${stepError ? `<div class="ev-auth-status is-error" style="margin-bottom:1rem;"><span>${esc(stepError)}</span></div>` : ''}

          <form id="evRegStep2Form" novalidate style="display:flex;flex-direction:column;gap:0.9rem;">
            ${enabledFields.map(renderDynamicFieldInput).join('')}

            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;padding-top:0.75rem;border-top:1px solid var(--ev-border);">
              <button type="button" class="ev-btn ev-btn-outline" id="evRegStep2BackBtn">&larr; Back</button>
              <button type="submit" class="ev-btn ev-btn-forest" id="evRegStep2NextBtn">Next: Participation Mode &rarr;</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderStep3(freshEv) {
      const ftc = freshEv.teamConfig;
      const openTeams = (freshEv.teams || []).filter((t) => t.memberIds.length < t.maxTeamSize);

      if (!ftc.supported) {
        return `
          <div class="ev-ws-card">
            <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;margin-bottom:0.4rem;">Individual Registration Confirmed</h2>
            <p style="font-size:0.88rem;color:var(--ev-muted);margin-bottom:1.15rem;">
              "${esc(freshEv.name)}" uses Individual Participation format. No team assignment or squad code is needed.
            </p>
            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline" id="evRegStep3BackBtn">&larr; Back</button>
              <button type="button" class="ev-btn ev-btn-forest" id="evRegStep3NextBtn">Next: Review Registration &rarr;</button>
            </div>
          </div>
        `;
      }

      if (canEditExisting) {
        const currentTeam = existingReg.teamId ? (freshEv.teams || []).find((t) => t.id === existingReg.teamId) : null;
        return `
          <div class="ev-ws-card">
            <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;margin-bottom:0.4rem;">Team Participation Status</h2>
            <p style="font-size:0.86rem;color:var(--ev-muted);margin-bottom:1rem;">
              ${currentTeam ? `You are currently a member of "${esc(currentTeam.teamName)}" (${currentTeam.memberIds.length}/${currentTeam.maxTeamSize}).` : 'You are registered and currently unassigned to a team.'} Manage your team from My Teams anytime.
            </p>
            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline" id="evRegStep3BackBtn">&larr; Back</button>
              <button type="button" class="ev-btn ev-btn-forest" id="evRegStep3NextBtn">Next: Review Update &rarr;</button>
            </div>
          </div>
        `;
      }

      const canCreate = !ftc.locked && ftc.creationMode !== 'organizer_only';
      const canJoin = !ftc.locked && ftc.allowJoinExisting && openTeams.length > 0;
      const canRequest = ftc.allowJoinRequests;

      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;">Choose Team Participation Option</h2>
              <p style="font-size:0.84rem;color:var(--ev-muted);">${esc(ftc.label)} &bull; Team rules enforced automatically.</p>
            </div>
          </div>

          ${stepError ? `<div class="ev-auth-status is-error" style="margin-bottom:1rem;"><span>${esc(stepError)}</span></div>` : ''}

          ${ftc.creationMode === 'organizer_only' ? `
            <div class="ev-auth-status is-info" style="margin-bottom:1rem;">
              <span>Organizer-only team creation is active for this event. Complete registration below and the organizer will assign your team cleanly.</span>
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.15rem;">
            ${canCreate ? `
              <label class="ev-reg-choice-card ${participationChoice === 'create_team' ? 'is-selected' : ''}">
                <div style="display:flex;align-items:center;gap:0.55rem;">
                  <input type="radio" name="evRegTeamChoice" value="create_team" ${participationChoice === 'create_team' ? 'checked' : ''} />
                  <strong style="color:var(--ev-charcoal);">Create a New Team</strong>
                </div>
                <span style="font-size:0.8rem;color:var(--ev-muted);margin-left:1.5rem;">Start a new team with yourself assigned as Team Leader.</span>
                ${participationChoice === 'create_team' ? `
                  <div class="ev-rb-grid-2" style="margin-top:0.85rem;margin-left:1.5rem;">
                    <div class="ev-field">
                      <label class="ev-label" for="evRegTmName">Team Name *</label>
                      <input class="ev-input" id="evRegTmName" type="text" value="${esc(teamCreateName)}" placeholder="e.g. Emerald Innovators" />
                    </div>
                    <div class="ev-field">
                      <label class="ev-label" for="evRegTmMax">Team Size Limit (max ${ftc.maxSize})</label>
                      <input class="ev-input" id="evRegTmMax" type="number" min="1" max="${ftc.maxSize}" value="${esc(teamCreateMax)}" />
                    </div>
                  </div>
                  <div class="ev-field" style="margin-top:0.65rem;margin-left:1.5rem;">
                    <label class="ev-label" for="evRegTmDesc">Team Description (Optional)</label>
                    <input class="ev-input" id="evRegTmDesc" type="text" value="${esc(teamCreateDesc)}" placeholder="Project idea or track..." />
                  </div>
                ` : ''}
              </label>
            ` : ''}

            ${canJoin ? `
              <label class="ev-reg-choice-card ${participationChoice === 'join_team' ? 'is-selected' : ''}">
                <div style="display:flex;align-items:center;gap:0.55rem;">
                  <input type="radio" name="evRegTeamChoice" value="join_team" ${participationChoice === 'join_team' ? 'checked' : ''} />
                  <strong style="color:var(--ev-charcoal);">Join an Existing Open Team (${openTeams.length} available)</strong>
                </div>
                <span style="font-size:0.8rem;color:var(--ev-muted);margin-left:1.5rem;">Join an existing squad with available capacity right away.</span>
                ${participationChoice === 'join_team' ? `
                  <div class="ev-field" style="margin-top:0.85rem;margin-left:1.5rem;">
                    <label class="ev-label" for="evRegJoinTeamSel">Choose Open Team *</label>
                    <select class="ev-select" id="evRegJoinTeamSel">
                      <option value="">Select a team...</option>
                      ${openTeams.map((t) => `<option value="${esc(t.id)}" ${selectedJoinTeamId === t.id ? 'selected' : ''}>${esc(t.teamName)} (${t.memberIds.length}/${t.maxTeamSize} members)</option>`).join('')}
                    </select>
                  </div>
                ` : ''}
              </label>
            ` : ''}

            <label class="ev-reg-choice-card ${participationChoice === 'form_later' ? 'is-selected' : ''}">
              <div style="display:flex;align-items:center;gap:0.55rem;">
                <input type="radio" name="evRegTeamChoice" value="form_later" ${participationChoice === 'form_later' ? 'checked' : ''} />
                <strong style="color:var(--ev-charcoal);">Register Individually &amp; Form/Join Team Later</strong>
              </div>
              <span style="font-size:0.8rem;color:var(--ev-muted);margin-left:1.5rem;">Complete registration now and create, join, or get assigned to a team later.</span>
            </label>

            ${canRequest ? `
              <label class="ev-reg-choice-card ${participationChoice === 'request_team' ? 'is-selected' : ''}">
                <div style="display:flex;align-items:center;gap:0.55rem;">
                  <input type="radio" name="evRegTeamChoice" value="request_team" ${participationChoice === 'request_team' ? 'checked' : ''} />
                  <strong style="color:var(--ev-charcoal);">Request Team Formation Assistance</strong>
                </div>
                <span style="font-size:0.8rem;color:var(--ev-muted);margin-left:1.5rem;">Ask the organizing team to help match you into an open squad.</span>
                ${participationChoice === 'request_team' ? `
                  <div class="ev-field" style="margin-top:0.75rem;margin-left:1.5rem;">
                    <label class="ev-label" for="evRegReqNote">Skills / Track Preference Note (Optional)</label>
                    <input class="ev-input" id="evRegReqNote" type="text" value="${esc(requestTeamNote)}" placeholder="e.g. Frontend + UI design, looking for backend partner" />
                  </div>
                ` : ''}
              </label>
            ` : ''}
          </div>

          <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
            <button type="button" class="ev-btn ev-btn-outline" id="evRegStep3BackBtn">&larr; Back</button>
            <button type="button" class="ev-btn ev-btn-forest" id="evRegStep3NextBtn">Next: Review Registration &rarr;</button>
          </div>
        </div>
      `;
    }

    function renderStep4(freshEv, freshAvail) {
      const enabledFields = (freshEv.registrationConfig.formFields || []).filter((f) => f.enabled !== false);
      let teamSummaryLabel = 'Individual Registration';
      if (freshEv.teamConfig.supported) {
        if (canEditExisting) {
          teamSummaryLabel = 'Preserving existing team assignment';
        } else if (participationChoice === 'create_team') {
          teamSummaryLabel = `Create Team: "${teamCreateName}" (Max ${teamCreateMax})`;
        } else if (participationChoice === 'join_team') {
          const jt = (freshEv.teams || []).find((t) => t.id === selectedJoinTeamId);
          teamSummaryLabel = `Join Team: "${jt ? jt.teamName : selectedJoinTeamId}"`;
        } else if (participationChoice === 'request_team') {
          teamSummaryLabel = `Request Team Formation${requestTeamNote ? ` (${requestTeamNote})` : ''}`;
        } else {
          teamSummaryLabel = 'Form or join a team later';
        }
      }

      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <h2 class="ev-display" style="font-size:1.35rem;font-weight:600;">Review Your Registration</h2>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Verify all information below before final submission to "${esc(freshEv.name)}".</p>
            </div>
            <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRegEditStep2Btn">Edit Form Answers</button>
          </div>

          ${stepError ? `<div class="ev-auth-status is-error" style="margin-bottom:1rem;"><span>${esc(stepError)}</span></div>` : ''}

          <div class="ev-pt-detail-grid" style="margin-bottom:1rem;">
            ${enabledFields.map((f) => {
              const rawVal = formValues[f.key];
              const disp = f.fieldType === 'checkbox' ? (rawVal ? 'Checked (Yes)' : 'Not Checked') : (String(rawVal || '').trim() || 'Not provided');
              return `<div><span class="ev-pt-kv-label">${esc(f.label)}</span><strong class="ev-pt-kv-val">${esc(disp)}</strong></div>`;
            }).join('')}
          </div>

          <div class="ev-rb-subpanel" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
            <div>
              <div class="ev-pt-kv-label">Participation Mode &amp; Team Choice</div>
              <strong style="font-size:0.9rem;color:var(--ev-charcoal);">${esc(teamSummaryLabel)}</strong>
            </div>
            ${freshEv.teamConfig.supported && !canEditExisting ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRegEditStep3Btn">Change Team Choice</button>` : ''}
          </div>

          <div class="ev-auth-status is-info" style="margin-bottom:1.1rem;">
            <span>
              ${canEditExisting
                ? 'Submitting updates your existing local Eventora registration details.'
                : (freshAvail.canWaitlist
                  ? 'Event capacity is currently full — submitting places your entry on the Waitlist.'
                  : (freshEv.registrationConfig.approvalMode === 'manual'
                    ? 'Organizer approval is enabled — your submission will enter Pending status cleanly.'
                    : 'Automatic approval is enabled — your registration will be recorded immediately as Approved.'))}
              (Prototype local sessionStorage only; no automated email is sent.)
            </span>
          </div>

          <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
            <button type="button" class="ev-btn ev-btn-outline" id="evRegStep4BackBtn">&larr; Back</button>
            <button type="button" class="ev-btn ev-btn-forest" id="evRegSubmitBtn" ${isSubmitting ? 'disabled' : ''}>
              ${isSubmitting ? 'Submitting...' : (canEditExisting ? 'Save Registration Changes' : (freshAvail.canWaitlist ? 'Submit Waitlist Registration' : 'Submit Registration'))}
            </button>
          </div>
        </div>
      `;
    }

    function renderStep5(freshEv) {
      const reg = submissionResult?.registration;
      const st = reg ? reg.registrationStatus : 'Pending';
      return `
        <div class="ev-ws-card" style="text-align:left;">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.65rem;">
            <span class="ev-badge ${esc(formatStatusBadgeClass(st))}">${esc(st)}</span>
            ${reg ? `<span class="ev-rb-id-chip">Registration ID: <code>${esc(reg.registrationId)}</code></span>` : ''}
          </div>
          <h2 class="ev-display" style="font-size:1.6rem;font-weight:600;color:var(--ev-charcoal);">
            ${canEditExisting ? 'Registration Updated' : (st === 'Approved' ? 'Registration Confirmed' : (st === 'Waitlisted' ? 'Added to Event Waitlist' : 'Registration Submitted (Pending Approval)'))}
          </h2>
          <p style="font-size:0.92rem;color:var(--ev-body);margin-top:0.45rem;line-height:1.6;">
            ${st === 'Approved' ? esc(freshEv.registrationConfig.confirmationMessage) : (st === 'Waitlisted' ? 'Confirmed seats are currently full; your registration sits on the organizer waitlist.' : 'Your submission is awaiting organizer review inside the event roster.')}
          </p>

          ${submissionResult?.team ? `
            <div class="ev-rb-subpanel" style="margin-top:1rem;">
              <strong style="font-size:0.9rem;color:var(--ev-forest);">Assigned Team: ${esc(submissionResult.team.teamName)}</strong>
              <div style="font-size:0.8rem;color:var(--ev-muted);margin-top:0.2rem;">Members: ${submissionResult.team.memberIds.length} / ${submissionResult.team.maxTeamSize}</div>
            </div>
          ` : ''}

          <div class="ev-auth-status is-info" style="margin-top:1rem;margin-bottom:1.25rem;">
            <span>Stored cleanly in local prototype sessionStorage and synced directly with the event organizer's Participants roster. No confirmation email was sent.</span>
          </div>

          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            <a href="participant-dashboard.html?section=registrations" class="ev-btn ev-btn-forest">View My Registrations &rarr;</a>
            <a href="event.html?slug=${encodeURIComponent(freshEv.slug)}" class="ev-btn ev-btn-outline">Return to Event Page</a>
          </div>
        </div>
      `;
    }

    function render() {
      const freshEv = getEvFresh();
      const freshAvail = s.evaluateRegistrationAvailability(freshEv, user);
      let bodyHtml = '';
      if (currentStep === 1) bodyHtml = renderStep1(freshEv, freshAvail);
      else if (currentStep === 2) bodyHtml = renderStep2(freshEv);
      else if (currentStep === 3) bodyHtml = renderStep3(freshEv);
      else if (currentStep === 4) bodyHtml = renderStep4(freshEv, freshAvail);
      else bodyHtml = renderStep5(freshEv);

      containerEl.innerHTML = `
        <div class="ev-container" style="max-width:860px;padding:2rem 1rem 4rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
            <div>
              <span class="ev-badge ev-badge-open">${canEditExisting ? 'Edit Registration' : 'Event Registration'}</span>
              <h1 class="ev-display" style="font-size:1.75rem;font-weight:600;margin-top:0.35rem;">${esc(freshEv.name)}</h1>
            </div>
            <a href="participant-dashboard.html?section=registrations" class="ev-btn ev-btn-outline ev-btn-sm">My Registrations</a>
          </div>

          ${renderStepper()}
          ${bodyHtml}
        </div>
      `;

      bindEvents(freshEv, freshAvail);
    }

    function bindEvents(freshEv) {
      containerEl.querySelector('#evRegStep1NextBtn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = 2;
        render();
      });

      // Step 2 live inputs & validation
      containerEl.querySelectorAll('[data-reg-key]').forEach((inp) => {
        const evt = inp.tagName === 'SELECT' ? 'change' : 'input';
        inp.addEventListener(evt, () => {
          formValues[inp.dataset.regKey] = inp.value;
          delete fieldErrors[inp.dataset.regKey];
          inp.classList.remove('is-invalid');
        });
      });
      containerEl.querySelectorAll('[data-reg-radio]').forEach((rb) => {
        rb.addEventListener('change', () => {
          formValues[rb.dataset.regRadio] = rb.value;
          delete fieldErrors[rb.dataset.regRadio];
        });
      });
      containerEl.querySelectorAll('[data-reg-check]').forEach((cb) => {
        cb.addEventListener('change', () => {
          formValues[cb.dataset.regCheck] = cb.checked;
          delete fieldErrors[cb.dataset.regCheck];
        });
      });

      containerEl.querySelector('#evRegStep2BackBtn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = canEditExisting ? 2 : 1;
        if (canEditExisting) {
          window.location.href = 'participant-dashboard.html?section=registrations';
          return;
        }
        render();
      });

      containerEl.querySelector('#evRegStep2Form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const check = s.validateRegistrationSubmission(freshEv, formValues);
        if (!check.valid) {
          fieldErrors = check.errors;
          stepError = check.firstError || 'Please complete the highlighted fields.';
          render();
          return;
        }
        formValues = { ...formValues, ...check.cleanData };
        fieldErrors = {};
        stepError = '';
        currentStep = 3;
        render();
      });

      // Step 3 inputs & next
      containerEl.querySelectorAll('input[name="evRegTeamChoice"]').forEach((rb) => {
        rb.addEventListener('change', () => {
          participationChoice = rb.value;
          stepError = '';
          render();
        });
      });
      containerEl.querySelector('#evRegTmName')?.addEventListener('input', (e) => { teamCreateName = e.target.value; });
      containerEl.querySelector('#evRegTmMax')?.addEventListener('input', (e) => { teamCreateMax = e.target.value; });
      containerEl.querySelector('#evRegTmDesc')?.addEventListener('input', (e) => { teamCreateDesc = e.target.value; });
      containerEl.querySelector('#evRegJoinTeamSel')?.addEventListener('change', (e) => { selectedJoinTeamId = e.target.value; });
      containerEl.querySelector('#evRegReqNote')?.addEventListener('input', (e) => { requestTeamNote = e.target.value; });

      containerEl.querySelector('#evRegStep3BackBtn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = 2;
        render();
      });

      containerEl.querySelector('#evRegStep3NextBtn')?.addEventListener('click', () => {
        if (freshEv.teamConfig.supported && !canEditExisting) {
          if (participationChoice === 'create_team') {
            if (!teamCreateName.trim() || teamCreateName.trim().length < 2) {
              stepError = 'Enter a valid team name (at least 2 characters).';
              render();
              return;
            }
            const dup = (freshEv.teams || []).some((t) => t.teamName.toLowerCase() === teamCreateName.trim().toLowerCase());
            if (dup) {
              stepError = `A team named "${teamCreateName.trim()}" already exists in this event.`;
              render();
              return;
            }
            const mNum = Number(teamCreateMax);
            if (!Number.isFinite(mNum) || mNum < 1 || mNum > freshEv.teamConfig.maxSize) {
              stepError = `Team size limit must be between 1 and ${freshEv.teamConfig.maxSize}.`;
              render();
              return;
            }
          } else if (participationChoice === 'join_team') {
            if (!selectedJoinTeamId) {
              stepError = 'Select an open team to join, or switch to another option.';
              render();
              return;
            }
          }
        }
        stepError = '';
        currentStep = 4;
        render();
      });

      // Step 4 review & submit
      containerEl.querySelector('#evRegEditStep2Btn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = 2;
        render();
      });
      containerEl.querySelector('#evRegEditStep3Btn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = 3;
        render();
      });
      containerEl.querySelector('#evRegStep4BackBtn')?.addEventListener('click', () => {
        stepError = '';
        currentStep = 3;
        render();
      });

      containerEl.querySelector('#evRegSubmitBtn')?.addEventListener('click', async () => {
        if (isSubmitting) return;
        isSubmitting = true;
        render();

        // PostgreSQL persistent path when Supabase schema is live
        if (s.getBackendMode && s.getBackendMode() === 'supabase' && ev.dbId && window.EventoraRegistrationsApi) {
          const isWaitlist = avail.state === 'waitlist_available';
          const statusToSet = isWaitlist ? 'Waitlisted' : (ev.registrationConfig.approvalMode === 'manual' ? 'Pending Approval' : 'Approved');
          let dbRegRes;
          if (canEditExisting && avail.existingRegistration && avail.existingRegistration.dbId) {
            dbRegRes = await window.EventoraRegistrationsApi.updateRegistrationInfo(avail.existingRegistration.dbId, {
              registrationData: formValues
            });
          } else {
            dbRegRes = await window.EventoraRegistrationsApi.registerParticipant(ev.dbId, {
              registrationType: participationChoice === 'create_team' ? 'team_leader' : (participationChoice === 'join_team' ? 'team_member' : 'individual'),
              registrationStatus: statusToSet,
              registrationData: formValues,
              teamId: null
            });
            if (dbRegRes.ok && dbRegRes.data && window.EventoraTeamsApi) {
              if (participationChoice === 'create_team' && teamCreateName.trim()) {
                await window.EventoraTeamsApi.createTeam(ev.dbId, {
                  name: teamCreateName.trim(),
                  registrationId: dbRegRes.data.dbId
                });
              } else if (participationChoice === 'join_team' && selectedJoinTeamId) {
                await window.EventoraTeamsApi.addMember({
                  teamId: selectedJoinTeamId,
                  eventId: ev.dbId,
                  userId: user.id,
                  registrationId: dbRegRes.data.dbId
                });
              }
            }
          }

          if (!dbRegRes.ok) {
            isSubmitting = false;
            stepError = dbRegRes.error || 'Database rejected registration.';
            render();
            return;
          }
          if (window.EventoraSync) {
            await window.EventoraSync.hydrateEventBySlug(slug, user, { organizerView: false });
          }
          isSubmitting = false;
          submissionResult = {
            ok: true,
            registrationId: dbRegRes.data ? dbRegRes.data.registrationId : 'CONFIRMED',
            registration: dbRegRes.data
          };
          stepError = '';
          currentStep = 5;
          window.EventoraUI?.showToast(canEditExisting ? 'Registration details saved in PostgreSQL!' : `Registration confirmed (${submissionResult.registrationId})!`);
          render();
          return;
        }

        const res = canEditExisting
          ? s.updateUserRegistration(slug, user, { submittedData: formValues })
          : s.submitEventRegistration(slug, user, {
              submittedData: formValues,
              participationChoice,
              teamPayload: {
                teamName: teamCreateName,
                description: teamCreateDesc,
                maxTeamSize: teamCreateMax,
                teamId: selectedJoinTeamId,
                requestNote: requestTeamNote
              }
            });

        isSubmitting = false;
        if (!res.ok) {
          stepError = res.error || 'Could not complete registration.';
          render();
          return;
        }
        submissionResult = res;
        stepError = '';
        currentStep = 5;
        window.EventoraUI?.showToast(canEditExisting ? 'Registration details saved!' : `Registration submitted (${res.registrationId})!`);
        render();
      });
    }

    render();
    return { getStep: () => currentStep };
  }

  return { mount };
})();

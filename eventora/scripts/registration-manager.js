/* ==========================================================================
   EVENTORA PHASE 6 — ORGANIZER REGISTRATION SETTINGS & FORM BUILDER
   Mounts inside manage-event.html?section=registration:
   - Registration overview & live availability metrics
   - Window, capacity, waitlist, approval mode, instructions & cancellation rules
   - Configurable default & custom fields (9 field types, reorder/edit/delete)
   - Unified Team Rule integration (delegates strictly to Phase 5 saveTeamRules)
   - Participant Form Preview
   ========================================================================== */

window.EventoraRegistrationManager = (function () {
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

  function cloneFields(fields) {
    return (Array.isArray(fields) ? fields : []).map((f, idx) => ({
      ...f,
      order: idx + 1,
      options: Array.isArray(f.options) ? [...f.options] : []
    }));
  }

  function renderFieldPreviewHTML(fields) {
    const enabled = (Array.isArray(fields) ? fields : []).filter((f) => f.enabled !== false);
    if (enabled.length === 0) {
      return `<div style="font-size:0.84rem;color:var(--ev-muted);padding:1rem;background:var(--ev-cream);border-radius:var(--ev-radius-sm);">No fields enabled yet. Enable at least one field in the Form Builder tab.</div>`;
    }

    return enabled.map((f) => {
      const reqStar = f.required ? '<span style="color:#9E2A20;">*</span>' : '<span style="font-size:0.74rem;color:var(--ev-muted);font-weight:400;">(Optional)</span>';
      const help = f.helpText ? `<span style="display:block;font-size:0.76rem;color:var(--ev-muted);margin-top:0.2rem;">${esc(f.helpText)}</span>` : '';

      if (f.fieldType === 'textarea') {
        return `<div class="ev-field"><label class="ev-label">${esc(f.label)} ${reqStar}</label><textarea class="ev-textarea" rows="2" disabled placeholder="Participant response..."></textarea>${help}</div>`;
      }
      if (f.fieldType === 'dropdown') {
        return `<div class="ev-field"><label class="ev-label">${esc(f.label)} ${reqStar}</label><select class="ev-select" disabled><option>Select ${esc(f.label)}...</option>${(f.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>${help}</div>`;
      }
      if (f.fieldType === 'multiple_choice') {
        return `<div class="ev-field"><span class="ev-label">${esc(f.label)} ${reqStar}</span><div style="display:flex;flex-wrap:wrap;gap:0.65rem;padding-top:0.2rem;">${(f.options || []).map((o) => `<label class="ev-rb-checkpill"><input type="radio" disabled /><span>${esc(o)}</span></label>`).join('')}</div>${help}</div>`;
      }
      if (f.fieldType === 'checkbox') {
        return `<div class="ev-field"><label class="ev-rb-checkline"><input type="checkbox" disabled /><span>${esc(f.label)} ${reqStar}</span></label>${help}</div>`;
      }
      const inputType = f.fieldType === 'email' ? 'email' : (f.fieldType === 'phone' ? 'tel' : (f.fieldType === 'number' ? 'number' : (f.fieldType === 'url' ? 'url' : 'text')));
      return `<div class="ev-field"><label class="ev-label">${esc(f.label)} ${reqStar}</label><input type="${inputType}" class="ev-input" disabled placeholder="${f.fieldType === 'url' ? 'https://...' : ''}" />${help}</div>`;
    }).join('');
  }

  /**
   * Mounts the complete Registration Management & Form Builder workspace.
   */
  function mount(containerEl, options = {}) {
    if (!containerEl) return null;
    const slug = String(options.slug || '').trim();
    const readOnly = Boolean(options.readOnly);
    const onJumpSection = typeof options.onJumpSection === 'function' ? options.onJumpSection : null;
    const onSaved = typeof options.onSaved === 'function' ? options.onSaved : null;

    const s = store();
    if (!s || !s.getEventBySlug(slug)) {
      containerEl.innerHTML = window.EventoraWorkspace.renderEmptyState({
        iconName: 'registration',
        title: 'Event Not Found',
        message: 'Select a valid event to configure registration settings.'
      });
      return null;
    }

    let activeTab = 'settings'; // 'settings' | 'form' | 'rules' | 'preview'
    let draftFields = cloneFields(s.getEventBySlug(slug).registrationConfig.formFields);
    let fieldsDirty = false;
    let editingFieldId = '';
    let showCustomForm = false;
    let feedbackMsg = '';
    let feedbackKind = 'info';

    // Custom field editor draft state
    let customDraft = {
      label: '',
      fieldType: 'text',
      helpText: '',
      required: false,
      enabled: true,
      optionsText: ''
    };

    function getEv() {
      return s.getEventBySlug(slug);
    }

    function setFeedback(kind, msg) {
      feedbackKind = kind;
      feedbackMsg = msg;
    }

    function renderSettingsTab(ev) {
      const rc = ev.registrationConfig;
      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;">Registration Window, Capacity &amp; Approval</h3>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Changes take effect immediately across Event Discovery, Event Details, and the Registration Flow.</p>
            </div>
          </div>

          <form id="evRgSettingsForm" novalidate style="display:flex;flex-direction:column;gap:1rem;">
            <div class="ev-rb-grid-3">
              <div class="ev-field">
                <label class="ev-label" for="evRgEnabled">Registration Intake</label>
                <select class="ev-select" id="evRgEnabled">
                  <option value="true" ${rc.registrationEnabled ? 'selected' : ''}>Open (Accepting Submissions)</option>
                  <option value="false" ${!rc.registrationEnabled ? 'selected' : ''}>Closed (Blocked for Participants)</option>
                </select>
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRgStatus">Display Status Badge</label>
                <select class="ev-select" id="evRgStatus">
                  <option value="Open" ${ev.registrationStatus === 'Open' ? 'selected' : ''}>Open</option>
                  <option value="Filling Fast" ${ev.registrationStatus === 'Filling Fast' ? 'selected' : ''}>Filling Fast</option>
                  <option value="Closing Soon" ${ev.registrationStatus === 'Closing Soon' ? 'selected' : ''}>Closing Soon</option>
                  <option value="Closed" ${ev.registrationStatus === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRgApproval">Approval Mode</label>
                <select class="ev-select" id="evRgApproval">
                  <option value="auto" ${rc.approvalMode === 'auto' ? 'selected' : ''}>Automatic Approval</option>
                  <option value="manual" ${rc.approvalMode === 'manual' ? 'selected' : ''}>Organizer Approval Required</option>
                </select>
              </div>
            </div>

            <div class="ev-rb-grid-3">
              <div class="ev-field">
                <label class="ev-label" for="evRgOpensAt">Registration Opens (Optional)</label>
                <input type="datetime-local" class="ev-input" id="evRgOpensAt" value="${esc(rc.registrationOpensAt)}" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRgClosesAt">Registration Closes (Optional)</label>
                <input type="datetime-local" class="ev-input" id="evRgClosesAt" value="${esc(rc.registrationClosesAt)}" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRgDeadlineLabel">Public Deadline Label</label>
                <input type="text" class="ev-input" id="evRgDeadlineLabel" value="${esc(ev.registrationDeadline)}" placeholder="Open until event start" />
              </div>
            </div>

            <div class="ev-rb-subpanel" style="margin-bottom:0;">
              <div class="ev-rb-subhead">
                <span>Capacity &amp; Waitlist Policy</span>
                <span class="ev-rb-subnote">Waitlisted users join the queue when seats fill</span>
              </div>
              <div class="ev-rb-grid-3" style="align-items:center;">
                <label class="ev-rb-checkline">
                  <input type="checkbox" id="evRgCapEnabled" ${rc.capacityEnabled ? 'checked' : ''} />
                  <span>Enforce maximum registrations</span>
                </label>
                <div class="ev-field">
                  <label class="ev-label" for="evRgMaxRegs">Maximum Registrations</label>
                  <input type="number" min="1" max="50000" class="ev-input" id="evRgMaxRegs" value="${esc(rc.maxRegistrations)}" ${!rc.capacityEnabled ? 'disabled' : ''} />
                </div>
                <label class="ev-rb-checkline">
                  <input type="checkbox" id="evRgWaitlist" ${rc.waitlistEnabled ? 'checked' : ''} />
                  <span>Enable Waitlist when full</span>
                </label>
              </div>
            </div>

            <div class="ev-rb-subpanel" style="margin-bottom:0;">
              <div class="ev-rb-subhead">
                <span>Participant Cancellation Policy</span>
                <span class="ev-rb-subnote">Controls Cancel button on Participant Dashboard</span>
              </div>
              <div class="ev-rb-grid-2" style="align-items:center;">
                <label class="ev-rb-checkline">
                  <input type="checkbox" id="evRgCancelAllowed" ${rc.cancellationAllowed ? 'checked' : ''} />
                  <span>Allow participants to cancel their own registration</span>
                </label>
                <div class="ev-field">
                  <label class="ev-label" for="evRgCancelDeadline">Cancellation Deadline (Optional)</label>
                  <input type="datetime-local" class="ev-input" id="evRgCancelDeadline" value="${esc(rc.cancellationDeadline)}" ${!rc.cancellationAllowed ? 'disabled' : ''} />
                </div>
              </div>
            </div>

            <div class="ev-rb-grid-2">
              <div class="ev-field">
                <label class="ev-label" for="evRgInstructions">Registration Instructions</label>
                <textarea class="ev-textarea" id="evRgInstructions" rows="2">${esc(rc.registrationInstructions)}</textarea>
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evRgConfirmMsg">Confirmation Message</label>
                <textarea class="ev-textarea" id="evRgConfirmMsg" rows="2">${esc(rc.confirmationMessage)}</textarea>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:0.65rem;flex-wrap:wrap;">
              <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm" id="evRgSaveSettingsBtn">Save Registration Settings</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderFormBuilderTab() {
      const needsOpts = customDraft.fieldType === 'dropdown' || customDraft.fieldType === 'multiple_choice';
      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;">Configurable Registration Form Builder</h3>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Enable, require, reorder, edit, or add custom registration questions for participants.</p>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
              ${fieldsDirty ? '<span class="ev-badge ev-badge-filling">Unsaved Form Changes</span>' : '<span class="ev-badge ev-badge-open">Form Saved</span>'}
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRgAddCustomBtn">+ Add Custom Field</button>
              <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRgSaveFormBtn">Save Form Fields</button>
            </div>
          </div>

          ${showCustomForm ? `
            <div class="ev-rb-type-picker" id="evRgCustomEditorBox">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;">
                <strong style="font-size:0.94rem;color:var(--ev-forest);">${editingFieldId ? 'Edit Custom Field' : 'New Custom Registration Field'}</strong>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evRgCancelCustomBtn">Cancel</button>
              </div>
              <div class="ev-rb-grid-3">
                <div class="ev-field">
                  <label class="ev-label" for="evRgCfLabel">Field Label *</label>
                  <input class="ev-input" id="evRgCfLabel" type="text" value="${esc(customDraft.label)}" placeholder="e.g. Portfolio URL or T-Shirt Size" />
                </div>
                <div class="ev-field">
                  <label class="ev-label" for="evRgCfType">Field Type</label>
                  <select class="ev-select" id="evRgCfType">
                    ${s.CUSTOM_FIELD_TYPES.map((ft) => `<option value="${esc(ft.key)}" ${customDraft.fieldType === ft.key ? 'selected' : ''}>${esc(ft.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="ev-field">
                  <label class="ev-label" for="evRgCfHelp">Help Text (Optional)</label>
                  <input class="ev-input" id="evRgCfHelp" type="text" value="${esc(customDraft.helpText)}" placeholder="Clarifies expected format..." />
                </div>
              </div>
              ${needsOpts ? `
                <div class="ev-field" style="margin-top:0.75rem;">
                  <label class="ev-label" for="evRgCfOpts">Options (Comma or Newline Separated) *</label>
                  <textarea class="ev-textarea" id="evRgCfOpts" rows="2" placeholder="Option A, Option B, Option C">${esc(customDraft.optionsText)}</textarea>
                </div>
              ` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-top:0.85rem;">
                <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                  <label class="ev-rb-checkline"><input type="checkbox" id="evRgCfReq" ${customDraft.required ? 'checked' : ''} /><span>Required field</span></label>
                  <label class="ev-rb-checkline"><input type="checkbox" id="evRgCfEn" ${customDraft.enabled ? 'checked' : ''} /><span>Enabled on form</span></label>
                </div>
                <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evRgCommitCustomBtn">${editingFieldId ? 'Update Field' : 'Add Field to Form'}</button>
              </div>
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;gap:0.65rem;">
            ${draftFields.map((f, idx) => {
              const typeMeta = s.CUSTOM_FIELD_TYPES.find((t) => t.key === f.fieldType) || { label: f.fieldType };
              return `
                <div class="ev-rg-field-row ${f.enabled === false ? 'is-disabled' : ''}" data-rg-field-id="${esc(f.id)}">
                  <div style="display:flex;align-items:center;gap:0.6rem;min-width:0;flex:1 1 240px;">
                    <div class="ev-rb-order-btns">
                      <button type="button" class="ev-rb-icon-btn" data-rg-up="${idx}" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
                      <button type="button" class="ev-rb-icon-btn" data-rg-down="${idx}" ${idx === draftFields.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
                    </div>
                    <div style="min-width:0;">
                      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <strong style="color:var(--ev-charcoal);font-size:0.92rem;">${esc(f.label)}</strong>
                        <span class="ev-badge ev-badge-category">${esc(typeMeta.label)}</span>
                        <span class="ev-badge ${f.isDefault ? 'ev-badge-sample' : 'ev-badge-open'}">${f.isDefault ? 'Default' : 'Custom'}</span>
                      </div>
                      ${f.helpText ? `<div style="font-size:0.76rem;color:var(--ev-muted);margin-top:0.15rem;">${esc(f.helpText)}</div>` : ''}
                      ${(f.options && f.options.length > 0) ? `<div style="font-size:0.74rem;color:var(--ev-primary);margin-top:0.15rem;">Options: ${esc(f.options.join(', '))}</div>` : ''}
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
                    <label class="ev-rb-checkline" style="font-size:0.78rem;">
                      <input type="checkbox" data-rg-toggle-en="${idx}" ${f.enabled !== false ? 'checked' : ''} />
                      <span>Enabled</span>
                    </label>
                    <label class="ev-rb-checkline" style="font-size:0.78rem;">
                      <input type="checkbox" data-rg-toggle-req="${idx}" ${f.required ? 'checked' : ''} ${f.enabled === false ? 'disabled' : ''} />
                      <span>Required</span>
                    </label>
                    ${!f.isDefault ? `
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-rg-edit-cf="${esc(f.id)}">Edit</button>
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-rg-del-cf="${esc(f.id)}">Delete</button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    function renderTeamRulesTab(ev) {
      const tc = ev.teamConfig;
      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.45rem;">Synchronized Phase 5 Rules</span>
              <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;">Participation Mode &amp; Team Rules</h3>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Controls both Step 3 of Participant Registration and the Teams Workspace cleanly without duplicate configs.</p>
            </div>
          </div>
          <div id="evWsTeamRulesErr" class="ev-wizard-error" role="alert" hidden style="margin-bottom:0.85rem;"></div>
          <form id="evWsTeamRulesForm" style="display:flex;flex-direction:column;gap:0.9rem;">
            <div class="ev-rb-grid-3">
              <div class="ev-field">
                <label class="ev-label" for="evWsRuleMode">Participation Mode</label>
                <select class="ev-select" id="evWsRuleMode">
                  <option value="individual" ${!tc.supported ? 'selected' : ''}>Individual Registration Only</option>
                  <option value="team" ${tc.supported ? 'selected' : ''}>Team Registration Enabled</option>
                </select>
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evWsRuleMin">Min Team Size</label>
                <input type="number" min="1" max="20" class="ev-input" id="evWsRuleMin" value="${tc.minSize}" ${!tc.supported ? 'disabled' : ''} />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evWsRuleMax">Max Team Size</label>
                <input type="number" min="1" max="20" class="ev-input" id="evWsRuleMax" value="${tc.maxSize}" ${!tc.supported ? 'disabled' : ''} />
              </div>
            </div>

            <div id="evWsTeamRulesExtraWrap" style="${!tc.supported ? 'opacity:0.55;' : ''}display:flex;flex-direction:column;gap:0.75rem;">
              <div class="ev-field">
                <label class="ev-label" for="evWsRuleCreation">Team Creation Policy</label>
                <select class="ev-select" id="evWsRuleCreation" ${!tc.supported ? 'disabled' : ''}>
                  <option value="participant_allowed" ${tc.creationMode === 'participant_allowed' ? 'selected' : ''}>Participants can create &amp; request teams (Organizer can also manage)</option>
                  <option value="organizer_only" ${tc.creationMode === 'organizer_only' ? 'selected' : ''}>Organizer-only team creation</option>
                </select>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.65rem;">
                <label class="ev-rb-checkline"><input type="checkbox" id="evWsRuleReqCreate" ${tc.allowJoinRequests ? 'checked' : ''} ${!tc.supported ? 'disabled' : ''} /><span>Allow participant team formation requests</span></label>
                <label class="ev-rb-checkline"><input type="checkbox" id="evWsRuleJoinExist" ${tc.allowJoinExisting ? 'checked' : ''} ${!tc.supported ? 'disabled' : ''} /><span>Allow joining existing open teams</span></label>
                <label class="ev-rb-checkline"><input type="checkbox" id="evWsRuleExclusive" ${tc.exclusiveMembership ? 'checked' : ''} ${!tc.supported ? 'disabled' : ''} /><span>Exclusive membership (1 team per participant)</span></label>
                <label class="ev-rb-checkline"><input type="checkbox" id="evWsRuleLeader" ${tc.requireLeader ? 'checked' : ''} ${!tc.supported ? 'disabled' : ''} /><span>Require Team Leader per team</span></label>
                <label class="ev-rb-checkline"><input type="checkbox" id="evWsRuleLocked" ${tc.locked ? 'checked' : ''} ${!tc.supported ? 'disabled' : ''} /><span>Lock team membership changes</span></label>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:0.55rem;flex-wrap:wrap;">
              ${onJumpSection ? '<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRgOpenTeamsBtn">Open Teams Workspace &rarr;</button>' : ''}
              <button type="submit" class="ev-btn ev-btn-forest ev-btn-sm" id="evWsSaveTeamRulesBtn">Save Team Rules</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderPreviewTab(ev) {
      const rc = ev.registrationConfig;
      return `
        <div class="ev-ws-card">
          <div class="ev-ws-card-head">
            <div>
              <span class="ev-badge ev-badge-open" style="margin-bottom:0.4rem;">Participant Form Preview</span>
              <h3 class="ev-display" style="font-size:1.3rem;font-weight:600;">How Participants Experience "${esc(ev.name)}"</h3>
              <p style="font-size:0.84rem;color:var(--ev-muted);">Live preview of currently active form fields, instructions, approval mode, and team options.</p>
            </div>
            <a href="register.html?slug=${encodeURIComponent(ev.slug)}" class="ev-btn ev-btn-outline ev-btn-sm">Open Participant Flow &rarr;</a>
          </div>

          <div class="ev-rb-subpanel" style="margin-bottom:1.15rem;">
            <div style="font-size:0.84rem;color:var(--ev-body);margin-bottom:0.35rem;"><strong>Instructions:</strong> ${esc(rc.registrationInstructions)}</div>
            <div style="font-size:0.8rem;color:var(--ev-muted);">
              Approval: <strong>${rc.approvalMode === 'manual' ? 'Organizer Approval Required' : 'Automatic Approval'}</strong>
              &bull; Format: <strong>${esc(ev.teamConfig.label)}</strong>
              &bull; Capacity: <strong>${rc.capacityEnabled ? `${rc.maxRegistrations} max` : 'Unlimited'}</strong>
              ${rc.waitlistEnabled ? ' &bull; Waitlist enabled' : ''}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:0.85rem;">
            ${renderFieldPreviewHTML(draftFields)}
          </div>
        </div>
      `;
    }

    function render() {
      const ev = getEv();
      const stats = s.getParticipantStats(ev.participants);
      const avail = s.evaluateRegistrationAvailability(ev, null);
      const rc = ev.registrationConfig;
      const enabledFieldCount = draftFields.filter((f) => f.enabled !== false).length;

      containerEl.innerHTML = `
        <div class="ev-rg-root" style="display:flex;flex-direction:column;gap:1.25rem;">
          <div class="ev-ws-card">
            <div class="ev-rb-header">
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                  <span class="ev-badge ev-badge-category">Phase 6 Registration System</span>
                  <span class="ev-badge ${esc(ev.registrationBadgeClass || 'ev-badge-open')}">${esc(ev.registrationStatus)}</span>
                  <span class="ev-badge ev-badge-sample">${rc.approvalMode === 'manual' ? 'Manual Approval' : 'Auto Approval'}</span>
                </div>
                <h2 class="ev-display" style="font-size:1.5rem;font-weight:600;color:var(--ev-charcoal);">${esc(ev.name)} — Registration</h2>
                <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.2rem;">
                  Configure registration window, capacity, waitlist, form fields, and team participation settings.
                </p>
              </div>
              <div class="ev-rb-header-actions">
                ${onJumpSection ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evRgGoRosterBtn">View Participants (${stats.total}) &rarr;</button>` : ''}
                <a href="event.html?slug=${encodeURIComponent(ev.slug)}" class="ev-btn ev-btn-outline ev-btn-sm">Public Event Page &rarr;</a>
              </div>
            </div>

            ${feedbackMsg ? `
              <div class="ev-auth-status is-${esc(feedbackKind)}" role="status" style="margin-bottom:1rem;">
                <span>${esc(feedbackMsg)}</span>
              </div>
            ` : ''}

            <div class="ev-pt-stats-grid" style="margin-bottom:1rem;">
              <div class="ev-stat-card"><div class="ev-stat-label">Active Slots</div><div class="ev-stat-value">${stats.activeSlots}</div><div class="ev-stat-sub">${rc.capacityEnabled ? `of ${rc.maxRegistrations}` : 'Unlimited cap'}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Approved</div><div class="ev-stat-value">${stats.approved}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Pending</div><div class="ev-stat-value">${stats.pending}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Waitlisted</div><div class="ev-stat-value">${stats.waitlisted}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Cancelled</div><div class="ev-stat-value">${stats.cancelled}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Form Fields</div><div class="ev-stat-value">${enabledFieldCount}</div><div class="ev-stat-sub">${avail.state === 'open' ? 'Open now' : esc(avail.state)}</div></div>
            </div>

            <div class="ev-ws-status-pills" role="tablist" aria-label="Registration management sections">
              <button type="button" class="ev-ws-pill ${activeTab === 'settings' ? 'is-active' : ''}" data-rg-tab="settings">Settings &amp; Window</button>
              <button type="button" class="ev-ws-pill ${activeTab === 'form' ? 'is-active' : ''}" data-rg-tab="form">Form Builder (${enabledFieldCount})</button>
              <button type="button" class="ev-ws-pill ${activeTab === 'rules' ? 'is-active' : ''}" data-rg-tab="rules">Team Mode Rules</button>
              <button type="button" class="ev-ws-pill ${activeTab === 'preview' ? 'is-active' : ''}" data-rg-tab="preview">Form Preview</button>
            </div>
          </div>

          ${activeTab === 'settings' ? renderSettingsTab(ev)
            : activeTab === 'form' ? renderFormBuilderTab()
            : activeTab === 'rules' ? renderTeamRulesTab(ev)
            : renderPreviewTab(ev)}
        </div>
      `;

      bindEvents(ev);
    }

    function bindEvents(ev) {
      containerEl.querySelectorAll('[data-rg-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.rgTab;
          render();
        });
      });

      containerEl.querySelector('#evRgGoRosterBtn')?.addEventListener('click', () => {
        if (onJumpSection) onJumpSection('participants');
      });
      containerEl.querySelector('#evRgOpenTeamsBtn')?.addEventListener('click', () => {
        if (onJumpSection) onJumpSection('teams');
      });

      if (readOnly) return;

      // Settings tab events
      const capCheck = containerEl.querySelector('#evRgCapEnabled');
      const maxInput = containerEl.querySelector('#evRgMaxRegs');
      capCheck?.addEventListener('change', () => {
        if (maxInput) maxInput.disabled = !capCheck.checked;
      });
      const canCheck = containerEl.querySelector('#evRgCancelAllowed');
      const canDead = containerEl.querySelector('#evRgCancelDeadline');
      canCheck?.addEventListener('change', () => {
        if (canDead) canDead.disabled = !canCheck.checked;
      });

      containerEl.querySelector('#evRgSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const enabledBool = containerEl.querySelector('#evRgEnabled').value === 'true';
        const statusSel = containerEl.querySelector('#evRgStatus').value;
        const res = s.saveRegistrationConfig(slug, {
          registrationEnabled: enabledBool,
          registrationStatus: !enabledBool ? 'Closed' : (statusSel === 'Closed' ? 'Open' : statusSel),
          approvalMode: containerEl.querySelector('#evRgApproval').value,
          registrationOpensAt: containerEl.querySelector('#evRgOpensAt').value,
          registrationClosesAt: containerEl.querySelector('#evRgClosesAt').value,
          registrationDeadline: containerEl.querySelector('#evRgDeadlineLabel').value.trim() || 'Open until event start',
          capacityEnabled: containerEl.querySelector('#evRgCapEnabled').checked,
          maxRegistrations: Number(containerEl.querySelector('#evRgMaxRegs').value) || 200,
          waitlistEnabled: containerEl.querySelector('#evRgWaitlist').checked,
          cancellationAllowed: containerEl.querySelector('#evRgCancelAllowed').checked,
          cancellationDeadline: containerEl.querySelector('#evRgCancelDeadline').value,
          registrationInstructions: containerEl.querySelector('#evRgInstructions').value.trim(),
          confirmationMessage: containerEl.querySelector('#evRgConfirmMsg').value.trim()
        });
        if (!res.ok) {
          setFeedback('error', res.error);
          render();
          return;
        }
        setFeedback('success', 'Saved registration window, capacity, waitlist, and approval settings cleanly.');
        if (onSaved) onSaved(res.event);
        render();
      });

      // Form builder events
      containerEl.querySelector('#evRgAddCustomBtn')?.addEventListener('click', () => {
        editingFieldId = '';
        customDraft = { label: '', fieldType: 'text', helpText: '', required: false, enabled: true, optionsText: '' };
        showCustomForm = true;
        render();
      });
      containerEl.querySelector('#evRgCancelCustomBtn')?.addEventListener('click', () => {
        showCustomForm = false;
        editingFieldId = '';
        render();
      });
      containerEl.querySelector('#evRgCfLabel')?.addEventListener('input', (e) => { customDraft.label = e.target.value; });
      containerEl.querySelector('#evRgCfHelp')?.addEventListener('input', (e) => { customDraft.helpText = e.target.value; });
      containerEl.querySelector('#evRgCfOpts')?.addEventListener('input', (e) => { customDraft.optionsText = e.target.value; });
      containerEl.querySelector('#evRgCfReq')?.addEventListener('change', (e) => { customDraft.required = e.target.checked; });
      containerEl.querySelector('#evRgCfEn')?.addEventListener('change', (e) => { customDraft.enabled = e.target.checked; });
      containerEl.querySelector('#evRgCfType')?.addEventListener('change', (e) => {
        customDraft.fieldType = e.target.value;
        render();
      });

      containerEl.querySelector('#evRgCommitCustomBtn')?.addEventListener('click', () => {
        const cleanLabel = customDraft.label.trim();
        if (!cleanLabel) {
          setFeedback('error', 'Enter a label for the custom field before adding.');
          render();
          return;
        }
        const opts = customDraft.optionsText.split(/\r?\n|,/).map((o) => o.trim()).filter(Boolean);
        if ((customDraft.fieldType === 'dropdown' || customDraft.fieldType === 'multiple_choice') && opts.length === 0) {
          setFeedback('error', 'Dropdown and Multiple Choice fields require at least one option.');
          render();
          return;
        }

        if (editingFieldId) {
          draftFields = draftFields.map((f) => (
            f.id === editingFieldId
              ? {
                  ...f,
                  label: cleanLabel,
                  fieldType: customDraft.fieldType,
                  helpText: customDraft.helpText.trim(),
                  required: customDraft.required,
                  enabled: customDraft.enabled,
                  options: (customDraft.fieldType === 'dropdown' || customDraft.fieldType === 'multiple_choice') ? opts : []
                }
              : f
          ));
        } else {
          const nid = `fld_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
          draftFields.push({
            id: nid,
            key: nid,
            label: cleanLabel,
            fieldType: customDraft.fieldType,
            helpText: customDraft.helpText.trim(),
            required: customDraft.required,
            enabled: customDraft.enabled,
            isDefault: false,
            order: draftFields.length + 1,
            options: (customDraft.fieldType === 'dropdown' || customDraft.fieldType === 'multiple_choice') ? opts : []
          });
        }
        fieldsDirty = true;
        showCustomForm = false;
        editingFieldId = '';
        setFeedback('info', 'Field updated in form builder. Click Save Form Fields to apply.');
        render();
      });

      containerEl.querySelectorAll('[data-rg-up]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.rgUp);
          if (i <= 0) return;
          const [moved] = draftFields.splice(i, 1);
          draftFields.splice(i - 1, 0, moved);
          fieldsDirty = true;
          render();
        });
      });
      containerEl.querySelectorAll('[data-rg-down]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.rgDown);
          if (i >= draftFields.length - 1) return;
          const [moved] = draftFields.splice(i, 1);
          draftFields.splice(i + 1, 0, moved);
          fieldsDirty = true;
          render();
        });
      });
      containerEl.querySelectorAll('[data-rg-toggle-en]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const idx = Number(cb.dataset.rgToggleEn);
          if (!draftFields[idx]) return;
          draftFields[idx].enabled = cb.checked;
          if (!cb.checked) draftFields[idx].required = false;
          fieldsDirty = true;
          render();
        });
      });
      containerEl.querySelectorAll('[data-rg-toggle-req]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const idx = Number(cb.dataset.rgToggleReq);
          if (!draftFields[idx]) return;
          draftFields[idx].required = cb.checked;
          fieldsDirty = true;
          render();
        });
      });
      containerEl.querySelectorAll('[data-rg-edit-cf]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const f = draftFields.find((item) => item.id === btn.dataset.rgEditCf);
          if (!f) return;
          editingFieldId = f.id;
          customDraft = {
            label: f.label,
            fieldType: f.fieldType,
            helpText: f.helpText || '',
            required: Boolean(f.required),
            enabled: f.enabled !== false,
            optionsText: (f.options || []).join(', ')
          };
          showCustomForm = true;
          render();
        });
      });
      containerEl.querySelectorAll('[data-rg-del-cf]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const f = draftFields.find((item) => item.id === btn.dataset.rgDelCf);
          if (!f) return;
          window.EventoraWorkspace.openConfirm({
            title: 'Delete Custom Field',
            body: `Remove custom field "${f.label}" from "${ev.name}" registration form?`,
            confirmLabel: 'Delete Field',
            danger: true,
            onConfirm: () => {
              draftFields = draftFields.filter((item) => item.id !== f.id);
              fieldsDirty = true;
              setFeedback('info', `Removed "${f.label}". Click Save Form Fields to commit.`);
              render();
            }
          });
        });
      });
      containerEl.querySelector('#evRgSaveFormBtn')?.addEventListener('click', () => {
        const res = s.saveRegistrationFormFields(slug, draftFields);
        if (!res.ok) {
          setFeedback('error', res.error);
          render();
          return;
        }
        draftFields = cloneFields(res.event.registrationConfig.formFields);
        fieldsDirty = false;
        setFeedback('success', 'Saved registration form configuration cleanly.');
        if (onSaved) onSaved(res.event);
        render();
      });

      // Team Rules tab events (reusing canonical Phase 5 APIs)
      const ruleModeEl = containerEl.querySelector('#evWsRuleMode');
      ruleModeEl?.addEventListener('change', () => {
        const isTeam = ruleModeEl.value === 'team';
        const minEl = containerEl.querySelector('#evWsRuleMin');
        const maxEl = containerEl.querySelector('#evWsRuleMax');
        const extraWrap = containerEl.querySelector('#evWsTeamRulesExtraWrap');
        if (minEl) { minEl.disabled = !isTeam; if (isTeam && Number(minEl.value) < 1) minEl.value = '2'; }
        if (maxEl) { maxEl.disabled = !isTeam; if (isTeam && Number(maxEl.value) < 2) maxEl.value = '4'; }
        if (extraWrap) {
          extraWrap.style.opacity = isTeam ? '1' : '0.55';
          extraWrap.querySelectorAll('input, select').forEach((el) => { el.disabled = !isTeam; });
        }
      });
      containerEl.querySelector('#evWsTeamRulesForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const errEl = containerEl.querySelector('#evWsTeamRulesErr');
        const isTeam = containerEl.querySelector('#evWsRuleMode').value === 'team';
        const res = s.saveTeamRules(slug, {
          supported: isTeam,
          minSize: isTeam ? Number(containerEl.querySelector('#evWsRuleMin').value) : 1,
          maxSize: isTeam ? Number(containerEl.querySelector('#evWsRuleMax').value) : 1,
          creationMode: containerEl.querySelector('#evWsRuleCreation').value,
          allowJoinRequests: containerEl.querySelector('#evWsRuleReqCreate').checked,
          allowJoinExisting: containerEl.querySelector('#evWsRuleJoinExist').checked,
          exclusiveMembership: containerEl.querySelector('#evWsRuleExclusive').checked,
          requireLeader: containerEl.querySelector('#evWsRuleLeader').checked,
          locked: containerEl.querySelector('#evWsRuleLocked').checked
        });
        if (!res.ok) {
          if (errEl) { errEl.hidden = false; errEl.textContent = res.error; }
          return;
        }
        if (errEl) errEl.hidden = true;
        setFeedback('success', `Team rules saved (${res.event.teamConfig.label}).`);
        if (onSaved) onSaved(res.event);
        render();
      });
    }

    render();
    return { refresh: render, renderFieldPreviewHTML };
  }

  return {
    mount,
    renderFieldPreviewHTML
  };
})();

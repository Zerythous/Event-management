/* ==========================================================================
   EVENTORA PHASE 5 — EVENT-SPECIFIC PARTICIPANTS & TEAM MANAGEMENT
   Provides interactive organizer workflows scoped strictly per event slug:
   - Participant directory, search/filter/sort, details drawer, status updates
   - Team CRUD, rule-enforced validation, leader invariant, member assignment
   - Accessible checkbox + dropdown assignment alongside drag-and-drop
   - Strictly local prototype persistence (sessionStorage); no fake backend
   ========================================================================== */

window.EventoraRoster = (function () {
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

  function formatDateShort(iso) {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function getStatusBadgeClass(status) {
    if (status === 'Approved' || status === 'Active') return 'ev-badge-open';
    if (status === 'Waitlisted' || status === 'Awaiting Members') return 'ev-badge-filling';
    if (status === 'Rejected' || status === 'Locked' || status === 'Cancelled') return 'ev-badge-closed';
    if (status === 'Full') return 'ev-badge-category';
    return 'ev-badge-sample';
  }

  /* ========================================================================
     A. EVENT-SPECIFIC PARTICIPANTS MANAGEMENT
     ======================================================================== */

  /**
   * Mounts the interactive Participants Management workspace for an event slug.
   */
  function mountParticipants(containerEl, options = {}) {
    if (!containerEl) return null;
    const slug = String(options.slug || '').trim();
    const readOnly = Boolean(options.readOnly);
    const onUpdated = typeof options.onUpdated === 'function' ? options.onUpdated : null;
    const onJumpSection = typeof options.onJumpSection === 'function' ? options.onJumpSection : null;
    const manageHref = options.manageHref || '';

    const s = store();
    if (!s || !s.getEventBySlug(slug)) {
      containerEl.innerHTML = window.EventoraWorkspace.renderEmptyState({
        iconName: 'participants',
        title: 'Event Not Found',
        message: 'Select a valid event to view and manage its participants.'
      });
      return null;
    }

    let searchQuery = '';
    let statusFilter = 'all';
    let teamFilter = 'all';
    let sortBy = 'name';
    let selectedParticipantId = '';
    let feedbackMsg = '';
    let feedbackKind = 'info';

    function getEv() {
      return s.getEventBySlug(slug);
    }

    function setFeedback(kind, msg) {
      feedbackKind = kind;
      feedbackMsg = msg;
    }

    function getFilteredParticipants(ev) {
      const q = searchQuery.trim().toLowerCase();
      const teamNameMap = new Map(ev.teams.map((t) => [t.id, t.teamName]));
      let list = ev.participants.filter((p) => {
        if (statusFilter !== 'all' && p.registrationStatus !== statusFilter) return false;
        if (teamFilter === 'assigned' && !p.teamId) return false;
        if (teamFilter === 'unassigned' && p.teamId) return false;
        if (teamFilter !== 'all' && teamFilter !== 'assigned' && teamFilter !== 'unassigned' && p.teamId !== teamFilter) {
          return false;
        }
        if (q) {
          const teamName = (p.teamId && teamNameMap.get(p.teamId)) || '';
          const haystack = [p.fullName, p.email, p.registrationId, teamName].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

      list = [...list];
      if (sortBy === 'newest') {
        list.sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
      } else if (sortBy === 'status') {
        list.sort((a, b) => a.registrationStatus.localeCompare(b.registrationStatus) || a.fullName.localeCompare(b.fullName));
      } else if (sortBy === 'team') {
        list.sort((a, b) => {
          const ta = (a.teamId && teamNameMap.get(a.teamId)) || 'zzz';
          const tb = (b.teamId && teamNameMap.get(b.teamId)) || 'zzz';
          return ta.localeCompare(tb) || a.fullName.localeCompare(b.fullName);
        });
      } else {
        list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      }
      return list;
    }

    function performStatusUpdate(ev, participant, nextStatus) {
      if (readOnly) return;
      const runUpdate = () => {
        const res = s.updateParticipantStatus(slug, participant.id, nextStatus);
        if (!res.ok) {
          setFeedback('error', res.error || 'Could not update status.');
        } else {
          setFeedback('success', `Updated ${participant.fullName} to "${nextStatus}" in local workspace storage (no email sent).`);
          if (onUpdated) onUpdated(res.event);
          // DB write-through: sync registration status to PostgreSQL
          if (window.EventoraRegistrationsApi && participant.dbId) {
            window.EventoraRegistrationsApi.setRegistrationStatus(participant.dbId, nextStatus, ev.dbId).catch(() => {});
          }
        }
        render();
      };

      if (nextStatus === 'Rejected') {
        window.EventoraWorkspace.openConfirm({
          title: 'Reject Registration',
          body: `Mark ${participant.fullName} (${participant.registrationId}) as Rejected for "${ev.name}"? This updates local prototype storage only; no automated email is sent.`,
          confirmLabel: 'Confirm Reject',
          danger: true,
          onConfirm: runUpdate
        });
      } else {
        runUpdate();
      }
    }

    function renderDetailsPanel(ev, participant, teamMap) {
      if (!participant) return '';
      const assignedTeam = participant.teamId ? teamMap.get(participant.teamId) : null;
      const meta = participant.metadata || {};
      const openTeams = ev.teams.filter((t) => t.memberIds.length < t.maxTeamSize && t.id !== participant.teamId);

      return `
        <aside class="ev-pt-detail-panel" id="evPtDetailPanel" aria-label="Participant details">
          <div class="ev-pt-detail-head">
            <div>
              <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.3rem;">
                <span class="ev-badge ${esc(getStatusBadgeClass(participant.registrationStatus))}">${esc(participant.registrationStatus)}</span>
                ${participant.isDemo ? '<span class="ev-badge ev-badge-sample">Prototype Demo Data</span>' : ''}
              </div>
              <h3 class="ev-display" style="font-size:1.22rem;font-weight:600;color:var(--ev-charcoal);">${esc(participant.fullName)}</h3>
              <div style="font-size:0.82rem;color:var(--ev-muted);word-break:break-all;">${esc(participant.email)}</div>
            </div>
            <button type="button" class="ev-modal-close" id="evPtCloseDetailBtn" aria-label="Close participant details">&times;</button>
          </div>

          <div class="ev-pt-detail-grid">
            <div><span class="ev-pt-kv-label">Registration ID</span><strong class="ev-pt-kv-val">${esc(participant.registrationId)}</strong></div>
            <div><span class="ev-pt-kv-label">Registered On</span><strong class="ev-pt-kv-val">${esc(formatDateShort(participant.registeredAt))}</strong></div>
            <div><span class="ev-pt-kv-label">Event</span><strong class="ev-pt-kv-val">${esc(ev.name)} (${esc(ev.slug)})</strong></div>
            <div><span class="ev-pt-kv-label">Team Assignment</span><strong class="ev-pt-kv-val">${assignedTeam ? esc(assignedTeam.teamName) : (ev.teamConfig.supported ? 'Unassigned' : 'Individual Format')}</strong></div>
            ${meta.institution ? `<div><span class="ev-pt-kv-label">Institution</span><strong class="ev-pt-kv-val">${esc(meta.institution)}</strong></div>` : ''}
            ${meta.department ? `<div><span class="ev-pt-kv-label">Department</span><strong class="ev-pt-kv-val">${esc(meta.department)}</strong></div>` : ''}
            ${meta.city ? `<div><span class="ev-pt-kv-label">City</span><strong class="ev-pt-kv-val">${esc(meta.city)}</strong></div>` : ''}
            ${meta.track ? `<div><span class="ev-pt-kv-label">Track / Interest</span><strong class="ev-pt-kv-val">${esc(meta.track)}</strong></div>` : ''}
          </div>
          ${meta.notes ? `<div style="font-size:0.8rem;color:var(--ev-muted);margin-top:0.65rem;"><strong>Notes:</strong> ${esc(meta.notes)}</div>` : ''}

          ${!readOnly ? `
            <div class="ev-pt-detail-actions">
              <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ev-forest);">Registration Status</div>
              <div style="display:flex;flex-wrap:wrap;gap:0.45rem;">
                ${participant.registrationStatus !== 'Approved' ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-pt-detail-status="Approved">Approve</button>` : ''}
                ${participant.registrationStatus !== 'Waitlisted' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pt-detail-status="Waitlisted">Waitlist</button>` : ''}
                ${participant.registrationStatus !== 'Pending' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pt-detail-status="Pending">Restore Pending</button>` : ''}
                ${participant.registrationStatus !== 'Rejected' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-pt-detail-status="Rejected">Reject</button>` : ''}
              </div>

              ${ev.teamConfig.supported ? `
                <div style="padding-top:0.75rem;border-top:1px solid var(--ev-border);margin-top:0.25rem;">
                  <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ev-forest);margin-bottom:0.45rem;">Team Membership</div>
                  ${ev.teamConfig.locked ? `
                    <div style="font-size:0.8rem;color:var(--ev-muted);">Team membership is locked by event rules.</div>
                  ` : (assignedTeam ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                      <span style="font-size:0.84rem;color:var(--ev-charcoal);">Assigned to <strong>${esc(assignedTeam.teamName)}</strong></span>
                      <button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" id="evPtDetailRemoveTeamBtn" data-team-id="${esc(assignedTeam.id)}">Remove from Team</button>
                    </div>
                  ` : (openTeams.length > 0 ? `
                    <div style="display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">
                      <select class="ev-select" id="evPtDetailAssignSelect" style="flex:1;min-width:160px;padding:0.4rem 0.6rem;font-size:0.82rem;">
                        ${openTeams.map((t) => `<option value="${esc(t.id)}">${esc(t.teamName)} (${t.memberIds.length}/${t.maxTeamSize})</option>`).join('')}
                      </select>
                      <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" id="evPtDetailAssignBtn">Add to Team</button>
                    </div>
                  ` : `
                    <div style="font-size:0.8rem;color:var(--ev-muted);">No teams with open slots. Create or open a team inside the Teams section.</div>
                  `))}
                </div>
              ` : ''}
              <div style="font-size:0.74rem;color:var(--ev-muted);">Local prototype persistence only — status actions do not trigger emails.</div>
            </div>
          ` : ''}
        </aside>
      `;
    }

    function renderRowsHTML(ev, filtered, teamMap) {
      if (filtered.length === 0) {
        return `
          <tr>
            <td colspan="7" style="text-align:center;padding:2rem 1rem;color:var(--ev-muted);">
              ${ev.participants.length === 0
                ? 'No registered participants exist in this event\'s prototype store.'
                : 'No participants match your active search or status filters.'}
            </td>
          </tr>
        `;
      }

      return filtered.map((p) => {
        const assignedTeam = p.teamId ? teamMap.get(p.teamId) : null;
        const isSelected = p.id === selectedParticipantId;
        return `
          <tr class="${isSelected ? 'ev-pt-row-active' : ''}" data-pt-row="${esc(p.id)}">
            <td data-label="Participant">
              <div style="font-weight:600;color:var(--ev-charcoal);">${esc(p.fullName)}</div>
              ${p.isDemo ? '<span class="ev-badge ev-badge-sample" style="margin-top:0.2rem;">Demo Record</span>' : ''}
            </td>
            <td data-label="Email" style="word-break:break-word;">${esc(p.email || 'No email')}</td>
            <td data-label="Reg ID"><code style="font-size:0.78rem;color:var(--ev-forest);">${esc(p.registrationId)}</code></td>
            <td data-label="Status"><span class="ev-badge ${esc(getStatusBadgeClass(p.registrationStatus))}">${esc(p.registrationStatus)}</span></td>
            <td data-label="Team">
              ${ev.teamConfig.supported
                ? (assignedTeam ? `<span class="ev-badge ev-badge-category">${esc(assignedTeam.teamName)}</span>` : '<span style="font-size:0.8rem;color:var(--ev-muted);">Unassigned</span>')
                : '<span style="font-size:0.78rem;color:var(--ev-muted);">Individual</span>'}
            </td>
            <td data-label="Registered" style="white-space:nowrap;font-size:0.8rem;color:var(--ev-muted);">${esc(formatDateShort(p.registeredAt))}</td>
            <td data-label="Actions">
              <div class="ev-pt-row-actions">
                <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pt-view="${esc(p.id)}">View</button>
                ${!readOnly ? `
                  ${p.registrationStatus !== 'Approved' ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-pt-status="Approved" data-pt-id="${esc(p.id)}">Approve</button>` : ''}
                  ${p.registrationStatus !== 'Rejected' ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-pt-status="Rejected" data-pt-id="${esc(p.id)}">Reject</button>` : ''}
                  ${ev.teamConfig.supported && !ev.teamConfig.locked && assignedTeam
                    ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pt-unassign="${esc(p.id)}" data-team-id="${esc(assignedTeam.id)}">Leave Team</button>`
                    : (ev.teamConfig.supported && !ev.teamConfig.locked && !assignedTeam && ev.teams.some((t) => t.memberIds.length < t.maxTeamSize)
                      ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-pt-view="${esc(p.id)}">+ Team</button>`
                      : '')}
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function updateTableInPlace() {
      const ev = getEv();
      const tbody = containerEl.querySelector('#evPtTableBody');
      const countEl = containerEl.querySelector('#evPtShowingCount');
      if (!tbody || !ev) return;
      const teamMap = new Map(ev.teams.map((t) => [t.id, t]));
      const filtered = getFilteredParticipants(ev);
      tbody.innerHTML = renderRowsHTML(ev, filtered, teamMap);
      if (countEl) {
        countEl.textContent = `Showing ${filtered.length} of ${ev.participants.length} participant(s)`;
      }
      bindTableEvents(ev);
    }

    function bindTableEvents(ev) {
      containerEl.querySelectorAll('[data-pt-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedParticipantId = btn.dataset.ptView;
          render();
        });
      });
      containerEl.querySelectorAll('[data-pt-status]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = ev.participants.find((item) => item.id === btn.dataset.ptId);
          if (p) performStatusUpdate(ev, p, btn.dataset.ptStatus);
        });
      });
      containerEl.querySelectorAll('[data-pt-unassign]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.dataset.ptUnassign;
          const tid = btn.dataset.teamId;
          const res = s.removeMemberFromTeam(slug, tid, pid);
          if (!res.ok && res.requiresLeaderSelection) {
            selectedParticipantId = pid;
            setFeedback('info', res.error);
            render();
            return;
          }
          if (!res.ok) setFeedback('error', res.error);
          else {
            setFeedback('success', 'Removed participant from team. Their event registration remains active.');
            if (onUpdated) onUpdated(res.event);
          }
          render();
        });
      });
    }

    function render() {
      const ev = getEv();
      const stats = s.getParticipantStats(ev.participants);
      const teamMap = new Map(ev.teams.map((t) => [t.id, t]));
      const filtered = getFilteredParticipants(ev);
      const hasDemo = ev.participants.some((p) => p.isDemo);
      const selectedParticipant = ev.participants.find((p) => p.id === selectedParticipantId) || null;

      containerEl.innerHTML = `
        <div class="ev-ws-card ev-pt-root">
          <div class="ev-rb-header">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                <span class="ev-badge ev-badge-category">Event-Scoped Participants</span>
                <span class="ev-rb-id-chip">Event ID: <code>${esc(ev.slug)}</code></span>
                <span class="ev-badge ev-badge-sample">Local Prototype Storage (No DB / Email)</span>
              </div>
              <h2 class="ev-display" style="font-size:1.5rem;font-weight:600;color:var(--ev-charcoal);">${esc(ev.name)} — Participants</h2>
              <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.2rem;">
                Manage registration approvals, profile details, and team assignments scoped solely to this event.
              </p>
            </div>
            <div class="ev-rb-header-actions">
              ${manageHref ? `<a href="${esc(manageHref)}" class="ev-btn ev-btn-outline ev-btn-sm">Manage Full Event &rarr;</a>` : ''}
              ${(!readOnly && onJumpSection && ev.teamConfig.supported) ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evPtGoTeamsBtn">Open Teams Workspace &rarr;</button>` : ''}
              ${(!readOnly && !hasDemo) ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evPtLoadDemoBtn">Load Demo Roster (Prototype)</button>` : ''}
              ${(!readOnly && hasDemo) ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-sm ev-rb-btn-danger" id="evPtClearDemoBtn">Clear Demo Data</button>` : ''}
            </div>
          </div>

          ${readOnly ? `
            <div class="ev-auth-status is-info" style="margin-bottom:1rem;">
              <span>Manager read-only scope: inspect participant registrations and details. Status edits require Event Organizer permissions.</span>
            </div>
          ` : ''}

          ${feedbackMsg ? `
            <div class="ev-auth-status is-${esc(feedbackKind)}" role="status" style="margin-bottom:1rem;">
              <span>${esc(feedbackMsg)}</span>
            </div>
          ` : ''}

          <!-- Participants Overview Stats -->
          <div class="ev-pt-stats-grid">
            <div class="ev-stat-card"><div class="ev-stat-label">Total</div><div class="ev-stat-value">${stats.total}</div></div>
            <div class="ev-stat-card"><div class="ev-stat-label">Approved</div><div class="ev-stat-value">${stats.approved}</div></div>
            <div class="ev-stat-card"><div class="ev-stat-label">Pending</div><div class="ev-stat-value">${stats.pending}</div></div>
            <div class="ev-stat-card"><div class="ev-stat-label">Waitlisted</div><div class="ev-stat-value">${stats.waitlisted}</div></div>
            <div class="ev-stat-card"><div class="ev-stat-label">In Teams</div><div class="ev-stat-value">${stats.assigned}</div></div>
            <div class="ev-stat-card"><div class="ev-stat-label">Unassigned</div><div class="ev-stat-value">${stats.unassigned}</div></div>
          </div>

          ${ev.participants.length === 0 ? window.EventoraWorkspace.renderEmptyState({
            iconName: 'participants',
            title: 'No participants registered for this event yet',
            message: 'Real participant submissions connect in the database/registration phase. Eventora never invents real users; optionally load clearly tagged prototype demo records to test approvals and team assignments.',
            actionHTML: !readOnly ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evPtEmptyLoadDemoBtn">Load Prototype Demo Roster (6 Demo Entries)</button>' : ''
          }) : `
            <!-- Search, Filters & Sorting -->
            <div class="ev-pt-filterbar">
              <input type="search" id="evPtSearchInput" class="ev-input" value="${esc(searchQuery)}" placeholder="Search by name, email, or Registration ID..." style="flex:1;min-width:210px;" />
              <select id="evPtStatusFilter" class="ev-select" style="width:auto;min-width:150px;">
                <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
                ${s.REGISTRATION_STATUSES.map((st) => `<option value="${esc(st)}" ${statusFilter === st ? 'selected' : ''}>${esc(st)}</option>`).join('')}
              </select>
              <select id="evPtTeamFilter" class="ev-select" style="width:auto;min-width:170px;">
                <option value="all" ${teamFilter === 'all' ? 'selected' : ''}>All Team States</option>
                <option value="assigned" ${teamFilter === 'assigned' ? 'selected' : ''}>Assigned to Team</option>
                <option value="unassigned" ${teamFilter === 'unassigned' ? 'selected' : ''}>Unassigned Only</option>
                ${ev.teams.map((t) => `<option value="${esc(t.id)}" ${teamFilter === t.id ? 'selected' : ''}>Team: ${esc(t.teamName)}</option>`).join('')}
              </select>
              <select id="evPtSortSelect" class="ev-select" style="width:auto;min-width:155px;">
                <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Sort: Name (A–Z)</option>
                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Sort: Newest</option>
                <option value="status" ${sortBy === 'status' ? 'selected' : ''}>Sort: Status</option>
                <option value="team" ${sortBy === 'team' ? 'selected' : ''}>Sort: Team</option>
              </select>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap;">
              <span id="evPtShowingCount" style="font-size:0.8rem;color:var(--ev-muted);">Showing ${filtered.length} of ${ev.participants.length} participant(s)</span>
              ${(searchQuery || statusFilter !== 'all' || teamFilter !== 'all') ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evPtResetFiltersBtn">Reset Filters</button>` : ''}
            </div>

            <div class="ev-pt-layout ${selectedParticipant ? 'has-detail' : ''}">
              <div class="ev-table-wrap ev-pt-table-wrap">
                <table class="ev-table ev-pt-responsive-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Email</th>
                      <th>Registration ID</th>
                      <th>Status</th>
                      <th>Team</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="evPtTableBody">
                    ${renderRowsHTML(ev, filtered, teamMap)}
                  </tbody>
                </table>
              </div>
              ${renderDetailsPanel(ev, selectedParticipant, teamMap)}
            </div>
          `}
        </div>
      `;

      bindEvents(ev, selectedParticipant);
    }

    function bindEvents(ev, selectedParticipant) {
      containerEl.querySelector('#evPtGoTeamsBtn')?.addEventListener('click', () => {
        if (onJumpSection) onJumpSection('teams');
      });

      const handleLoadDemo = () => {
        const res = s.loadDemoRoster(slug);
        if (!res.ok) setFeedback('error', res.error);
        else {
          setFeedback('info', 'Loaded clearly tagged Prototype Demo Roster locally. Demo records are never treated as real user accounts.');
          if (onUpdated) onUpdated(res.event);
        }
        render();
      };
      containerEl.querySelector('#evPtLoadDemoBtn')?.addEventListener('click', handleLoadDemo);
      containerEl.querySelector('#evPtEmptyLoadDemoBtn')?.addEventListener('click', handleLoadDemo);

      containerEl.querySelector('#evPtClearDemoBtn')?.addEventListener('click', () => {
        window.EventoraWorkspace.openConfirm({
          title: 'Clear Prototype Demo Data',
          body: `Remove all demo participants and demo teams from "${ev.name}"?`,
          confirmLabel: 'Clear Demo Data',
          danger: true,
          onConfirm: () => {
            const res = s.clearDemoRoster(slug);
            selectedParticipantId = '';
            setFeedback('info', 'Cleared prototype demo roster.');
            if (res.ok && onUpdated) onUpdated(res.event);
            render();
          }
        });
      });

      containerEl.querySelector('#evPtSearchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateTableInPlace();
      });
      containerEl.querySelector('#evPtStatusFilter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        render();
      });
      containerEl.querySelector('#evPtTeamFilter')?.addEventListener('change', (e) => {
        teamFilter = e.target.value;
        render();
      });
      containerEl.querySelector('#evPtSortSelect')?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        render();
      });
      containerEl.querySelector('#evPtResetFiltersBtn')?.addEventListener('click', () => {
        searchQuery = '';
        statusFilter = 'all';
        teamFilter = 'all';
        render();
      });

      containerEl.querySelector('#evPtCloseDetailBtn')?.addEventListener('click', () => {
        selectedParticipantId = '';
        render();
      });

      if (selectedParticipant) {
        containerEl.querySelectorAll('[data-pt-detail-status]').forEach((btn) => {
          btn.addEventListener('click', () => performStatusUpdate(ev, selectedParticipant, btn.dataset.ptDetailStatus));
        });
        containerEl.querySelector('#evPtDetailAssignBtn')?.addEventListener('click', () => {
          const sel = containerEl.querySelector('#evPtDetailAssignSelect');
          if (!sel || !sel.value) return;
          const res = s.assignMembersToTeam(slug, sel.value, [selectedParticipant.id]);
          if (!res.ok) setFeedback('error', res.error);
          else {
            setFeedback('success', `Assigned ${selectedParticipant.fullName} to team.`);
            if (onUpdated) onUpdated(res.event);
          }
          render();
        });
        containerEl.querySelector('#evPtDetailRemoveTeamBtn')?.addEventListener('click', (e) => {
          const tid = e.target.dataset.teamId;
          const res = s.removeMemberFromTeam(slug, tid, selectedParticipant.id);
          if (!res.ok && res.requiresLeaderSelection) {
            setFeedback('info', `${res.error} Use the Teams workspace to designate a replacement leader before removing.`);
            render();
            return;
          }
          if (!res.ok) setFeedback('error', res.error);
          else {
            setFeedback('success', `Removed ${selectedParticipant.fullName} from team. Registration kept intact.`);
            if (onUpdated) onUpdated(res.event);
          }
          render();
        });
      }

      bindTableEvents(ev);
    }

    render();
    return { refresh: render };
  }

  /* ========================================================================
     B. EVENT-SPECIFIC TEAMS MANAGEMENT
     ======================================================================== */

  /**
   * Mounts the interactive Teams Management workspace for an event slug.
   */
  function mountTeams(containerEl, options = {}) {
    if (!containerEl) return null;
    const slug = String(options.slug || '').trim();
    const readOnly = Boolean(options.readOnly);
    const onUpdated = typeof options.onUpdated === 'function' ? options.onUpdated : null;
    const onJumpSection = typeof options.onJumpSection === 'function' ? options.onJumpSection : null;
    const manageHref = options.manageHref || '';

    const s = store();
    if (!s || !s.getEventBySlug(slug)) {
      containerEl.innerHTML = window.EventoraWorkspace.renderEmptyState({
        iconName: 'teams',
        title: 'Event Not Found',
        message: 'Select a valid event to manage teams and member rules.'
      });
      return null;
    }

    let subView = 'cards'; // 'cards' | 'assign' | 'detail' | 'form'
    let editingTeamId = ''; // empty => create mode
    let viewingTeamId = '';
    let formError = '';
    let feedbackMsg = '';
    let feedbackKind = 'info';

    // Assignment board state
    let unassignedSearch = '';
    const pickedParticipantIds = new Set();
    let dragParticipantId = '';

    // Create/Edit team form state
    let formMemberSearch = '';
    const formMemberIds = new Set();
    let formDraftName = '';
    let formDraftDesc = '';
    let formDraftMaxSize = '';
    let formDraftLeaderId = '';

    // Detail view state
    let leaderReplacePromptForId = '';
    let detailAddSearch = '';

    function getEv() {
      return s.getEventBySlug(slug);
    }

    function setFeedback(kind, msg) {
      feedbackKind = kind;
      feedbackMsg = msg;
    }

    function openCreateForm(ev) {
      editingTeamId = '';
      formError = '';
      formMemberSearch = '';
      formMemberIds.clear();
      formDraftName = '';
      formDraftDesc = '';
      formDraftMaxSize = String(ev.teamConfig.maxSize || 4);
      formDraftLeaderId = '';
      subView = 'form';
      render();
    }

    function openEditForm(ev, team) {
      editingTeamId = team.id;
      formError = '';
      formMemberSearch = '';
      formMemberIds.clear();
      (team.memberIds || []).forEach((id) => formMemberIds.add(id));
      formDraftName = team.teamName;
      formDraftDesc = team.description || '';
      formDraftMaxSize = String(team.maxTeamSize || ev.teamConfig.maxSize || 4);
      formDraftLeaderId = team.teamLeaderId || '';
      subView = 'form';
      render();
    }

    function openTeamDetails(teamId) {
      viewingTeamId = teamId;
      leaderReplacePromptForId = '';
      detailAddSearch = '';
      subView = 'detail';
      render();
    }

    function renderRulesStrip(ev) {
      const cfg = ev.teamConfig;
      return `
        <div class="ev-tm-rules-strip">
          <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
            <span class="ev-badge ev-badge-open">${esc(cfg.label)}</span>
            <span class="ev-rb-chip">${cfg.creationMode === 'organizer_only' ? 'Organizer-only team creation' : 'Participants may request/form teams'}</span>
            <span class="ev-rb-chip">${cfg.exclusiveMembership ? 'Exclusive (1 team/participant)' : 'Multi-team allowed'}</span>
            <span class="ev-rb-chip">${cfg.requireLeader ? 'Team Leader required' : 'Team Leader optional'}</span>
            ${cfg.locked ? '<span class="ev-badge ev-badge-closed">Team Changes Locked</span>' : ''}
          </div>
          ${(!readOnly && onJumpSection) ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evTmConfigRulesBtn">Configure Team Rules</button>` : ''}
        </div>
      `;
    }

    function renderTeamFormPanel(ev) {
      const isEdit = Boolean(editingTeamId);
      const q = formMemberSearch.trim().toLowerCase();
      const teamNameMap = new Map(ev.teams.map((t) => [t.id, t.teamName]));
      const visibleCandidates = ev.participants.filter((p) => {
        if (!q) return true;
        return [p.fullName, p.email, p.registrationId].join(' ').toLowerCase().includes(q);
      });
      const checkedMembers = Array.from(formMemberIds)
        .map((id) => ev.participants.find((p) => p.id === id))
        .filter(Boolean);

      return `
        <div class="ev-tm-form-card" id="evTmFormPanel">
          <div class="ev-ws-card-head" style="margin-bottom:0.85rem;">
            <div>
              <span class="ev-badge ev-badge-category">${isEdit ? 'Edit Existing Team' : 'Create New Team'}</span>
              <h3 class="ev-display" style="font-size:1.25rem;font-weight:600;margin-top:0.25rem;">
                ${isEdit ? `Edit "${esc(formDraftName)}"` : 'Create Event Team'}
              </h3>
            </div>
            <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evTmFormCancelBtn">Cancel</button>
          </div>

          ${formError ? `<div class="ev-auth-status is-error" role="alert" style="margin-bottom:0.85rem;"><span>${esc(formError)}</span></div>` : ''}

          <form id="evTmTeamForm" novalidate style="display:flex;flex-direction:column;gap:0.95rem;">
            <div class="ev-rb-grid-3">
              <div class="ev-field">
                <label class="ev-label" for="evTmNameInput">Team Name *</label>
                <input class="ev-input" id="evTmNameInput" type="text" required value="${esc(formDraftName)}" placeholder="e.g. GreenGrid Builders" />
              </div>
              <div class="ev-field">
                <label class="ev-label" for="evTmMaxInput">Max Team Size (Event cap: ${ev.teamConfig.maxSize})</label>
                <input class="ev-input" id="evTmMaxInput" type="number" min="1" max="${ev.teamConfig.maxSize}" value="${esc(formDraftMaxSize)}" />
              </div>
              <div class="ev-field">
                <label class="ev-label">Team Identifier</label>
                <input class="ev-input" type="text" readonly value="${isEdit ? esc(editingTeamId) : 'Auto-generated on creation'}" style="background:var(--ev-cream);color:var(--ev-muted);" />
              </div>
            </div>

            <div class="ev-field">
              <label class="ev-label" for="evTmDescInput">Team Description (Optional)</label>
              <textarea class="ev-textarea" id="evTmDescInput" rows="2" placeholder="Project focus, track, or team notes...">${esc(formDraftDesc)}</textarea>
            </div>

            <div class="ev-rb-subpanel" style="margin-bottom:0;">
              <div class="ev-rb-subhead">
                <span>Select Team Members (${checkedMembers.length} selected)</span>
                <span class="ev-rb-subnote">Only participants registered for "${esc(ev.name)}" are eligible</span>
              </div>

              ${ev.participants.length === 0 ? `
                <div style="font-size:0.84rem;color:var(--ev-muted);padding:0.5rem 0;">
                  No registered participants exist in this event yet. Load demo participants or switch to Participants first.
                </div>
              ` : `
                <input type="search" id="evTmFormMemberSearch" class="ev-input" value="${esc(formMemberSearch)}" placeholder="Search event participants by name, email, or Reg ID..." style="margin-bottom:0.75rem;" />
                <div class="ev-tm-member-pick-list" id="evTmFormMemberList">
                  ${visibleCandidates.map((p) => {
                    const checked = formMemberIds.has(p.id);
                    const otherTeamId = p.teamId && p.teamId !== editingTeamId ? p.teamId : null;
                    const blockedExclusive = Boolean(otherTeamId && ev.teamConfig.exclusiveMembership);
                    const otherTeamName = otherTeamId ? teamNameMap.get(otherTeamId) : '';
                    return `
                      <label class="ev-tm-member-pick-item ${blockedExclusive && !checked ? 'is-disabled' : ''}">
                        <input type="checkbox" data-tm-form-member="${esc(p.id)}" ${checked ? 'checked' : ''} ${blockedExclusive && !checked ? 'disabled' : ''} />
                        <span style="min-width:0;flex:1;">
                          <strong style="display:block;font-size:0.84rem;color:var(--ev-charcoal);">${esc(p.fullName)}</strong>
                          <span style="display:block;font-size:0.74rem;color:var(--ev-muted);">${esc(p.registrationId)} &bull; ${esc(p.email)}</span>
                        </span>
                        <span class="ev-badge ${esc(getStatusBadgeClass(p.registrationStatus))}">${esc(p.registrationStatus)}</span>
                        ${otherTeamName ? `<span class="ev-badge ev-badge-sample">In: ${esc(otherTeamName)}</span>` : ''}
                      </label>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <div class="ev-field">
              <label class="ev-label" for="evTmLeaderSelect">
                Team Leader ${ev.teamConfig.requireLeader ? '(Required)' : '(Optional)'}
              </label>
              <select class="ev-select" id="evTmLeaderSelect">
                ${!ev.teamConfig.requireLeader || checkedMembers.length === 0 ? `<option value="">-- No Leader Selected --</option>` : ''}
                ${checkedMembers.map((m) => `
                  <option value="${esc(m.id)}" ${formDraftLeaderId === m.id ? 'selected' : ''}>${esc(m.fullName)} (${esc(m.registrationId)})</option>
                `).join('')}
              </select>
              <span style="font-size:0.75rem;color:var(--ev-muted);">The Team Leader must belong to the team's member roster.</span>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:0.65rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline" id="evTmFormCancelBtn2">Cancel</button>
              <button type="submit" class="ev-btn ev-btn-forest" id="evTmFormSubmitBtn">${isEdit ? 'Save Team Changes' : 'Create Team'}</button>
            </div>
          </form>
        </div>
      `;
    }

    function renderTeamDetailsView(ev, team) {
      if (!team) return '';
      const pMap = new Map(ev.participants.map((p) => [p.id, p]));
      const members = team.memberIds.map((id) => pMap.get(id)).filter(Boolean);
      const leader = team.teamLeaderId ? pMap.get(team.teamLeaderId) : null;
      const pct = Math.min(100, Math.round((members.length / Math.max(1, team.maxTeamSize)) * 100));
      const openSlots = Math.max(0, team.maxTeamSize - members.length);

      const qAdd = detailAddSearch.trim().toLowerCase();
      const addCandidates = ev.participants.filter((p) => {
        if (team.memberIds.includes(p.id)) return false;
        if (ev.teamConfig.exclusiveMembership && p.teamId) return false;
        if (!qAdd) return true;
        return [p.fullName, p.email, p.registrationId].join(' ').toLowerCase().includes(qAdd);
      });

      return `
        <div class="ev-tm-detail-card" id="evTmDetailPanel">
          <div class="ev-ws-card-head" style="margin-bottom:1rem;">
            <div>
              <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.35rem;">
                <span class="ev-badge ${esc(getStatusBadgeClass(team.status))}">${esc(team.status)}</span>
                <span class="ev-rb-id-chip">Team ID: <code>${esc(team.id)}</code></span>
                ${team.isDemo ? '<span class="ev-badge ev-badge-sample">Demo Team</span>' : ''}
              </div>
              <h3 class="ev-display" style="font-size:1.35rem;font-weight:600;color:var(--ev-charcoal);">${esc(team.teamName)}</h3>
              ${team.description ? `<p style="font-size:0.86rem;color:var(--ev-body);margin-top:0.25rem;">${esc(team.description)}</p>` : ''}
            </div>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
              <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evTmDetailBackBtn">&larr; All Teams</button>
              ${(!readOnly && !ev.teamConfig.locked) ? `
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evTmDetailEditBtn">Edit Team</button>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm ev-rb-btn-danger" id="evTmDetailDeleteBtn">Delete Team</button>
              ` : ''}
            </div>
          </div>

          <div class="ev-tm-detail-summary">
            <div><span class="ev-pt-kv-label">Team Leader</span><strong class="ev-pt-kv-val">${leader ? esc(leader.fullName) : 'No leader assigned'}</strong></div>
            <div><span class="ev-pt-kv-label">Size &amp; Capacity</span><strong class="ev-pt-kv-val">${members.length} / ${team.maxTeamSize} members (${openSlots} open)</strong></div>
            <div><span class="ev-pt-kv-label">Created On</span><strong class="ev-pt-kv-val">${esc(formatDateShort(team.createdAt))}</strong></div>
          </div>
          <div class="ev-tm-cap-bar" style="margin-bottom:1.25rem;">
            <div class="ev-tm-cap-fill" style="width:${pct}%;"></div>
          </div>

          ${leaderReplacePromptForId ? `
            <div class="ev-auth-status is-info" style="margin-bottom:1rem;flex-direction:column;align-items:stretch;gap:0.6rem;">
              <div><strong>Select Replacement Leader:</strong> Event rules require a Team Leader. Choose who should take over leadership before removing ${esc(pMap.get(leaderReplacePromptForId)?.fullName || 'current leader')}:</div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                <select class="ev-select" id="evTmReplaceLeaderSelect" style="flex:1;min-width:180px;">
                  ${members.filter((m) => m.id !== leaderReplacePromptForId).map((m) => `
                    <option value="${esc(m.id)}">${esc(m.fullName)} (${esc(m.registrationId)})</option>
                  `).join('')}
                </select>
                <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evTmConfirmReplaceLeaderBtn">Replace Leader &amp; Remove Member</button>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm" id="evTmCancelReplaceLeaderBtn">Cancel</button>
              </div>
            </div>
          ` : ''}

          <div class="ev-rb-subhead" style="margin-bottom:0.7rem;">
            <span>Team Members (${members.length})</span>
            <span class="ev-rb-subnote">Removing a member keeps them registered as unassigned</span>
          </div>

          ${members.length === 0 ? `
            <div style="padding:1.25rem;border-radius:var(--ev-radius-sm);background:var(--ev-cream);border:1px solid var(--ev-border);font-size:0.84rem;color:var(--ev-muted);margin-bottom:1.15rem;">
              No members currently assigned to this team.
            </div>
          ` : `
            <div class="ev-tm-members-grid">
              ${members.map((m) => {
                const isLeader = m.id === team.teamLeaderId;
                return `
                  <div class="ev-tm-member-card">
                    <div style="min-width:0;">
                      <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
                        <strong style="color:var(--ev-charcoal);font-size:0.9rem;">${esc(m.fullName)}</strong>
                        ${isLeader ? '<span class="ev-badge ev-badge-open">Team Leader</span>' : ''}
                      </div>
                      <div style="font-size:0.78rem;color:var(--ev-muted);margin-top:0.15rem;word-break:break-all;">${esc(m.email)} &bull; ${esc(m.registrationId)}</div>
                      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.35rem;">
                        <span class="ev-badge ${esc(getStatusBadgeClass(m.registrationStatus))}">${esc(m.registrationStatus)}</span>
                        ${m.metadata?.institution ? `<span class="ev-rb-chip">${esc(m.metadata.institution)}</span>` : ''}
                      </div>
                    </div>
                    ${(!readOnly && !ev.teamConfig.locked) ? `
                      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.65rem;">
                        ${!isLeader ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-tm-make-leader="${esc(m.id)}">Make Leader</button>` : ''}
                        <button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-tm-remove-member="${esc(m.id)}">Remove</button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}

          ${(!readOnly && !ev.teamConfig.locked && openSlots > 0) ? `
            <div class="ev-rb-subpanel" style="margin-top:1.15rem;margin-bottom:0;">
              <div class="ev-rb-subhead">
                <span>Add Registered Participant (${openSlots} open slot${openSlots === 1 ? '' : 's'})</span>
              </div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.65rem;">
                <input type="search" id="evTmDetailAddSearch" class="ev-input" value="${esc(detailAddSearch)}" placeholder="Search eligible participants..." style="flex:1;min-width:190px;" />
              </div>
              ${addCandidates.length === 0 ? `
                <div style="font-size:0.8rem;color:var(--ev-muted);">No eligible unassigned participants match your filter.</div>
              ` : `
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                  <select class="ev-select" id="evTmDetailAddSelect" style="flex:1;min-width:210px;">
                    ${addCandidates.map((p) => `<option value="${esc(p.id)}">${esc(p.fullName)} (${esc(p.registrationId)} • ${esc(p.registrationStatus)})</option>`).join('')}
                  </select>
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evTmDetailAddBtn">+ Add to Team</button>
                </div>
              `}
            </div>
          ` : ''}
        </div>
      `;
    }

    function renderAssignmentBoard(ev) {
      const pMap = new Map(ev.participants.map((p) => [p.id, p]));
      const q = unassignedSearch.trim().toLowerCase();
      const unassigned = ev.participants.filter((p) => {
        if (ev.teamConfig.exclusiveMembership && p.teamId) return false;
        if (q) return [p.fullName, p.email, p.registrationId].join(' ').toLowerCase().includes(q);
        return true;
      });
      const openTeams = ev.teams.filter((t) => t.memberIds.length < t.maxTeamSize);

      return `
        <div class="ev-tm-assign-board">
          <!-- Left: Unassigned Participants -->
          <div class="ev-tm-assign-pane">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap;">
              <div>
                <h3 class="ev-display" style="font-size:1.1rem;font-weight:600;">${ev.teamConfig.exclusiveMembership ? 'Unassigned Participants' : 'Registered Participants'} (${unassigned.length})</h3>
                <div style="font-size:0.76rem;color:var(--ev-muted);">Select participants or drag onto a team card.</div>
              </div>
              ${pickedParticipantIds.size > 0 ? `<button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evTmClearPickBtn">Clear (${pickedParticipantIds.size})</button>` : ''}
            </div>

            <div style="display:flex;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap;">
              <input type="search" id="evTmUnassignedSearch" class="ev-input" value="${esc(unassignedSearch)}" placeholder="Search participants..." style="flex:1;min-width:170px;" />
            </div>

            ${pickedParticipantIds.size > 0 && openTeams.length > 0 && !ev.teamConfig.locked ? `
              <div class="ev-tm-bulk-bar">
                <select class="ev-select" id="evTmBulkTargetSelect" style="flex:1;min-width:150px;padding:0.38rem 0.6rem;font-size:0.8rem;">
                  ${openTeams.map((t) => `<option value="${esc(t.id)}">${esc(t.teamName)} (${t.maxTeamSize - t.memberIds.length} open)</option>`).join('')}
                </select>
                <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" id="evTmBulkAssignBtn">Assign ${pickedParticipantIds.size} Selected</button>
              </div>
            ` : ''}

            ${unassigned.length === 0 ? `
              <div style="padding:1.5rem 1rem;border-radius:var(--ev-radius-sm);background:var(--ev-white);border:1px solid var(--ev-border);text-align:center;font-size:0.84rem;color:var(--ev-muted);">
                ${ev.participants.length === 0 ? 'No participants registered yet.' : 'All matching participants are currently assigned.'}
              </div>
            ` : `
              <div class="ev-tm-assign-list" id="evTmUnassignedList">
                ${unassigned.map((p) => {
                  const picked = pickedParticipantIds.has(p.id);
                  return `
                    <div class="ev-tm-drag-item ${picked ? 'is-picked' : ''}" draggable="${!ev.teamConfig.locked}" data-tm-drag-p="${esc(p.id)}">
                      <label style="display:flex;align-items:center;gap:0.55rem;flex:1;min-width:0;cursor:pointer;">
                        <input type="checkbox" data-tm-pick-p="${esc(p.id)}" ${picked ? 'checked' : ''} ${ev.teamConfig.locked ? 'disabled' : ''} />
                        <span style="min-width:0;flex:1;">
                          <strong style="display:block;font-size:0.84rem;color:var(--ev-charcoal);">${esc(p.fullName)}</strong>
                          <span style="display:block;font-size:0.74rem;color:var(--ev-muted);">${esc(p.registrationId)} &bull; ${esc(p.registrationStatus)}</span>
                        </span>
                      </label>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Right: Existing Teams Drop/Assignment Targets -->
          <div class="ev-tm-assign-pane">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.65rem;flex-wrap:wrap;">
              <div>
                <h3 class="ev-display" style="font-size:1.1rem;font-weight:600;">Event Teams (${ev.teams.length})</h3>
                <div style="font-size:0.76rem;color:var(--ev-muted);">Monitor capacity slots or click Add Selected on any open team.</div>
              </div>
              <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" id="evTmAssignNewBtn">+ New Team</button>
            </div>

            ${ev.teams.length === 0 ? `
              <div style="padding:1.5rem 1rem;border-radius:var(--ev-radius-sm);background:var(--ev-white);border:1px solid var(--ev-border);text-align:center;font-size:0.84rem;color:var(--ev-muted);">
                Create a team first to assign participants.
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:0.65rem;">
                ${ev.teams.map((t) => {
                  const pct = Math.min(100, Math.round((t.memberIds.length / Math.max(1, t.maxTeamSize)) * 100));
                  const hasSlots = t.memberIds.length < t.maxTeamSize && !ev.teamConfig.locked;
                  return `
                    <div class="ev-tm-drop-card" data-tm-drop-team="${esc(t.id)}">
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                        <div>
                          <strong style="color:var(--ev-charcoal);font-size:0.92rem;">${esc(t.teamName)}</strong>
                          <span style="font-size:0.76rem;color:var(--ev-muted);margin-left:0.4rem;">${t.memberIds.length}/${t.maxTeamSize} members</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:0.35rem;">
                          <span class="ev-badge ${esc(getStatusBadgeClass(t.status))}">${esc(t.status)}</span>
                          ${(pickedParticipantIds.size > 0 && hasSlots) ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-tm-assign-here="${esc(t.id)}">+ Add Selected</button>` : ''}
                        </div>
                      </div>
                      <div class="ev-tm-cap-bar" style="margin:0.5rem 0;">
                        <div class="ev-tm-cap-fill" style="width:${pct}%;"></div>
                      </div>
                      <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
                        ${t.memberIds.length === 0 ? '<span style="font-size:0.76rem;color:var(--ev-muted);">No members yet</span>' : t.memberIds.map((mid) => {
                          const m = pMap.get(mid);
                          if (!m) return '';
                          return `
                            <span class="ev-rb-chip">
                              ${esc(m.fullName)}${mid === t.teamLeaderId ? ' (Leader)' : ''}
                              ${!ev.teamConfig.locked ? `<button type="button" class="ev-tm-chip-x" data-tm-chip-rem-p="${esc(mid)}" data-tm-chip-rem-t="${esc(t.id)}" aria-label="Remove ${esc(m.fullName)}">&times;</button>` : ''}
                            </span>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    }

    function renderTeamCardsGrid(ev) {
      if (ev.teams.length === 0) {
        return window.EventoraWorkspace.renderEmptyState({
          iconName: 'teams',
          title: 'No teams created for this event yet',
          message: ev.participants.length > 0
            ? 'Create teams manually, assign registered participants, and configure team leaders cleanly.'
            : 'Create empty/draft teams or load prototype demo participants from the Participants section to organize teams.',
          actionHTML: (!readOnly && !ev.teamConfig.locked)
            ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evTmEmptyCreateBtn">+ Create First Team</button>'
            : ''
        });
      }

      const pMap = new Map(ev.participants.map((p) => [p.id, p]));
      return `
        <div class="ev-tm-cards-grid">
          ${ev.teams.map((t) => {
            const leader = t.teamLeaderId ? pMap.get(t.teamLeaderId) : null;
            const pct = Math.min(100, Math.round((t.memberIds.length / Math.max(1, t.maxTeamSize)) * 100));
            return `
              <article class="ev-tm-card" data-tm-card="${esc(t.id)}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;">
                  <div style="min-width:0;">
                    <span class="ev-rb-id-chip" style="margin-bottom:0.35rem;">ID: <code>${esc(t.id)}</code></span>
                    <h3 class="ev-display" style="font-size:1.12rem;font-weight:600;color:var(--ev-charcoal);word-break:break-word;">${esc(t.teamName)}</h3>
                  </div>
                  <span class="ev-badge ${esc(getStatusBadgeClass(t.status))}">${esc(t.status)}</span>
                </div>

                ${t.description ? `<p style="font-size:0.82rem;color:var(--ev-muted);line-height:1.45;">${esc(t.description)}</p>` : ''}

                <div style="font-size:0.8rem;color:var(--ev-body);display:flex;flex-direction:column;gap:0.25rem;">
                  <div><strong>Leader:</strong> ${leader ? esc(leader.fullName) : '<span style="color:var(--ev-muted);">Unassigned</span>'}</div>
                  <div><strong>Size:</strong> ${t.memberIds.length} / ${t.maxTeamSize} members &bull; <strong>Created:</strong> ${esc(formatDateShort(t.createdAt))}</div>
                </div>

                <div class="ev-tm-cap-bar"><div class="ev-tm-cap-fill" style="width:${pct}%;"></div></div>

                <div class="ev-ws-event-actions" style="margin-top:auto;">
                  <button type="button" class="ev-btn ev-btn-forest ev-btn-xs" data-tm-view="${esc(t.id)}">View Team</button>
                  ${(!readOnly && !ev.teamConfig.locked) ? `
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-tm-edit="${esc(t.id)}">Edit Team</button>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-xs" data-tm-view="${esc(t.id)}">Members / Leader</button>
                    <button type="button" class="ev-btn ev-btn-outline ev-btn-xs ev-rb-btn-danger" data-tm-delete="${esc(t.id)}">Delete</button>
                  ` : ''}
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `;
    }

    function render() {
      const ev = getEv();
      const teamStats = s.getTeamStats(ev.teams, ev.teamConfig);
      const partStats = s.getParticipantStats(ev.participants);
      const activeTeam = viewingTeamId ? ev.teams.find((t) => t.id === viewingTeamId) : null;
      if (subView === 'detail' && !activeTeam) subView = 'cards';

      containerEl.innerHTML = `
        <div class="ev-ws-card ev-tm-root">
          <div class="ev-rb-header">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.4rem;">
                <span class="ev-badge ev-badge-category">Event-Scoped Teams</span>
                <span class="ev-rb-id-chip">Event ID: <code>${esc(ev.slug)}</code></span>
                <span class="ev-badge ev-badge-sample">Local Prototype Storage</span>
              </div>
              <h2 class="ev-display" style="font-size:1.5rem;font-weight:600;color:var(--ev-charcoal);">${esc(ev.name)} — Teams</h2>
              <p style="font-size:0.86rem;color:var(--ev-muted);margin-top:0.2rem;">
                Create teams, manage team leadership and member capacity, and assign registered participants.
              </p>
            </div>
            <div class="ev-rb-header-actions">
              ${manageHref ? `<a href="${esc(manageHref)}" class="ev-btn ev-btn-outline ev-btn-sm">Manage Full Event &rarr;</a>` : ''}
              ${(!readOnly && ev.teamConfig.supported) ? `
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm ${subView === 'cards' ? 'is-active-tab' : ''}" id="evTmTabCardsBtn">Team Cards (${ev.teams.length})</button>
                <button type="button" class="ev-btn ev-btn-outline ev-btn-sm ${subView === 'assign' ? 'is-active-tab' : ''}" id="evTmTabAssignBtn">Assign Participants (${partStats.unassigned})</button>
                ${!ev.teamConfig.locked ? `<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evTmCreateBtn">+ Create Team</button>` : ''}
              ` : ''}
            </div>
          </div>

          ${readOnly ? `
            <div class="ev-auth-status is-info" style="margin-bottom:1rem;">
              <span>Manager read-only scope: inspect teams, capacity, and members. Team mutations require Event Organizer permissions.</span>
            </div>
          ` : ''}

          ${feedbackMsg ? `
            <div class="ev-auth-status is-${esc(feedbackKind)}" role="status" style="margin-bottom:1rem;">
              <span>${esc(feedbackMsg)}</span>
            </div>
          ` : ''}

          ${renderRulesStrip(ev)}

          ${!ev.teamConfig.supported ? window.EventoraWorkspace.renderEmptyState({
            iconName: 'teams',
            title: 'Individual Registration Mode Active',
            message: 'This event currently uses Individual Participation format, so participants are not grouped into teams. Switch to Team Registration under Registration & Team Rules to enable team management.',
            actionHTML: (!readOnly && onJumpSection)
              ? '<button type="button" class="ev-btn ev-btn-forest ev-btn-sm" id="evTmEnableRulesBtn">Configure Team Rules in Registration &rarr;</button>'
              : ''
          }) : `
            <!-- Team Overview Metrics -->
            <div class="ev-pt-stats-grid" style="margin-bottom:1.25rem;">
              <div class="ev-stat-card"><div class="ev-stat-label">Total Teams</div><div class="ev-stat-value">${teamStats.total}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Active Teams</div><div class="ev-stat-value">${teamStats.active}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Open Slots</div><div class="ev-stat-value">${teamStats.openSlots}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Full Teams</div><div class="ev-stat-value">${teamStats.full}</div></div>
              <div class="ev-stat-card"><div class="ev-stat-label">Awaiting Members</div><div class="ev-stat-value">${teamStats.awaiting}</div></div>
            </div>

            ${subView === 'form' ? renderTeamFormPanel(ev)
              : subView === 'detail' ? renderTeamDetailsView(ev, activeTeam)
              : subView === 'assign' ? renderAssignmentBoard(ev)
              : renderTeamCardsGrid(ev)}
          `}
        </div>
      `;

      bindEvents(ev, activeTeam);
    }

    function bindEvents(ev, activeTeam) {
      containerEl.querySelector('#evTmConfigRulesBtn')?.addEventListener('click', () => {
        if (onJumpSection) onJumpSection('registration');
      });
      containerEl.querySelector('#evTmEnableRulesBtn')?.addEventListener('click', () => {
        if (onJumpSection) onJumpSection('registration');
      });

      containerEl.querySelector('#evTmTabCardsBtn')?.addEventListener('click', () => {
        subView = 'cards';
        feedbackMsg = '';
        render();
      });
      containerEl.querySelector('#evTmTabAssignBtn')?.addEventListener('click', () => {
        subView = 'assign';
        feedbackMsg = '';
        render();
      });
      containerEl.querySelector('#evTmCreateBtn')?.addEventListener('click', () => openCreateForm(ev));
      containerEl.querySelector('#evTmEmptyCreateBtn')?.addEventListener('click', () => openCreateForm(ev));
      containerEl.querySelector('#evTmAssignNewBtn')?.addEventListener('click', () => openCreateForm(ev));

      containerEl.querySelectorAll('[data-tm-view]').forEach((btn) => {
        btn.addEventListener('click', () => openTeamDetails(btn.dataset.tmView));
      });
      containerEl.querySelectorAll('[data-tm-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = ev.teams.find((t) => t.id === btn.dataset.tmEdit);
          if (target) openEditForm(ev, target);
        });
      });
      containerEl.querySelectorAll('[data-tm-delete]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = ev.teams.find((t) => t.id === btn.dataset.tmDelete);
          if (!target) return;
          window.EventoraWorkspace.openConfirm({
            title: 'Delete Team',
            body: `Delete team "${target.teamName}" (${target.memberIds.length} member(s))? Deleting this team will NOT delete participant registrations; members remain registered as unassigned.`,
            confirmLabel: 'Delete Team',
            danger: true,
            onConfirm: () => {
              const res = s.deleteTeam(slug, target.id);
              if (!res.ok) setFeedback('error', res.error);
              else {
                setFeedback('success', `Deleted team "${target.teamName}". All participant registrations remain intact.`);
                if (onUpdated) onUpdated(res.event);
              }
              subView = 'cards';
              render();
            }
          });
        });
      });

      // Form panel bindings
      if (subView === 'form') {
        const cancelForm = () => {
          subView = editingTeamId ? 'detail' : 'cards';
          formError = '';
          render();
        };
        containerEl.querySelector('#evTmFormCancelBtn')?.addEventListener('click', cancelForm);
        containerEl.querySelector('#evTmFormCancelBtn2')?.addEventListener('click', cancelForm);
        containerEl.querySelector('#evTmNameInput')?.addEventListener('input', (e) => { formDraftName = e.target.value; });
        containerEl.querySelector('#evTmDescInput')?.addEventListener('input', (e) => { formDraftDesc = e.target.value; });
        containerEl.querySelector('#evTmMaxInput')?.addEventListener('input', (e) => { formDraftMaxSize = e.target.value; });
        containerEl.querySelector('#evTmLeaderSelect')?.addEventListener('change', (e) => { formDraftLeaderId = e.target.value; });

        containerEl.querySelector('#evTmFormMemberSearch')?.addEventListener('input', (e) => {
          formMemberSearch = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const reSearch = containerEl.querySelector('#evTmFormMemberSearch');
          if (reSearch) {
            reSearch.focus();
            if (typeof pos === 'number') reSearch.setSelectionRange(pos, pos);
          }
        });

        containerEl.querySelectorAll('[data-tm-form-member]').forEach((cb) => {
          cb.addEventListener('change', () => {
            const pid = cb.dataset.tmFormMember;
            if (cb.checked) formMemberIds.add(pid);
            else {
              formMemberIds.delete(pid);
              if (formDraftLeaderId === pid) formDraftLeaderId = '';
            }
            if (ev.teamConfig.requireLeader && !formDraftLeaderId && formMemberIds.size > 0) {
              formDraftLeaderId = Array.from(formMemberIds)[0];
            }
            render();
          });
        });

        containerEl.querySelector('#evTmTeamForm')?.addEventListener('submit', (e) => {
          e.preventDefault();
          const payload = {
            teamName: formDraftName,
            description: formDraftDesc,
            maxTeamSize: formDraftMaxSize,
            memberIds: Array.from(formMemberIds),
            teamLeaderId: formDraftLeaderId || null
          };
          const res = editingTeamId
            ? s.updateTeam(slug, editingTeamId, payload)
            : s.createTeam(slug, payload);
          if (!res.ok) {
            formError = res.error;
            render();
            return;
          }
          formError = '';
          setFeedback('success', editingTeamId ? `Saved team "${payload.teamName}".` : `Created team "${payload.teamName}".`);
          viewingTeamId = res.team ? res.team.id : editingTeamId;
          subView = editingTeamId ? 'detail' : 'cards';
          if (onUpdated) onUpdated(res.event);
          render();
        });
      }

      // Details view bindings
      if (subView === 'detail' && activeTeam) {
        containerEl.querySelector('#evTmDetailBackBtn')?.addEventListener('click', () => {
          subView = 'cards';
          leaderReplacePromptForId = '';
          render();
        });
        containerEl.querySelector('#evTmDetailEditBtn')?.addEventListener('click', () => openEditForm(ev, activeTeam));
        containerEl.querySelector('#evTmDetailDeleteBtn')?.addEventListener('click', () => {
          window.EventoraWorkspace.openConfirm({
            title: 'Delete Team',
            body: `Delete team "${activeTeam.teamName}"? Members will remain registered for "${ev.name}" as unassigned participants.`,
            confirmLabel: 'Delete Team',
            danger: true,
            onConfirm: () => {
              const res = s.deleteTeam(slug, activeTeam.id);
              subView = 'cards';
              if (!res.ok) setFeedback('error', res.error);
              else {
                setFeedback('success', `Deleted team "${activeTeam.teamName}". Registrations kept active.`);
                if (onUpdated) onUpdated(res.event);
              }
              render();
            }
          });
        });

        containerEl.querySelectorAll('[data-tm-make-leader]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const res = s.setTeamLeader(slug, activeTeam.id, btn.dataset.tmMakeLeader);
            if (!res.ok) setFeedback('error', res.error);
            else {
              setFeedback('success', 'Updated Team Leader.');
              if (onUpdated) onUpdated(res.event);
            }
            render();
          });
        });

        containerEl.querySelectorAll('[data-tm-remove-member]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const pid = btn.dataset.tmRemoveMember;
            const res = s.removeMemberFromTeam(slug, activeTeam.id, pid);
            if (!res.ok && res.requiresLeaderSelection) {
              leaderReplacePromptForId = pid;
              render();
              return;
            }
            if (!res.ok) setFeedback('error', res.error);
            else {
              setFeedback('success', 'Removed member from team. Participant remains registered for this event.');
              if (onUpdated) onUpdated(res.event);
            }
            render();
          });
        });

        containerEl.querySelector('#evTmConfirmReplaceLeaderBtn')?.addEventListener('click', () => {
          const repSel = containerEl.querySelector('#evTmReplaceLeaderSelect');
          if (!repSel || !repSel.value || !leaderReplacePromptForId) return;
          const res = s.removeMemberFromTeam(slug, activeTeam.id, leaderReplacePromptForId, repSel.value);
          leaderReplacePromptForId = '';
          if (!res.ok) setFeedback('error', res.error);
          else {
            setFeedback('success', 'Reassigned Team Leader and removed member cleanly.');
            if (onUpdated) onUpdated(res.event);
          }
          render();
        });
        containerEl.querySelector('#evTmCancelReplaceLeaderBtn')?.addEventListener('click', () => {
          leaderReplacePromptForId = '';
          render();
        });

        containerEl.querySelector('#evTmDetailAddSearch')?.addEventListener('input', (e) => {
          detailAddSearch = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const reSearch = containerEl.querySelector('#evTmDetailAddSearch');
          if (reSearch) {
            reSearch.focus();
            if (typeof pos === 'number') reSearch.setSelectionRange(pos, pos);
          }
        });
        containerEl.querySelector('#evTmDetailAddBtn')?.addEventListener('click', () => {
          const sel = containerEl.querySelector('#evTmDetailAddSelect');
          if (!sel || !sel.value) return;
          const res = s.assignMembersToTeam(slug, activeTeam.id, [sel.value]);
          if (!res.ok) setFeedback('error', res.error);
          else {
            setFeedback('success', 'Added participant to team.');
            if (onUpdated) onUpdated(res.event);
          }
          render();
        });
      }

      // Assignment board bindings
      if (subView === 'assign') {
        containerEl.querySelector('#evTmUnassignedSearch')?.addEventListener('input', (e) => {
          unassignedSearch = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const reSearch = containerEl.querySelector('#evTmUnassignedSearch');
          if (reSearch) {
            reSearch.focus();
            if (typeof pos === 'number') reSearch.setSelectionRange(pos, pos);
          }
        });

        containerEl.querySelector('#evTmClearPickBtn')?.addEventListener('click', () => {
          pickedParticipantIds.clear();
          render();
        });

        containerEl.querySelectorAll('[data-tm-pick-p]').forEach((cb) => {
          cb.addEventListener('change', () => {
            if (cb.checked) pickedParticipantIds.add(cb.dataset.tmPickP);
            else pickedParticipantIds.delete(cb.dataset.tmPickP);
            render();
          });
        });

        function performAssign(targetTeamId, memberIds) {
          const res = s.assignMembersToTeam(slug, targetTeamId, memberIds);
          if (!res.ok) setFeedback('error', res.error);
          else {
            pickedParticipantIds.clear();
            setFeedback('success', `Assigned ${memberIds.length} participant(s) to team.`);
            if (onUpdated) onUpdated(res.event);
          }
          render();
        }

        containerEl.querySelector('#evTmBulkAssignBtn')?.addEventListener('click', () => {
          const sel = containerEl.querySelector('#evTmBulkTargetSelect');
          if (!sel || !sel.value || pickedParticipantIds.size === 0) return;
          performAssign(sel.value, Array.from(pickedParticipantIds));
        });

        containerEl.querySelectorAll('[data-tm-assign-here]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (pickedParticipantIds.size === 0) return;
            performAssign(btn.dataset.tmAssignHere, Array.from(pickedParticipantIds));
          });
        });

        containerEl.querySelectorAll('[data-tm-chip-rem-p]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const pid = btn.dataset.tmChipRemP;
            const tid = btn.dataset.tmChipRemT;
            const res = s.removeMemberFromTeam(slug, tid, pid);
            if (!res.ok && res.requiresLeaderSelection) {
              viewingTeamId = tid;
              leaderReplacePromptForId = pid;
              subView = 'detail';
              render();
              return;
            }
            if (!res.ok) setFeedback('error', res.error);
            else {
              setFeedback('success', 'Removed participant from team.');
              if (onUpdated) onUpdated(res.event);
            }
            render();
          });
        });

        // Accessible Drag & Drop enhancement
        containerEl.querySelectorAll('[data-tm-drag-p]').forEach((item) => {
          item.addEventListener('dragstart', (e) => {
            dragParticipantId = item.dataset.tmDragP;
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', dragParticipantId);
            }
          });
          item.addEventListener('dragend', () => { dragParticipantId = ''; });
        });
        containerEl.querySelectorAll('[data-tm-drop-team]').forEach((card) => {
          card.addEventListener('dragover', (e) => {
            if (ev.teamConfig.locked || !dragParticipantId) return;
            e.preventDefault();
            card.classList.add('is-drag-over');
          });
          card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
          card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('is-drag-over');
            const pid = dragParticipantId || e.dataTransfer?.getData('text/plain');
            dragParticipantId = '';
            if (pid) performAssign(card.dataset.tmDropTeam, [pid]);
          });
        });
      }
    }

    render();
    return { refresh: render };
  }

  return {
    mountParticipants,
    mountTeams
  };
})();

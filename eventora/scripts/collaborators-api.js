/* ==========================================================================
   EVENTORA PHASE 10: COLLABORATORS API MODULE
   Event-scoped collaborator assignments and granular role permissions.
   ========================================================================== */

window.EventoraCollaboratorsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  const ROLE_DEFAULT_PERMS = {
    co_organizer: { edit_event: true, manage_registrations: true, manage_participants: true, manage_teams: true, manage_rounds: true, manage_content: true, evaluate: true, publish_results: true, manage_settings: true },
    manager: { edit_event: false, manage_registrations: true, manage_participants: true, manage_teams: true, manage_rounds: true, manage_content: true, evaluate: true, publish_results: false, manage_settings: false },
    evaluator: { edit_event: false, manage_registrations: false, manage_participants: false, manage_teams: false, manage_rounds: false, manage_content: false, evaluate: true, publish_results: false, manage_settings: false },
    coordinator: { edit_event: false, manage_registrations: true, manage_participants: true, manage_teams: true, manage_rounds: false, manage_content: false, evaluate: false, publish_results: false, manage_settings: false },
    viewer: { edit_event: false, manage_registrations: false, manage_participants: false, manage_teams: false, manage_rounds: false, manage_content: false, evaluate: false, publish_results: false, manage_settings: false }
  };

  async function fetchCollaborators(eventId) {
    return runDb(async (sb) => {
      return sb
        .from('event_collaborators')
        .select('*, profile:profiles!event_collaborators_user_id_fkey(id, full_name, email, avatar_url, platform_role)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
    }, 'Failed to load event collaborators.');
  }

  async function addCollaborator(eventId, { email, userId, collaboratorRole, permissions }) {
    const cleanRole = ROLE_DEFAULT_PERMS[collaboratorRole] ? collaboratorRole : 'manager';
    const cleanPerms = { ...ROLE_DEFAULT_PERMS[cleanRole], ...(permissions || {}) };
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const actorId = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null;
      let targetUid = userId || null;
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!targetUid && cleanEmail) {
        const prof = await sb.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
        if (prof.data && prof.data.id) targetUid = prof.data.id;
      }

      const row = {
        event_id: eventId,
        user_id: targetUid,
        invited_email: cleanEmail,
        collaborator_role: cleanRole,
        permissions: cleanPerms,
        invited_by: actorId,
        invitation_status: targetUid ? 'accepted' : 'pending'
      };
      const res = await sb.from('event_collaborators').insert(row).select('*').single();
      if (!res.error && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'collaborator_added', 'collaborator', res.data.id, { role: cleanRole });
      }
      return res;
    }, 'Failed to add event collaborator.');
  }

  async function updateCollaboratorPermissions(collabId, collaboratorRole, permissions) {
    return runDb(async (sb) => {
      const patch = {};
      if (collaboratorRole && ROLE_DEFAULT_PERMS[collaboratorRole]) patch.collaborator_role = collaboratorRole;
      if (permissions && typeof permissions === 'object') patch.permissions = permissions;
      return sb.from('event_collaborators').update(patch).eq('id', collabId).select('*').single();
    }, 'Failed to update collaborator permissions.');
  }

  async function updateInvitationStatus(collabId, invitationStatus) {
    return runDb(async (sb) => {
      return sb.from('event_collaborators').update({ invitation_status: invitationStatus }).eq('id', collabId).select('*').single();
    }, 'Failed to update invitation status.');
  }

  async function removeCollaborator(collabId) {
    return runDb(async (sb) => {
      return sb.from('event_collaborators').delete().eq('id', collabId);
    }, 'Failed to remove collaborator.');
  }

  return {
    ROLE_DEFAULT_PERMS,
    fetchCollaborators,
    addCollaborator,
    updateCollaboratorPermissions,
    updateInvitationStatus,
    removeCollaborator
  };
})();

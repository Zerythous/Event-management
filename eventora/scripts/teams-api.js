/* ==========================================================================
   EVENTORA PHASE 10: TEAMS & TEAM MEMBERS API MODULE
   ========================================================================== */

window.EventoraTeamsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  function toDbTeamStatus(st) {
    if (st === 'Active' || st === 'Awaiting Members' || !st) return 'Open';
    if (['Open', 'Full', 'Locked', 'Disbanded'].includes(st)) return st;
    return 'Open';
  }

  function mapTeamsAndMembers(teamsRows, memberRows, regRows) {
    const regByUser = new Map((regRows || []).map((r) => [r.userId || r.user_id, r]));
    return (teamsRows || []).map((t) => {
      const activeMembers = (memberRows || []).filter((m) => m.team_id === t.id && m.membership_status === 'active');
      const memberRegIds = activeMembers
        .map((m) => {
          const r = regByUser.get(m.user_id);
          return r ? (r.id || r.dbId) : m.user_id;
        })
        .filter(Boolean);
      const leaderReg = regByUser.get(t.leader_id);
      return {
        dbId: t.id,
        id: t.id,
        eventId: t.event_id,
        teamName: t.name,
        name: t.name,
        teamCode: t.team_code,
        code: t.team_code,
        leaderUserId: t.leader_id,
        teamLeaderId: leaderReg ? (leaderReg.id || leaderReg.dbId) : t.leader_id,
        memberIds: memberRegIds,
        memberUserIds: activeMembers.map((m) => m.user_id),
        status: t.team_status || 'Open',
        locked: t.team_status === 'Locked',
        createdAt: t.created_at
      };
    });
  }

  async function fetchEventTeams(eventId, regRows) {
    return runDb(async (sb) => {
      const tRes = await sb.from('teams').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
      if (tRes.error) return tRes;
      const mRes = await sb.from('team_members').select('*').eq('event_id', eventId).eq('membership_status', 'active');
      if (mRes.error) return mRes;
      return { data: mapTeamsAndMembers(tRes.data, mRes.data, regRows), error: null };
    }, 'Failed to fetch event teams.');
  }

  async function createTeam(eventId, { name, teamCode, leaderId, registrationId }) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = leaderId || (authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '');
      if (!uid) return { data: null, error: { message: 'Authentication required to create a team.' } };

      const code = String(teamCode || ('TM-' + Math.random().toString(36).slice(2, 7).toUpperCase())).trim().toUpperCase();
      const tRes = await sb.from('teams').insert({
        event_id: eventId,
        name: String(name || 'Team').trim(),
        team_code: code,
        leader_id: uid,
        team_status: 'Open'
      }).select('*').single();
      if (tRes.error) return tRes;

      const mRes = await sb.from('team_members').insert({
        team_id: tRes.data.id,
        event_id: eventId,
        user_id: uid,
        member_role: 'leader',
        membership_status: 'active'
      });
      if (mRes.error) return mRes;

      if (registrationId) {
        await sb.from('registrations').update({ team_id: tRes.data.id, registration_type: 'team_leader' }).eq('id', registrationId);
      }
      if (window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'team_created', 'team', tRes.data.id, { name: tRes.data.name });
      }
      return { data: tRes.data, error: null };
    }, 'Failed to create team.');
  }

  async function updateTeam(teamId, patch) {
    return runDb(async (sb) => {
      const dbPatch = {};
      if (patch.name !== undefined || patch.teamName !== undefined) dbPatch.name = String(patch.name || patch.teamName).trim();
      if (patch.teamStatus !== undefined || patch.status !== undefined) dbPatch.team_status = toDbTeamStatus(patch.teamStatus || patch.status);
      if (patch.leaderId !== undefined) dbPatch.leader_id = patch.leaderId;
      return sb.from('teams').update(dbPatch).eq('id', teamId).select('*').single();
    }, 'Failed to update team.');
  }

  async function deleteTeam(teamId) {
    return runDb(async (sb) => sb.from('teams').delete().eq('id', teamId), 'Failed to delete team.');
  }

  async function addMember({ teamId, eventId, userId, registrationId, role }) {
    return runDb(async (sb) => {
      const res = await sb.from('team_members').upsert({
        team_id: teamId,
        event_id: eventId,
        user_id: userId,
        member_role: role || 'member',
        membership_status: 'active'
      }, { onConflict: 'team_id,user_id' }).select('*').single();
      if (res.error) return res;
      if (registrationId) {
        await sb.from('registrations').update({ team_id: teamId, registration_type: 'team_member' }).eq('id', registrationId);
      }
      return res;
    }, 'Failed to add team member.');
  }

  async function removeMember({ teamId, userId, registrationId }) {
    return runDb(async (sb) => {
      const res = await sb.from('team_members').update({ membership_status: 'left' }).eq('team_id', teamId).eq('user_id', userId);
      if (res.error) return res;
      if (registrationId) {
        await sb.from('registrations').update({ team_id: null, registration_type: 'individual' }).eq('id', registrationId);
      }
      return { data: true, error: null };
    }, 'Failed to leave or remove team member.');
  }

  async function updateLeader(teamId, newLeaderUserId) {
    return runDb(async (sb) => {
      await sb.from('team_members').update({ member_role: 'member' }).eq('team_id', teamId).eq('member_role', 'leader');
      await sb.from('team_members').update({ member_role: 'leader' }).eq('team_id', teamId).eq('user_id', newLeaderUserId);
      return sb.from('teams').update({ leader_id: newLeaderUserId }).eq('id', teamId).select('*').single();
    }, 'Failed to assign team leader.');
  }

  return {
    mapTeamsAndMembers,
    fetchEventTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    updateLeader
  };
})();

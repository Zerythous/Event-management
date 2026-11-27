/* ==========================================================================
   EVENTORA PHASE 10: REGISTRATIONS API MODULE
   ========================================================================== */

window.EventoraRegistrationsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  function toDbStatus(uiStatus) {
    const clean = String(uiStatus || '').trim();
    if (clean === 'Pending') return 'Pending Approval';
    if (['Approved', 'Pending Approval', 'Waitlisted', 'Rejected', 'Cancelled'].includes(clean)) return clean;
    return 'Approved';
  }

  function fromDbStatus(dbStatus) {
    if (dbStatus === 'Pending Approval') return 'Pending';
    return dbStatus || 'Approved';
  }

  function mapRowToParticipant(row) {
    const d = row.registration_data && typeof row.registration_data === 'object' ? row.registration_data : {};
    const prof = row.profile && typeof row.profile === 'object' ? row.profile : {};
    const uiStatus = fromDbStatus(row.registration_status);
    return {
      dbId: row.id,
      id: row.id,
      registrationId: row.registration_code || row.id,
      userId: row.user_id,
      name: d.fullName || prof.full_name || d.email || 'Participant',
      fullName: d.fullName || prof.full_name || '',
      email: (d.email || prof.email || '').toLowerCase(),
      phone: d.phone || '',
      institution: d.institution || prof.institution || '',
      department: d.department || prof.department || '',
      city: d.city || prof.city || '',
      yearOfStudy: d.yearOfStudy || '',
      participantType: d.participantType || 'Student',
      registrationType: row.registration_type || 'individual',
      registrationStatus: uiStatus,
      teamId: row.team_id || null,
      submittedData: d,
      registeredAt: row.submitted_at || row.created_at,
      approvedAt: row.approved_at || null,
      cancelledAt: row.cancelled_at || null
    };
  }

  async function fetchEventRegistrations(eventId) {
    return runDb(async (sb) => {
      const res = await sb
        .from('registrations')
        .select('*, profile:profiles(id, full_name, email, institution, department, city, avatar_url)')
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: false });
      if (res.error) return res;
      return { data: (res.data || []).map(mapRowToParticipant), error: null };
    }, 'Failed to fetch event registrations.');
  }

  async function fetchUserRegistrations(userId) {
    return runDb(async (sb) => {
      let uid = userId;
      if (!uid) {
        const authRes = await sb.auth.getUser();
        uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      }
      if (!uid) return { data: [], error: { message: 'Authentication required to fetch registrations.' } };
      const res = await sb
        .from('registrations')
        .select('*, event:events(*)')
        .eq('user_id', uid)
        .order('submitted_at', { ascending: false });
      if (res.error) return res;
      return { data: res.data || [], error: null };
    }, 'Failed to fetch your event registrations.');
  }

  async function registerParticipant(eventId, { registrationType, registrationStatus, registrationData, teamId }) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      if (!uid) return { data: null, error: { message: 'Sign in before registering for an event.' } };

      const payload = {
        event_id: eventId,
        user_id: uid,
        registration_type: registrationType || 'individual',
        registration_status: registrationStatus || 'Approved',
        registration_data: registrationData || {},
        team_id: teamId || null,
        approved_at: (registrationStatus || 'Approved') === 'Approved' ? new Date().toISOString() : null
      };
      const res = await sb.from('registrations').insert(payload).select('*').single();
      if (res.error) return res;
      if (window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, 'registration_submitted', 'registration', res.data.id, { status: res.data.registration_status });
      }
      return { data: mapRowToParticipant(res.data), error: null };
    }, 'Failed to submit registration.');
  }

  async function setRegistrationStatus(regId, status, eventId) {
    const dbStatus = toDbStatus(status);
    return runDb(async (sb) => {
      const patch = { registration_status: dbStatus };
      if (dbStatus === 'Approved') patch.approved_at = new Date().toISOString();
      if (dbStatus === 'Cancelled') patch.cancelled_at = new Date().toISOString();
      const res = await sb.from('registrations').update(patch).eq('id', regId).select('*').single();
      if (res.error) return res;
      if (eventId && window.EventoraEventsApi) {
        await window.EventoraEventsApi.logActivity(eventId, `registration_${dbStatus.toLowerCase().replace(/\s+/g, '_')}`, 'registration', regId, {});
      }
      return { data: mapRowToParticipant(res.data), error: null };
    }, `Failed to mark registration as ${status}.`);
  }

  async function updateRegistrationInfo(regId, patchData) {
    return runDb(async (sb) => {
      const patch = {};
      if (patchData.registrationData !== undefined) patch.registration_data = patchData.registrationData;
      if (patchData.teamId !== undefined) patch.team_id = patchData.teamId;
      if (patchData.registrationType !== undefined) patch.registration_type = patchData.registrationType;
      const res = await sb.from('registrations').update(patch).eq('id', regId).select('*').single();
      if (res.error) return res;
      return { data: mapRowToParticipant(res.data), error: null };
    }, 'Failed to update registration details.');
  }

  return {
    mapRowToParticipant,
    fetchEventRegistrations,
    fetchUserRegistrations,
    registerParticipant,
    approveRegistration: (id, evId) => setRegistrationStatus(id, 'Approved', evId),
    rejectRegistration: (id, evId) => setRegistrationStatus(id, 'Rejected', evId),
    waitlistRegistration: (id, evId) => setRegistrationStatus(id, 'Waitlisted', evId),
    cancelRegistration: (id, evId) => setRegistrationStatus(id, 'Cancelled', evId),
    setRegistrationStatus,
    updateRegistrationInfo
  };
})();

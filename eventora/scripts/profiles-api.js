/* ==========================================================================
   EVENTORA PHASE 10: PROFILES API MODULE
   Manages authenticated user profile reads/updates against public.profiles.
   ========================================================================== */

window.EventoraProfilesApi = (function () {
  function runDb(fn, msg) {
    if (!window.EventoraSupabase || !window.EventoraSupabase.db) {
      return Promise.resolve({ ok: false, error: 'Supabase client module is unavailable.', data: null });
    }
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  function validateProfileInput(patch) {
    const p = patch || {};
    if (p.fullName !== undefined && String(p.fullName).trim().length < 2) {
      return { valid: false, error: 'Full name must be at least 2 characters.' };
    }
    if (p.bio !== undefined && String(p.bio).length > 800) {
      return { valid: false, error: 'Bio must be 800 characters or fewer.' };
    }
    return { valid: true, error: '' };
  }

  function mapRowToProfile(row) {
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.full_name || '',
      email: row.email || '',
      institution: row.institution || '',
      department: row.department || '',
      city: row.city || '',
      bio: row.bio || '',
      avatarUrl: row.avatar_url || '',
      platformRole: row.platform_role || 'participant',
      requestedRole: row.requested_role || 'participant',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    };
  }

  async function fetchProfile(userId) {
    return runDb(async (sb) => {
      let uid = userId;
      if (!uid) {
        const authRes = await sb.auth.getUser();
        uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      }
      if (!uid) return { data: null, error: { message: 'Authentication required to fetch profile.' } };
      const res = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (res.error) return res;
      return { data: mapRowToProfile(res.data), error: null };
    }, 'Failed to fetch user profile.');
  }

  async function ensureProfile(user) {
    if (!user || !user.id) return { ok: false, error: 'Authenticated user required.' };
    return runDb(async (sb) => {
      const existing = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (existing.error) return existing;
      if (existing.data) return { data: mapRowToProfile(existing.data), error: null };

      const reqRole = ['participant', 'organizer', 'manager'].includes(user.rolePreference || user.role)
        ? (user.rolePreference || user.role)
        : 'participant';
      const payload = {
        id: user.id,
        full_name: String(user.fullName || user.email || 'Eventora User').trim(),
        email: String(user.email || '').trim().toLowerCase(),
        institution: String(user.institution || '').trim(),
        department: String(user.department || '').trim(),
        city: String(user.city || '').trim(),
        bio: String(user.bio || '').trim(),
        avatar_url: String(user.avatarUrl || '').trim(),
        platform_role: reqRole,
        requested_role: reqRole
      };
      const ins = await sb.from('profiles').insert(payload).select('*').single();
      if (ins.error) return ins;
      return { data: mapRowToProfile(ins.data), error: null };
    }, 'Failed to provision user profile.');
  }

  async function updateProfile(userId, patch) {
    const check = validateProfileInput(patch);
    if (!check.valid) return { ok: false, error: check.error, data: null };

    return runDb(async (sb) => {
      let uid = userId;
      if (!uid) {
        const authRes = await sb.auth.getUser();
        uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : '';
      }
      if (!uid) return { data: null, error: { message: 'Authentication required to update profile.' } };

      const dbPatch = {};
      if (patch.fullName !== undefined) dbPatch.full_name = String(patch.fullName).trim();
      if (patch.institution !== undefined) dbPatch.institution = String(patch.institution).trim();
      if (patch.department !== undefined) dbPatch.department = String(patch.department).trim();
      if (patch.city !== undefined) dbPatch.city = String(patch.city).trim();
      if (patch.bio !== undefined) dbPatch.bio = String(patch.bio).trim();
      if (patch.avatarUrl !== undefined) dbPatch.avatar_url = String(patch.avatarUrl).trim();
      if (patch.requestedRole !== undefined && ['participant', 'organizer', 'manager'].includes(patch.requestedRole)) {
        dbPatch.requested_role = patch.requestedRole;
      }

      const res = await sb.from('profiles').update(dbPatch).eq('id', uid).select('*').single();
      if (res.error) return res;
      return { data: mapRowToProfile(res.data), error: null };
    }, 'Failed to update profile.');
  }

  return {
    validateProfileInput,
    mapRowToProfile,
    fetchProfile,
    ensureProfile,
    updateProfile
  };
})();

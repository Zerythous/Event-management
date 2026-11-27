/* ==========================================================================
   EVENTORA PHASE 10: ANNOUNCEMENTS API MODULE
   ========================================================================== */

window.EventoraAnnouncementsApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchAnnouncements(eventId, roundDbId) {
    return runDb(async (sb) => {
      let query = sb
        .from('event_announcements')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (roundDbId) query = query.or(`round_id.eq.${roundDbId},round_id.is.null`);
      return query;
    }, 'Failed to load event announcements.');
  }

  async function createAnnouncement({ eventId, roundId, title, message, audience, publishNow }) {
    return runDb(async (sb) => {
      const authRes = await sb.auth.getUser();
      const uid = authRes && authRes.data && authRes.data.user ? authRes.data.user.id : null;
      const row = {
        event_id: eventId,
        round_id: roundId || null,
        created_by: uid,
        title: String(title || 'Live Announcement').trim(),
        message: String(message || '').trim(),
        audience: audience || 'all_participants',
        published_at: publishNow === false ? null : new Date().toISOString()
      };
      const res = await sb.from('event_announcements').insert(row).select('*').single();
      if (!res.error && window.EventoraEventsApi && row.published_at) {
        await window.EventoraEventsApi.logActivity(eventId, 'announcement_published', 'announcement', res.data.id, { title: row.title });
      }
      return res;
    }, 'Failed to publish announcement.');
  }

  async function updateAnnouncement(annId, patch) {
    return runDb(async (sb) => {
      const dbPatch = {};
      if (patch.title !== undefined) dbPatch.title = String(patch.title).trim();
      if (patch.message !== undefined) dbPatch.message = String(patch.message).trim();
      if (patch.audience !== undefined) dbPatch.audience = patch.audience;
      if (patch.publishNow === true) dbPatch.published_at = new Date().toISOString();
      return sb.from('event_announcements').update(dbPatch).eq('id', annId).select('*').single();
    }, 'Failed to update announcement.');
  }

  async function deleteAnnouncement(annId) {
    return runDb(async (sb) => sb.from('event_announcements').delete().eq('id', annId), 'Failed to delete announcement.');
  }

  return {
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
  };
})();

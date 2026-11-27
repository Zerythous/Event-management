/* ==========================================================================
   EVENTORA PHASE 10: LEADERBOARD API MODULE
   Reads persisted rankings via get_published_leaderboard() SQL function.
   ========================================================================== */

window.EventoraLeaderboardApi = (function () {
  function runDb(fn, msg) {
    return window.EventoraSupabase.db.runQuery(fn, msg);
  }

  async function fetchLeaderboard(eventId, roundDbId) {
    return runDb(async (sb) => {
      return sb.rpc('get_published_leaderboard', {
        p_event_id: eventId,
        p_round_id: roundDbId || null
      });
    }, 'Failed to load leaderboard rankings.');
  }

  return {
    fetchRoundLeaderboard: (eventId, roundDbId) => fetchLeaderboard(eventId, roundDbId),
    fetchOverallLeaderboard: (eventId) => fetchLeaderboard(eventId, null),
    fetchPublishedLeaderboard: (eventId, roundDbId) => fetchLeaderboard(eventId, roundDbId || null),
    fetchTeamLeaderboard: async (eventId, roundDbId) => {
      const res = await fetchLeaderboard(eventId, roundDbId || null);
      if (!res.ok) return res;
      return {
        ...res,
        data: (res.data || []).filter((row) => row.target_kind === 'team')
      };
    }
  };
})();

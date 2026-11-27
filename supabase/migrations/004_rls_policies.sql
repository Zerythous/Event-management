-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 004_rls_policies.sql
-- Description: Complete Table-by-Table Row Level Security (RLS) & Grant Matrix
-- Author: Eventora Platform Architecture Team
-- ============================================================================

-- Baseline: Revoke all default public permissions across the public schema
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY p_profiles_sel ON public.profiles FOR SELECT USING (public.can_view_profile(id));
CREATE POLICY p_profiles_ins ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() AND (platform_role = 'participant' OR public.is_super_admin()));
CREATE POLICY p_profiles_upd ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY p_profiles_del ON public.profiles FOR DELETE USING (public.is_super_admin());

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
-- Column-level privilege restrictions: ordinary users cannot read or modify platform_role
GRANT SELECT (id, full_name, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT INSERT (id, full_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Grants for safe public profiles projection view
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT ALL ON public.public_profiles TO service_role;

-- ----------------------------------------------------------------------------
-- 2. profile_private_data
-- ----------------------------------------------------------------------------
ALTER TABLE public.profile_private_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_private_data FORCE ROW LEVEL SECURITY;

CREATE POLICY p_pdata_sel ON public.profile_private_data FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY p_pdata_ins ON public.profile_private_data FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY p_pdata_upd ON public.profile_private_data FOR UPDATE USING (user_id = auth.uid() OR public.is_super_admin()) WITH CHECK (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY p_pdata_del ON public.profile_private_data FOR DELETE USING (public.is_super_admin());

REVOKE ALL ON public.profile_private_data FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_private_data TO authenticated;
GRANT ALL ON public.profile_private_data TO service_role;

-- ----------------------------------------------------------------------------
-- 3. events
-- ----------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

CREATE POLICY p_events_sel ON public.events FOR SELECT USING (status IN ('published', 'live', 'completed') OR public.is_event_admin(id));
CREATE POLICY p_events_ins ON public.events FOR INSERT WITH CHECK (created_by = auth.uid() OR public.is_super_admin());
CREATE POLICY p_events_upd ON public.events FOR UPDATE USING (public.is_event_admin(id)) WITH CHECK (public.is_event_admin(id));
CREATE POLICY p_events_del ON public.events FOR DELETE USING (created_by = auth.uid() OR public.is_super_admin());

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

-- ----------------------------------------------------------------------------
-- 4. event_collaborators
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators FORCE ROW LEVEL SECURITY;

CREATE POLICY p_ec_sel ON public.event_collaborators FOR SELECT USING (public.is_event_admin(event_id) OR user_id = auth.uid());
CREATE POLICY p_ec_ins ON public.event_collaborators FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_ec_upd ON public.event_collaborators FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_ec_del ON public.event_collaborators FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_collaborators TO authenticated;
GRANT ALL ON public.event_collaborators TO service_role;

-- ----------------------------------------------------------------------------
-- 5. collaborator_round_permissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.collaborator_round_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_round_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_crp_sel ON public.collaborator_round_permissions FOR SELECT USING (public.is_event_admin(event_id) OR EXISTS (SELECT 1 FROM public.event_collaborators ec WHERE ec.id = collaborator_id AND ec.user_id = auth.uid()));
CREATE POLICY p_crp_ins ON public.collaborator_round_permissions FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_crp_upd ON public.collaborator_round_permissions FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_crp_del ON public.collaborator_round_permissions FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborator_round_permissions TO authenticated;
GRANT ALL ON public.collaborator_round_permissions TO service_role;

-- ----------------------------------------------------------------------------
-- 6. event_invitations
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY p_inv_sel ON public.event_invitations FOR SELECT USING (public.is_event_admin(event_id));
CREATE POLICY p_inv_ins ON public.event_invitations FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_inv_upd ON public.event_invitations FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_inv_del ON public.event_invitations FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invitations TO authenticated;
GRANT ALL ON public.event_invitations TO service_role;

-- ----------------------------------------------------------------------------
-- 7. event_invitation_rounds
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_invitation_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitation_rounds FORCE ROW LEVEL SECURITY;

CREATE POLICY p_invr_sel ON public.event_invitation_rounds FOR SELECT USING (public.is_event_admin(event_id));
CREATE POLICY p_invr_ins ON public.event_invitation_rounds FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_invr_upd ON public.event_invitation_rounds FOR UPDATE USING (FALSE);
CREATE POLICY p_invr_del ON public.event_invitation_rounds FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, DELETE ON public.event_invitation_rounds TO authenticated;
GRANT ALL ON public.event_invitation_rounds TO service_role;

-- ----------------------------------------------------------------------------
-- 8. teams (Public squad directory)
-- ----------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams FORCE ROW LEVEL SECURITY;

CREATE POLICY p_teams_sel ON public.teams FOR SELECT USING (status = 'approved' OR public.is_event_admin(event_id) OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()));
CREATE POLICY p_teams_ins ON public.teams FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_teams_upd ON public.teams FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_teams_del ON public.teams FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT ON public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

-- ----------------------------------------------------------------------------
-- 9. team_auth_credentials (Private credentials vault - Directive 2)
-- ----------------------------------------------------------------------------
ALTER TABLE public.team_auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_auth_credentials FORCE ROW LEVEL SECURITY;

CREATE POLICY p_team_auth_deny ON public.team_auth_credentials FOR ALL USING (FALSE);

REVOKE ALL ON public.team_auth_credentials FROM anon, authenticated;
GRANT ALL ON public.team_auth_credentials TO service_role;

-- ----------------------------------------------------------------------------
-- 10. team_members
-- ----------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members FORCE ROW LEVEL SECURITY;

CREATE POLICY p_tm_sel ON public.team_members FOR SELECT USING (public.can_view_team_member(team_id, event_id));
CREATE POLICY p_tm_ins ON public.team_members FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_tm_upd ON public.team_members FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_tm_del ON public.team_members FOR DELETE USING (public.is_event_admin(event_id));

REVOKE ALL ON public.team_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

-- ----------------------------------------------------------------------------
-- 11. team_sessions (Server-side session store)
-- ----------------------------------------------------------------------------
ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_ts_deny ON public.team_sessions FOR ALL USING (FALSE);

REVOKE ALL ON public.team_sessions FROM anon, authenticated;
GRANT ALL ON public.team_sessions TO service_role;

-- ----------------------------------------------------------------------------
-- 12. event_rounds
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rounds FORCE ROW LEVEL SECURITY;

CREATE POLICY p_rounds_sel ON public.event_rounds FOR SELECT USING (status != 'scheduled' OR public.is_event_admin(event_id));
CREATE POLICY p_rounds_ins ON public.event_rounds FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_rounds_upd ON public.event_rounds FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_rounds_del ON public.event_rounds FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT ON public.event_rounds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rounds TO authenticated;
GRANT ALL ON public.event_rounds TO service_role;

-- ----------------------------------------------------------------------------
-- 13. round_participations
-- ----------------------------------------------------------------------------
ALTER TABLE public.round_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_participations FORCE ROW LEVEL SECURITY;

CREATE POLICY p_part_sel ON public.round_participations FOR SELECT USING (public.is_event_admin(event_id) OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = round_participations.team_id AND tm.user_id = auth.uid()));
CREATE POLICY p_part_ins ON public.round_participations FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_part_upd ON public.round_participations FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_part_del ON public.round_participations FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_participations TO authenticated;
GRANT ALL ON public.round_participations TO service_role;

-- ----------------------------------------------------------------------------
-- 14. round_lifecycle_events
-- ----------------------------------------------------------------------------
ALTER TABLE public.round_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_lifecycle_events FORCE ROW LEVEL SECURITY;

CREATE POLICY p_rle_sel ON public.round_lifecycle_events FOR SELECT USING (public.is_event_admin(event_id));
CREATE POLICY p_rle_ins ON public.round_lifecycle_events FOR INSERT WITH CHECK (public.is_event_admin(event_id) OR public.can_collaborator_moderate(round_id));
CREATE POLICY p_rle_upd ON public.round_lifecycle_events FOR UPDATE USING (FALSE);
CREATE POLICY p_rle_del ON public.round_lifecycle_events FOR DELETE USING (public.is_super_admin());

GRANT SELECT, INSERT ON public.round_lifecycle_events TO authenticated;
GRANT ALL ON public.round_lifecycle_events TO service_role;

-- ----------------------------------------------------------------------------
-- 15. event_notifications (Targeted Notification Filtering - Directive 12)
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY p_notif_sel ON public.event_notifications FOR SELECT USING (
  (target_team_id IS NULL AND (public.is_event_admin(event_id) OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.event_id = event_notifications.event_id AND tm.user_id = auth.uid())))
  OR (target_team_id IS NOT NULL AND (public.is_event_admin(event_id) OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = event_notifications.target_team_id AND tm.user_id = auth.uid())))
);
CREATE POLICY p_notif_ins ON public.event_notifications FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_notif_upd ON public.event_notifications FOR UPDATE USING (public.is_event_admin(event_id)) WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_notif_del ON public.event_notifications FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT ON public.event_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_notifications TO authenticated;
GRANT ALL ON public.event_notifications TO service_role;

-- ----------------------------------------------------------------------------
-- 16. quiz_questions
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_qq_sel ON public.quiz_questions FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live'));
CREATE POLICY p_qq_ins ON public.quiz_questions FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qq_upd ON public.quiz_questions FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qq_del ON public.quiz_questions FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.quiz_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;

-- ----------------------------------------------------------------------------
-- 17. quiz_options
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options FORCE ROW LEVEL SECURITY;

CREATE POLICY p_qo_sel ON public.quiz_options FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live'));
CREATE POLICY p_qo_ins ON public.quiz_options FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qo_upd ON public.quiz_options FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qo_del ON public.quiz_options FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.quiz_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT ALL ON public.quiz_options TO service_role;

-- ----------------------------------------------------------------------------
-- 18. quiz_answers (Secret Vault: Client direct access DENIED)
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers FORCE ROW LEVEL SECURITY;

CREATE POLICY p_qa_sel ON public.quiz_answers FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qa_ins ON public.quiz_answers FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qa_upd ON public.quiz_answers FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qa_del ON public.quiz_answers FOR DELETE USING (public.can_collaborator_manage_content(round_id));

REVOKE ALL ON public.quiz_answers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;

-- ----------------------------------------------------------------------------
-- 19. quiz_attempts (Managed via RPC)
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts FORCE ROW LEVEL SECURITY;

CREATE POLICY p_qatt_sel ON public.quiz_attempts FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.round_participations rp JOIN public.team_members tm ON tm.team_id = rp.team_id WHERE rp.id = quiz_attempts.participation_id AND tm.user_id = auth.uid()));
CREATE POLICY p_qatt_ins ON public.quiz_attempts FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_qatt_upd ON public.quiz_attempts FOR UPDATE USING (FALSE);
CREATE POLICY p_qatt_del ON public.quiz_attempts FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

-- ----------------------------------------------------------------------------
-- 20. quiz_attempt_answers (Managed via RPC)
-- ----------------------------------------------------------------------------
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers FORCE ROW LEVEL SECURITY;

CREATE POLICY p_qaa_sel ON public.quiz_attempt_answers FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_qaa_ins ON public.quiz_attempt_answers FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_qaa_upd ON public.quiz_attempt_answers FOR UPDATE USING (FALSE);
CREATE POLICY p_qaa_del ON public.quiz_attempt_answers FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.quiz_attempt_answers TO authenticated;
GRANT ALL ON public.quiz_attempt_answers TO service_role;

-- ----------------------------------------------------------------------------
-- 21. coding_problems
-- ----------------------------------------------------------------------------
ALTER TABLE public.coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_problems FORCE ROW LEVEL SECURITY;

CREATE POLICY p_cp_sel ON public.coding_problems FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live'));
CREATE POLICY p_cp_ins ON public.coding_problems FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_cp_upd ON public.coding_problems FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_cp_del ON public.coding_problems FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.coding_problems TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coding_problems TO authenticated;
GRANT ALL ON public.coding_problems TO service_role;

-- ----------------------------------------------------------------------------
-- 22. coding_test_cases
-- ----------------------------------------------------------------------------
ALTER TABLE public.coding_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_test_cases FORCE ROW LEVEL SECURITY;

CREATE POLICY p_ctc_sel ON public.coding_test_cases FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR (is_hidden = FALSE AND EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live')));
CREATE POLICY p_ctc_ins ON public.coding_test_cases FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_ctc_upd ON public.coding_test_cases FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_ctc_del ON public.coding_test_cases FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.coding_test_cases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coding_test_cases TO authenticated;
GRANT ALL ON public.coding_test_cases TO service_role;

-- ----------------------------------------------------------------------------
-- 23. submissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_sub_sel ON public.submissions FOR SELECT USING (public.is_event_admin(event_id) OR public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid()));
CREATE POLICY p_sub_ins ON public.submissions FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_sub_upd ON public.submissions FOR UPDATE USING (FALSE);
CREATE POLICY p_sub_del ON public.submissions FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;

-- ----------------------------------------------------------------------------
-- 24. evaluation_jobs (Worker queue)
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY p_ej_sel ON public.evaluation_jobs FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_ej_ins ON public.evaluation_jobs FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_ej_upd ON public.evaluation_jobs FOR UPDATE USING (FALSE);
CREATE POLICY p_ej_del ON public.evaluation_jobs FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.evaluation_jobs TO authenticated;
GRANT ALL ON public.evaluation_jobs TO service_role;

-- ----------------------------------------------------------------------------
-- 25. evaluation_results
-- ----------------------------------------------------------------------------
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_results FORCE ROW LEVEL SECURITY;

CREATE POLICY p_er_sel ON public.evaluation_results FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_er_ins ON public.evaluation_results FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_er_upd ON public.evaluation_results FOR UPDATE USING (FALSE);
CREATE POLICY p_er_del ON public.evaluation_results FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.evaluation_results TO authenticated;
GRANT ALL ON public.evaluation_results TO service_role;

-- ----------------------------------------------------------------------------
-- 26. mystery_challenges
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_challenges FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mc_sel ON public.mystery_challenges FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live'));
CREATE POLICY p_mc_ins ON public.mystery_challenges FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mc_upd ON public.mystery_challenges FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mc_del ON public.mystery_challenges FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.mystery_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mystery_challenges TO authenticated;
GRANT ALL ON public.mystery_challenges TO service_role;

-- ----------------------------------------------------------------------------
-- 27. mystery_clues
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_clues FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mclue_sel ON public.mystery_clues FOR SELECT USING (public.can_collaborator_manage_content(round_id) OR EXISTS (SELECT 1 FROM public.event_rounds WHERE id = round_id AND status = 'live'));
CREATE POLICY p_mclue_ins ON public.mystery_clues FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mclue_upd ON public.mystery_clues FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mclue_del ON public.mystery_clues FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.mystery_clues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mystery_clues TO authenticated;
GRANT ALL ON public.mystery_clues TO service_role;

-- ----------------------------------------------------------------------------
-- 28. mystery_clue_solutions (Secret Vault: Client direct access DENIED)
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_clue_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_clue_solutions FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mcs_sel ON public.mystery_clue_solutions FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mcs_ins ON public.mystery_clue_solutions FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mcs_upd ON public.mystery_clue_solutions FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mcs_del ON public.mystery_clue_solutions FOR DELETE USING (public.can_collaborator_manage_content(round_id));

REVOKE ALL ON public.mystery_clue_solutions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mystery_clue_solutions TO authenticated;
GRANT ALL ON public.mystery_clue_solutions TO service_role;

-- ----------------------------------------------------------------------------
-- 29. mystery_clue_hints (Secret Vault: Client direct access DENIED)
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_clue_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_clue_hints FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mch_sel ON public.mystery_clue_hints FOR SELECT USING (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mch_ins ON public.mystery_clue_hints FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mch_upd ON public.mystery_clue_hints FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_mch_del ON public.mystery_clue_hints FOR DELETE USING (public.can_collaborator_manage_content(round_id));

REVOKE ALL ON public.mystery_clue_hints FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mystery_clue_hints TO authenticated;
GRANT ALL ON public.mystery_clue_hints TO service_role;

-- ----------------------------------------------------------------------------
-- 30. mystery_progress (Managed via RPC)
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_progress FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mp_deny ON public.mystery_progress FOR ALL USING (FALSE);

REVOKE ALL ON public.mystery_progress FROM anon, authenticated;
GRANT ALL ON public.mystery_progress TO service_role;

-- ----------------------------------------------------------------------------
-- 31. mystery_hint_logs (Managed via RPC)
-- ----------------------------------------------------------------------------
ALTER TABLE public.mystery_hint_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mystery_hint_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY p_mhl_deny ON public.mystery_hint_logs FOR ALL USING (FALSE);

REVOKE ALL ON public.mystery_hint_logs FROM anon, authenticated;
GRANT ALL ON public.mystery_hint_logs TO service_role;

-- ----------------------------------------------------------------------------
-- 32. jury_rubrics
-- ----------------------------------------------------------------------------
ALTER TABLE public.jury_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_rubrics FORCE ROW LEVEL SECURITY;

CREATE POLICY p_jr_sel ON public.jury_rubrics FOR SELECT USING (TRUE);
CREATE POLICY p_jr_ins ON public.jury_rubrics FOR INSERT WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_jr_upd ON public.jury_rubrics FOR UPDATE USING (public.can_collaborator_manage_content(round_id)) WITH CHECK (public.can_collaborator_manage_content(round_id));
CREATE POLICY p_jr_del ON public.jury_rubrics FOR DELETE USING (public.can_collaborator_manage_content(round_id));

GRANT SELECT ON public.jury_rubrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jury_rubrics TO authenticated;
GRANT ALL ON public.jury_rubrics TO service_role;

-- ----------------------------------------------------------------------------
-- 33. jury_scores
-- ----------------------------------------------------------------------------
ALTER TABLE public.jury_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_scores FORCE ROW LEVEL SECURITY;

CREATE POLICY p_js_sel ON public.jury_scores FOR SELECT USING (judge_id = auth.uid() OR public.is_event_admin(event_id) OR public.can_collaborator_grade(round_id));
CREATE POLICY p_js_ins ON public.jury_scores FOR INSERT WITH CHECK (judge_id = auth.uid() AND public.can_collaborator_grade(round_id));
CREATE POLICY p_js_upd ON public.jury_scores FOR UPDATE USING (judge_id = auth.uid() AND public.can_collaborator_grade(round_id)) WITH CHECK (judge_id = auth.uid() AND public.can_collaborator_grade(round_id));
CREATE POLICY p_js_del ON public.jury_scores FOR DELETE USING (public.is_event_admin(event_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jury_scores TO authenticated;
GRANT ALL ON public.jury_scores TO service_role;

-- ----------------------------------------------------------------------------
-- 34. round_scores (Scoring Engine: Client direct modification DENIED)
-- ----------------------------------------------------------------------------
ALTER TABLE public.round_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_scores FORCE ROW LEVEL SECURITY;

CREATE POLICY p_rs_sel ON public.round_scores FOR SELECT USING (public.is_event_admin(event_id) OR public.can_collaborator_grade(round_id));
CREATE POLICY p_rs_ins ON public.round_scores FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_rs_upd ON public.round_scores FOR UPDATE USING (FALSE);
CREATE POLICY p_rs_del ON public.round_scores FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.round_scores TO authenticated;
GRANT ALL ON public.round_scores TO service_role;

-- ----------------------------------------------------------------------------
-- 35. score_overrides
-- ----------------------------------------------------------------------------
ALTER TABLE public.score_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY p_so_sel ON public.score_overrides FOR SELECT USING (public.is_event_admin(event_id));
CREATE POLICY p_so_ins ON public.score_overrides FOR INSERT WITH CHECK (public.is_event_admin(event_id));
CREATE POLICY p_so_upd ON public.score_overrides FOR UPDATE USING (FALSE);
CREATE POLICY p_so_del ON public.score_overrides FOR DELETE USING (public.is_super_admin());

GRANT SELECT, INSERT ON public.score_overrides TO authenticated;
GRANT ALL ON public.score_overrides TO service_role;

-- ----------------------------------------------------------------------------
-- 36. audit_logs
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY p_al_sel ON public.audit_logs FOR SELECT USING (public.is_event_admin(event_id));
CREATE POLICY p_al_ins ON public.audit_logs FOR INSERT WITH CHECK (FALSE);
CREATE POLICY p_al_upd ON public.audit_logs FOR UPDATE USING (FALSE);
CREATE POLICY p_al_del ON public.audit_logs FOR DELETE USING (public.is_super_admin());

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

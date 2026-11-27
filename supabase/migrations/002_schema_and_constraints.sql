-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 002_schema_and_constraints.sql
-- Description: Complete 36-Table Relational Schema & Composite Foreign Keys
-- Author: Eventora Platform Architecture Team
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Identity & Profiles Module
-- ----------------------------------------------------------------------------

-- 1. profiles: Public identity and platform authorization role
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  platform_role public.platform_role_enum NOT NULL DEFAULT 'participant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. profile_private_data: Isolated personal identifiable metadata
CREATE TABLE public.profile_private_data (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  college_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe public profile view projecting basic identity fields exclusively (P0)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name,
  avatar_url
FROM public.profiles;

-- ----------------------------------------------------------------------------
-- 2. Platform Core & Multi-Tenant Events Module
-- ----------------------------------------------------------------------------

-- 3. events: Multi-tenant competition workspaces
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status public.event_status_enum NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{"max_team_size":4,"min_team_size":2,"allow_guest_spectators":true}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_status ON public.events(status);

-- 4. event_collaborators: Delegated event-level administrators, judges & proctors
CREATE TABLE public.event_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.collaborator_role_enum NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_collaborator_event_user UNIQUE (event_id, user_id),
  CONSTRAINT uq_collaborator_id_event UNIQUE (id, event_id),
  CONSTRAINT uq_collaborator_user_event UNIQUE (user_id, event_id)
);
CREATE INDEX idx_collaborators_event ON public.event_collaborators(event_id);

-- 5. event_rounds: Dynamically configured sequential competition stages
CREATE TABLE public.event_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  name TEXT NOT NULL,
  type public.round_type_enum NOT NULL,
  status public.round_status_enum NOT NULL DEFAULT 'scheduled',
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_round_event_number UNIQUE (event_id, round_number),
  CONSTRAINT uq_round_id_event UNIQUE (id, event_id)
);
CREATE INDEX idx_rounds_event_status ON public.event_rounds(event_id, status);

-- 6. collaborator_round_permissions: Scoped round-level authority matrix
CREATE TABLE public.collaborator_round_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id UUID NOT NULL,
  event_id UUID NOT NULL,
  round_id UUID NOT NULL,
  can_manage_content BOOLEAN NOT NULL DEFAULT FALSE,
  can_grade BOOLEAN NOT NULL DEFAULT FALSE,
  can_moderate BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_crp_collab_composite FOREIGN KEY (collaborator_id, event_id) REFERENCES public.event_collaborators(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_crp_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_crp_collab_round UNIQUE (collaborator_id, round_id)
);

-- 7. event_invitations: Secure collaborator invites with SHA-256 tokens
CREATE TABLE public.event_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.collaborator_role_enum NOT NULL CHECK (role <> 'owner'),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invitation_id_event UNIQUE (id, event_id),
  CONSTRAINT uq_invitation_event_email UNIQUE (event_id, email)
);

-- 8. event_invitation_rounds: Pre-assigned round permissions for invitees
CREATE TABLE public.event_invitation_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL,
  event_id UUID NOT NULL,
  round_id UUID NOT NULL,
  CONSTRAINT fk_invr_inv_composite FOREIGN KEY (invitation_id, event_id) REFERENCES public.event_invitations(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_invr_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_invr_inv_round UNIQUE (invitation_id, round_id)
);

-- ----------------------------------------------------------------------------
-- 3. Team System & Credential Vault Module
-- ----------------------------------------------------------------------------

-- 9. teams: Public squad directory (Names, department, status - decoupled)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  college TEXT NOT NULL DEFAULT 'Main Campus',
  status public.team_status_enum NOT NULL DEFAULT 'approved',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_event_name UNIQUE (event_id, name),
  CONSTRAINT uq_team_event_composite UNIQUE (id, event_id)
);
CREATE INDEX idx_teams_event_status ON public.teams(event_id, status);

-- 10. team_auth_credentials: Private Bcrypt PIN hash and lockout vault
CREATE TABLE public.team_auth_credentials (
  team_id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  pin_hash TEXT NOT NULL,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_team_auth_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE
);

-- 11. team_members: Verified squad student members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  event_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'suspended', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tm_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_tm_event_user UNIQUE (event_id, user_id)
);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);

-- 12. team_sessions: Server-side verified session store for kiosk logins
CREATE TABLE public.team_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  event_id UUID NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 hours'),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ts_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE
);
CREATE INDEX idx_team_sessions_hash ON public.team_sessions(session_token_hash);

-- ----------------------------------------------------------------------------
-- 4. Round Participation & Lifecycle Events Module
-- ----------------------------------------------------------------------------

-- 13. round_participations: Team participation lifecycle, timer & progress
CREATE TABLE public.round_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  team_id UUID NOT NULL,
  event_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  tab_switch_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rp_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_rp_round_team UNIQUE (round_id, team_id),
  CONSTRAINT uq_rp_id_round_team UNIQUE (id, round_id, team_id),
  CONSTRAINT uq_rp_id_round UNIQUE (id, round_id)
);
CREATE INDEX idx_participations_round_team ON public.round_participations(round_id, team_id);

-- 14. round_lifecycle_events: Stage transitions audit trail
CREATE TABLE public.round_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  action TEXT NOT NULL,
  triggered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rle_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE
);

-- 15. event_notifications: Real-time broadcast and squad-targeted alerts
CREATE TABLE public.event_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  target_team_id UUID,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_notif_team_composite FOREIGN KEY (target_team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 5. Round 1: Quiz Domain Module
-- ----------------------------------------------------------------------------

-- 16. quiz_questions: MCQ questions bank per round
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  question_order INT NOT NULL,
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  points NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  negative_points NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_qq_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_qq_round_order UNIQUE (round_id, question_order),
  CONSTRAINT uq_qq_id_round UNIQUE (id, round_id)
);

-- 17. quiz_options: Multiple-choice answer options per question
CREATE TABLE public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  round_id UUID NOT NULL,
  option_index INT NOT NULL CHECK (option_index >= 0 AND option_index <= 3),
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_qo_question_composite FOREIGN KEY (question_id, round_id) REFERENCES public.quiz_questions(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_qo_question_index UNIQUE (question_id, option_index),
  CONSTRAINT uq_qo_id_question_round UNIQUE (id, question_id, round_id)
);

-- 18. quiz_answers: Secret correct answer keys (Private vault)
CREATE TABLE public.quiz_answers (
  question_id UUID PRIMARY KEY,
  round_id UUID NOT NULL,
  correct_option_id UUID NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_qa_question_composite FOREIGN KEY (question_id, round_id) REFERENCES public.quiz_questions(id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_qa_option_composite FOREIGN KEY (correct_option_id, question_id, round_id) REFERENCES public.quiz_options(id, question_id, round_id) ON DELETE CASCADE
);

-- 19. quiz_attempts: Team attempt records
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL,
  round_id UUID NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  score NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_qatt_part_composite FOREIGN KEY (participation_id, round_id) REFERENCES public.round_participations(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_qatt_part_attempt UNIQUE (participation_id, attempt_number),
  CONSTRAINT uq_qatt_id_round UNIQUE (id, round_id)
);

-- 20. quiz_attempt_answers: Answer records with composite foreign key bound to question
CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  round_id UUID NOT NULL,
  selected_option_id UUID,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_qaa_attempt_composite FOREIGN KEY (attempt_id, round_id) REFERENCES public.quiz_attempts(id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_qaa_question_composite FOREIGN KEY (question_id, round_id) REFERENCES public.quiz_questions(id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_qaa_option_composite FOREIGN KEY (selected_option_id, question_id, round_id) REFERENCES public.quiz_options(id, question_id, round_id) MATCH SIMPLE ON DELETE RESTRICT,
  CONSTRAINT uq_qaa_attempt_question UNIQUE (attempt_id, question_id)
);

-- ----------------------------------------------------------------------------
-- 6. Round 2: Coding & Execution Sandbox Module
-- ----------------------------------------------------------------------------

-- 21. coding_problems: Speed-debugging problem statements
CREATE TABLE public.coding_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  problem_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expected_output_hint TEXT,
  starting_code TEXT NOT NULL,
  time_limit_ms INT NOT NULL DEFAULT 2000,
  memory_limit_kb INT NOT NULL DEFAULT 131072,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_cp_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_cp_round_code UNIQUE (round_id, problem_code),
  CONSTRAINT uq_cp_id_round UNIQUE (id, round_id)
);

-- 22. coding_test_cases: Public sample and hidden evaluation test cases
CREATE TABLE public.coding_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL,
  round_id UUID NOT NULL,
  test_case_order INT NOT NULL,
  input_text TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
  points NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ctc_problem_composite FOREIGN KEY (problem_id, round_id) REFERENCES public.coding_problems(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_ctc_problem_order UNIQUE (problem_id, test_case_order),
  CONSTRAINT uq_ctc_id_problem_round UNIQUE (id, problem_id, round_id)
);

-- 23. submissions: Formal code submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  team_id UUID NOT NULL,
  problem_id UUID NOT NULL,
  code_text TEXT NOT NULL,
  submission_number INT NOT NULL,
  status public.eval_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sub_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_problem_composite FOREIGN KEY (problem_id, round_id) REFERENCES public.coding_problems(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_sub_composite UNIQUE (id, round_id, event_id, problem_id),
  CONSTRAINT uq_sub_team_prob_num UNIQUE (team_id, problem_id, submission_number)
);

-- 24. evaluation_jobs: Asynchronous compilation & execution job queue
CREATE TABLE public.evaluation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  problem_id UUID NOT NULL,
  worker_id TEXT,
  status public.eval_status_enum NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ej_sub_composite FOREIGN KEY (submission_id, round_id, event_id, problem_id) REFERENCES public.submissions(id, round_id, event_id, problem_id) ON DELETE CASCADE,
  CONSTRAINT fk_ej_problem_composite FOREIGN KEY (problem_id, round_id) REFERENCES public.coding_problems(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_ej_id_problem_round UNIQUE (id, problem_id, round_id)
);
CREATE INDEX idx_ej_pending ON public.evaluation_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_ej_queue ON public.evaluation_jobs(status, lease_expires_at, created_at) WHERE status IN ('pending', 'running');

-- 25. evaluation_results: Sanitized outputs and metrics per test case
CREATE TABLE public.evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  test_case_id UUID NOT NULL,
  problem_id UUID NOT NULL,
  round_id UUID NOT NULL,
  verdict public.verdict_enum NOT NULL,
  execution_time_ms NUMERIC(10, 2) NOT NULL,
  memory_kb INT NOT NULL,
  sanitized_stdout TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_er_job_composite FOREIGN KEY (job_id, problem_id, round_id) REFERENCES public.evaluation_jobs(id, problem_id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_er_tc_composite FOREIGN KEY (test_case_id, problem_id, round_id) REFERENCES public.coding_test_cases(id, problem_id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_er_job_tc UNIQUE (job_id, test_case_id)
);

-- ----------------------------------------------------------------------------
-- 7. Round 3: Mystery Tech Challenge Module
-- ----------------------------------------------------------------------------

-- 26. mystery_challenges: Mystery puzzle suites per round
CREATE TABLE public.mystery_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  challenge_order INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  max_clues INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mc_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_mc_round_order UNIQUE (round_id, challenge_order),
  CONSTRAINT uq_mc_id_round UNIQUE (id, round_id)
);

-- 27. mystery_clues: Sequential clues per challenge
CREATE TABLE public.mystery_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  round_id UUID NOT NULL,
  clue_order INT NOT NULL,
  clue_title TEXT NOT NULL,
  clue_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mclue_ch_composite FOREIGN KEY (challenge_id, round_id) REFERENCES public.mystery_challenges(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_mclue_ch_order UNIQUE (challenge_id, clue_order),
  CONSTRAINT uq_mclue_id_ch_round UNIQUE (id, challenge_id, round_id)
);

-- 28. mystery_clue_solutions: Secret salted answer hashes (Private vault)
CREATE TABLE public.mystery_clue_solutions (
  clue_id UUID PRIMARY KEY,
  challenge_id UUID NOT NULL,
  round_id UUID NOT NULL,
  accepted_answer_hashes TEXT[] NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mcs_clue_composite FOREIGN KEY (clue_id, challenge_id, round_id) REFERENCES public.mystery_clues(id, challenge_id, round_id) ON DELETE CASCADE
);

-- 29. mystery_clue_hints: Optional hint text with penalty seconds (Private vault)
CREATE TABLE public.mystery_clue_hints (
  clue_id UUID PRIMARY KEY,
  challenge_id UUID NOT NULL,
  round_id UUID NOT NULL,
  hint_text TEXT NOT NULL,
  penalty_seconds INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mch_clue_composite FOREIGN KEY (clue_id, challenge_id, round_id) REFERENCES public.mystery_clues(id, challenge_id, round_id) ON DELETE CASCADE
);

-- 30. mystery_progress: Team sequential puzzle state per challenge
CREATE TABLE public.mystery_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID NOT NULL,
  challenge_id UUID NOT NULL,
  round_id UUID NOT NULL,
  current_clue_order INT NOT NULL DEFAULT 1,
  clues_unlocked INT NOT NULL DEFAULT 1,
  hints_used INT NOT NULL DEFAULT 0,
  penalty_seconds INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT fk_mp_part_composite FOREIGN KEY (participation_id, round_id) REFERENCES public.round_participations(id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_mp_ch_composite FOREIGN KEY (challenge_id, round_id) REFERENCES public.mystery_challenges(id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_mp_part_ch UNIQUE (participation_id, challenge_id),
  CONSTRAINT uq_mp_id_ch_round UNIQUE (id, challenge_id, round_id)
);

-- 31. mystery_hint_logs: Exact-once hint unlocks and penalty audit
CREATE TABLE public.mystery_hint_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id UUID NOT NULL,
  challenge_id UUID NOT NULL,
  round_id UUID NOT NULL,
  clue_id UUID NOT NULL,
  penalty_applied_seconds INT NOT NULL,
  revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mhl_prog_composite FOREIGN KEY (progress_id, challenge_id, round_id) REFERENCES public.mystery_progress(id, challenge_id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_mhl_clue_composite FOREIGN KEY (clue_id, challenge_id, round_id) REFERENCES public.mystery_clues(id, challenge_id, round_id) ON DELETE CASCADE,
  CONSTRAINT uq_mhl_prog_clue UNIQUE (progress_id, clue_id)
);

-- ----------------------------------------------------------------------------
-- 8. Round 4: Jury Evaluation Module
-- ----------------------------------------------------------------------------

-- 32. jury_rubrics: Stage presentation scoring criteria and ceilings
CREATE TABLE public.jury_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  criterion_name TEXT NOT NULL,
  description TEXT,
  max_points NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (max_points > 0),
  weight NUMERIC(3, 2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_jr_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_jr_id_round UNIQUE (id, round_id)
);

-- 33. jury_scores: Individual judge evaluations with rubric bounds
CREATE TABLE public.jury_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  team_id UUID NOT NULL,
  rubric_id UUID NOT NULL,
  judge_id UUID NOT NULL,
  score NUMERIC(10, 2) NOT NULL CHECK (score >= 0),
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_js_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_js_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_js_rubric_composite FOREIGN KEY (rubric_id, round_id) REFERENCES public.jury_rubrics(id, round_id) ON DELETE CASCADE,
  CONSTRAINT fk_js_judge_composite FOREIGN KEY (judge_id, event_id) REFERENCES public.event_collaborators(user_id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_js_round_team_rubric_judge UNIQUE (round_id, team_id, rubric_id, judge_id)
);

-- ----------------------------------------------------------------------------
-- 9. Standings, Overrides & Audit Module
-- ----------------------------------------------------------------------------

-- 34. round_scores: Aggregate scores, rank, qualifications and tie-breakers
CREATE TABLE public.round_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  team_id UUID NOT NULL,
  event_id UUID NOT NULL,
  primary_score NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  secondary_metric NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  rank INT,
  last_valid_submission_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_rs_round_composite FOREIGN KEY (round_id, event_id) REFERENCES public.event_rounds(id, event_id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_team_composite FOREIGN KEY (team_id, event_id) REFERENCES public.teams(id, event_id) ON DELETE CASCADE,
  CONSTRAINT uq_rs_round_team UNIQUE (round_id, team_id),
  CONSTRAINT uq_round_scores_id_event UNIQUE (id, event_id),
  CONSTRAINT uq_rs_id_event_round_team UNIQUE (id, event_id, round_id, team_id)
);
CREATE INDEX idx_rs_round_scores ON public.round_scores(round_id, primary_score DESC, secondary_metric ASC);

-- 35. score_overrides: Audited administrative adjustments to round scores
CREATE TABLE public.score_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID NOT NULL,
  event_id UUID NOT NULL,
  overridden_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  original_score NUMERIC(10, 2) NOT NULL,
  new_score NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_so_score_composite FOREIGN KEY (score_id, event_id) REFERENCES public.round_scores(id, event_id) ON DELETE CASCADE
);

-- 36. audit_logs: Platform-wide immutable audit trail
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_event_time ON public.audit_logs(event_id, created_at DESC);

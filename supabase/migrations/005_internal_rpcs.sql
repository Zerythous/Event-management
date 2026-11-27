-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 005_internal_rpcs.sql
-- Description: Stored Procedures, Internal RPCs & Edge Function API Contracts
-- Author: Eventora Platform Architecture Team
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Identity & SuperAdmin Secure Provisioning (Directive 1)
-- ----------------------------------------------------------------------------

-- Secure one-time initial SuperAdmin provisioning
CREATE OR REPLACE FUNCTION public.provision_initial_super_admin(p_email TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_existing_superadmin_count INT;
BEGIN
  -- 1. Advisory transaction lock to prevent race conditions during initial setup
  PERFORM pg_advisory_xact_lock(hashtext('provision_initial_super_admin'));

  -- 2. Reject any invocation from unprivileged PostgREST roles (anon or authenticated)
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Access Denied: Ordinary users and anonymous clients cannot invoke SuperAdmin provisioning.';
  END IF;

  -- 3. Restrict execution strictly to service_role (Edge Functions Gateway) or direct administrative sessions (postgres/supabase_admin)
  -- Note: We inspect SESSION_USER rather than current_user because current_user reflects the function owner in SECURITY DEFINER
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Authorization Required: Initial SuperAdmin provisioning requires service_role or direct administrative session.';
  END IF;

  -- 4. Validate email format
  IF p_email IS NULL OR TRIM(p_email) = '' OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Validation Error: A valid, well-formed email address is required.';
  END IF;

  -- 5. Concurrency check: Verify that no SuperAdmin currently exists
  SELECT COUNT(*) INTO v_existing_superadmin_count
  FROM public.profiles
  WHERE platform_role = 'super_admin';

  IF v_existing_superadmin_count > 0 THEN
    RAISE EXCEPTION 'Lockout: A SuperAdmin has already been provisioned (% registered). Additional administrators must be invited by an existing SuperAdmin.', v_existing_superadmin_count;
  END IF;

  -- 6. Resolve user ID from auth.users by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User Not Found: User with email "%" does not exist in auth.users. The user must sign up via Supabase Auth before being granted initial SuperAdmin.', p_email;
  END IF;

  -- 7. Upsert profile with platform_role = 'super_admin'
  INSERT INTO public.profiles (id, full_name, platform_role, created_at, updated_at)
  VALUES (v_user_id, 'Platform Super Admin', 'super_admin', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET platform_role = 'super_admin',
      updated_at = NOW();

  -- 8. Upsert private profile data
  INSERT INTO public.profile_private_data (user_id, email, metadata, created_at, updated_at)
  VALUES (v_user_id, lower(trim(p_email)), '{"provisioned_method":"initial_bootstrap"}'::JSONB, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET email = lower(trim(p_email)),
      updated_at = NOW();

  -- 9. Link any canonical platform events to the newly provisioned SuperAdmin
  UPDATE public.events
  SET created_by = v_user_id, updated_at = NOW()
  WHERE created_by IS NULL;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Team Authentication & Session Gateway (Directive 2 & 9)
-- ----------------------------------------------------------------------------

-- Atomic PIN verification and secure session token generation
CREATE OR REPLACE FUNCTION public.verify_team_pin_login(
  p_event_slug TEXT,
  p_team_name TEXT,
  p_pin TEXT,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  session_token TEXT,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_event_id UUID;
  v_team RECORD;
  v_cred RECORD;
  v_raw_token TEXT;
  v_token_hash TEXT;
BEGIN
  -- 1. Resolve event
  SELECT id INTO v_event_id FROM public.events WHERE slug = p_event_slug;
  IF v_event_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Event not found.'::TEXT;
    RETURN;
  END IF;

  -- 2. Lock team record
  SELECT * INTO v_team FROM public.teams 
  WHERE event_id = v_event_id AND lower(name) = lower(trim(p_team_name))
  FOR UPDATE;

  IF v_team.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Team name does not exist.'::TEXT;
    RETURN;
  END IF;

  IF v_team.status <> 'approved' THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Squad registration is pending approval or disqualified.'::TEXT;
    RETURN;
  END IF;

  -- 3. Lock private credentials
  SELECT * INTO v_cred FROM public.team_auth_credentials
  WHERE team_id = v_team.id AND event_id = v_event_id
  FOR UPDATE;

  IF v_cred.team_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, 'Authentication credentials not configured.'::TEXT;
    RETURN;
  END IF;

  -- 4. Check lockout state
  IF v_cred.locked_until IS NOT NULL THEN
    IF v_cred.locked_until > NOW() THEN
      RETURN QUERY SELECT FALSE, NULL::TEXT, 'Account locked due to consecutive failed attempts. Try again later.'::TEXT;
      RETURN;
    ELSE
      -- Lockout window has elapsed; reset counter to give squad fresh attempts
      UPDATE public.team_auth_credentials 
      SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() 
      WHERE team_id = v_team.id;
      v_cred.failed_login_attempts := 0;
      v_cred.locked_until := NULL;
    END IF;
  END IF;

  -- 5. Verify Bcrypt PIN hash
  IF v_cred.pin_hash = crypt(p_pin, v_cred.pin_hash) THEN
    -- Reset lockout state
    UPDATE public.team_auth_credentials 
    SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() 
    WHERE team_id = v_team.id;

    -- Generate cryptographically random 32-byte hex session token
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    -- Insert server-side session
    INSERT INTO public.team_sessions (team_id, event_id, session_token_hash, ip_address, user_agent, expires_at)
    VALUES (v_team.id, v_event_id, v_token_hash, p_ip, p_user_agent, NOW() + INTERVAL '12 hours');

    RETURN QUERY SELECT TRUE, v_raw_token, NULL::TEXT;
  ELSE
    -- Increment failed counter and enforce 15-minute lockout at 5 failures
    IF v_cred.failed_login_attempts + 1 >= 5 THEN
      UPDATE public.team_auth_credentials 
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = NOW() + INTERVAL '15 minutes',
          updated_at = NOW() 
      WHERE team_id = v_team.id;
      RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid PIN. Account locked for 15 minutes due to 5 consecutive failures.'::TEXT;
    ELSE
      UPDATE public.team_auth_credentials 
      SET failed_login_attempts = failed_login_attempts + 1,
          updated_at = NOW() 
      WHERE team_id = v_team.id;
      RETURN QUERY SELECT FALSE, NULL::TEXT, 'Invalid PIN. Please verify your squad credentials.'::TEXT;
    END IF;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Collaborator Invitation Acceptance (Directive 8)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_event_invitation(p_raw_token TEXT)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_hash TEXT;
  v_inv RECORD;
  v_collab_id UUID;
  v_round RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication Required: You must be logged in to accept an invitation.';
  END IF;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  -- Lock invitation row to prevent concurrent double-acceptance
  SELECT * INTO v_inv FROM public.event_invitations
  WHERE token_hash = v_hash AND expires_at > NOW() AND accepted_at IS NULL
  FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or already accepted invitation.';
  END IF;

  -- 1. Email matching check
  IF lower(trim(v_inv.email)) <> lower(trim(auth.jwt() ->> 'email')) THEN
    RAISE EXCEPTION 'Identity Mismatch: Invitation was issued to %, but current account is %.', v_inv.email, auth.jwt() ->> 'email';
  END IF;

  -- 2. Owner protection: Role 'owner' cannot be acquired via invitation
  IF v_inv.role = 'owner' THEN
    RAISE EXCEPTION 'Security Violation: Event ownership cannot be transferred via invitation.';
  END IF;

  -- 3. Upsert collaborator entry
  INSERT INTO public.event_collaborators (event_id, user_id, role, assigned_by)
  VALUES (v_inv.event_id, auth.uid(), v_inv.role, v_inv.invited_by)
  ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING id INTO v_collab_id;

  -- 4. Map pre-assigned rounds
  FOR v_round IN SELECT round_id FROM public.event_invitation_rounds WHERE invitation_id = v_inv.id LOOP
    INSERT INTO public.collaborator_round_permissions (collaborator_id, event_id, round_id, can_manage_content, can_grade, can_moderate)
    VALUES (
      v_collab_id, v_inv.event_id, v_round.round_id,
      (v_inv.role = 'admin'),
      (v_inv.role IN ('admin', 'judge')),
      (v_inv.role IN ('admin', 'proctor'))
    )
    ON CONFLICT (collaborator_id, round_id) DO UPDATE 
    SET can_manage_content = EXCLUDED.can_manage_content, can_grade = EXCLUDED.can_grade, can_moderate = EXCLUDED.can_moderate;
  END LOOP;

  -- 5. Mark invitation accepted
  UPDATE public.event_invitations SET accepted_at = NOW() WHERE id = v_inv.id;

  RETURN v_collab_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Quiz Domain Procedures (Directives 5 & 6)
-- ----------------------------------------------------------------------------

-- Start Quiz Attempt
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(
  p_team_id UUID,
  p_event_id UUID,
  p_round_id UUID
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_part RECORD;
  v_attempt_id UUID;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  -- Validate live round
  IF (SELECT status FROM public.event_rounds WHERE id = p_round_id AND event_id = p_event_id) <> 'live' THEN
    RAISE EXCEPTION 'Competition Error: Round is not currently live.';
  END IF;

  -- Validate team status
  IF (SELECT status FROM public.teams WHERE id = p_team_id AND event_id = p_event_id) <> 'approved' THEN
    RAISE EXCEPTION 'Access Denied: Squad is not approved.';
  END IF;

  SELECT * INTO v_part FROM public.round_participations 
  WHERE round_id = p_round_id AND team_id = p_team_id AND event_id = p_event_id;

  IF v_part.id IS NULL OR v_part.is_completed OR v_part.expires_at < NOW() THEN
    RAISE EXCEPTION 'Participation Error: Round participation is invalid or expired.';
  END IF;

  INSERT INTO public.quiz_attempts (participation_id, round_id, attempt_number)
  VALUES (v_part.id, p_round_id, 1)
  ON CONFLICT (participation_id, attempt_number) DO UPDATE SET created_at = quiz_attempts.created_at
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

-- Save Quiz Answer (Ownership, Expiry & Question Bounds Verified)
CREATE OR REPLACE FUNCTION public.save_quiz_answer(
  p_attempt_id UUID,
  p_question_id UUID,
  p_option_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_ctx RECORD;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  -- Derive context exclusively from attempt record
  SELECT qa.id, qa.round_id, qa.is_submitted, rp.expires_at, rp.is_completed, r.status AS round_status
  INTO v_ctx
  FROM public.quiz_attempts qa
  JOIN public.round_participations rp ON rp.id = qa.participation_id
  JOIN public.event_rounds r ON r.id = qa.round_id
  WHERE qa.id = p_attempt_id
  FOR UPDATE OF qa;

  IF v_ctx.id IS NULL THEN
    RAISE EXCEPTION 'Attempt Error: Quiz attempt does not exist.';
  END IF;

  IF v_ctx.is_submitted THEN
    RAISE EXCEPTION 'Quiz Error: Attempt is already submitted.';
  END IF;

  IF v_ctx.round_status <> 'live' OR v_ctx.is_completed OR v_ctx.expires_at < NOW() THEN
    RAISE EXCEPTION 'Participation Error: Quiz window has expired.';
  END IF;

  -- Validate question belongs to attempt round
  IF NOT EXISTS (SELECT 1 FROM public.quiz_questions WHERE id = p_question_id AND round_id = v_ctx.round_id) THEN
    RAISE EXCEPTION 'Integrity Error: Question does not belong to this quiz round.';
  END IF;

  -- Validate option belongs to question (if not unselecting)
  IF p_option_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.quiz_options WHERE id = p_option_id AND question_id = p_question_id AND round_id = v_ctx.round_id) THEN
      RAISE EXCEPTION 'Integrity Error: Selected option does not belong to this question.';
    END IF;
  END IF;

  INSERT INTO public.quiz_attempt_answers (attempt_id, question_id, round_id, selected_option_id)
  VALUES (p_attempt_id, p_question_id, v_ctx.round_id, p_option_id)
  ON CONFLICT (attempt_id, question_id) DO UPDATE 
  SET selected_option_id = EXCLUDED.selected_option_id, answered_at = NOW();

  RETURN TRUE;
END;
$$;

-- Submit and Grade Quiz (Team ID derived entirely from attempt record)
CREATE OR REPLACE FUNCTION public.submit_and_grade_quiz(p_attempt_id UUID)
RETURNS NUMERIC(10, 2)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_ctx RECORD;
  v_total_score NUMERIC(10, 2) := 0.00;
  v_ans RECORD;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  -- Derive team_id, round_id and participation directly from attempt record
  SELECT qa.id, qa.round_id, qa.is_submitted, qa.score,
         rp.id AS participation_id, rp.team_id, rp.event_id, rp.is_completed
  INTO v_ctx
  FROM public.quiz_attempts qa
  JOIN public.round_participations rp ON rp.id = qa.participation_id
  WHERE qa.id = p_attempt_id
  FOR UPDATE OF qa;

  IF v_ctx.id IS NULL THEN
    RAISE EXCEPTION 'Attempt Error: Quiz attempt does not exist.';
  END IF;

  IF v_ctx.is_submitted THEN
    RETURN v_ctx.score;
  END IF;

  -- Evaluate each answer with negative marking
  FOR v_ans IN 
    SELECT qaa.selected_option_id, qa.correct_option_id, qq.points, qq.negative_points
    FROM public.quiz_questions qq
    LEFT JOIN public.quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    JOIN public.quiz_answers qa ON qa.question_id = qq.id
    WHERE qq.round_id = v_ctx.round_id
  LOOP
    IF v_ans.selected_option_id IS NOT NULL THEN
      IF v_ans.selected_option_id = v_ans.correct_option_id THEN
        v_total_score := v_total_score + v_ans.points;
      ELSE
        v_total_score := v_total_score - v_ans.negative_points;
      END IF;
    END IF;
  END LOOP;

  -- Atomic update of attempt, participation, and round scores
  UPDATE public.quiz_attempts 
  SET score = v_total_score, is_submitted = TRUE, submitted_at = NOW() 
  WHERE id = p_attempt_id;

  UPDATE public.round_participations
  SET is_completed = TRUE, completed_at = NOW()
  WHERE id = v_ctx.participation_id;

  -- Atomic upsert into round_scores (ensures score is recorded even if round_scores row was not pre-created)
  INSERT INTO public.round_scores (
    round_id, team_id, event_id, primary_score, secondary_metric, last_valid_submission_at, calculated_at
  )
  VALUES (
    v_ctx.round_id, v_ctx.team_id, v_ctx.event_id, v_total_score, 0.00, NOW(), NOW()
  )
  ON CONFLICT (round_id, team_id) DO UPDATE
  SET primary_score = EXCLUDED.primary_score,
      last_valid_submission_at = EXCLUDED.last_valid_submission_at,
      calculated_at = EXCLUDED.calculated_at;

  RETURN v_total_score;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Mystery Tech Challenge Procedures (Directive 7)
-- ----------------------------------------------------------------------------

-- Initialize Challenge Progress
CREATE OR REPLACE FUNCTION public.initialize_mystery_progress(
  p_team_id UUID,
  p_event_id UUID,
  p_round_id UUID,
  p_challenge_id UUID
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_part RECORD;
  v_progress_id UUID;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  SELECT * INTO v_part FROM public.round_participations 
  WHERE round_id = p_round_id AND team_id = p_team_id AND event_id = p_event_id;

  IF v_part.id IS NULL OR v_part.is_completed OR v_part.expires_at < NOW() THEN
    RAISE EXCEPTION 'Participation Error: Round participation is invalid or expired.';
  END IF;

  INSERT INTO public.mystery_progress (participation_id, challenge_id, round_id, current_clue_order, clues_unlocked)
  VALUES (v_part.id, p_challenge_id, p_round_id, 1, 1)
  ON CONFLICT (participation_id, challenge_id) DO UPDATE SET unlocked_at = mystery_progress.unlocked_at
  RETURNING id INTO v_progress_id;

  RETURN v_progress_id;
END;
$$;

-- Submit Mystery Clue Answer (Sequential bounds, dynamic clue counting, round completion)
CREATE OR REPLACE FUNCTION public.submit_mystery_clue_answer(
  p_team_id UUID,
  p_event_id UUID,
  p_round_id UUID,
  p_challenge_id UUID,
  p_clue_id UUID,
  p_submitted_answer TEXT
)
RETURNS TABLE (
  is_correct BOOLEAN,
  next_clue_order INT,
  challenge_completed BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_part RECORD;
  v_progress RECORD;
  v_challenge RECORD;
  v_clue RECORD;
  v_sol RECORD;
  v_cleaned_answer TEXT;
  v_answer_hash TEXT;
  v_is_match BOOLEAN := FALSE;
  v_has_next_clue BOOLEAN := FALSE;
  v_all_done BOOLEAN := FALSE;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  -- 1. Validate team status
  IF (SELECT status FROM public.teams WHERE id = p_team_id AND event_id = p_event_id) <> 'approved' THEN
    RAISE EXCEPTION 'Access Denied: Team is not in approved status.';
  END IF;

  -- 2. Validate live round
  IF (SELECT status FROM public.event_rounds WHERE id = p_round_id AND event_id = p_event_id) <> 'live' THEN
    RAISE EXCEPTION 'Competition Error: Mystery round is not currently live.';
  END IF;

  -- 3. Validate challenge belongs to round
  SELECT * INTO v_challenge FROM public.mystery_challenges WHERE id = p_challenge_id AND round_id = p_round_id;
  IF v_challenge.id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: Challenge does not belong to this round.';
  END IF;

  -- 4. Validate participation window
  SELECT * INTO v_part FROM public.round_participations WHERE round_id = p_round_id AND team_id = p_team_id;
  IF v_part.id IS NULL OR v_part.is_completed OR v_part.expires_at < NOW() THEN
    RAISE EXCEPTION 'Participation Error: Team participation is expired or completed.';
  END IF;

  -- 5. Lock challenge progress row
  SELECT * INTO v_progress FROM public.mystery_progress 
  WHERE participation_id = v_part.id AND challenge_id = p_challenge_id FOR UPDATE;

  IF v_progress.id IS NULL THEN
    RAISE EXCEPTION 'State Error: Progress record not initialized for this challenge.';
  END IF;

  IF v_progress.is_completed THEN
    RAISE EXCEPTION 'State Error: Challenge is already completed.';
  END IF;

  -- 6. Validate clue belongs to challenge and sequence
  SELECT * INTO v_clue FROM public.mystery_clues 
  WHERE id = p_clue_id AND challenge_id = p_challenge_id AND round_id = p_round_id;

  IF v_clue.id IS NULL THEN
    RAISE EXCEPTION 'Integrity Error: Clue does not exist in this challenge.';
  END IF;

  IF v_clue.clue_order <> v_progress.current_clue_order THEN
    RAISE EXCEPTION 'Progression Violation: Active clue is #%, not #%.', v_progress.current_clue_order, v_clue.clue_order;
  END IF;

  -- 7. Validate solution existence and verify salted hash
  SELECT * INTO v_sol FROM public.mystery_clue_solutions WHERE clue_id = p_clue_id;
  IF v_sol.clue_id IS NULL THEN
    RAISE EXCEPTION 'Configuration Error: Clue has no registered solution.';
  END IF;

  v_cleaned_answer := lower(trim(regexp_replace(p_submitted_answer, '\s+', ' ', 'g')));
  v_answer_hash := encode(digest(v_cleaned_answer || v_sol.salt, 'sha256'), 'hex');

  IF v_answer_hash = ANY(v_sol.accepted_answer_hashes) THEN
    v_is_match := TRUE;
  END IF;

  IF v_is_match THEN
    -- Check if actual next clue exists in the database
    SELECT EXISTS (
      SELECT 1 FROM public.mystery_clues 
      WHERE challenge_id = p_challenge_id AND round_id = p_round_id AND clue_order = v_clue.clue_order + 1
    ) INTO v_has_next_clue;

    IF NOT v_has_next_clue OR v_clue.clue_order >= v_challenge.max_clues THEN
      UPDATE public.mystery_progress
      SET is_completed = TRUE, completed_at = NOW(), clues_unlocked = v_clue.clue_order
      WHERE id = v_progress.id;

      -- Check if all challenges in this round are completed
      SELECT NOT EXISTS (
        SELECT 1 FROM public.mystery_challenges mc
        LEFT JOIN public.mystery_progress mp ON mp.challenge_id = mc.id AND mp.participation_id = v_part.id
        WHERE mc.round_id = p_round_id AND (mp.is_completed IS NULL OR mp.is_completed = FALSE)
      ) INTO v_all_done;

      IF v_all_done THEN
        UPDATE public.round_participations SET is_completed = TRUE, completed_at = NOW() WHERE id = v_part.id;
      END IF;

      -- Atomic upsert into round_scores for completed challenge
      INSERT INTO public.round_scores (
        round_id, team_id, event_id, primary_score, secondary_metric, last_valid_submission_at, calculated_at
      )
      VALUES (
        p_round_id, p_team_id, p_event_id, 10.00, 0.00, NOW(), NOW()
      )
      ON CONFLICT (round_id, team_id) DO UPDATE
      SET primary_score = round_scores.primary_score + 10.00,
          last_valid_submission_at = EXCLUDED.last_valid_submission_at,
          calculated_at = EXCLUDED.calculated_at;

      RETURN QUERY SELECT TRUE, v_clue.clue_order, TRUE, 'Challenge completed!'::TEXT;
    ELSE
      UPDATE public.mystery_progress
      SET current_clue_order = v_progress.current_clue_order + 1,
          clues_unlocked = v_progress.clues_unlocked + 1
      WHERE id = v_progress.id;

      -- Atomic upsert into round_scores for cracked clue
      INSERT INTO public.round_scores (
        round_id, team_id, event_id, primary_score, secondary_metric, last_valid_submission_at, calculated_at
      )
      VALUES (
        p_round_id, p_team_id, p_event_id, 10.00, 0.00, NOW(), NOW()
      )
      ON CONFLICT (round_id, team_id) DO UPDATE
      SET primary_score = round_scores.primary_score + 10.00,
          last_valid_submission_at = EXCLUDED.last_valid_submission_at,
          calculated_at = EXCLUDED.calculated_at;

      RETURN QUERY SELECT TRUE, v_progress.current_clue_order + 1, FALSE, 'Clue cracked! Next clue unlocked.'::TEXT;
    END IF;
  ELSE
    RETURN QUERY SELECT FALSE, v_progress.current_clue_order, FALSE, 'Incorrect answer. Try again.'::TEXT;
  END IF;
END;
$$;

-- Request Mystery Clue Hint (Exact-once check & penalty application)
CREATE OR REPLACE FUNCTION public.request_mystery_clue_hint(
  p_team_id UUID,
  p_event_id UUID,
  p_round_id UUID,
  p_challenge_id UUID,
  p_clue_id UUID
)
RETURNS TABLE (
  hint_text TEXT,
  penalty_seconds INT,
  total_penalty_seconds INT
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_part RECORD;
  v_progress RECORD;
  v_clue RECORD;
  v_hint RECORD;
BEGIN
  -- Defense-in-depth: Ensure competition procedures are only invoked via the service_role Edge Function Gateway
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Competition procedures must be called through the authenticated Edge Function Gateway.';
  END IF;

  SELECT * INTO v_part FROM public.round_participations 
  WHERE round_id = p_round_id AND team_id = p_team_id;

  IF v_part.id IS NULL OR v_part.is_completed OR v_part.expires_at < NOW() THEN
    RAISE EXCEPTION 'Participation Error: Participation is expired or completed.';
  END IF;

  SELECT * INTO v_progress FROM public.mystery_progress 
  WHERE participation_id = v_part.id AND challenge_id = p_challenge_id FOR UPDATE;

  SELECT * INTO v_clue FROM public.mystery_clues 
  WHERE id = p_clue_id AND challenge_id = p_challenge_id AND round_id = p_round_id;

  IF v_clue.clue_order <> v_progress.current_clue_order THEN
    RAISE EXCEPTION 'Access Denied: You cannot request hints for locked clues.';
  END IF;

  SELECT * INTO v_hint FROM public.mystery_clue_hints WHERE clue_id = p_clue_id;

  -- If hint was already requested for this clue, return hint without applying new penalty
  IF EXISTS (SELECT 1 FROM public.mystery_hint_logs WHERE progress_id = v_progress.id AND clue_id = p_clue_id) THEN
    RETURN QUERY SELECT v_hint.hint_text, 0, v_progress.penalty_seconds;
    RETURN;
  END IF;

  -- Apply hint penalty exactly once
  INSERT INTO public.mystery_hint_logs (progress_id, challenge_id, round_id, clue_id, penalty_applied_seconds)
  VALUES (v_progress.id, p_challenge_id, p_round_id, p_clue_id, v_hint.penalty_seconds);

  UPDATE public.mystery_progress
  SET hints_used = v_progress.hints_used + 1,
      penalty_seconds = v_progress.penalty_seconds + v_hint.penalty_seconds
  WHERE id = v_progress.id;

  -- Atomic upsert into round_scores for hint penalty
  INSERT INTO public.round_scores (
    round_id, team_id, event_id, primary_score, secondary_metric, calculated_at
  )
  VALUES (
    p_round_id, p_team_id, p_event_id, 0.00, v_hint.penalty_seconds, NOW()
  )
  ON CONFLICT (round_id, team_id) DO UPDATE
  SET secondary_metric = round_scores.secondary_metric + v_hint.penalty_seconds,
      calculated_at = EXCLUDED.calculated_at;

  RETURN QUERY SELECT v_hint.hint_text, v_hint.penalty_seconds, v_progress.penalty_seconds + v_hint.penalty_seconds;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Sandbox Evaluation Worker Lifecycle Procedures (Directive 10)
-- ----------------------------------------------------------------------------

-- Claim Evaluation Job (Atomic checkout with SKIP LOCKED, reclaiming expired leases, and fencing token)
CREATE OR REPLACE FUNCTION public.claim_evaluation_job(p_worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  submission_id UUID,
  problem_id UUID,
  round_id UUID,
  code_text TEXT,
  lease_token UUID
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_job RECORD;
  v_lease_token UUID;
BEGIN
  -- Defense-in-depth: Ensure worker procedures can only be invoked by service_role (Evaluator Gateway)
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Worker evaluation procedures require service_role gateway authorization.';
  END IF;

  IF p_worker_id IS NULL OR TRIM(p_worker_id) = '' THEN
    RAISE EXCEPTION 'Validation Error: worker_id must not be empty.';
  END IF;

  -- 1. Deadlock prevention: transition expired jobs that reached max attempts to 'error'
  UPDATE public.evaluation_jobs
  SET status = 'error',
      lease_expires_at = NOW()
  WHERE status = 'running'
    AND lease_expires_at < NOW()
    AND attempt_count >= max_attempts;

  -- 2. Select pending job OR unexpired reclaimable job
  SELECT ej.id, ej.submission_id, ej.problem_id, ej.round_id, s.code_text
  INTO v_job
  FROM public.evaluation_jobs ej
  JOIN public.submissions s ON s.id = ej.submission_id
  WHERE (ej.status = 'pending' OR (ej.status = 'running' AND ej.lease_expires_at < NOW()))
    AND ej.attempt_count < ej.max_attempts
  ORDER BY ej.created_at ASC
  FOR UPDATE OF ej SKIP LOCKED
  LIMIT 1;

  IF v_job.id IS NOT NULL THEN
    v_lease_token := gen_random_uuid();

    UPDATE public.evaluation_jobs
    SET status = 'running',
        worker_id = p_worker_id,
        lease_token = v_lease_token,
        claimed_at = NOW(),
        lease_expires_at = NOW() + INTERVAL '30 seconds',
        attempt_count = attempt_count + 1
    WHERE id = v_job.id;

    RETURN QUERY SELECT v_job.id, v_job.submission_id, v_job.problem_id, v_job.round_id, v_job.code_text, v_lease_token;
  END IF;
END;
$$;

-- Compatible alias for Worker Orchestration daemons
CREATE OR REPLACE FUNCTION public.fetch_pending_evaluation_jobs(p_worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  submission_id UUID,
  problem_id UUID,
  round_id UUID,
  code_text TEXT,
  lease_token UUID
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql AS $$
  SELECT * FROM public.claim_evaluation_job(p_worker_id);
$$;

-- Heartbeat Renewal (Rejects stale, non-owning workers, or mismatched lease tokens)
CREATE OR REPLACE FUNCTION public.heartbeat_evaluation_job(
  p_job_id UUID, 
  p_worker_id TEXT,
  p_lease_token UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  -- Defense-in-depth: Ensure worker procedures can only be invoked by service_role (Evaluator Gateway)
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Worker evaluation procedures require service_role gateway authorization.';
  END IF;

  UPDATE public.evaluation_jobs
  SET lease_expires_at = NOW() + INTERVAL '30 seconds'
  WHERE id = p_job_id 
    AND worker_id = p_worker_id 
    AND lease_token = p_lease_token
    AND status = 'running'
    AND lease_expires_at > NOW();

  v_updated := FOUND;
  IF NOT v_updated THEN
    RAISE EXCEPTION 'Lease Violation: Worker % does not hold an active lease with token % on job %.', p_worker_id, p_lease_token, p_job_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Record Evaluation Test Case Result (Enforces active lease fencing token and unexpired lease)
CREATE OR REPLACE FUNCTION public.record_evaluation_test_result(
  p_job_id UUID,
  p_test_case_id UUID,
  p_worker_id TEXT,
  p_lease_token UUID,
  p_verdict public.verdict_enum,
  p_exec_time NUMERIC(10, 2),
  p_memory INT,
  p_stdout TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Defense-in-depth: Ensure worker procedures can only be invoked by service_role (Evaluator Gateway)
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Worker evaluation procedures require service_role gateway authorization.';
  END IF;

  SELECT * INTO v_job 
  FROM public.evaluation_jobs 
  WHERE id = p_job_id 
    AND worker_id = p_worker_id 
    AND lease_token = p_lease_token
    AND status = 'running'
    AND lease_expires_at > NOW();

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Ownership/Lease Error: Worker % does not hold an active unexpired lease token on job %.', p_worker_id, p_job_id;
  END IF;

  INSERT INTO public.evaluation_results (job_id, test_case_id, problem_id, round_id, verdict, execution_time_ms, memory_kb, sanitized_stdout)
  VALUES (p_job_id, p_test_case_id, v_job.problem_id, v_job.round_id, p_verdict, p_exec_time, p_memory, p_stdout)
  ON CONFLICT (job_id, test_case_id) DO UPDATE 
  SET verdict = EXCLUDED.verdict, 
      execution_time_ms = EXCLUDED.execution_time_ms, 
      memory_kb = EXCLUDED.memory_kb, 
      sanitized_stdout = EXCLUDED.sanitized_stdout;
END;
$$;

-- Complete Evaluation Job (Ownership, fencing token validation, and atomic score upsert)
CREATE OR REPLACE FUNCTION public.complete_evaluation_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_token UUID,
  p_final_status public.eval_status_enum
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_job RECORD;
  v_passed_points NUMERIC(10, 2) := 0.00;
  v_sub RECORD;
BEGIN
  -- Defense-in-depth: Ensure worker procedures can only be invoked by service_role (Evaluator Gateway)
  IF COALESCE(auth.role(), '') <> 'service_role' AND SESSION_USER NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access Denied: Worker evaluation procedures require service_role gateway authorization.';
  END IF;

  SELECT * INTO v_job 
  FROM public.evaluation_jobs 
  WHERE id = p_job_id 
    AND worker_id = p_worker_id 
    AND lease_token = p_lease_token
  FOR UPDATE;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Ownership Error: Worker % with token % does not own job %.', p_worker_id, p_lease_token, p_job_id;
  END IF;

  IF v_job.status <> 'running' OR v_job.lease_expires_at <= NOW() THEN
    RAISE EXCEPTION 'State Error: Job % lease has expired or job is not in running state.', p_job_id;
  END IF;

  SELECT * INTO v_sub FROM public.submissions WHERE id = v_job.submission_id;

  -- Calculate score from passed test cases
  SELECT COALESCE(SUM(tc.points), 0.00) INTO v_passed_points
  FROM public.evaluation_results er
  JOIN public.coding_test_cases tc ON tc.id = er.test_case_id
  WHERE er.job_id = p_job_id AND er.verdict = 'AC';

  -- Update job and submission
  UPDATE public.evaluation_jobs 
  SET status = p_final_status, lease_expires_at = NOW()
  WHERE id = p_job_id;

  UPDATE public.submissions 
  SET status = p_final_status 
  WHERE id = v_job.submission_id;

  -- Atomic upsert into round_scores (ensures score recorded even without pre-created row, preserves highest score & tie-breaker timestamp)
  INSERT INTO public.round_scores (
    round_id, team_id, event_id, primary_score, secondary_metric, last_valid_submission_at, calculated_at
  )
  VALUES (
    v_job.round_id, v_sub.team_id, v_sub.event_id, v_passed_points, 0.00, NOW(), NOW()
  )
  ON CONFLICT (round_id, team_id) DO UPDATE
  SET primary_score = GREATEST(round_scores.primary_score, EXCLUDED.primary_score),
      last_valid_submission_at = CASE
        WHEN EXCLUDED.primary_score > round_scores.primary_score THEN EXCLUDED.last_valid_submission_at
        ELSE round_scores.last_valid_submission_at
      END,
      calculated_at = EXCLUDED.calculated_at;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Standings & Public Leaderboard
-- ----------------------------------------------------------------------------

-- Calculate round standings and apply qualification thresholds (excludes demo squads)
CREATE OR REPLACE FUNCTION public.calculate_round_standings(
  p_event_id UUID,
  p_round_id UUID,
  p_cutoff_rank INT DEFAULT 10
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  -- Validate event admin
  IF NOT public.is_event_admin(p_event_id) THEN
    RAISE EXCEPTION 'Access Denied: Only event administrators can recalculate standings.';
  END IF;

  -- Compute ranks and qualifications (exclude demo squads and unapproved teams)
  WITH ranked AS (
    SELECT 
      rs.id,
      DENSE_RANK() OVER (
        ORDER BY 
          rs.primary_score DESC,
          rs.secondary_metric ASC,
          rs.last_valid_submission_at ASC NULLS LAST
      ) AS calc_rank
    FROM public.round_scores rs
    JOIN public.teams t ON t.id = rs.team_id AND t.event_id = rs.event_id
    WHERE rs.event_id = p_event_id 
      AND rs.round_id = p_round_id 
      AND t.status = 'approved'
      AND t.is_demo = FALSE
  )
  UPDATE public.round_scores rs
  SET rank = ranked.calc_rank,
      is_qualified = (ranked.calc_rank <= p_cutoff_rank),
      calculated_at = NOW()
  FROM ranked
  WHERE rs.id = ranked.id;
END;
$$;

-- Public Leaderboard projection (Sanitized, security definer, deterministic tie-breaking, excludes demo squads)
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(p_event_id UUID, p_round_id UUID)
RETURNS TABLE (
  rank BIGINT,
  team_name TEXT,
  department TEXT,
  score NUMERIC(10, 2),
  duration_seconds NUMERIC(10, 2),
  is_qualified BOOLEAN
)
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  -- 1. Validate round belongs to event and status permits public view
  IF NOT EXISTS (
    SELECT 1 FROM public.event_rounds r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_round_id AND r.event_id = p_event_id 
      AND e.status IN ('published', 'live', 'completed')
      AND r.status IN ('live', 'evaluating', 'completed')
  ) THEN
    RETURN;
  END IF;

  -- 2. Return sanitized public projection ordered lexicographically (excluding demo squads)
  RETURN QUERY
  SELECT 
    DENSE_RANK() OVER (
      ORDER BY 
        rs.primary_score DESC,
        rs.secondary_metric ASC,
        rs.last_valid_submission_at ASC NULLS LAST
    ) AS rank,
    t.name AS team_name,
    t.department,
    rs.primary_score AS score,
    ROUND(rs.secondary_metric / 1000.0, 2) AS duration_seconds,
    rs.is_qualified
  FROM public.round_scores rs
  JOIN public.teams t ON t.id = rs.team_id AND t.event_id = rs.event_id
  WHERE rs.event_id = p_event_id 
    AND rs.round_id = p_round_id 
    AND t.status = 'approved' 
    AND t.is_demo = FALSE
  ORDER BY 
    rs.primary_score DESC,
    rs.secondary_metric ASC,
    rs.last_valid_submission_at ASC NULLS LAST;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Function Execution Grants & Revocations
-- ----------------------------------------------------------------------------

-- Revoke all execute privileges from public
REVOKE EXECUTE ON FUNCTION public.provision_initial_super_admin(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_team_pin_login FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_event_invitation FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_quiz_attempt FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_quiz_answer FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_and_grade_quiz FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_mystery_progress FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_mystery_clue_answer FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_mystery_clue_hint FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fetch_pending_evaluation_jobs FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heartbeat_evaluation_job FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_evaluation_test_result FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_evaluation_job FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_round_standings FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_leaderboard FROM PUBLIC;

-- Grant administrative bootstrap exclusively to service_role (Edge Functions Gateway)
GRANT EXECUTE ON FUNCTION public.provision_initial_super_admin(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_team_pin_login TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_event_invitation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard TO anon, authenticated, service_role;

-- Grant competition stored procedures exclusively to service_role (Edge Functions Gateway & Worker Daemon)
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt TO service_role;
GRANT EXECUTE ON FUNCTION public.save_quiz_answer TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_and_grade_quiz TO service_role;
GRANT EXECUTE ON FUNCTION public.initialize_mystery_progress TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_mystery_clue_answer TO service_role;
GRANT EXECUTE ON FUNCTION public.request_mystery_clue_hint TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job TO service_role;
GRANT EXECUTE ON FUNCTION public.fetch_pending_evaluation_jobs TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_evaluation_job TO service_role;
GRANT EXECUTE ON FUNCTION public.record_evaluation_test_result TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_evaluation_job TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_round_standings TO authenticated, service_role;

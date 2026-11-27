-- ============================================================================
-- Eventora Platform – Local Development & Test Seed
-- File: supabase/seed.sql
-- Description: Grounded Demo Squads, Credentials & Sample Scores for Local/Staging Testing
-- Author: Eventora Platform Architecture Team
-- ============================================================================

DO $$
DECLARE
  v_env TEXT;
  v_event_id UUID := 'e0000000-0000-0000-0000-000000000001';
  v_r1_id    UUID := 'a0000001-0000-0000-0000-000000000001';
  v_r2_id    UUID := 'a0000002-0000-0000-0000-000000000002';
  v_r3_id    UUID := 'a0000003-0000-0000-0000-000000000003';
  v_r4_id    UUID := 'a0000004-0000-0000-0000-000000000004';
  v_team_id  UUID;
  v_existing_id UUID;
  v_is_demo  BOOLEAN;
BEGIN
  -- Dynamically resolve provisioned round IDs if already inserted
  SELECT id INTO v_r1_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 1;
  SELECT id INTO v_r2_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 2;
  SELECT id INTO v_r3_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 3;
  SELECT id INTO v_r4_id FROM public.event_rounds WHERE event_id = v_event_id AND round_number = 4;

  -- --------------------------------------------------------------------------
  -- Strict Fail-Closed Environment Guard (Directive P0)
  -- --------------------------------------------------------------------------
  -- Missing, empty, or unapproved environment settings MUST NOT be interpreted
  -- as permission to seed. Execution is strictly blocked unless app.environment
  -- is explicitly set to an authorized non-production environment.
  v_env := NULLIF(TRIM(current_setting('app.environment', true)), '');

  IF v_env IS NULL THEN
    RAISE EXCEPTION 'FATAL [seed.sql]: Execution blocked. "app.environment" session parameter is not set. Demo seeds require an explicit non-production environment declaration, e.g.: SET app.environment = ''local''; or SET app.environment = ''test'';';
  END IF;

  IF v_env NOT IN ('local', 'development', 'test') THEN
    RAISE EXCEPTION 'FATAL [seed.sql]: Execution forbidden in "%" environment. Demo seeds must never be executed against staging or production databases.', v_env;
  END IF;

  RAISE NOTICE '[seed.sql]: Authorized for environment "%". Seeding demo squads...', v_env;
  -- --------------------------------------------------------------------------
  -- 8. 20 Grounded Demo Teams (is_demo = TRUE, PIN: 1234, Cutoff Qualified)
  -- --------------------------------------------------------------------------

  -- Safe resolution for demo team: Neural Knights
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Neural Knights';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Neural Knights';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0001-0000-0000-000000000000', v_event_id, 'Neural Knights', 'CSE-A', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0001-0001-0000-000000000000', v_team_id, v_event_id, 'Aarav Patel', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0001-0002-0000-000000000000', v_team_id, v_event_id, 'Priya Sharma', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0001-0003-0000-000000000000', v_team_id, v_event_id, 'Kunal Bajaj', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0001-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0001-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 24.00, 420000, TRUE, 1, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0001-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0001-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 1, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Binary Beasts
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Binary Beasts';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Binary Beasts';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0002-0000-0000-000000000000', v_event_id, 'Binary Beasts', 'AI&DS', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0002-0001-0000-000000000000', v_team_id, v_event_id, 'Rohan Varma', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0002-0002-0000-000000000000', v_team_id, v_event_id, 'Sneha Iyer', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0002-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0002-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 23.00, 480000, TRUE, 2, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0002-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0002-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 2, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Quantum Coders
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Quantum Coders';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Quantum Coders';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0003-0000-0000-000000000000', v_event_id, 'Quantum Coders', 'CSE-B', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0003-0001-0000-000000000000', v_team_id, v_event_id, 'Vikram Reddy', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0003-0002-0000-000000000000', v_team_id, v_event_id, 'Neha Gupta', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0003-0003-0000-000000000000', v_team_id, v_event_id, 'Arjun Nair', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0003-0004-0000-000000000000', v_team_id, v_event_id, 'Diya Sen', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0003-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0003-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 23.00, 510000, TRUE, 3, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0003-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0003-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 3, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Algo Wizards
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Algo Wizards';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Algo Wizards';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0004-0000-0000-000000000000', v_event_id, 'Algo Wizards', 'IT', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0004-0001-0000-000000000000', v_team_id, v_event_id, 'Kiran Rao', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0004-0002-0000-000000000000', v_team_id, v_event_id, 'Meera Das', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0004-0003-0000-000000000000', v_team_id, v_event_id, 'Sahil Verma', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0004-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0004-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 22.00, 530000, TRUE, 4, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0004-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0004-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 4, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Cyber Titans
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Cyber Titans';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Cyber Titans';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0005-0000-0000-000000000000', v_event_id, 'Cyber Titans', 'CyberSec', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0005-0001-0000-000000000000', v_team_id, v_event_id, 'Ananya Joshi', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0005-0002-0000-000000000000', v_team_id, v_event_id, 'Dev Mehta', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0005-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0005-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 21.00, 560000, TRUE, 5, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0005-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0005-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 5, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Syntax Strikers
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Syntax Strikers';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Syntax Strikers';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0006-0000-0000-000000000000', v_event_id, 'Syntax Strikers', 'CSE-C', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0006-0001-0000-000000000000', v_team_id, v_event_id, 'Riya Shah', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0006-0002-0000-000000000000', v_team_id, v_event_id, 'Harsh Jain', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0006-0003-0000-000000000000', v_team_id, v_event_id, 'Pooja Bose', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0006-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0006-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 21.00, 590000, TRUE, 6, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0006-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0006-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 6, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Byte Brawlers
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Byte Brawlers';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Byte Brawlers';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0007-0000-0000-000000000000', v_event_id, 'Byte Brawlers', 'ECE', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0007-0001-0000-000000000000', v_team_id, v_event_id, 'Nikhil Kulkarni', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0007-0002-0000-000000000000', v_team_id, v_event_id, 'Kavya Menon', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0007-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0007-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 20.00, 610000, TRUE, 7, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0007-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0007-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 7, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Logic Lords
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Logic Lords';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Logic Lords';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0008-0000-0000-000000000000', v_event_id, 'Logic Lords', 'AIML', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0008-0001-0000-000000000000', v_team_id, v_event_id, 'Rahul Kumar', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0008-0002-0000-000000000000', v_team_id, v_event_id, 'Ishaan Dixit', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0008-0003-0000-000000000000', v_team_id, v_event_id, 'Nidhi Agarwal', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0008-0004-0000-000000000000', v_team_id, v_event_id, 'Tanvi Pillai', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0008-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0008-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 20.00, 640000, TRUE, 8, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0008-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0008-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 70.0, 120000, TRUE, 8, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Data Dynamos
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Data Dynamos';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Data Dynamos';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0009-0000-0000-000000000000', v_event_id, 'Data Dynamos', 'DataSci', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0009-0001-0000-000000000000', v_team_id, v_event_id, 'Amit Roy', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0009-0002-0000-000000000000', v_team_id, v_event_id, 'Sakshi Bhat', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0009-0003-0000-000000000000', v_team_id, v_event_id, 'Varun Deshmukh', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0009-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0009-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 19.00, 670000, TRUE, 9, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0009-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0009-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 17, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Pixel Pioneers
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Pixel Pioneers';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Pixel Pioneers';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0010-0000-0000-000000000000', v_event_id, 'Pixel Pioneers', 'CSE-A', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0010-0001-0000-000000000000', v_team_id, v_event_id, 'Shreya Ghosh', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0010-0002-0000-000000000000', v_team_id, v_event_id, 'Aditya Choudhury', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0010-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0010-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 18.00, 700000, TRUE, 10, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0010-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0010-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 18, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Matrix Mavericks
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Matrix Mavericks';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Matrix Mavericks';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0011-0000-0000-000000000000', v_event_id, 'Matrix Mavericks', 'IT', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0011-0001-0000-000000000000', v_team_id, v_event_id, 'Trisha Ray', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0011-0002-0000-000000000000', v_team_id, v_event_id, 'Gaurav Sethi', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0011-0003-0000-000000000000', v_team_id, v_event_id, 'Simran Kaur', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0011-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0011-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 18.00, 720000, TRUE, 11, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0011-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0011-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 19, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Code Alchemists
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Code Alchemists';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Code Alchemists';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0012-0000-0000-000000000000', v_event_id, 'Code Alchemists', 'AI&DS', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0012-0001-0000-000000000000', v_team_id, v_event_id, 'Manish Pandey', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0012-0002-0000-000000000000', v_team_id, v_event_id, 'Divya Nambiar', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0012-0003-0000-000000000000', v_team_id, v_event_id, 'Suresh Pillai', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0012-0004-0000-000000000000', v_team_id, v_event_id, 'Bhavna Mittal', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0012-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0012-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 17.00, 750000, TRUE, 12, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0012-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0012-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 20, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Silicon Sages
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Silicon Sages';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Silicon Sages';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0013-0000-0000-000000000000', v_event_id, 'Silicon Sages', 'ECE', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0013-0001-0000-000000000000', v_team_id, v_event_id, 'Parul Trivedi', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0013-0002-0000-000000000000', v_team_id, v_event_id, 'Ajay Singhal', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0013-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0013-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 16.00, 780000, TRUE, 13, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0013-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0013-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 21, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Tensor Titans
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Tensor Titans';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Tensor Titans';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0014-0000-0000-000000000000', v_event_id, 'Tensor Titans', 'CSE-B', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0014-0001-0000-000000000000', v_team_id, v_event_id, 'Swati Mathur', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0014-0002-0000-000000000000', v_team_id, v_event_id, 'Deepak Chawla', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0014-0003-0000-000000000000', v_team_id, v_event_id, 'Lata Subramanian', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0014-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0014-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 16.00, 810000, TRUE, 14, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0014-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0014-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 22, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Prompt Prodigies
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Prompt Prodigies';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Prompt Prodigies';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0015-0000-0000-000000000000', v_event_id, 'Prompt Prodigies', 'AIML', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0015-0001-0000-000000000000', v_team_id, v_event_id, 'Karan Singhania', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0015-0002-0000-000000000000', v_team_id, v_event_id, 'Aditi Verma', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0015-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0015-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 15.00, 840000, TRUE, 15, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0015-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0015-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 23, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Bug Busters
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Bug Busters';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Bug Busters';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0016-0000-0000-000000000000', v_event_id, 'Bug Busters', 'IT', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0016-0001-0000-000000000000', v_team_id, v_event_id, 'Yash Malhotra', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0016-0002-0000-000000000000', v_team_id, v_event_id, 'Zoya Khan', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0016-0003-0000-000000000000', v_team_id, v_event_id, 'Kabir Bedi', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0016-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0016-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 15.00, 870000, TRUE, 16, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF TRUE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0016-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0016-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 40.0, 120000, FALSE, 24, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Stack Smashers
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Stack Smashers';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Stack Smashers';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0017-0000-0000-000000000000', v_event_id, 'Stack Smashers', 'CSE-C', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0017-0001-0000-000000000000', v_team_id, v_event_id, 'Sameer Joshi', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0017-0002-0000-000000000000', v_team_id, v_event_id, 'Tanya Kapoor', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0017-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0017-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 14.00, 900000, FALSE, 17, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF FALSE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0017-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0017-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 0.0, 120000, FALSE, 25, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Dev Dragons
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Dev Dragons';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Dev Dragons';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0018-0000-0000-000000000000', v_event_id, 'Dev Dragons', 'CyberSec', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0018-0001-0000-000000000000', v_team_id, v_event_id, 'Rishi Kapoor', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0018-0002-0000-000000000000', v_team_id, v_event_id, 'Tara Alva', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0018-0003-0000-000000000000', v_team_id, v_event_id, 'Aryan Goel', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0018-0004-0000-000000000000', v_team_id, v_event_id, 'Mira Nair', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0018-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0018-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 13.00, 930000, FALSE, 18, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF FALSE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0018-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0018-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 0.0, 120000, FALSE, 26, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Turbo Testers
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Turbo Testers';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Turbo Testers';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0019-0000-0000-000000000000', v_event_id, 'Turbo Testers', 'ECE', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0019-0001-0000-000000000000', v_team_id, v_event_id, 'Farhan Akhtar', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0019-0002-0000-000000000000', v_team_id, v_event_id, 'Shruti Hassan', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0019-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0019-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 12.00, 960000, FALSE, 19, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF FALSE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0019-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0019-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 0.0, 120000, FALSE, 27, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

  -- Safe resolution for demo team: Hex Heroes
  SELECT id, is_demo INTO v_existing_id, v_is_demo
  FROM public.teams
  WHERE event_id = v_event_id AND name = 'Hex Heroes';

  IF v_existing_id IS NOT NULL THEN
    IF v_is_demo IS FALSE THEN
      -- Existing legitimate non-demo team: NEVER overwrite or convert!
      RAISE NOTICE '[seed.sql]: Skipping demo seed for "%" as a legitimate non-demo team already exists.', 'Hex Heroes';
      v_team_id := NULL;
    ELSE
      -- Existing demo team: reuse its resolved UUID
      v_team_id := v_existing_id;
    END IF;
  ELSE
    INSERT INTO public.teams (id, event_id, name, department, college, status, is_demo)
    VALUES ('d0000000-0020-0000-0000-000000000000', v_event_id, 'Hex Heroes', 'CSE-A', 'Main Campus', 'approved', TRUE)
    RETURNING id INTO v_team_id;
  END IF;

  IF v_team_id IS NOT NULL THEN

  -- Private credentials vault: PIN 1234
  INSERT INTO public.team_auth_credentials (team_id, event_id, pin_hash, failed_login_attempts)
  VALUES (v_team_id, v_event_id, crypt('1234', gen_salt('bf', 8)), 0)
  ON CONFLICT (team_id) DO NOTHING;

  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0020-0001-0000-000000000000', v_team_id, v_event_id, 'Chetan Bhagat', TRUE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0020-0002-0000-000000000000', v_team_id, v_event_id, 'Twinkle Khanna', FALSE)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.team_members (id, team_id, event_id, full_name, is_lead)
  VALUES ('de000000-0020-0003-0000-000000000000', v_team_id, v_event_id, 'Sunil Grover', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Round 1 Participation & Completed Score
  INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed, completed_at)
  VALUES ('dc000001-0020-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 35 minutes', TRUE, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO NOTHING;

  INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
  VALUES ('df000001-0020-0000-0000-000000000000', v_r1_id, v_team_id, v_event_id, 11.00, 990000, FALSE, 20, NOW() - INTERVAL '1 hour 40 minutes')
  ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, rank = EXCLUDED.rank, is_qualified = EXCLUDED.is_qualified;

  -- Round 2 Participation (Active for top 16)
  IF FALSE THEN
    INSERT INTO public.round_participations (id, round_id, team_id, event_id, started_at, expires_at, is_completed)
    VALUES ('dc000002-0020-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '10 minutes', FALSE)
    ON CONFLICT (round_id, team_id) DO NOTHING;

    INSERT INTO public.round_scores (id, round_id, team_id, event_id, primary_score, secondary_metric, is_qualified, rank, last_valid_submission_at)
    VALUES ('df000002-0020-0000-0000-000000000000', v_r2_id, v_team_id, v_event_id, 0.0, 120000, FALSE, 28, NOW() - INTERVAL '10 minutes')
    ON CONFLICT (round_id, team_id) DO UPDATE SET primary_score = EXCLUDED.primary_score, is_qualified = EXCLUDED.is_qualified;
  END IF;
  END IF;

END $$;

-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 001_extensions_and_types.sql
-- Description: PostgreSQL 15+ Extensions and Domain Enumerations
-- Author: Eventora Platform Architecture Team
-- ============================================================================

-- Enable required core extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Platform-wide user role enum
DO $$ BEGIN
  CREATE TYPE public.platform_role_enum AS ENUM (
    'super_admin',
    'organizer',
    'participant'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Event lifecycle status enum
DO $$ BEGIN
  CREATE TYPE public.event_status_enum AS ENUM (
    'draft',
    'published',
    'live',
    'completed',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Collaborator administrative role enum
DO $$ BEGIN
  CREATE TYPE public.collaborator_role_enum AS ENUM (
    'owner',
    'admin',
    'judge',
    'proctor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Competition round domain type enum
DO $$ BEGIN
  CREATE TYPE public.round_type_enum AS ENUM (
    'quiz',
    'coding',
    'mystery',
    'jury'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Competition round operational status enum
DO $$ BEGIN
  CREATE TYPE public.round_status_enum AS ENUM (
    'scheduled',
    'live',
    'paused',
    'evaluating',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Squad registration & participation status enum
DO $$ BEGIN
  CREATE TYPE public.team_status_enum AS ENUM (
    'pending',
    'approved',
    'disqualified'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Asynchronous submission & worker evaluation status enum
DO $$ BEGIN
  CREATE TYPE public.eval_status_enum AS ENUM (
    'pending',
    'running',
    'passed',
    'failed',
    'error',
    'timed_out'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Sandbox execution test case verdict enum
DO $$ BEGIN
  CREATE TYPE public.verdict_enum AS ENUM (
    'AC',   -- Accepted / Passed
    'WA',   -- Wrong Answer
    'TLE',  -- Time Limit Exceeded
    'MLE',  -- Memory Limit Exceeded
    'RE',   -- Runtime Error
    'CE'    -- Compilation Error
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

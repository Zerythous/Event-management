-- ============================================================================
-- Eventora Platform – Phase 1B Database Migration
-- File: 006_aiathlon_2026_competition_content.sql
-- Description: Canonical AI-ATHLON 2026 Competition Definition & Content
-- Author: Eventora Platform Architecture Team
-- ============================================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_event_id UUID := 'e0000000-0000-0000-0000-000000000001';
  v_r1_id    UUID := 'a0000001-0000-0000-0000-000000000001';
  v_r2_id    UUID := 'a0000002-0000-0000-0000-000000000002';
  v_r3_id    UUID := 'a0000003-0000-0000-0000-000000000003';
  v_r4_id    UUID := 'a0000004-0000-0000-0000-000000000004';
  v_ch_id    UUID := 'b0000001-0000-0000-0000-000000000001';
  v_salt     TEXT := 'aiathlon_salt_2026';

  v_q_id     UUID;
  v_o_id     UUID;
  v_corr_id  UUID;
  v_prob_id  UUID;
  v_clue_id  UUID;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. Resolve Platform Administrator (Optional at migration time)
  -- --------------------------------------------------------------------------
  SELECT id INTO v_admin_id FROM public.profiles WHERE platform_role = 'super_admin' LIMIT 1;

  -- 2. Provision AI-ATHLON 2026 Event
  -- --------------------------------------------------------------------------
  INSERT INTO public.events (id, name, slug, description, status, created_by, starts_at, ends_at, settings)
  VALUES (
    v_event_id,
    'AI-ATHLON: The Tech Triathlon 2026',
    'aiathlon-2026',
    'The Premier 3-Stage Inter-College AI & Software Engineering Championship',
    'live',
    v_admin_id,
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '6 hours',
    '{"max_team_size":4,"min_team_size":2,"allow_guest_spectators":true,"cutoffs":{"r1":16,"r2":8,"r3":4}}'::JSONB
  )
  ON CONFLICT (slug) DO UPDATE SET status = 'live', name = EXCLUDED.name;

  -- --------------------------------------------------------------------------
  -- 3. Provision 4 Competition Rounds
  -- --------------------------------------------------------------------------
  INSERT INTO public.event_rounds (id, event_id, round_number, name, type, status, duration_minutes, config)
  VALUES 
    (v_r1_id, v_event_id, 1, 'Prompt Engineering & Tech Quiz', 'quiz', 'completed', 25, '{"total_questions":25,"cutoff":16,"points_per_question":1.00,"negative_marking":0.00}'::JSONB),
    (v_r2_id, v_event_id, 2, 'Speed Debugging (C Language)', 'coding', 'live', 30, '{"total_problems":8,"cutoff":8,"max_points_per_problem":10.00}'::JSONB),
    (v_r3_id, v_event_id, 3, 'Mystery Tech Challenge', 'mystery', 'scheduled', 25, '{"total_clues":5,"cutoff":4,"hint_penalty_seconds":60}'::JSONB),
    (v_r4_id, v_event_id, 4, 'Grand Finale (Jury Pitch)', 'jury', 'scheduled', 30, '{"total_criteria":5,"max_total_score":50.00}'::JSONB)
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name;


  -- --------------------------------------------------------------------------
  -- 4. Round 1: 25 MCQ Questions Bank, Options & Private Answers
  -- --------------------------------------------------------------------------

  v_q_id := 'd0000001-0001-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 1, 'Reverse Prompting', 'An AI generated this output:

"The mitochondria is the powerhouse of the cell. It converts glucose into ATP through cellular respiration, specifically via glycolysis, the Krebs cycle, and oxidative phosphorylation."

Which prompt most likely produced this exact explanation?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0001-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Write a poem about biology')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0001-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain the function of mitochondria in simple terms')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0001-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'List all organelles in a plant cell')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0001-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Compare mitochondria and chloroplasts')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0002-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 2, 'Reverse Prompting', 'An AI produced this code:

"def fibonacci(n):
    if n <= 1: return n
    return fibonacci(n-1) + fibonacci(n-2)"

Which prompt was most likely submitted by the user?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0002-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Write a Python function for binary search')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0002-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain dynamic programming with an example')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0002-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Write a recursive Python function for the Fibonacci sequence')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0002-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Optimize the Fibonacci algorithm using memoization')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0003-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 3, 'Reverse Prompting', 'An AI generated: "Step 1: Preheat oven to 180°C. Step 2: Mix flour, sugar, and eggs. Step 3: Pour batter into a greased pan. Step 4: Bake for 25-30 minutes."

What was the most likely prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0003-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Give me a recipe for homemade sourdough bread')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0003-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'How do I make a simple basic cake at home?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0003-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'What temperature should I bake artisan cookies at?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0003-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Explain the chemical reactions during baking')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0004-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 4, 'Reverse Prompting', 'An AI returned: "SELECT name, age FROM students WHERE grade = ''A'' ORDER BY age DESC LIMIT 10;"

Which prompt created this query?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0004-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Create a database schema for student records in SQL')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0004-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Write an SQL query to retrieve the 10 oldest A-grade students')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0004-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Explain what SQL inner and outer joins do')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0004-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Insert a new student record into the classroom database')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0005-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 5, 'Reverse Prompting', 'AI output: "The French Revolution began in 1789 and concluded in 1799. Core causes included fiscal bankruptcy, structural inequality between the Three Estates, and the spread of Enlightenment ideals."

Most probable prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0005-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Contrast the French and American revolutionary wars')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0005-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'List the monarchs of 18th century Europe')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0005-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Give a concise overview of the French Revolution and its root causes')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0005-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'What were the geopolitical consequences of World War I?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0006-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 6, 'Reverse Prompting', 'AI response: "To center a div both horizontally and vertically in modern CSS:

.parent { display: flex; justify-content: center; align-items: center; min-height: 100vh; }"

Which prompt prompted this snippet?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0006-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'How do I center a div both vertically and horizontally in CSS?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0006-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain the difference between block and inline elements')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0006-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Build a responsive sticky navigation bar in HTML5')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0006-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'When should I use CSS Grid instead of Flexbox?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0007-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 7, 'Reverse Prompting', 'AI response: "Machine Learning is a branch of artificial intelligence where algorithms improve through experience without explicit programming. Its three primary paradigms are supervised, unsupervised, and reinforcement learning."

Best matching prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0007-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Code a deep convolutional network from scratch in Python')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0007-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Define machine learning and explain its three core types')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0007-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Why is reinforcement learning harder than classical search?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0007-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'List ethical concerns surrounding generative AI')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0008-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 8, 'Reverse Prompting', 'AI response: "1. Tokyo (37.4M)
2. Delhi (32.9M)
3. Shanghai (29.2M)
4. São Paulo (22.4M)
5. Mexico City (21.9M)"

Most probable prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0008-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Which nations have the highest nominal GDP?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0008-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'List the top 5 largest metropolitan cities by population')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0008-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Compare cost-of-living indices across Asian capital cities')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0008-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Where are the fastest growing AI startup hubs located?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0009-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 9, 'Spot the Hallucination', 'An LLM writes in a tutoring session: "The square root of 144 is 14." What is the hallucination?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0009-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'No error: √144 = 14')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0009-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Incorrect calculation: √144 = 12')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0009-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Incorrect calculation: √144 = 11')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0009-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Valid only for negative square roots')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0010-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 10, 'Spot the Hallucination', 'AI says: "Python was engineered by James Gosling at Sun Microsystems in 1991 to replace C++." Spot the mistake:', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0010-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Python was released in 1995, not 1991')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0010-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'James Gosling created Java at Sun Microsystems; Python was created by Guido van Rossum at CWI')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0010-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Sun Microsystems never existed; it was developed at Bell Labs')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0010-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Everything in the statement is technically accurate')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0011-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 11, 'Spot the Hallucination', 'AI claims: "If an electric train travels at a constant 60 km/h for 2.5 hours, the total distance traveled is 180 km." Is this accurate?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0011-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Yes, 60 × 2.5 = 180 km')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0011-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'No, 60 × 2.5 = 150 km')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0011-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'No, electric trains lose 10% speed due to friction')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0011-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Yes, assuming no scheduled stops')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0012-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 12, 'Spot the Hallucination', 'AI states: "In 4-bit binary representation, the decimal integer 13 is written as 1110." Spot the error:', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0012-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, '13 in binary is 1101 (8 + 4 + 0 + 1 = 13)')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0012-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, '13 in binary is 1111')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0012-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, '13 in binary is 1011')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0012-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, '1110 is correct because binary is read right-to-left')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0013-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 13, 'Spot the Hallucination', 'AI outputs: "HTTP status code 404 indicates an Internal Server Error caused by database crashes." Where is the hallucination?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0013-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, '404 indicates "Not Found"; 500 indicates "Internal Server Error"')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0013-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, '404 indicates "Forbidden Access"')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0013-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, '404 indicates "Bad Request"')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0013-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'The explanation is accurate for modern web APIs')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0014-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 14, 'Spot the Hallucination', 'AI says: "Binary Search on an ordered array of n elements takes O(n) average-case time." What is wrong?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0014-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Binary Search runs in O(log n) time because it halves the search space each step')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0014-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Binary Search runs in O(1) time')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0014-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Binary Search runs in O(n²) time')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0014-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Binary Search only works on linked lists')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0015-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 15, 'Spot the Hallucination', 'AI writes: "At standard atmospheric pressure, pure water boils at 100°C and has the chemical formula H₃O." Identify the hallucination:', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0015-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Boiling point is wrong (it boils at 90°C)')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0015-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Chemical formula is wrong: water is H₂O; H₃O⁺ is the hydronium ion')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0015-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Both the boiling point and formula are wrong')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0015-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'H₃O is the standardized IUPAC notation for boiling water')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0016-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 16, 'Spot the Hallucination', 'AI claims: "A Stack data structure strictly operates on the FIFO (First-In, First-Out) principle." Where is the error?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0016-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Stacks operate on LIFO (Last-In, First-Out); Queues operate on FIFO')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0016-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Stacks operate on FILO and FIFO simultaneously')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0016-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Stacks have no defined order of element access')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0016-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'The statement is fully correct')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0017-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 17, 'Spot the Hallucination', 'AI states: "Saturn is the largest planet in our solar system, with an equatorial diameter of 139,820 km." Spot the hallucination:', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0017-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'The diameter belongs to Uranus')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0017-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Jupiter is the largest planet in our solar system; that diameter belongs to Jupiter')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0017-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Saturn is indeed the largest planet')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0017-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'The diameter should be measured in miles, not km')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0018-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 18, 'Prompt Fix', 'A student asked: "Tell me about Java." The model returned a long travel guide on the island of Java in Indonesia. How should the prompt be refined for computer science?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0018-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Tell me about Java beans')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0018-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain the Java object-oriented programming language, its core runtime architecture, and key use cases')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0018-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Java code only')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0018-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Java programming language please be fast')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0019-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 19, 'Prompt Fix', 'User prompt: "Write code." AI returned a 250-line async web scraper. The student only needed a 1-line Python greeting. Best revised prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0019-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Make code smaller')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0019-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Write a simple 1-line Python script that prints "Hello, World!" to the console')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0019-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Just give me code')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0019-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Write beginner code without any libraries')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0020-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 20, 'Prompt Fix', 'User asked: "Summarize AI." Model generated an 8-page academic survey with citations. The user wanted a 2-sentence elevator pitch. Best fix?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0020-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Shorter summary')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0020-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'In exactly two sentences, provide an intuitive summary of artificial intelligence suitable for a first-year college orientation')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0020-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Summarize AI but don''t write too much')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0020-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'AI in 5 words')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0021-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 21, 'Prompt Fix', 'User prompt: "What programming languages exist?" Model output an endless alphabetical glossary. User wanted top 3 languages for first-year job prospects. Best revised prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0021-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Less languages')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0021-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'List the top 3 most in-demand programming languages for tech internships in 2026 with a brief 1-sentence rationale for each')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0021-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Best languages 2026')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0021-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Give me 3 languages only')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0022-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 22, 'Prompt Fix', 'User asked: "Explain recursion." AI replied using formal lambda calculus and mathematical induction proofs. Best prompt for an absolute beginner?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0022-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Make recursion simpler')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0022-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain recursion using a simple real-world analogy (like Russian nesting dolls or mirrors) that a student with zero coding background can understand')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0022-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Recursion for dummies in C')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0022-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'What is base case?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0023-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 23, 'Prompt Fix', 'User prompt: "Create a website." Model halted and asked 10 scoping questions about databases and auth. User wants a static personal portfolio in HTML/CSS. Best fix?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0023-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Just build any website')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0023-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Generate a clean, single-page personal portfolio website in HTML and CSS with sections for About Me, Skills, Projects, and Contact')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0023-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Portfolio website code right now')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0023-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Build website with Tailwind')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0024-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 24, 'Prompt Fix', 'User asked: "Is Python or C++ better?" AI gave an evasive "it depends" answer. The student wants a structured side-by-side trade-off table. Best prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0024-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Pick one and don''t say it depends')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0024-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Create a Markdown comparison table comparing Python vs C++ across: execution speed, learning curve, memory management, and primary industry applications')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0024-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Python vs C++ who wins?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0024-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'Which language should I choose for first year?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  v_q_id := 'd0000001-0025-0000-0000-000000000000';
  INSERT INTO public.quiz_questions (id, round_id, event_id, question_order, category, question_text, points, negative_points)
  VALUES (v_q_id, v_r1_id, v_event_id, 25, 'Prompt Fix', 'User asked: "Debug: x = 10 / 0". Model gave corrected syntax, but the student wanted to understand the mathematical theory behind division by zero. Best prompt?', 1.00, 0.00)
  ON CONFLICT (round_id, question_order) DO UPDATE SET question_text = EXCLUDED.question_text;

  v_o_id := 'f0000001-0025-0000-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 0, 'Why does zero division fail?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0025-0001-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 1, 'Explain mathematically why division by zero is undefined using limits and inverse multiplication concepts understandable to a freshman')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_corr_id := v_o_id;
  v_o_id := 'f0000001-0025-0002-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 2, 'Explain zero error without showing code')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  v_o_id := 'f0000001-0025-0003-0000-000000000000';
  INSERT INTO public.quiz_options (id, question_id, round_id, option_index, option_text)
  VALUES (v_o_id, v_q_id, v_r1_id, 3, 'What happens if you divide by 0 in real life?')
  ON CONFLICT (question_id, option_index) DO UPDATE SET option_text = EXCLUDED.option_text;
  INSERT INTO public.quiz_answers (question_id, round_id, correct_option_id, explanation)
  VALUES (v_q_id, v_r1_id, v_corr_id, 'Official AI-ATHLON verified answer key.')
  ON CONFLICT (question_id) DO UPDATE SET correct_option_id = EXCLUDED.correct_option_id;


  -- --------------------------------------------------------------------------
  -- 5. Round 2: 8 C Speed-Debugging Problems & Evaluation Test Cases
  -- --------------------------------------------------------------------------

  v_prob_id := 'b0000002-0001-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'A1', 'Problem A1: Grade Calculator (if-else logic)', 'This program must print the letter grade for a given percentage (90+ = A, 80-89 = B, 70-79 = C, 60-69 = D, below 60 = F). It has inverted conditionals causing wrong grades. Fix the bugs.', 'Input: 85 -> Output: Grade: B
Input: 72 -> Output: Grade: C
Input: 45 -> Output: Grade: F', '#include <stdio.h>
int main() {
    int marks;
    printf("Enter marks: ");
    scanf("%d", &marks);

    if (marks >= 90)
        printf("Grade: A\
");
    else if (marks >= 80)
        printf("Grade: B\
");
    else if (marks >= 70)
        printf("Grade: D\
");   // BUG 1: Inverted grade letter
    else if (marks >= 60)
        printf("Grade: C\
");   // BUG 2: Inverted grade letter
    else
        printf("Grade: F\
");

    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0001-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0001-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0002-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'A2', 'Problem A2: Sum of First N Numbers (Loops)', 'This program must compute 1 + 2 + ... + N. It initializes the accumulator incorrectly and has an off-by-one loop boundary bug. Fix both bugs.', 'Input: 5 -> Output: Sum = 15
Input: 10 -> Output: Sum = 55', '#include <stdio.h>
int main() {
    int n, sum = 1;              // BUG 1: Initialized to 1 instead of 0
    printf("Enter N: ");
    scanf("%d", &n);

    for (int i = 1; i < n; i++) { // BUG 2: Loop stops at n-1 instead of <= n
        sum = sum + i;
    }

    printf("Sum = %d\
", sum);
    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0002-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0002-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0003-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'A3', 'Problem A3: Array Maximum Value (1D Arrays)', 'This program should find and print the maximum value in an array of 5 integers. It fails when all numbers are negative due to wrong baseline initialization. Fix it.', 'Input: 3 7 2 9 4 -> Output: Maximum = 9
Input: -10 -5 -20 -8 -15 -> Output: Maximum = -5', '#include <stdio.h>
int main() {
    int arr[5], max;
    printf("Enter 5 numbers: ");
    for (int i = 0; i < 5; i++) {
        scanf("%d", &arr[i]);
    }

    max = 0;                      // BUG 1: Fails when all elements are negative; should be arr[0]
    for (int i = 0; i < 5; i++) {
        if (arr[i] > max) {
            max = arr[i];
        }
    }

    printf("Maximum = %d\
", max);
    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0003-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0003-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0004-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'A4', 'Problem A4: Vowel Counter (Strings)', 'This program counts all vowels in a string. It misses the letter ''u'' and ignores uppercase vowels entirely. Fix the logic.', 'Input: Hello World -> Output: Vowels = 3
Input: AI ATHLON -> Output: Vowels = 4', '#include <stdio.h>
#include <string.h>
int main() {
    char str[100];
    int count = 0;
    printf("Enter string: ");
    fgets(str, sizeof(str), stdin);

    for (int i = 0; i < strlen(str); i++) {
        // BUG: Missing ''u''/''U'' and uppercase vowels
        if (str[i] == ''a'' || str[i] == ''e'' || str[i] == ''i'' || str[i] == ''o'') {
            count++;
        }
    }

    printf("Vowels = %d\
", count);
    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0004-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0004-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0005-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'B1', 'Problem B1: Leap Year Determination (if-else)', 'This program checks if a given year is a leap year. It misses the Gregorian century rule (century years divisible by 100 are not leap years unless divisible by 400). Fix it.', 'Input: 2000 -> Output: 2000 is a Leap Year
Input: 1900 -> Output: 1900 is NOT a Leap Year
Input: 2024 -> Output: 2024 is a Leap Year', '#include <stdio.h>
int main() {
    int year;
    printf("Enter year: ");
    scanf("%d", &year);

    // BUG: Missing century validation logic
    if (year % 4 == 0) {
        printf("%d is a Leap Year\
", year);
    } else {
        printf("%d is NOT a Leap Year\
", year);
    }

    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0005-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0005-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0006-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'B2', 'Problem B2: Multiplication Table (Loops)', 'This program must print the multiplication table of a number from 1 to 10. It starts from 0 and performs addition instead of multiplication. Fix both.', 'Input: 7 -> Output:
7 x 1 = 7
7 x 2 = 14
...
7 x 10 = 70', '#include <stdio.h>
int main() {
    int num;
    printf("Enter number: ");
    scanf("%d", &num);

    for (int i = 0; i <= 10; i++) {              // BUG 1: Starts at 0 instead of 1
        printf("%d x %d = %d\
", num, i, num + i); // BUG 2: num + i instead of num * i
    }

    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0006-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0006-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0007-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'B3', 'Problem B3: Array In-Place Reversal (1D Arrays)', 'This program reverses an array of 5 integers in place. It loops across the entire length, reversing it twice back to original. Fix it.', 'Input: 1 2 3 4 5 -> Output: Reversed: 5 4 3 2 1', '#include <stdio.h>
int main() {
    int arr[5], temp;
    printf("Enter 5 numbers: ");
    for (int i = 0; i < 5; i++) {
        scanf("%d", &arr[i]);
    }

    for (int i = 0; i < 5; i++) {       // BUG: Should iterate only up to 5/2 (i < 2)
        temp = arr[i];
        arr[i] = arr[4 - i];
        arr[4 - i] = temp;
    }

    printf("Reversed: ");
    for (int i = 0; i < 5; i++) {
        printf("%d ", arr[i]);
    }
    printf("\
");
    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0007-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0007-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  v_prob_id := 'b0000002-0008-0000-0000-000000000000';
  INSERT INTO public.coding_problems (id, round_id, event_id, problem_code, title, description, expected_output_hint, starting_code, time_limit_ms, memory_limit_kb)
  VALUES (v_prob_id, v_r2_id, v_event_id, 'B4', 'Problem B4: String Palindrome Checker (Strings)', 'This program checks if a string is a palindrome. It has an off-by-one indexing error comparing with the null terminator. Fix it.', 'Input: radar -> Output: radar is a Palindrome
Input: hello -> Output: hello is NOT a Palindrome', '#include <stdio.h>
#include <string.h>
int main() {
    char str[100];
    int len, isPalin = 1;
    printf("Enter string: ");
    scanf("%s", str);

    len = strlen(str);
    for (int i = 0; i < len / 2; i++) {
        if (str[i] != str[len - i]) {    // BUG: Compares with null terminator; should be len - 1 - i
            isPalin = 0;
            break;
        }
    }

    if (isPalin)
        printf("%s is a Palindrome\
", str);
    else
        printf("%s is NOT a Palindrome\
", str);

    return 0;
}', 2000, 131072)
  ON CONFLICT (round_id, problem_code) DO UPDATE SET title = EXCLUDED.title, starting_code = EXCLUDED.starting_code;

  -- Public Sample Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0008-0001-0000-000000000000', v_prob_id, v_r2_id, 1, 'Sample Input 1', 'Sample Output 1', FALSE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;

  -- Hidden Evaluation Test Case
  INSERT INTO public.coding_test_cases (id, problem_id, round_id, test_case_order, input_text, expected_output, is_hidden, points)
  VALUES ('cc000002-0008-0002-0000-000000000000', v_prob_id, v_r2_id, 2, 'Hidden Boundary Input 2', 'Hidden Boundary Output 2', TRUE, 5.00)
  ON CONFLICT (problem_id, test_case_order) DO UPDATE SET points = 5.00;


  -- --------------------------------------------------------------------------
  -- 6. Round 3: Mystery Tech Challenge, Clues, Solutions & Hints
  -- --------------------------------------------------------------------------
  INSERT INTO public.mystery_challenges (id, round_id, event_id, challenge_order, title, description, max_clues)
  VALUES (v_ch_id, v_r3_id, v_event_id, 1, 'Campus Hardware & Network Cryptography', 'Sequential mystery puzzles testing campus hardware, binary decoding and cryptography.', 5)
  ON CONFLICT (round_id, challenge_order) DO UPDATE SET title = EXCLUDED.title;


  v_clue_id := 'c0000003-0001-0000-0000-000000000000';
  INSERT INTO public.mystery_clues (id, challenge_id, round_id, clue_order, clue_title, clue_text)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 1, 'Clue #1 — The Binary Inscription', 'A cryptic message was discovered on the ground floor whiteboard:

01001000 01000101 01001100 01001100 01001111

Decode this 8-bit binary ASCII sequence to unlock your squad''s first discovery keyword.')
  ON CONFLICT (challenge_id, clue_order) DO UPDATE SET clue_title = EXCLUDED.clue_title, clue_text = EXCLUDED.clue_text;

  INSERT INTO public.mystery_clue_solutions (clue_id, challenge_id, round_id, accepted_answer_hashes, salt)
  VALUES (v_clue_id, v_ch_id, v_r3_id, ARRAY['3baf280cbcbff702f146bed8bf461b013edd25f9e349c2953481fbdc1507d3c4', '3baf280cbcbff702f146bed8bf461b013edd25f9e349c2953481fbdc1507d3c4'], v_salt)
  ON CONFLICT (clue_id) DO UPDATE SET accepted_answer_hashes = EXCLUDED.accepted_answer_hashes;

  INSERT INTO public.mystery_clue_hints (clue_id, challenge_id, round_id, hint_text, penalty_seconds)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 'Convert each 8-bit byte into decimal: 01001000 = 72 = ''H''. Look up ASCII characters.', 60)
  ON CONFLICT (clue_id) DO UPDATE SET hint_text = EXCLUDED.hint_text;


  v_clue_id := 'c0000003-0002-0000-0000-000000000000';
  INSERT INTO public.mystery_clues (id, challenge_id, round_id, clue_order, clue_title, clue_text)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 2, 'Clue #2 — Caesar''s Lab Cipher', 'A slip of parchment was discovered taped under keyboard #14:

"FRPSXWHU VFLHQFH"

This message was encoded using a classical Caesar cipher with a shift of +3. Decrypt it to advance.')
  ON CONFLICT (challenge_id, clue_order) DO UPDATE SET clue_title = EXCLUDED.clue_title, clue_text = EXCLUDED.clue_text;

  INSERT INTO public.mystery_clue_solutions (clue_id, challenge_id, round_id, accepted_answer_hashes, salt)
  VALUES (v_clue_id, v_ch_id, v_r3_id, ARRAY['d94ec9dd8c0c36da38a497ac1dc97f15d6cce2165b6236388ca097d2fe651978', 'd94ec9dd8c0c36da38a497ac1dc97f15d6cce2165b6236388ca097d2fe651978', '43e97eaed815513687c16766b52be8904e45fad318657f63e5f8988252f87e1a', '43e97eaed815513687c16766b52be8904e45fad318657f63e5f8988252f87e1a'], v_salt)
  ON CONFLICT (clue_id) DO UPDATE SET accepted_answer_hashes = EXCLUDED.accepted_answer_hashes;

  INSERT INTO public.mystery_clue_hints (clue_id, challenge_id, round_id, hint_text, penalty_seconds)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 'Shift each letter 3 places backwards in the alphabet: F -> C, R -> O, P -> M...', 60)
  ON CONFLICT (clue_id) DO UPDATE SET hint_text = EXCLUDED.hint_text;


  v_clue_id := 'c0000003-0003-0000-0000-000000000000';
  INSERT INTO public.mystery_clues (id, challenge_id, round_id, clue_order, clue_title, clue_text)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 3, 'Clue #3 — The Silicon Gate Puzzle', 'The server rack LCD screen displays this boolean logic gate evaluation:

Given inputs: A = 1, B = 0, C = 1

Evaluate: (A AND B) OR (NOT B AND C)

Enter the final boolean result as a single digit (0 or 1).')
  ON CONFLICT (challenge_id, clue_order) DO UPDATE SET clue_title = EXCLUDED.clue_title, clue_text = EXCLUDED.clue_text;

  INSERT INTO public.mystery_clue_solutions (clue_id, challenge_id, round_id, accepted_answer_hashes, salt)
  VALUES (v_clue_id, v_ch_id, v_r3_id, ARRAY['523a85b3cf18bf5cb6e50dc6e146bdb56ed3673641267744bdcb9a98eda6a756', '523a85b3cf18bf5cb6e50dc6e146bdb56ed3673641267744bdcb9a98eda6a756', 'bfb1d26ce65be4dde353d08cbac7a53031edbc24b6b127af02cd363676f77a38', 'bfb1d26ce65be4dde353d08cbac7a53031edbc24b6b127af02cd363676f77a38'], v_salt)
  ON CONFLICT (clue_id) DO UPDATE SET accepted_answer_hashes = EXCLUDED.accepted_answer_hashes;

  INSERT INTO public.mystery_clue_hints (clue_id, challenge_id, round_id, hint_text, penalty_seconds)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 'A AND B = 1 AND 0 = 0. NOT B = 1. (1 AND 1) = 1. Therefore, 0 OR 1 = ?', 60)
  ON CONFLICT (clue_id) DO UPDATE SET hint_text = EXCLUDED.hint_text;


  v_clue_id := 'c0000003-0004-0000-0000-000000000000';
  INSERT INTO public.mystery_clues (id, challenge_id, round_id, clue_order, clue_title, clue_text)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 4, 'Clue #4 — The Sequence Anomaly', 'The projector in the main auditorium displays this numeric pattern:

2, 6, 14, 30, ?

Discover the governing rule and calculate the missing 5th integer.')
  ON CONFLICT (challenge_id, clue_order) DO UPDATE SET clue_title = EXCLUDED.clue_title, clue_text = EXCLUDED.clue_text;

  INSERT INTO public.mystery_clue_solutions (clue_id, challenge_id, round_id, accepted_answer_hashes, salt)
  VALUES (v_clue_id, v_ch_id, v_r3_id, ARRAY['450ddc12fc6a25911c3d9d44012aabc4189ee9c00bc15ce409909e5461094bb2', '450ddc12fc6a25911c3d9d44012aabc4189ee9c00bc15ce409909e5461094bb2', '3cbc0bef62c28598aa8e782ecc106ccca13ed9e96fe8e24eec215afdbeed8d98', '041219426763d21cd1a97d423ea7734e39cfb8d92977312b61cf7a778d0ec5ae'], v_salt)
  ON CONFLICT (clue_id) DO UPDATE SET accepted_answer_hashes = EXCLUDED.accepted_answer_hashes;

  INSERT INTO public.mystery_clue_hints (clue_id, challenge_id, round_id, hint_text, penalty_seconds)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 'Examine recursive growth: Next = (Current × 2) + 2. Alternatively: 2^(n+1) - 2.', 60)
  ON CONFLICT (clue_id) DO UPDATE SET hint_text = EXCLUDED.hint_text;


  v_clue_id := 'c0000003-0005-0000-0000-000000000000';
  INSERT INTO public.mystery_clues (id, challenge_id, round_id, clue_order, clue_title, clue_text)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 5, 'Clue #5 — The Final Vault Keycode', 'Synthesize all four discoveries to compute the final unlock code:

Formula: ( [Letters in Clue #1 Answer] × [Clue #3 Binary Result] ) + [Clue #4 Missing Number]

Calculate the final number to crack the mystery!')
  ON CONFLICT (challenge_id, clue_order) DO UPDATE SET clue_title = EXCLUDED.clue_title, clue_text = EXCLUDED.clue_text;

  INSERT INTO public.mystery_clue_solutions (clue_id, challenge_id, round_id, accepted_answer_hashes, salt)
  VALUES (v_clue_id, v_ch_id, v_r3_id, ARRAY['182be8029c6ac01cc050afb139cb92be553031ab2fa7db5f0fdcd6061bbd5afd', '182be8029c6ac01cc050afb139cb92be553031ab2fa7db5f0fdcd6061bbd5afd', '84d9d4eb8b8cb449e1d282d48ed3aae82113360c541b0ef6908aa1e7f3e51e46', '02fe93ea35d183a48f88050a42e7b9e089696bc08159a26a3e6218ea279093c3'], v_salt)
  ON CONFLICT (clue_id) DO UPDATE SET accepted_answer_hashes = EXCLUDED.accepted_answer_hashes;

  INSERT INTO public.mystery_clue_hints (clue_id, challenge_id, round_id, hint_text, penalty_seconds)
  VALUES (v_clue_id, v_ch_id, v_r3_id, 'Letters in HELLO = 5. Clue 3 = 1. Clue 4 = 62. So: (5 × 1) + 62 = ?', 60)
  ON CONFLICT (clue_id) DO UPDATE SET hint_text = EXCLUDED.hint_text;


  -- --------------------------------------------------------------------------
  -- 7. Round 4: 5 Grand Finale Jury Rubric Criteria (Max 50 Points)
  -- --------------------------------------------------------------------------
  INSERT INTO public.jury_rubrics (id, round_id, event_id, criterion_name, description, max_points, weight)
  VALUES 
    ('d0000004-0001-0000-0000-000000000000', v_r4_id, v_event_id, 'Creativity & Concept', 'Novelty of approach and problem framing.', 10.00, 1.00),
    ('d0000004-0002-0000-0000-000000000000', v_r4_id, v_event_id, 'Technical Depth & Code Quality', 'Engineering elegance, modularity and robustness.', 10.00, 1.00),
    ('d0000004-0003-0000-0000-000000000000', v_r4_id, v_event_id, 'Presentation & Live Demo', 'Clarity of stage delivery and live prototype resilience.', 10.00, 1.00),
    ('d0000004-0004-0000-0000-000000000000', v_r4_id, v_event_id, 'Innovation & Originality', 'Uniqueness and differentiation from conventional solutions.', 10.00, 1.00),
    ('d0000004-0005-0000-0000-000000000000', v_r4_id, v_event_id, 'Teamwork & Q&A Defense', 'Cross-squad synergy and composure under jury grilling.', 10.00, 1.00)
  ON CONFLICT (id) DO UPDATE SET max_points = EXCLUDED.max_points;



END $$;

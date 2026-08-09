BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'owner-one@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'owner-two@example.test'),
  ('10000000-0000-0000-0000-000000000003', 'no-profile@example.test');

INSERT INTO schools (id, name)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'School One'),
  ('20000000-0000-0000-0000-000000000002', 'School Two');

INSERT INTO departments (id, school_id, name)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Department One'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Department Two');

INSERT INTO profiles (id, email, full_name, school_id, department_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'owner-one@example.test', 'Owner One', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'owner-two@example.test', 'Owner Two', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002');

INSERT INTO staff (id, school_id, department_id, full_name, email)
VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Teacher One', 'teacher-one@example.test'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Teacher Two', 'teacher-two@example.test');

INSERT INTO tasks (title, created_by)
VALUES
  ('Owner one task', '10000000-0000-0000-0000-000000000001'),
  ('Owner two task', '10000000-0000-0000-0000-000000000002');

INSERT INTO meetings (id, title, date, start_time, end_time, created_by)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'Owner one meeting', CURRENT_DATE, '09:00', '10:00', '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', 'Owner two meeting', CURRENT_DATE, '11:00', '12:00', '10000000-0000-0000-0000-000000000002');

INSERT INTO meeting_actions (meeting_id, title)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'Owner one action'),
  ('50000000-0000-0000-0000-000000000002', 'Owner two action');

INSERT INTO observations (teacher_id, observer_id, scheduled_date)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', CURRENT_DATE),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', CURRENT_DATE);

INSERT INTO department_goals (department_id, title, academic_year, term)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'Department one goal', '2026-2027', 'Term 1'),
  ('30000000-0000-0000-0000-000000000002', 'Department two goal', '2026-2027', 'Term 1');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","email":"owner-one@example.test","role":"authenticated"}', true);

SELECT results_eq(
  $$ SELECT title FROM tasks ORDER BY title $$,
  ARRAY['Owner one task'],
  'a user can read only their own tasks'
);

SELECT results_eq(
  $$ SELECT title FROM meetings ORDER BY title $$,
  ARRAY['Owner one meeting'],
  'a user can read only their own meetings'
);

SELECT results_eq(
  $$ SELECT teacher_id::text FROM observations ORDER BY teacher_id $$,
  ARRAY['40000000-0000-0000-0000-000000000001'],
  'a user can read only observations they own'
);

SELECT results_eq(
  $$ SELECT title FROM department_goals ORDER BY title $$,
  ARRAY['Department one goal'],
  'a user can read only their department goals'
);

SELECT results_eq(
  $$ SELECT title FROM meeting_actions ORDER BY title $$,
  ARRAY['Owner one action'],
  'meeting actions inherit the parent meeting owner'
);

SELECT throws_ok(
  $$ INSERT INTO profiles (id, email, full_name) VALUES ('10000000-0000-0000-0000-000000000003', 'no-profile@example.test', 'No Profile') $$,
  '42501',
  'permission denied for table profiles',
  'an authenticated account cannot provision its own app profile'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","email":"no-profile@example.test","role":"authenticated"}', true);

SELECT is(
  (SELECT COUNT(*) FROM workflow_templates),
  0::bigint,
  'an authenticated account without an app profile cannot read shared templates'
);

SELECT is(
  (SELECT COUNT(*) FROM leadership_quotes),
  0::bigint,
  'an authenticated account without an app profile cannot read supporting tables'
);

SELECT * FROM finish();
ROLLBACK;

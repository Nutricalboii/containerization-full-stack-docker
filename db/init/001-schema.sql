CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tasks (title, description)
SELECT seed.title, seed.description
FROM (VALUES
  ('Build a portable stack', 'Start the complete frontend, API, and database with one Compose command.'),
  ('Measure startup time', 'Compare a cold build with a warm container restart.'),
  ('Observe resource use', 'Watch CPU and memory for each service with docker stats.')
) AS seed(title, description)
WHERE NOT EXISTS (SELECT 1 FROM tasks);


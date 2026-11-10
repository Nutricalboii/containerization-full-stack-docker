# StackLab — Project 07

## Containerization of Full Stack Applications using Docker

StackLab is a small task board used to demonstrate a complete containerized application. It has a static web frontend, a Node.js REST API, and PostgreSQL. Docker Compose builds and runs the application as one portable stack.

## Architecture

```text
Browser ── :8080 ──> Nginx frontend ── /api/* ──> Node API ──> PostgreSQL
                           │                         │              │
                      static files              health check   named volume
```

Compose starts PostgreSQL first, waits for its health check, then starts the API and frontend. Only the frontend port is published to the host; the API and database stay on the private Compose network. PostgreSQL data lives in a named volume and survives container replacement.

## Start the project

Requirements: Docker Engine or Docker Desktop with the Docker Compose plugin.

```bash
cp .env.example .env
# Optional for local use: edit .env and choose a different database password.
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080). The board supports adding, completing, and deleting tasks. The database is initialized with a few example tasks on the first run.

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f api
docker compose down                 # Stop and remove containers and network
docker compose down -v              # Also erase the database volume and its data
```

To change the host port, set `APP_PORT` in `.env`, then recreate the frontend with `docker compose up -d --force-recreate frontend`.

## API

The API is available through the frontend proxy:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Create a task with `title` and optional `description` |
| `PATCH` | `/api/tasks/:id` | Update `title`, `description`, or `completed` |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/health` | Check API and database readiness |

Example:

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Compare container startup time","description":"Record three cold starts"}'
```

## What this project demonstrates

- Separate frontend, API, and database containers with an explicit internal network.
- Multi-stage API image build and a non-root API process.
- Startup ordering based on service health, rather than assuming a running database is ready.
- A persistent database volume and environment-based configuration.
- Parameterized SQL, input validation, API readiness, and graceful shutdown.
- Reproducible local setup using `docker compose up --build`.

The sample credentials are for local learning only. For a deployed environment, provide secrets through the platform's secret manager, restrict network access, add TLS and authentication, and use managed or backed-up database storage.

## Keeping dependencies current

Dependabot is configured to check the Node.js package, Docker images, and GitHub Actions every week. It opens update pull requests so changes can be reviewed before they are merged. Project changes made in this working copy should be committed and pushed to keep the remote repository in sync.

## Study and report guide

Use the same machine, workload, and test duration for every comparison. Record the date, OS, CPU, RAM, Docker version, image tags, and whether each run is a cold start or warm start. Do not treat the starter values below as measured results; fill the table with your own observations.

| Measure | How to collect it | Result |
| --- | --- | --- |
| Cold startup time | Start a stopwatch before `docker compose up --build -d`; stop it when `curl -fsS http://localhost:8080/api/health` succeeds | Fill in |
| Warm startup time | Stop containers without removing images, then time `docker compose up -d` until the same health request succeeds | Fill in |
| Per-service memory and CPU | Run `docker stats --no-stream` after startup and during a fixed workload | Fill in |
| Image size | Run `docker image ls` and record the three project image sizes | Fill in |
| Portability | Clone/copy the project to a second machine, start it with Compose, and record any machine-specific changes | Fill in |
| Environment consistency | Repeat with a clean checkout and `.env.example`; compare app behavior and configuration | Fill in |
| API scaling | Try `docker compose up --build -d --scale api=3`, send repeated requests, and observe CPU, memory, and response times | Fill in |

For a simple load comparison, record response times at a few fixed request rates before and after scaling the API. Keep the frontend and database unchanged, note the tool and command used, and repeat each run several times. This Compose setup is a learning environment, not a production orchestrator; scaling is constrained by the single host and database.

## Project layout

```text
.
├── compose.yaml
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── public/
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/server.js
└── db/init/001-schema.sql
```


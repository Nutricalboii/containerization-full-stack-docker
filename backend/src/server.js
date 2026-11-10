import { createServer } from 'node:http';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'stacklab',
  user: process.env.DB_USER || 'stacklab',
  password: process.env.DB_PASSWORD || 'local-only-change-me',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected idle database connection error:', error.message);
});

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
};

async function readJson(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64 * 1024) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
  }
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400 });
  }
  return value;
}

function parseTask(body, { partial = false } = {}) {
  const values = {};
  if (!partial || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      const error = new Error('Title is required.');
      error.status = 400;
      throw error;
    }
    const title = body.title.trim();
    if (title.length > 120) {
      const error = new Error('Title must be 120 characters or fewer.');
      error.status = 400;
      throw error;
    }
    values.title = title;
  }
  if (!partial || Object.hasOwn(body, 'description')) {
    const description = body.description ?? '';
    if (typeof description !== 'string' || description.length > 500) {
      const error = new Error('Description must be 500 characters or fewer.');
      error.status = 400;
      throw error;
    }
    values.description = description.trim();
  }
  if (Object.hasOwn(body, 'completed')) {
    if (typeof body.completed !== 'boolean') {
      const error = new Error('Completed must be true or false.');
      error.status = 400;
      throw error;
    }
    values.completed = body.completed;
  }
  if (partial && Object.keys(values).length === 0) {
    const error = new Error('Provide at least one field to update.');
    error.status = 400;
    throw error;
  }
  return values;
}

function getId(pathname) {
  const match = pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const { pathname } = url;

  if (pathname === '/api/health' && request.method === 'GET') {
    await pool.query('SELECT 1');
    return sendJson(response, 200, { status: 'ok', database: 'ok' });
  }

  if (pathname === '/api/tasks' && request.method === 'GET') {
    const result = await pool.query(
      'SELECT id, title, description, completed, created_at FROM tasks ORDER BY created_at DESC, id DESC',
    );
    return sendJson(response, 200, result.rows);
  }

  if (pathname === '/api/tasks' && request.method === 'POST') {
    const values = parseTask(await readJson(request));
    const result = await pool.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING id, title, description, completed, created_at',
      [values.title, values.description],
    );
    return sendJson(response, 201, result.rows[0]);
  }

  const id = getId(pathname);
  if (id && pathname.startsWith('/api/tasks/')) {
    if (request.method === 'PATCH') {
      const values = parseTask(await readJson(request), { partial: true });
      const columns = { title: 'title', description: 'description', completed: 'completed' };
      const entries = Object.entries(values);
      const setters = entries.map(([key], index) => `${columns[key]} = $${index + 1}`);
      const params = entries.map(([, value]) => value);
      params.push(id);
      const result = await pool.query(
        `UPDATE tasks SET ${setters.join(', ')} WHERE id = $${params.length} RETURNING id, title, description, completed, created_at`,
        params,
      );
      if (result.rowCount === 0) return sendJson(response, 404, { error: 'Task not found.' });
      return sendJson(response, 200, result.rows[0]);
    }
    if (request.method === 'DELETE') {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount === 0) return sendJson(response, 404, { error: 'Task not found.' });
      return sendJson(response, 200, { deleted: true, id });
    }
  }

  return sendJson(response, 404, { error: 'Route not found.' });
}

async function connectWithRetry() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      console.log(`Database not ready (${attempt}/30): ${error.message}`);
      if (attempt === 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

await connectWithRetry();

const server = createServer(async (request, response) => {
  try {
    await handle(request, response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    sendJson(response, status, { error: status >= 500 ? 'Internal server error.' : error.message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`StackLab API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));


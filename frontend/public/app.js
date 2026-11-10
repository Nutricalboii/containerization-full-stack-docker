const taskList = document.querySelector('#task-list');
const taskForm = document.querySelector('#task-form');
const formMessage = document.querySelector('#form-message');
const connectionLabel = document.querySelector('#connection-label');
const liveStatus = document.querySelector('.live-status');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function setConnection(connected, message = '') {
  liveStatus.classList.toggle('connected', connected);
  liveStatus.classList.toggle('failed', !connected);
  connectionLabel.textContent = connected ? 'All services online' : 'Stack unavailable';
  document.querySelector('#database-state').textContent = connected ? 'Connected' : 'Offline';
  if (message) {
    taskList.replaceChildren();
    const error = document.createElement('div');
    error.className = 'error-state';
    error.textContent = message;
    taskList.append(error);
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function createTaskRow(task) {
  const row = document.createElement('article');
  row.className = `task-row${task.completed ? ' is-complete' : ''}`;

  const checkbox = document.createElement('input');
  checkbox.className = 'task-check';
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.setAttribute('aria-label', `Mark ${task.title} ${task.completed ? 'in progress' : 'complete'}`);
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: checkbox.checked }) });
      await loadTasks();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      checkbox.disabled = false;
      showFormMessage(error.message);
    }
  });

  const details = document.createElement('div');
  const title = document.createElement('h4');
  title.className = 'task-title';
  title.textContent = task.title;
  details.append(title);
  if (task.description) {
    const description = document.createElement('p');
    description.className = 'task-description';
    description.textContent = task.description;
    details.append(description);
  }
  const time = document.createElement('time');
  time.className = 'task-time';
  time.dateTime = task.created_at;
  time.textContent = `ADDED ${formatDate(task.created_at).toUpperCase()}`;
  details.append(time);

  const remove = document.createElement('button');
  remove.className = 'delete-button';
  remove.type = 'button';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Delete ${task.title}`);
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      await loadTasks();
    } catch (error) {
      remove.disabled = false;
      showFormMessage(error.message);
    }
  });

  row.append(checkbox, details, remove);
  return row;
}

function renderTasks(tasks) {
  taskList.replaceChildren();
  const total = tasks.length;
  const done = tasks.filter((task) => task.completed).length;
  document.querySelector('#total-count').textContent = String(total).padStart(2, '0');
  document.querySelector('#open-count').textContent = String(total - done).padStart(2, '0');
  document.querySelector('#done-count').textContent = String(done).padStart(2, '0');
  document.querySelector('#task-count').textContent = `${total} ${total === 1 ? 'TASK' : 'TASKS'}`;

  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('strong');
    title.textContent = 'A clean slate.';
    const hint = document.createElement('span');
    hint.textContent = 'Add the first task and watch it land in PostgreSQL.';
    empty.append(title, hint);
    taskList.append(empty);
    return;
  }
  for (const task of tasks) taskList.append(createTaskRow(task));
}

async function loadTasks() {
  try {
    const [tasks] = await Promise.all([api('/api/tasks'), api('/api/health')]);
    setConnection(true);
    renderTasks(tasks);
  } catch (error) {
    setConnection(false, `${error.message} Start the stack with docker compose up --build.`);
  }
}

function showFormMessage(message, success = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('success', success);
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = taskForm.querySelector('button[type="submit"]');
  const form = new FormData(taskForm);
  const title = String(form.get('title') || '').trim();
  const description = String(form.get('description') || '').trim();
  if (!title) return showFormMessage('Give your task a name first.');

  submit.disabled = true;
  showFormMessage('');
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title, description }) });
    taskForm.reset();
    showFormMessage('Added and saved to PostgreSQL.', true);
    await loadTasks();
    document.querySelector('#task-title').focus();
  } catch (error) {
    showFormMessage(error.message);
  } finally {
    submit.disabled = false;
  }
});

loadTasks();


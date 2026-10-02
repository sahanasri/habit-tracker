# Daily Form Habit Tracker

A local full-stack habit tracker with a FastAPI backend, SQLite persistence, and a React TypeScript interface.

## Features

- Create and delete habits with a color, symbol, intention, and weekly target
- Create an account and sign in with account-scoped habit data
- Complete or undo a habit for any selected date
- Track current streaks and the last seven days of activity
- Store dated notes through the API
- View daily completion rate and best active streak
- Persist data in relational SQLite tables

## Project structure

```text
habit-tracker/
  backend/
    app/             FastAPI routes, SQLAlchemy models, and schemas
    tests/           API integration tests
    schema.sql       Reference database DDL
    pyproject.toml   Python dependencies
  frontend/
    src/             React application and API client
    package.json     Node dependencies and scripts
```

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer

## Run the backend

From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive documentation is at `http://127.0.0.1:8000/docs`.

The application creates `backend/habit_tracker.db` automatically on first startup. Set `DATABASE_URL` to use a different SQLAlchemy database URL.
Passwords are stored as salted `scrypt` hashes. Login sessions last 30 days and can be ended with **Sign out**.
When upgrading an existing database, previously created habits are assigned to the first account registered.

## Run the frontend

From `frontend` in a second terminal:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to FastAPI.

## Publish with Railway

This repository includes a production `Dockerfile` that builds the React app and serves it from FastAPI under one public domain.

1. Push this repository to GitHub.
2. In [Railway](https://railway.com), choose **New Project**, then **Deploy from GitHub repo**.
3. After the first deployment, open the service's **Volumes** tab and mount a volume at `/data`.
4. Add the service variable `DATABASE_URL=sqlite:////data/habit_tracker.db`.
5. In **Settings > Networking**, choose **Generate Domain**.

Railway will rebuild and redeploy when you push to the connected GitHub branch. The generated domain is the public link for the website. A volume is required because container files are otherwise replaced during deployments.

## Validate

```powershell
cd backend
pytest

cd ..\frontend
npm run build
```

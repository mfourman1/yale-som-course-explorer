# Backend: professor agents

FastAPI app where every professor in `data/yale_som.db` is a PydanticAI agent. Each agent's
instructions come from the database (bio, courses, sections, times, rooms, syllabus) plus a
speaking style from `styles.py`. All agents share tools that search the whole Fall 2026 catalog,
so a professor can answer questions about other classes too.

| File | What it does |
| --- | --- |
| `catalog.py` | Loads the courses table into memory; search, course, and professor lookups |
| `professors.py` | Builds each professor's prompt and agent; the catalog tools; the Portkey model |
| `styles.py` | Speaking style per professor id (e.g. `tauhid-zaman`); everyone else gets the default |
| `main.py` | API routes |

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Needs `PORTKEY_API_KEY`, from the environment or a `.env` in this folder or any folder above it
(see `.env.example`). `OPENAI_MODEL` defaults to `gpt-6-luna`. Interactive docs: http://localhost:8000/docs

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/health` | Model, counts, whether the API key is set |
| GET | `/api/professors` | Every professor id, name, and courses |
| GET | `/api/professors/{id}` | Bio, courses with sections, and speaking style |
| GET | `/api/courses?q=&category=&session=&day=&limit=` | Catalog search |
| POST | `/api/professors/{id}/chat` | `{"message": "...", "history": [{"role": "user" or "professor", "content": "..."}]}` → `{"reply": "..."}` |

The server keeps no chat state; the frontend sends the conversation so far as `history`.

## Deploy on Render

Create a **Web Service** from the repo:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: `PORTKEY_API_KEY`, `OPENAI_MODEL=gpt-6-luna`, and `ALLOWED_ORIGINS` set to the
  static site's URL (e.g. `https://your-site.onrender.com`)

Then set `VITE_API_URL` to the backend's URL on the static site and redeploy it, so the chat
window calls the deployed backend instead of `http://localhost:8000`.

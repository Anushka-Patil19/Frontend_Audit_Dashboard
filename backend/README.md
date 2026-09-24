# Frontend Audit Dashboard — API

FastAPI backend, ported from the TanStack Start server functions that used to live in the frontend app. Runs as a completely separate process/service.

## Setup

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
playwright install chromium  # one-time: installs the browser binary used for evidence screenshots
copy .env.example .env       # then fill in real values
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

The API is served at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

Set the frontend's `VITE_API_BASE_URL` to this address (see the frontend's own `.env.example`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/cp38/verify` | CP38 — Business UAT sign-off verification |
| GET | `/api/cp38/evidence?file_name=` | CP38 evidence screenshot |
| POST | `/api/cp10/verify` | CP10 — CAB approval verification |
| GET | `/api/cp10/evidence?file_name=` | CP10 evidence screenshot |
| POST | `/api/cr-compliance/verify` | CR compliance verification |
| POST | `/api/mail-connector/sync` | Mail connector "test connection" |
| GET | `/api/dependencies/check` | Dependency/deprecation checker |

## Notes

- No database — matches the original TanStack Start server functions, which also had no persistence beyond an in-memory `Map` that nothing in the frontend ever actually read back.
- No auth on this API — the frontend's sign-in is a client-side-only demo today, with no server-side session to check. Access is gated only by CORS (`FRONTEND_ORIGIN`).
- CP10's Jira check uses direct Jira REST (same as CR-compliance), not Atlassian's Rovo MCP/OAuth — that flow was dropped during the Python port.

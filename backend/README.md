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

### Real Outlook evidence screenshots (optional)

```bash
python -m scripts.outlook_login
```

Sign in to Outlook in the window that opens (with an account that can open `MS_SHARED_MAILBOX`), wait for the inbox, then press Enter in the terminal. CP38/CP10 evidence is then a screenshot of the email as Outlook on the web shows it. Without this, or once the login expires, the email is rendered from Graph instead.

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
| GET/PUT/DELETE | `/api/escalations/config/{project_id}` | Read, update, or reset a project's escalation configuration |
| PUT | `/api/escalations/policy/{project_id}` | Update the escalation matrix and role contacts |
| PUT | `/api/escalations/limits/{project_id}` | Update project, category, and checkpoint limits |
| GET | `/api/escalations/items` | List shared escalation items |
| GET | `/api/escalations/runs/latest` | Read the latest run for each project |
| GET | `/api/escalations/notifications` | Read shared role notifications |
| POST | `/api/escalations/run/{project_id}` | Evaluate deadline and approval escalation rules |
| POST | `/api/escalations/items/{item_id}/fixed` | Mark an item fixed and request Manager approval |
| POST | `/api/escalations/items/{item_id}/undo` | Withdraw a fix before approval |
| POST | `/api/escalations/items/{item_id}/nudge` | Remind the Manager (limited to once every 24 hours) |
| POST | `/api/escalations/items/{item_id}/approve` | Approve a fix and capture its evidence screenshot |
| GET | `/api/escalations/evidence?file_name=` | Read an approval evidence screenshot |
| POST | `/api/escalations/items/{item_id}/reject` | Reject a fix and restart its deadline |
| POST | `/api/escalations/demo/reset` | Restore seeded demo items |

## Notes

- Escalation configuration, items, notifications, and latest runs persist in the JSON file configured by `ESCALATIONS_FILE`. The other API features do not use a database.
- Manager approval screenshots are saved in `EVIDENCE_DIR` and linked to the approved checkpoint record. The Manager approval card and that checkpoint's existing Audit Evidence panel use the same screenshot.
- Escalation email delivery is controlled by `ESCALATION_EMAIL_LIVE` (false by default). When enabled, fixed and nudge actions email the configured Manager **from the configured Developer mailbox**; run-summary emails continue to use `MS_SHARED_MAILBOX` (or `MS_TEST_MAILBOX`). Graph requires server-side credentials, the `Mail.Send` application permission, admin consent, and permission to send from each selected mailbox.
- No auth on this API — the frontend's sign-in is a client-side-only demo today, with no server-side session to check. Access is gated only by CORS (`FRONTEND_ORIGIN`).
- CP10's Jira check uses direct Jira REST (same as CR-compliance), not Atlassian's Rovo MCP/OAuth — that flow was dropped during the Python port.

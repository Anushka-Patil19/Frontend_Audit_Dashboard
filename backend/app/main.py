import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.routers import (
    compliance,
    cp6,
    cp10,
    cp20,
    cp38,
    cp40,
    cr_compliance,
    dependencies,
    escalations,
    github_tracking,
    invites,
    mail_connector,
)
from app.settings import settings

app = FastAPI(title="Frontend Audit Dashboard API")
logger = logging.getLogger(__name__)


# Safety net: an unhandled error becomes a JSON 500 *inside* the CORS layer, so the
# browser gets a readable error instead of a bare "Failed to fetch". Registered
# before CORSMiddleware, which therefore wraps it (last-added middleware is outermost).
class _CatchErrors(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as error:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": f"The server hit an error ({error.__class__.__name__}): {error}"},
            )


app.add_middleware(_CatchErrors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(cp38.router)
app.include_router(cp6.router)
app.include_router(cp10.router)
app.include_router(cp20.router)
app.include_router(cp40.router)
app.include_router(cr_compliance.router)
app.include_router(mail_connector.router)
app.include_router(dependencies.router)
app.include_router(invites.router)
app.include_router(escalations.router)
app.include_router(compliance.router)
app.include_router(github_tracking.router)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}

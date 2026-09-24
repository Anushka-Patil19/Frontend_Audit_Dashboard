from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import cp10, cp38, cr_compliance, dependencies, mail_connector
from app.settings import settings

app = FastAPI(title="Frontend Audit Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(cp38.router)
app.include_router(cp10.router)
app.include_router(cr_compliance.router)
app.include_router(mail_connector.router)
app.include_router(dependencies.router)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}

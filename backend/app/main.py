from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import compliance, cp10, cp38, cr_compliance, dependencies, escalations, invites, mail_connector
from app.settings import settings

app = FastAPI(title="Frontend Audit Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(cp38.router)
app.include_router(cp10.router)
app.include_router(cr_compliance.router)
app.include_router(mail_connector.router)
app.include_router(dependencies.router)
app.include_router(invites.router)
app.include_router(escalations.router)
app.include_router(compliance.router)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}

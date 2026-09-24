from fastapi import APIRouter

from app.config.cr_compliance_config import cr_compliance_configs, extract_ticket_key, resolve_cr_compliance_project
from app.models import CrGateStatus, CrVerifyResponse, QuestionRequest
from app.services.cr_compliance_verify import verify_cr_compliance

router = APIRouter(prefix="/api/cr-compliance", tags=["cr-compliance"])


def _initial_gates() -> CrGateStatus:
    return CrGateStatus(jira="pending", branch="pending", pr="pending")


@router.post("/verify", response_model=CrVerifyResponse, response_model_by_alias=True)
async def verify(body: QuestionRequest) -> CrVerifyResponse:
    ticket_key = extract_ticket_key(body.question)
    if not ticket_key:
        return CrVerifyResponse(
            config=None,
            ticketKey=None,
            result=None,
            gates=_initial_gates(),
            reply='I couldn\'t find a ticket ID in that question — ask like "Can you tell me if ticket CR-POC-4 is compliant?"',
        )
    cfg = resolve_cr_compliance_project(ticket_key)
    if not cfg:
        project_prefix = ticket_key.split("-")[0]
        known = ", ".join(c.jira_project_key for c in cr_compliance_configs)
        return CrVerifyResponse(
            config=None,
            ticketKey=ticket_key,
            result=None,
            gates=_initial_gates(),
            reply=f'I don\'t have a GitHub repo configured for project "{project_prefix}". Known projects: {known}.',
        )
    return await verify_cr_compliance(ticket_key, cfg)

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ms_tenant_id: str | None = None
    ms_client_id: str | None = None
    ms_client_secret: str | None = None
    ms_test_mailbox: str | None = None
    ms_shared_mailbox: str | None = None

    jira_email: str | None = None
    jira_api_token: str | None = None
    jira_base_url: str | None = None

    github_token: str | None = None

    groq_api_key: str | None = None

    frontend_origin: str = "http://localhost:8080"
    evidence_dir: str = "evidence"
    invites_file: str = "invites.json"
    escalations_file: str = "escalations.json"
    # Compliance Review Dashboard: one line per email attempt (no secrets, no bodies).
    compliance_mail_log_file: str = "compliance_mail_log.json"
    escalation_email_live: bool = False
    # Saved Outlook on the web login (scripts/outlook_login.py) used to screenshot
    # the real email in Outlook. Without it, the email is re-rendered from Graph.
    outlook_session_file: str = "outlook_session.json"
    # Saved Jira web login (scripts/jira_login.py) used to screenshot the real Jira
    # issue page for CP6. Without it, the issue is re-rendered from the REST API.
    jira_session_file: str = "jira_session.json"
    # CP40: post each new check result as a comment on the Jira ticket (the PDF's
    # "post result on the ticket"). Off by default — it writes to Jira.
    jira_post_result_comments: bool = False
    # Pull request mandatory (CP20 + GitHub tracking): only PRs / Jira tickets /
    # commits created between these IST days (YYYY-MM-DD, inclusive) are shown.
    # Empty = no limit on that side. See app/config/date_range.py.
    pr_ticket_date_from: str | None = None
    pr_ticket_date_to: str | None = None

    @property
    def frontend_origins(self) -> list[str]:
        """FRONTEND_ORIGIN may list several origins, comma-separated (e.g. 8081 and 8082)."""
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]


settings = Settings()

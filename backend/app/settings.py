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


settings = Settings()

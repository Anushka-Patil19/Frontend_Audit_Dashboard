export type CheckpointStatus = "compliant" | "non_compliant" | "needs_review";

export interface HierarchyCheckpoint {
  id: string;
  name: string;
  status: CheckpointStatus;
  detail?: string;
}

export interface HierarchyProject {
  name: string;
  compliance: number;
  checkpoints: HierarchyCheckpoint[];
}

export interface HierarchyControlArea {
  name: string;
  compliance: number;
  projects: Record<string, HierarchyProject>;
}

export interface HierarchyBusinessUnit {
  name: string;
  compliance: number;
  description?: string;
  controlAreas: Record<string, HierarchyControlArea>;
}

export type ComplianceHierarchy = Record<string, HierarchyBusinessUnit>;

export const complianceHierarchy: ComplianceHierarchy = {
  Banking: {
    name: "Banking",
    compliance: 88,
    description: "Core Banking, Treasury & Retail Services",
    controlAreas: {
      "Change Management": {
        name: "Change Management",
        compliance: 92,
        projects: {
          "PIT Armour": {
            name: "PIT Armour",
            compliance: 76,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Automated ticket traceability" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "Board sign-off verification" },
              { id: "CP16", name: "Version Control", status: "compliant", detail: "Branch protection and tagging" },
              { id: "CP21", name: "Peer Review", status: "non_compliant", detail: "Self-approval detected on PR #491" },
              { id: "CP28", name: "Secure Coding", status: "needs_review", detail: "SAST scan warning pending triage" },
            ],
          },
          "Project Alpha": {
            name: "Project Alpha",
            compliance: 91,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Automated ticket traceability" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "Board sign-off verification" },
              { id: "CP16", name: "Version Control", status: "compliant", detail: "Branch protection and tagging" },
              { id: "CP21", name: "Peer Review", status: "compliant", detail: "Independent reviewer confirmed" },
              { id: "CP28", name: "Secure Coding", status: "needs_review", detail: "Minor advisory in dependency" },
            ],
          },
          "Project Beta": {
            name: "Project Beta",
            compliance: 84,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Automated ticket traceability" },
              { id: "CP10", name: "CAB Approval", status: "needs_review", detail: "Emergency change justification pending" },
              { id: "CP16", name: "Version Control", status: "compliant", detail: "Branch protection verified" },
              { id: "CP21", name: "Peer Review", status: "compliant", detail: "Two peer approvals verified" },
              { id: "CP28", name: "Secure Coding", status: "non_compliant", detail: "Hardcoded secret flagged in commit" },
            ],
          },
          "Project Gamma": {
            name: "Project Gamma",
            compliance: 95,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Ticket linkage complete" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "Formal sign-off verified" },
              { id: "CP16", name: "Version Control", status: "compliant", detail: "Branch protection verified" },
              { id: "CP21", name: "Peer Review", status: "compliant", detail: "PR review verified" },
              { id: "CP28", name: "Secure Coding", status: "compliant", detail: "Zero high/medium vulnerabilities" },
            ],
          },
        },
      },
      "Access Control": {
        name: "Access Control",
        compliance: 86,
        projects: {
          "PIT Armour": {
            name: "PIT Armour",
            compliance: 85,
            checkpoints: [
              { id: "CP01", name: "MFA Enforcement", status: "compliant", detail: "Hardware token enforced for all engineers" },
              { id: "CP04", name: "Privileged Access Review", status: "compliant", detail: "Quarterly review completed" },
              { id: "CP07", name: "Quarterly Deprovisioning", status: "needs_review", detail: "1 dormant contractor account detected" },
            ],
          },
          "Project Alpha": {
            name: "Project Alpha",
            compliance: 90,
            checkpoints: [
              { id: "CP01", name: "MFA Enforcement", status: "compliant", detail: "MFA verified" },
              { id: "CP04", name: "Privileged Access Review", status: "compliant", detail: "Privileged access certified" },
              { id: "CP07", name: "Quarterly Deprovisioning", status: "compliant", detail: "Zero orphaned accounts" },
            ],
          },
        },
      },
      "Secure SDLC": {
        name: "Secure SDLC",
        compliance: 81,
        projects: {
          "PIT Armour": {
            name: "PIT Armour",
            compliance: 78,
            checkpoints: [
              { id: "CP22", name: "SAST Static Analysis", status: "compliant", detail: "SonarQube scan clean" },
              { id: "CP25", name: "DAST Pipeline Gate", status: "non_compliant", detail: "Staging scan failed authentication step" },
              { id: "CP31", name: "Dependency Scan", status: "needs_review", detail: "Moderate CVE in lodash helper" },
            ],
          },
          "Project Beta": {
            name: "Project Beta",
            compliance: 84,
            checkpoints: [
              { id: "CP22", name: "SAST Static Analysis", status: "compliant", detail: "Scans passing" },
              { id: "CP25", name: "DAST Pipeline Gate", status: "compliant", detail: "DAST check passed" },
              { id: "CP31", name: "Dependency Scan", status: "needs_review", detail: "Advisory pending upgrade" },
            ],
          },
        },
      },
      "Testing": {
        name: "Testing",
        compliance: 94,
        projects: {
          "PIT Armour": {
            name: "PIT Armour",
            compliance: 92,
            checkpoints: [
              { id: "CP35", name: "Automated Regression Test", status: "compliant", detail: "100% test pass rate in CI" },
              { id: "CP38", name: "Code Coverage Threshold (>80%)", status: "compliant", detail: "84.2% unit test line coverage" },
              { id: "CP42", name: "Performance Sign-off", status: "needs_review", detail: "Latency p99 slightly elevated under peak" },
            ],
          },
          "Project Gamma": {
            name: "Project Gamma",
            compliance: 96,
            checkpoints: [
              { id: "CP35", name: "Automated Regression Test", status: "compliant", detail: "Regression suite green" },
              { id: "CP38", name: "Code Coverage Threshold (>80%)", status: "compliant", detail: "88.6% unit test coverage" },
              { id: "CP42", name: "Performance Sign-off", status: "compliant", detail: "Performance criteria certified" },
            ],
          },
        },
      },
    },
  },
  Insurance: {
    name: "Insurance",
    compliance: 91,
    description: "Policy Underwriting, Claims & Actuarial Systems",
    controlAreas: {
      "Policy Admin & Access": {
        name: "Policy Admin & Access",
        compliance: 94,
        projects: {
          "InsureCore": {
            name: "InsureCore",
            compliance: 95,
            checkpoints: [
              { id: "CP01", name: "Role-Based Authorization", status: "compliant", detail: "Granular underwriting permissions verified" },
              { id: "CP08", name: "Audit Log Immutability", status: "compliant", detail: "WORM cloud storage active" },
              { id: "CP12", name: "Dual Sign-off on Claims", status: "compliant", detail: "Maker-checker workflow active >$50k" },
            ],
          },
          "Claims Engine": {
            name: "Claims Engine",
            compliance: 92,
            checkpoints: [
              { id: "CP01", name: "Role-Based Authorization", status: "compliant", detail: "Adjuster roles verified" },
              { id: "CP08", name: "Audit Log Immutability", status: "compliant", detail: "Append-only ledger enabled" },
              { id: "CP12", name: "Dual Sign-off on Claims", status: "needs_review", detail: "Single approver allowed under $1,000 threshold" },
            ],
          },
        },
      },
      "Change Management": {
        name: "Change Management",
        compliance: 90,
        projects: {
          "InsureCore": {
            name: "InsureCore",
            compliance: 91,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "All releases tied to JIRA ticket" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "CAB sign-off validated" },
              { id: "CP21", name: "Peer Review", status: "needs_review", detail: "Peer review took <1 minute on PR #122" },
            ],
          },
          "Underwriting Portal": {
            name: "Underwriting Portal",
            compliance: 89,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Release traceability verified" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "CAB approval recorded" },
              { id: "CP21", name: "Peer Review", status: "non_compliant", detail: "Admin force-pushed to main branch" },
            ],
          },
        },
      },
      "Data Protection": {
        name: "Data Protection",
        compliance: 88,
        projects: {
          "InsureCore": {
            name: "InsureCore",
            compliance: 90,
            checkpoints: [
              { id: "CP18", name: "PII Masking in Non-Prod", status: "compliant", detail: "Synthetic data generation verified" },
              { id: "CP19", name: "Encryption at Rest", status: "compliant", detail: "AES-256 cloud envelope encryption active" },
              { id: "CP20", name: "Key Rotation Policies", status: "needs_review", detail: "KMS annual rotation scheduled in 14 days" },
            ],
          },
        },
      },
    },
  },
  Payments: {
    name: "Payments",
    compliance: 74,
    description: "Merchant Gateway, POS & Real-Time Settlement",
    controlAreas: {
      "PCI-DSS & Data Security": {
        name: "PCI-DSS & Data Security",
        compliance: 71,
        projects: {
          "Merchant Gateway": {
            name: "Merchant Gateway",
            compliance: 70,
            checkpoints: [
              { id: "CP14", name: "CDE Environment Isolation", status: "compliant", detail: "Zero route from office intranet to CDE" },
              { id: "CP15", name: "Payload Encryption", status: "needs_review", detail: "TLS 1.2 still allowed for legacy POS terminals" },
              { id: "CP24", name: "Tokenization Service Validation", status: "non_compliant", detail: "Unmasked PAN logged in debug payload" },
            ],
          },
          "Payment Switch": {
            name: "Payment Switch",
            compliance: 73,
            checkpoints: [
              { id: "CP14", name: "CDE Environment Isolation", status: "compliant", detail: "Firewall boundary verified" },
              { id: "CP15", name: "Payload Encryption", status: "compliant", detail: "mTLS 1.3 enforced on all API endpoints" },
              { id: "CP24", name: "Tokenization Service Validation", status: "non_compliant", detail: "Token sync latency anomaly" },
            ],
          },
        },
      },
      "Change Management": {
        name: "Change Management",
        compliance: 78,
        projects: {
          "Merchant Gateway": {
            name: "Merchant Gateway",
            compliance: 76,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Jira issue linked on deploy" },
              { id: "CP10", name: "Emergency CAB Exemption Log", status: "needs_review", detail: "3 emergency patches deployed without post-CAB" },
              { id: "CP21", name: "Peer Review Enforcement", status: "non_compliant", detail: "Hotfix bypass used on settlement service" },
            ],
          },
          "Settlement Engine": {
            name: "Settlement Engine",
            compliance: 81,
            checkpoints: [
              { id: "CP06", name: "CR / Jira Linkage", status: "compliant", detail: "Ticket linkage validated" },
              { id: "CP10", name: "CAB Approval", status: "compliant", detail: "CAB sign-off archived" },
              { id: "CP21", name: "Peer Review Enforcement", status: "needs_review", detail: "Single reviewer on financial ledger modification" },
            ],
          },
        },
      },
      "Access Control": {
        name: "Access Control",
        compliance: 73,
        projects: {
          "Merchant Gateway": {
            name: "Merchant Gateway",
            compliance: 72,
            checkpoints: [
              { id: "CP02", name: "MFA on Bastion Host", status: "compliant", detail: "RADIUS-backed Duo MFA active" },
              { id: "CP05", name: "Quarterly API Key Rotation", status: "non_compliant", detail: "Production payment token expired 4 days ago" },
              { id: "CP09", name: "Database Admin Separation", status: "needs_review", detail: "Shared root credential used for migration" },
            ],
          },
        },
      },
    },
  },
};

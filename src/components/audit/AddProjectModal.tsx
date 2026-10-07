import React, { useState } from "react";
import {
  X,
  FolderPlus,
  ShieldCheck,
  Info,
  Check,
  ChevronRight,
  ChevronLeft,
  Server,
  Users,
  GitBranch,
  ShieldAlert,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, title: "Identity & Scope", label: "Application Identity", icon: Server },
  { id: 2, title: "Governance & Roles", label: "Stakeholder Governance", icon: Users },
  { id: 3, title: "Toolchain & VCS", label: "Integrations & Repos", icon: GitBranch },
];

export function AddProjectModal({ isOpen, onClose, onSuccess }: AddProjectModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  // Section 1: Core Application Identity
  const [appId] = useState("APP-PIT-ARNOUR");
  const [appName, setAppName] = useState("PIT Armour — Digital Banking Platform");
  const [businessUnit, setBusinessUnit] = useState("Enterprise");
  const [criticalityTier, setCriticalityTier] = useState("tier1");
  const [environment, setEnvironment] = useState("AWS / On-Prem Kubernetes");
  const [frameworks, setFrameworks] = useState<Record<string, boolean>>({
    soc2: true,
    iso27001: true,
    rbi: true,
    hipaa: false,
  });

  // Section 2: Ownership & Governance Stakeholders
  const [techLead, setTechLead] = useState("techlead@newel-demo.com");
  const [productManager, setProductManager] = useState("pm@newel-demo.com");
  const [engManager, setEngManager] = useState("eng_mgr@newel-demo.com");

  // Checkpoint-Specific Approvers
  const [cabApprover, setCabApprover] = useState("akhil@newel-demo.com");
  const [uatSigner, setUatSigner] = useState("nikhil.chawla@newel-demo.com");
  const [crClosureOwner, setCrClosureOwner] = useState("rahul@newel-demo.com");

  // Section 3: Toolchain & Repository Integrations
  const [vcsProvider, setVcsProvider] = useState("GitHub");
  const [repoUrl, setRepoUrl] = useState("https://github.com/acmecapital/pit-arnour");
  const [branchRegex, setBranchRegex] = useState("^(main|release/.*|hotfix/.*)$");
  const [jiraKey, setJiraKey] = useState("POC");
  const [itsmTool, setItsmTool] = useState("Jira Service Management");
  const [cabGroup, setCabGroup] = useState("CAB-GROUP-PIT-ARNOUR");

  if (!isOpen) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    } else {
      if (onSuccess) onSuccess();
      onClose();
      setCurrentStep(1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const toggleFramework = (key: string) => {
    setFrameworks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Slide-Over Panel Container */}
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-panel border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Modal Header */}
        <div className="border-b border-border bg-panel-2 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary shadow-xs">
                <FolderPlus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  New Project Registration
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configure continuous compliance controls, stakeholder signers & repository connectors.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* STEPPER NAVIGATION BAR */}
          <div className="mt-5">
            <div className="relative flex items-center justify-between">
              {/* Progress Line */}
              <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-border -z-0" />
              <div
                className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300 -z-0"
                style={{ width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%" }}
              />

              {STEPS.map((step) => {
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;
                const StepIcon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (step.id <= currentStep || isCompleted) setCurrentStep(step.id);
                    }}
                    className={`relative z-10 flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary-soft"
                        : isCompleted
                        ? "border-primary/40 bg-panel text-primary hover:border-primary"
                        : "border-border bg-panel text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-mono font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : isCompleted
                          ? "bg-primary-soft text-primary"
                          : "bg-panel-2 text-faint"
                      }`}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                    </span>
                    <span className="hidden sm:inline font-serif">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form id="add-project-form" onSubmit={handleNext} className="flex-1 overflow-y-auto p-6">
          
          {/* STEP 1: Core Application Identity */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-xl border border-border bg-panel p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <Server className="h-4 w-4 text-primary" />
                    <h3 className="font-serif text-base font-semibold text-foreground">
                      1. Core Application Identity
                    </h3>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                    Step 1 of 3
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Application Code / ID */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Application Code / ID
                    </label>
                    <input
                      type="text"
                      value={appId}
                      disabled
                      className="w-full rounded-md border border-border bg-panel-2 px-3 py-2 font-mono text-xs text-muted-foreground cursor-not-allowed select-none"
                    />
                    <p className="mt-1 text-[11px] text-faint">Unique system key, immutable once created</p>
                  </div>

                  {/* Application Name */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Application Name <span className="text-fail">*</span>
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {/* Business Unit / Division */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Business Unit / Division
                    </label>
                    <select
                      value={businessUnit}
                      onChange={(e) => setBusinessUnit(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Operation">Operation</option>
                      <option value="FnA">FnA</option>
                    </select>
                  </div>

                  {/* Hosting / Runtime Environment */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Hosting / Runtime Environment
                    </label>
                    <input
                      type="text"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>
                </div>

                {/* Criticality Tier Cards */}
                <div className="pt-3 border-t border-border">
                  <label className="block text-xs font-semibold text-foreground mb-2">
                    Criticality Tier & Governance Rule Set
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        id: "tier1",
                        title: "Tier 1 - Mission Critical",
                        tag: "Strict",
                        desc: "Zero exceptions. Mandatory CAB + 2 peer PR approvals required.",
                        tone: "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-400",
                      },
                      {
                        id: "tier2",
                        title: "Tier 2 - Business Impact",
                        tag: "Standard",
                        desc: "CAB required, 1 peer PR approval mandatory.",
                        tone: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
                      },
                      {
                        id: "tier3",
                        title: "Tier 3 - Low Risk",
                        tag: "Relaxed",
                        desc: "Standard PR checks, automated validation enabled.",
                        tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
                      },
                    ].map((tier) => {
                      const selected = criticalityTier === tier.id;
                      return (
                        <div
                          key={tier.id}
                          onClick={() => setCriticalityTier(tier.id)}
                          className={`relative flex flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition-all ${
                            selected
                              ? "border-primary bg-primary-soft/40 shadow-sm ring-1 ring-primary/30"
                              : "border-border bg-panel hover:border-primary/40 hover:bg-panel-2"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-foreground">{tier.title}</span>
                            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold ${tier.tone}`}>
                              {tier.tag}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {tier.desc}
                          </p>
                          {selected && (
                            <span className="mt-2 text-[10px] font-mono text-primary font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Selected Policy
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Compliance Framework Checkboxes */}
                <div className="pt-3 border-t border-border">
                  <label className="block text-xs font-semibold text-foreground mb-2">
                    Mandatory Compliance Frameworks
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { id: "soc2", label: "SOC 2 Type II" },
                      { id: "iso27001", label: "ISO 27001" },
                      { id: "rbi", label: "RBI Guidelines" },
                      { id: "hipaa", label: "HIPAA" },
                    ].map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          frameworks[item.id]
                            ? "border-primary/50 bg-primary-soft/30 text-foreground"
                            : "border-border bg-panel text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={frameworks[item.id]}
                          onChange={() => toggleFramework(item.id)}
                          className="accent-primary rounded"
                        />
                        <span className="text-xs font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Ownership & Governance Stakeholders */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-xl border border-border bg-panel p-6 shadow-card space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="font-serif text-base font-semibold text-foreground">
                      2. Ownership & Stakeholder Governance
                    </h3>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                    Step 2 of 3
                  </span>
                </div>

                {/* General Stakeholders */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    General Project Stakeholders
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Technical Lead / Architect
                      </label>
                      <input
                        type="email"
                        value={techLead}
                        onChange={(e) => setTechLead(e.target.value)}
                        className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Product / Project Manager
                      </label>
                      <input
                        type="email"
                        value={productManager}
                        onChange={(e) => setProductManager(e.target.value)}
                        className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Engineering Manager / HOD
                      </label>
                      <input
                        type="email"
                        value={engManager}
                        onChange={(e) => setEngManager(e.target.value)}
                        className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* VISUAL SUBDIVIDER: Checkpoint-Specific Approvers */}
                <div className="rounded-xl border border-primary/30 bg-primary-soft/25 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-primary/20 pb-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h4 className="font-serif text-xs font-bold uppercase tracking-wider text-primary">
                        Checkpoint-Specific Approvers
                      </h4>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono text-primary font-semibold">
                      ENFORCED EVIDENCE SIGNERS
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* CAB Approver */}
                    <div className="rounded-lg border border-border bg-panel p-3.5 shadow-xs">
                      <label className="block text-xs font-bold text-foreground mb-1">
                        CAB Approver <span className="text-muted-foreground font-normal">(CAB Approval)</span>
                      </label>
                      <input
                        type="email"
                        value={cabApprover}
                        onChange={(e) => setCabApprover(e.target.value)}
                        className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Authorized to approve production change requests via email. Emails must arrive from this exact address to be accepted.
                      </p>
                    </div>

                    {/* Business UAT Signer */}
                    <div className="rounded-lg border border-border bg-panel p-3.5 shadow-xs">
                      <label className="block text-xs font-bold text-foreground mb-1">
                        Business UAT Signer <span className="text-muted-foreground font-normal">(UAT Sign-off)</span>
                      </label>
                      <input
                        type="email"
                        value={uatSigner}
                        onChange={(e) => setUatSigner(e.target.value)}
                        className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        Authorized to confirm UAT sign-off for production releases. Emails must arrive from this exact address to be accepted.
                      </p>
                    </div>
                  </div>

                  {/* PR Merge Owner (Informational) */}
                  <div className="pt-3 border-t border-primary/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        PR Merge / CR Closure Owner
                      </label>
                      <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        <Info className="h-3 w-3 text-faint" />
                        Informational
                      </span>
                    </div>
                    <input
                      type="email"
                      value={crClosureOwner}
                      onChange={(e) => setCrClosureOwner(e.target.value)}
                      className="w-full rounded-md border border-border/60 bg-panel/80 px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring"
                    />
                    <p className="mt-1 text-[11px] text-faint">
                      Reference contact for GitHub PR merges and CR closure — not enforced by automated checks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Toolchain & Repository Integrations */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-xl border border-border bg-panel p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <h3 className="font-serif text-base font-semibold text-foreground">
                      3. Toolchain & Repository Integrations
                    </h3>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                    Step 3 of 3
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* VCS Provider */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      VCS Provider
                    </label>
                    <select
                      value={vcsProvider}
                      onChange={(e) => setVcsProvider(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    >
                      <option value="GitHub">GitHub</option>
                      <option value="GitHub Enterprise">GitHub Enterprise</option>
                      <option value="GitLab">GitLab</option>
                      <option value="Bitbucket">Bitbucket</option>
                      <option value="Azure Repos">Azure Repos</option>
                    </select>
                  </div>

                  {/* Repository URL */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Repository URL
                    </label>
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>

                  {/* Production / Release Branch Regex */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Production / Release Branch Regex
                    </label>
                    <input
                      type="text"
                      value={branchRegex}
                      onChange={(e) => setBranchRegex(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>

                  {/* Jira / ALM Project Keys */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Jira / ALM Project Keys
                    </label>
                    <input
                      type="text"
                      value={jiraKey}
                      onChange={(e) => setJiraKey(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                    <p className="mt-1 text-[11px] text-faint">
                      Valid Jira prefixes required in commit messages and PR titles
                    </p>
                  </div>

                  {/* ITSM / Change Management Tool */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      ITSM / Change Management Tool
                    </label>
                    <input
                      type="text"
                      value={itsmTool}
                      onChange={(e) => setItsmTool(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>

                  {/* CAB Assignment Group / Board ID */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      CAB Assignment Group / Board ID
                    </label>
                    <input
                      type="text"
                      value={cabGroup}
                      onChange={(e) => setCabGroup(e.target.value)}
                      className="w-full rounded-md border border-border bg-panel px-3 py-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>
                </div>

                {/* Final Configuration Summary Box */}
                <div className="mt-4 rounded-lg border border-border bg-panel-2 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Ready for Onboarding</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Clicking <strong>Create Project</strong> will register {appName} ({appId}) under continuous compliance monitoring. Baseline automated workers will initiate initial security & change management verification.
                  </p>
                </div>
              </div>
            </div>
          )}

        </form>

        {/* Modal Footer / Navigation Controls */}
        <div className="flex items-center justify-between border-t border-border bg-panel-2 px-6 py-4">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-panel px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <span>Next: {STEPS[currentStep]?.label}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                form="add-project-form"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Create Project</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

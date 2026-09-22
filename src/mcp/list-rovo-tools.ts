// One-off diagnostic: fetch the real POC-3 ticket to see its actual shape
// (status, CAB Approver custom field) before wiring the real Jira gate.
import { connectRovoMcp } from "./rovo-mcp-client.js";

const client = await connectRovoMcp();

const resources = await client.callTool({ name: "getAccessibleAtlassianResources", arguments: {} });
console.log("=== getAccessibleAtlassianResources ===");
console.log(JSON.stringify(resources, null, 2));

const cloudId = JSON.parse((resources.content as { text: string }[])[0].text).data.resources[0]?.cloudId;
console.log("\nUsing cloudId:", cloudId);

const issue = await client.callTool({
  name: "getJiraIssue",
  arguments: { cloudId, issueIdOrKey: "POC-3", view: "full" },
});
console.log("\n=== getJiraIssue(POC-3, view=full) ===");
console.log(JSON.stringify(issue, null, 2));

process.exit(0);

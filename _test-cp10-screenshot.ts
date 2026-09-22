import { getGraphAccessToken } from "./src/lib/graph-auth";
import { captureApprovalEmailScreenshot } from "./src/lib/cp10-screenshot";

async function main() {
  const tokenResult = await getGraphAccessToken();
  if (!tokenResult.ok) {
    console.error("Token error:", tokenResult.error);
    process.exit(1);
  }

  const mailbox = process.env.MS_SHARED_MAILBOX ?? process.env.MS_TEST_MAILBOX;
  if (!mailbox) {
    console.error("No mailbox configured.");
    process.exit(1);
  }
  console.log("Using mailbox:", mailbox);

  const listRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?$top=1&$select=id,subject,from,receivedDateTime&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } },
  );
  const listData = (await listRes.json()) as {
    value?: { id: string; subject?: string; from?: { emailAddress?: { address?: string } }; receivedDateTime?: string }[];
    error?: { message: string };
  };
  if (!listRes.ok || !listData.value?.length) {
    console.error("Could not list messages:", listData.error ?? listRes.status);
    process.exit(1);
  }
  const message = listData.value[0];
  console.log("Test message:", message.subject, "from", message.from?.emailAddress?.address, "id", message.id);

  const fileName = await captureApprovalEmailScreenshot({
    projectId: "smoke-test",
    messageId: message.id,
    mailbox,
    accessToken: tokenResult.accessToken,
    subject: message.subject ?? "",
    from: message.from?.emailAddress?.address ?? "",
    receivedDateTime: message.receivedDateTime ?? "",
  });

  console.log("Result fileName:", fileName);
  if (!fileName) {
    console.error("Screenshot capture returned null.");
    process.exit(1);
  }
  console.log("Saved to: evidence/cp10/" + fileName);
}

main();

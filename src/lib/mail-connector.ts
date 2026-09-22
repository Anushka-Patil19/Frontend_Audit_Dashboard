import { createServerFn } from "@tanstack/react-start";
import { getGraphAccessToken } from "./graph-auth";

export type MailSyncResult = { connected: boolean; message: string };

export const syncMailConnector = createServerFn({ method: "POST" }).handler(
  async (): Promise<MailSyncResult> => {
    const tokenResult = await getGraphAccessToken();
    if (!tokenResult.ok) {
      return { connected: false, message: tokenResult.error };
    }

    // A token alone only proves the app registration's id/secret are
    // valid — it says nothing about whether Graph permissions were
    // actually granted. Call Graph itself to verify real org access.
    const usersRes = await fetch("https://graph.microsoft.com/v1.0/users?$top=5&$select=userPrincipalName", {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });
    const usersData = (await usersRes.json()) as {
      value?: { userPrincipalName: string }[];
      error?: { message: string };
    };

    if (!usersRes.ok || !usersData.value) {
      return {
        connected: false,
        message:
          usersData.error?.message ??
          `Token acquired, but Graph rejected the directory check (HTTP ${usersRes.status}). Check User.Read.All / Directory.Read.All is admin-consented.`,
      };
    }

    // Directory access alone doesn't prove Mail.Read is granted or that a
    // real mailbox is reachable. If a test mailbox is configured, do one
    // more call against actual mail — but only surface a timestamp, never
    // message subject/body, to the UI.
    const testMailbox = process.env.MS_TEST_MAILBOX;
    if (testMailbox) {
      const mailRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(testMailbox)}/messages?$top=1&$select=receivedDateTime`,
        { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } },
      );
      const mailData = (await mailRes.json()) as {
        value?: { receivedDateTime: string }[];
        error?: { message: string };
      };

      if (!mailRes.ok || !mailData.value) {
        return {
          connected: false,
          message:
            mailData.error?.message ??
            `Directory access OK, but reading mailbox ${testMailbox} failed (HTTP ${mailRes.status}). Check Mail.Read (Application) is admin-consented.`,
        };
      }

      const latest = mailData.value[0]?.receivedDateTime;
      return {
        connected: true,
        message: latest
          ? `Connected — verified real mailbox access to ${testMailbox} (latest message received ${latest}).`
          : `Connected — verified real mailbox access to ${testMailbox} (mailbox is empty).`,
      };
    }

    // Token is intentionally not returned to the client — only the
    // connected/failed status is.
    return {
      connected: true,
      message: `Connected — verified via Microsoft Graph (${usersData.value.length} org users visible, e.g. ${usersData.value[0]?.userPrincipalName ?? "n/a"}).`,
    };
  },
);

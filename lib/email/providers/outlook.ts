import {
  getIntegrationBaseUrl,
  getMicrosoftTenantId,
  getMicrosoftWebhookClientState,
  getOutlookRedirectUri,
  outlookScopes
} from "@/lib/email/config";
import type { ProviderThreadPayload } from "@/lib/email/providers/types";
import type { EmailParticipant } from "@/lib/types";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

type GraphRecipient = {
  emailAddress?: {
    name?: string | null;
    address?: string | null;
  };
};

function normalizeParticipant(recipient: GraphRecipient | null | undefined): EmailParticipant | null {
  const email = recipient?.emailAddress?.address?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  return {
    name: recipient?.emailAddress?.name?.trim() || null,
    email
  };
}

function normalizeParticipants(recipients: GraphRecipient[] | null | undefined) {
  return (recipients ?? [])
    .map((recipient) => normalizeParticipant(recipient))
    .filter((entry): entry is EmailParticipant => Boolean(entry?.email));
}

function uniqueParticipants(entries: Array<EmailParticipant | null | undefined>) {
  const seen = new Set<string>();
  const participants: EmailParticipant[] = [];

  for (const entry of entries) {
    if (!entry?.email || seen.has(entry.email)) {
      continue;
    }

    seen.add(entry.email);
    participants.push(entry);
  }

  return participants;
}

function stripHtml(html: string | null | undefined) {
  if (!html) {
    return null;
  }

  return html.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferContractRelated(subject: string, bodies: string[]) {
  const corpus = `${subject}\n${bodies.join("\n")}`.toLowerCase();
  return ["contract", "agreement", "usage rights", "net ", "invoice", "payment", "deliverable", "campaign"].some((term) =>
    corpus.includes(term)
  );
}

async function graphRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GRAPH_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function buildMicrosoftTokenUrl() {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/token`;
}

function buildMicrosoftAuthorizeUrl() {
  return `https://login.microsoftonline.com/${getMicrosoftTenantId()}/oauth2/v2.0/authorize`;
}

function mapOutlookThread(
  conversationId: string,
  messages: Array<{
    id: string;
    conversationId: string;
    subject?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
    sentDateTime?: string;
    internetMessageId?: string;
    from?: GraphRecipient;
    toRecipients?: GraphRecipient[];
    ccRecipients?: GraphRecipient[];
    bccRecipients?: GraphRecipient[];
    body?: { contentType?: string; content?: string };
    hasAttachments?: boolean;
    attachments?: Array<{
      id: string;
      name?: string;
      contentType?: string;
      size?: number;
    }>;
  }>,
  emailAddress: string
): ProviderThreadPayload {
  const mappedMessages = messages
    .map((message) => {
      const from = normalizeParticipant(message.from);
      const htmlBody =
        message.body?.contentType?.toLowerCase() === "html" ? message.body.content ?? null : null;
      const textBody =
        message.body?.contentType?.toLowerCase() === "text"
          ? message.body.content ?? null
          : stripHtml(htmlBody) ?? message.bodyPreview ?? null;

      return {
        providerMessageId: message.id,
        internetMessageId: message.internetMessageId ?? null,
        from,
        to: normalizeParticipants(message.toRecipients),
        cc: normalizeParticipants(message.ccRecipients),
        bcc: normalizeParticipants(message.bccRecipients),
        subject: message.subject?.trim() || "(no subject)",
        textBody,
        htmlBody,
        sentAt: message.sentDateTime ?? null,
        receivedAt: message.receivedDateTime ?? message.sentDateTime ?? null,
        direction:
          from?.email.toLowerCase() === emailAddress.toLowerCase()
            ? ("outbound" as const)
            : ("inbound" as const),
        hasAttachments: Boolean(message.hasAttachments),
        attachments: (message.attachments ?? []).map((attachment) => ({
          providerAttachmentId: attachment.id,
          filename: attachment.name?.trim() || "attachment",
          mimeType: attachment.contentType?.trim() || "application/octet-stream",
          sizeBytes: Number(attachment.size ?? 0)
        }))
      };
    })
    .sort((left, right) => (left.receivedAt ?? "").localeCompare(right.receivedAt ?? ""));

  const lastMessage = mappedMessages[mappedMessages.length - 1];

  return {
    providerThreadId: conversationId,
    subject: lastMessage?.subject ?? "(no subject)",
    snippet: lastMessage?.textBody?.slice(0, 280) ?? null,
    participants: uniqueParticipants(
      mappedMessages.flatMap((message) => [message.from, ...message.to, ...message.cc, ...message.bcc])
    ),
    lastMessageAt:
      lastMessage?.receivedAt ??
      lastMessage?.sentAt ??
      new Date().toISOString(),
    isContractRelated: inferContractRelated(
      lastMessage?.subject ?? "",
      mappedMessages.map((message) => message.textBody ?? "")
    ),
    messages: mappedMessages
  };
}

function inboxSelectFields() {
  return [
    "id",
    "conversationId",
    "subject",
    "bodyPreview",
    "receivedDateTime",
    "sentDateTime",
    "internetMessageId",
    "from",
    "toRecipients",
    "ccRecipients",
    "bccRecipients",
    "body",
    "hasAttachments"
  ].join(",");
}

export function buildOutlookAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
    redirect_uri: getOutlookRedirectUri(),
    response_type: "code",
    response_mode: "query",
    scope: outlookScopes.join(" "),
    state
  });

  return `${buildMicrosoftAuthorizeUrl()}?${params.toString()}`;
}

export async function exchangeOutlookCode(code: string) {
  const response = await fetch(buildMicrosoftTokenUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      code,
      redirect_uri: getOutlookRedirectUri(),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function refreshOutlookAccessToken(refreshToken: string) {
  const response = await fetch(buildMicrosoftTokenUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function getOutlookProfile(accessToken: string) {
  const me = await graphRequest<{
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  }>("/me?$select=id,displayName,mail,userPrincipalName", accessToken);

  const emailAddress = (me.mail || me.userPrincipalName || "").trim().toLowerCase();
  if (!emailAddress) {
    throw new Error("Microsoft profile did not return an email address.");
  }

  return {
    providerAccountId: me.id,
    emailAddress,
    displayName: me.displayName?.trim() || emailAddress
  };
}

async function fetchConversationMessages(accessToken: string, conversationId: string) {
  const filter = encodeURIComponent(`conversationId eq '${conversationId.replace(/'/g, "''")}'`);
  const payload = await graphRequest<{
    value?: Array<{
      id: string;
      conversationId: string;
      subject?: string;
      bodyPreview?: string;
      receivedDateTime?: string;
      sentDateTime?: string;
      internetMessageId?: string;
      from?: GraphRecipient;
      toRecipients?: GraphRecipient[];
      ccRecipients?: GraphRecipient[];
      bccRecipients?: GraphRecipient[];
      body?: { contentType?: string; content?: string };
      hasAttachments?: boolean;
    }>;
  }>(`/me/messages?$filter=${filter}&$select=${encodeURIComponent(inboxSelectFields())}&$top=50`, accessToken);

  return payload.value ?? [];
}

async function fetchMessageAttachments(accessToken: string, messageId: string) {
  const payload = await graphRequest<{
    value?: Array<{
      id: string;
      name?: string;
      contentType?: string;
      size?: number;
    }>;
  }>(
    `/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size`,
    accessToken
  );

  return payload.value ?? [];
}

export async function listRecentOutlookThreads(accessToken: string, emailAddress: string, top = 25) {
  const inboxMessages = await graphRequest<{
    value?: Array<{
      id: string;
      conversationId: string;
      subject?: string;
      bodyPreview?: string;
      receivedDateTime?: string;
      sentDateTime?: string;
      internetMessageId?: string;
      from?: GraphRecipient;
      toRecipients?: GraphRecipient[];
      ccRecipients?: GraphRecipient[];
      bccRecipients?: GraphRecipient[];
      body?: { contentType?: string; content?: string };
      hasAttachments?: boolean;
    }>;
  }>(
    `/me/mailFolders/inbox/messages?$select=${encodeURIComponent(inboxSelectFields())}&$orderby=receivedDateTime desc&$top=${top}`,
    accessToken
  );

  const conversationIds = [...new Set((inboxMessages.value ?? []).map((message) => message.conversationId).filter(Boolean))];
  return fetchOutlookThreadsByConversationIds(accessToken, emailAddress, conversationIds);
}

export async function fetchOutlookThreadsByConversationIds(
  accessToken: string,
  emailAddress: string,
  conversationIds: string[]
) {
  const threads: ProviderThreadPayload[] = [];

  for (const conversationId of conversationIds) {
    const messages = await fetchConversationMessages(accessToken, conversationId);
    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => ({
        ...message,
        attachments: message.hasAttachments
          ? await fetchMessageAttachments(accessToken, message.id)
          : []
      }))
    );

    threads.push(mapOutlookThread(conversationId, messagesWithAttachments, emailAddress));
  }

  return threads;
}

export async function fetchOutlookMessage(accessToken: string, messageId: string) {
  const message = await graphRequest<{
    id: string;
    conversationId: string;
    subject?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
    sentDateTime?: string;
    internetMessageId?: string;
    from?: GraphRecipient;
    toRecipients?: GraphRecipient[];
    ccRecipients?: GraphRecipient[];
    bccRecipients?: GraphRecipient[];
    body?: { contentType?: string; content?: string };
    hasAttachments?: boolean;
  }>(`/me/messages/${encodeURIComponent(messageId)}?$select=${encodeURIComponent(inboxSelectFields())}`, accessToken);

  return {
    ...message,
    attachments: message.hasAttachments ? await fetchMessageAttachments(accessToken, message.id) : []
  };
}

export async function createOutlookSubscription(accessToken: string) {
  const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return graphRequest<{
    id: string;
    expirationDateTime: string;
    resource: string;
  }>("/subscriptions", accessToken, {
    method: "POST",
    body: JSON.stringify({
      changeType: "created,updated",
      notificationUrl: `${getIntegrationBaseUrl()}/api/email/outlook/webhook`,
      resource: "/me/mailFolders/inbox/messages",
      expirationDateTime,
      clientState: getMicrosoftWebhookClientState() ?? undefined
    })
  });
}

export async function renewOutlookSubscription(accessToken: string, subscriptionId: string) {
  const expirationDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return graphRequest<{
    id: string;
    expirationDateTime: string;
  }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({
      expirationDateTime
    })
  });
}

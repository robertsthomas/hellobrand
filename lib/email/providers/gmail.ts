import { gmailScopes, getGooglePubSubTopic, getGoogleRedirectUri } from "@/lib/email/config";
import type { ProviderThreadPayload } from "@/lib/email/providers/types";
import type { EmailParticipant } from "@/lib/types";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayloadPart[];
};

function parseAddressHeader(value: string | null | undefined): EmailParticipant | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1]?.trim().replace(/^"|"$|^'|'$/g, "") || null,
      email: match[2].trim().toLowerCase()
    };
  }

  return {
    name: null,
    email: trimmed.replace(/^"|"$|^'|'$/g, "").toLowerCase()
  };
}

function parseAddressList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => parseAddressHeader(entry))
    .filter((entry): entry is EmailParticipant => Boolean(entry?.email));
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, target: string) {
  return headers?.find((header) => header.name?.toLowerCase() === target.toLowerCase())?.value ?? null;
}

function decodeGmailBody(data: string | null | undefined) {
  if (!data) {
    return null;
  }

  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collectBodyParts(
  payload: GmailPayloadPart | null | undefined,
  output: { textBody: string | null; htmlBody: string | null; attachments: Array<{ providerAttachmentId: string; filename: string; mimeType: string; sizeBytes: number }> }
) {
  if (!payload) {
    return;
  }

  const mimeType = payload.mimeType?.toLowerCase() ?? "";
  const fileName = payload.filename?.trim() ?? "";
  const body = payload.body ?? {};

  if (fileName && body.attachmentId) {
    output.attachments.push({
      providerAttachmentId: body.attachmentId,
      filename: fileName,
      mimeType: payload.mimeType ?? "application/octet-stream",
      sizeBytes: Number(body.size ?? 0)
    });
  }

  const decoded = decodeGmailBody(body.data);
  if (decoded) {
    if (mimeType === "text/plain" && !output.textBody) {
      output.textBody = decoded;
    }

    if (mimeType === "text/html" && !output.htmlBody) {
      output.htmlBody = decoded;
    }
  }

  for (const part of payload.parts ?? []) {
    collectBodyParts(part, output);
  }
}

function stripHtml(html: string | null) {
  if (!html) {
    return null;
  }

  return html.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueParticipants(entries: Array<EmailParticipant | null | undefined>) {
  const seen = new Set<string>();
  const participants: EmailParticipant[] = [];

  for (const entry of entries) {
    if (!entry?.email) {
      continue;
    }

    const email = entry.email.toLowerCase();
    if (seen.has(email)) {
      continue;
    }

    seen.add(email);
    participants.push({
      name: entry.name?.trim() || null,
      email
    });
  }

  return participants;
}

function inferContractRelated(subject: string, bodies: string[]) {
  const corpus = `${subject}\n${bodies.join("\n")}`.toLowerCase();
  return ["contract", "agreement", "usage rights", "net ", "invoice", "payment", "deliverable", "campaign"].some((term) =>
    corpus.includes(term)
  );
}

async function gmailRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gmail request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: gmailScopes.join(" "),
    state
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function getGoogleProfile(accessToken: string) {
  const profile = await gmailRequest<{
    emailAddress: string;
    historyId: string;
    messagesTotal: number;
    threadsTotal: number;
  }>("/profile", accessToken);

  return {
    providerAccountId: profile.emailAddress.toLowerCase(),
    emailAddress: profile.emailAddress.toLowerCase(),
    displayName: profile.emailAddress.split("@")[0] ?? profile.emailAddress,
    historyId: profile.historyId
  };
}

function mapGmailThread(
  payload: {
    id: string;
    snippet?: string;
    messages?: Array<{
      id: string;
      threadId: string;
      internalDate?: string;
      payload?: GmailPayloadPart & {
        headers?: Array<{ name?: string; value?: string }>;
      };
    }>;
  },
  emailAddress: string
): ProviderThreadPayload {
  const messages = (payload.messages ?? [])
    .map((message) => {
      const headers = message.payload?.headers ?? [];
      const from = parseAddressHeader(headerValue(headers, "from"));
      const to = parseAddressList(headerValue(headers, "to"));
      const cc = parseAddressList(headerValue(headers, "cc"));
      const bcc = parseAddressList(headerValue(headers, "bcc"));
      const subject = headerValue(headers, "subject") ?? payload.snippet ?? "(no subject)";
      const internetMessageId = headerValue(headers, "message-id");
      const bodyOutput = {
        textBody: null as string | null,
        htmlBody: null as string | null,
        attachments: [] as Array<{
          providerAttachmentId: string;
          filename: string;
          mimeType: string;
          sizeBytes: number;
        }>
      };
      collectBodyParts(message.payload, bodyOutput);
      const sentAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null;

      return {
        providerMessageId: message.id,
        internetMessageId,
        from,
        to,
        cc,
        bcc,
        subject,
        textBody: bodyOutput.textBody ?? stripHtml(bodyOutput.htmlBody),
        htmlBody: bodyOutput.htmlBody,
        sentAt,
        receivedAt: sentAt,
        direction:
          from?.email.toLowerCase() === emailAddress.toLowerCase()
            ? ("outbound" as const)
            : ("inbound" as const),
        hasAttachments: bodyOutput.attachments.length > 0,
        attachments: bodyOutput.attachments
      };
    })
    .sort((left, right) => (left.receivedAt ?? "").localeCompare(right.receivedAt ?? ""));

  const lastMessage = messages[messages.length - 1];
  const participants = uniqueParticipants(
    messages.flatMap((message) => [message.from, ...message.to, ...message.cc, ...message.bcc])
  );

  return {
    providerThreadId: payload.id,
    subject: lastMessage?.subject ?? "(no subject)",
    snippet: payload.snippet ?? lastMessage?.textBody?.slice(0, 280) ?? null,
    participants,
    lastMessageAt:
      lastMessage?.receivedAt ??
      lastMessage?.sentAt ??
      new Date().toISOString(),
    isContractRelated: inferContractRelated(
      lastMessage?.subject ?? "",
      messages.map((message) => message.textBody ?? stripHtml(message.htmlBody) ?? "")
    ),
    messages
  };
}

export async function listRecentGmailThreads(accessToken: string, emailAddress: string, maxResults = 20) {
  const list = await gmailRequest<{ threads?: Array<{ id: string }> }>(
    `/threads?labelIds=INBOX&maxResults=${maxResults}`,
    accessToken
  );
  const threadIds = (list.threads ?? []).map((thread) => thread.id);
  return fetchGmailThreadsByIds(accessToken, emailAddress, threadIds);
}

export async function fetchGmailThreadsByIds(
  accessToken: string,
  emailAddress: string,
  threadIds: string[]
) {
  const threads = await Promise.all(
    threadIds.map((threadId) =>
      gmailRequest<{
        id: string;
        snippet?: string;
        messages?: Array<{
          id: string;
          threadId: string;
          internalDate?: string;
          payload?: GmailPayloadPart & {
            headers?: Array<{ name?: string; value?: string }>;
          };
        }>;
      }>(`/threads/${threadId}?format=full`, accessToken)
    )
  );

  return threads.map((thread) => mapGmailThread(thread, emailAddress));
}

export async function listGmailHistoryThreadIds(accessToken: string, startHistoryId: string) {
  const payload = await gmailRequest<{
    history?: Array<{
      messagesAdded?: Array<{ message?: { threadId?: string } }>;
      messages?: Array<{ threadId?: string }>;
    }>;
    historyId?: string;
  }>(`/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded`, accessToken);

  const threadIds = new Set<string>();
  for (const history of payload.history ?? []) {
    for (const entry of history.messagesAdded ?? []) {
      if (entry.message?.threadId) {
        threadIds.add(entry.message.threadId);
      }
    }

    for (const entry of history.messages ?? []) {
      if (entry.threadId) {
        threadIds.add(entry.threadId);
      }
    }
  }

  return {
    threadIds: [...threadIds],
    historyId: payload.historyId ?? startHistoryId
  };
}

export async function registerGmailWatch(accessToken: string) {
  const topicName = getGooglePubSubTopic();

  if (!topicName) {
    return null;
  }

  return gmailRequest<{ historyId: string; expiration?: string }>(
    "/watch",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE"
      })
    }
  );
}

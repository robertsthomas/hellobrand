import { gmailScopes, getGooglePubSubTopic, getGoogleRedirectUri } from "@/lib/email/config";
import type {
  ProviderSendAttachmentInput,
  ProviderSendMessageResult,
  ProviderThreadPayload
} from "@/lib/email/providers/types";
import type { EmailParticipant } from "@/lib/types";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const GMAIL_REQUEST_RETRY_LIMIT = 5;
const GMAIL_THREAD_FETCH_CONCURRENCY = 4;

type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayloadPart[];
};

class GmailApiError extends Error {
  status: number;
  retryAfterMs: number | null;
  isRetryable: boolean;

  constructor(status: number, message: string, retryAfterMs: number | null) {
    super(`Gmail request failed (${status}): ${message}`);
    this.name = "GmailApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.isRetryable = GMAIL_RETRYABLE_STATUS_CODES.has(status);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, timestamp - Date.now());
}

async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  worker: (value: TInput, index: number) => Promise<TOutput>
) {
  const results = new Array<TOutput>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, () =>
      runWorker()
    )
  );

  return results;
}

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

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatAddressList(participants: EmailParticipant[]) {
  return participants
    .map((participant) =>
      participant.name
        ? `"${escapeHeaderValue(participant.name)}" <${participant.email}>`
        : participant.email
    )
    .join(", ");
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
  for (let attempt = 0; attempt < GMAIL_REQUEST_RETRY_LIMIT; attempt += 1) {
    const response = await fetch(`${GMAIL_API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const message = await response.text();
    const error = new GmailApiError(
      response.status,
      message,
      parseRetryAfterMs(response.headers.get("retry-after"))
    );

    if (!error.isRetryable || attempt === GMAIL_REQUEST_RETRY_LIMIT - 1) {
      throw error;
    }

    const backoffMs =
      error.retryAfterMs ??
      Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 250);
    await sleep(backoffMs);
  }

  throw new Error("Gmail request retry loop exhausted.");
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
  const threads = await mapWithConcurrency(
    threadIds,
    GMAIL_THREAD_FETCH_CONCURRENCY,
    (threadId) =>
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
  );

  return threads.map((thread) => mapGmailThread(thread, emailAddress));
}

export async function fetchGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
) {
  const payload = await gmailRequest<{
    data?: string;
    size?: number;
  }>(
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    accessToken
  );

  return {
    bytes: Buffer.from((payload.data ?? "").replace(/-/g, "+").replace(/_/g, "/"), "base64"),
    sizeBytes: Number(payload.size ?? 0)
  };
}

export async function sendGmailThreadReply(
  accessToken: string,
  input: {
    threadId: string;
    subject: string;
    body: string;
    to: EmailParticipant[];
    cc?: EmailParticipant[];
    bcc?: EmailParticipant[];
    inReplyTo?: string | null;
    references?: string[];
    attachments?: ProviderSendAttachmentInput[];
  }
): Promise<ProviderSendMessageResult> {
  const boundary = `hb_${Date.now().toString(36)}`;
  const parts = [
    `From: me`,
    `To: ${formatAddressList(input.to)}`,
    input.cc && input.cc.length > 0 ? `Cc: ${formatAddressList(input.cc)}` : null,
    input.bcc && input.bcc.length > 0 ? `Bcc: ${formatAddressList(input.bcc)}` : null,
    `Subject: ${escapeHeaderValue(input.subject)}`,
    "MIME-Version: 1.0",
    input.inReplyTo ? `In-Reply-To: <${input.inReplyTo.replace(/^<|>$/g, "")}>` : null,
    input.references && input.references.length > 0
      ? `References: ${input.references.map((value) => `<${value.replace(/^<|>$/g, "")}>`).join(" ")}`
      : null,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
    ""
  ].filter((value): value is string => value !== null);

  for (const attachment of input.attachments ?? []) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${escapeHeaderValue(attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${escapeHeaderValue(attachment.filename)}"`,
      "",
      Buffer.from(attachment.bytes).toString("base64"),
      ""
    );
  }

  parts.push(`--${boundary}--`, "");

  const payload = await gmailRequest<{
    id: string;
    threadId?: string;
  }>("/messages/send", accessToken, {
    method: "POST",
    body: JSON.stringify({
      raw: encodeBase64Url(parts.join("\r\n")),
      threadId: input.threadId
    })
  });

  return {
    providerMessageId: payload.id,
    internetMessageId: null,
    providerThreadId: payload.threadId ?? input.threadId,
    to: input.to,
    cc: input.cc ?? [],
    bcc: input.bcc ?? []
  };
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

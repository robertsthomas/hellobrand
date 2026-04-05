import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { ImapFlow, type MessageAddressObject, type MessageStructureObject } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import nodemailer from "nodemailer";

import { getYahooRedirectUri, yahooScopes } from "@/lib/email/config";
import type {
  ProviderAttachmentPayload,
  ProviderMessagePayload,
  ProviderSendAttachmentInput,
  ProviderSendMessageResult,
  ProviderThreadPayload
} from "@/lib/email/providers/types";
import type { EmailParticipant } from "@/lib/types";

const YAHOO_IMAP_HOST = "imap.mail.yahoo.com";
const YAHOO_IMAP_PORT = 993;
const YAHOO_SMTP_HOST = "smtp.mail.yahoo.com";
const YAHOO_SMTP_PORT = 465;
const YAHOO_AUTH_BASE = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_USERINFO_URL = "https://api.login.yahoo.com/openid/v1/userinfo";

type YahooCursor = {
  lastUid: number;
  uidValidity: string | null;
};

type YahooMappedMessage = ProviderMessagePayload & {
  rawUid: number;
  threadKey: string;
};

function normalizeYahooEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function stripHtml(html: string | null | false | undefined) {
  if (!html || typeof html !== "string") {
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

function normalizeEnvelopeParticipant(
  participant: MessageAddressObject | null | undefined
): EmailParticipant | null {
  const email = normalizeYahooEmail(participant?.address);
  if (!email) {
    return null;
  }

  return {
    name: participant?.name?.trim() || null,
    email
  };
}

function normalizeEnvelopeParticipants(participants: MessageAddressObject[] | null | undefined) {
  return (participants ?? [])
    .map((participant) => normalizeEnvelopeParticipant(participant))
    .filter((entry): entry is EmailParticipant => Boolean(entry?.email));
}

function normalizeParsedParticipant(
  address: { address?: string | null; name?: string | null } | null | undefined
): EmailParticipant | null {
  const email = normalizeYahooEmail(address?.address);
  if (!email) {
    return null;
  }

  return {
    name: address?.name?.trim() || null,
    email
  };
}

function normalizeParsedParticipants(addresses: AddressObject | AddressObject[] | null | undefined) {
  const values = Array.isArray(addresses)
    ? addresses.flatMap((entry) => entry.value ?? [])
    : addresses?.value ?? [];

  return values
    .map((entry) => normalizeParsedParticipant(entry))
    .filter((entry): entry is EmailParticipant => Boolean(entry?.email));
}

function normalizeMessageId(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/^<|>$/g, "").toLowerCase();
}

function normalizeSubject(subject: string) {
  return subject
    .trim()
    .toLowerCase()
    .replace(/^(re|fwd?):\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSyntheticThreadKey(
  parsed: ParsedMail,
  subject: string,
  participants: EmailParticipant[]
) {
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];

  const anchor =
    references.map((value) => normalizeMessageId(value)).filter(Boolean)[0] ??
    normalizeMessageId(parsed.inReplyTo) ??
    normalizeMessageId(parsed.messageId) ??
    `subject:${normalizeSubject(subject)}|participants:${participants.map((entry) => entry.email).sort().join(",")}`;

  return createHash("sha1").update(anchor).digest("hex");
}

function collectAttachmentParts(
  node: MessageStructureObject | undefined,
  output: ProviderAttachmentPayload[]
) {
  if (!node) {
    return;
  }

  if (node.part && node.disposition && node.disposition.toLowerCase() !== "inline") {
    output.push({
      providerAttachmentId: node.part,
      filename:
        node.dispositionParameters?.filename?.trim() ||
        node.parameters?.name?.trim() ||
        "attachment",
      mimeType: node.type?.trim() || "application/octet-stream",
      sizeBytes: Number(node.size ?? 0)
    });
  }

  for (const child of node.childNodes ?? []) {
    collectAttachmentParts(child, output);
  }
}

function reconcileAttachmentMetadata(
  structureAttachments: ProviderAttachmentPayload[],
  parsed: ParsedMail
) {
  return structureAttachments.map((attachment, index) => {
    const parsedAttachment = parsed.attachments[index];
    return {
      providerAttachmentId: attachment.providerAttachmentId,
      filename:
        parsedAttachment?.filename?.trim() ||
        attachment.filename,
      mimeType:
        parsedAttachment?.contentType?.trim() ||
        attachment.mimeType,
      sizeBytes:
        Number(parsedAttachment?.size ?? 0) || attachment.sizeBytes
    };
  });
}

export function buildYahooProviderCursor(lastUid: number, uidValidity: bigint | string | null | undefined) {
  return JSON.stringify({
    lastUid,
    uidValidity: uidValidity === null || uidValidity === undefined ? null : String(uidValidity)
  } satisfies YahooCursor);
}

export function parseYahooProviderCursor(cursor: string | null | undefined): YahooCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as Partial<YahooCursor>;
    if (!Number.isFinite(parsed.lastUid) || Number(parsed.lastUid) < 0) {
      return null;
    }

    return {
      lastUid: Number(parsed.lastUid),
      uidValidity:
        typeof parsed.uidValidity === "string" && parsed.uidValidity.trim().length > 0
          ? parsed.uidValidity.trim()
          : null
    };
  } catch {
    return null;
  }
}

function buildProviderMessageId(uid: number, uidValidity: bigint | string | null | undefined) {
  return uidValidity === null || uidValidity === undefined
    ? String(uid)
    : `${String(uidValidity)}:${uid}`;
}

function parseProviderMessageUid(providerMessageId: string) {
  const parts = providerMessageId.split(":");
  const value = Number(parts[parts.length - 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid Yahoo message identifier.");
  }

  return value;
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function createYahooImapClient(emailAddress: string, accessToken: string) {
  return new ImapFlow({
    host: YAHOO_IMAP_HOST,
    port: YAHOO_IMAP_PORT,
    secure: true,
    auth: {
      user: emailAddress,
      accessToken
    },
    disableAutoIdle: true,
    connectionTimeout: 20_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    logger: false
  });
}

async function withYahooMailbox<T>(
  emailAddress: string,
  accessToken: string,
  handler: (client: ImapFlow) => Promise<T>
) {
  const client = createYahooImapClient(emailAddress, accessToken);
  let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;

  try {
    await client.connect();
    lock = await client.getMailboxLock("INBOX");
    return await handler(client);
  } finally {
    lock?.release();

    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

async function parseYahooMessages(
  client: ImapFlow,
  uids: number[],
  emailAddress: string
) {
  if (uids.length === 0) {
    return {
      uidValidity: client.mailbox ? String(client.mailbox.uidValidity) : null,
      messages: [] as YahooMappedMessage[],
      lastUid: 0
    };
  }

  const fetched = await client.fetchAll(
    [...uids].sort((left, right) => left - right),
    {
      uid: true,
      envelope: true,
      internalDate: true,
      bodyStructure: true,
      source: true
    },
    { uid: true }
  );

  const uidValidity = client.mailbox ? String(client.mailbox.uidValidity) : null;
  const messages: YahooMappedMessage[] = [];

  for (const message of fetched) {
    if (!message.source) {
      continue;
    }

    const parsed = await simpleParser(message.source);
    const from =
      normalizeParsedParticipants(parsed.from)[0] ??
      normalizeEnvelopeParticipants(message.envelope?.from)[0] ??
      null;
    const to = normalizeParsedParticipants(parsed.to);
    const cc = normalizeParsedParticipants(parsed.cc);
    const bcc = normalizeParsedParticipants(parsed.bcc);
    const subject = parsed.subject?.trim() || message.envelope?.subject?.trim() || "(no subject)";
    const htmlBody = typeof parsed.html === "string" ? parsed.html : null;
    const textBody = parsed.text?.trim() || stripHtml(htmlBody) || null;
    const attachmentParts = reconcileAttachmentMetadata(
      (() => {
        const parts: ProviderAttachmentPayload[] = [];
        collectAttachmentParts(message.bodyStructure, parts);
        return parts;
      })(),
      parsed
    );
    const participants = uniqueParticipants([from, ...to, ...cc, ...bcc]);
    const threadKey = buildSyntheticThreadKey(parsed, subject, participants);

    messages.push({
      rawUid: message.uid,
      threadKey,
      providerMessageId: buildProviderMessageId(message.uid, uidValidity),
      internetMessageId:
        normalizeMessageId(parsed.messageId) ??
        normalizeMessageId(message.envelope?.messageId) ??
        null,
      from,
      to,
      cc,
      bcc,
      subject,
      textBody,
      htmlBody,
      sentAt: parsed.date?.toISOString() ?? null,
      receivedAt:
        message.internalDate instanceof Date
          ? message.internalDate.toISOString()
          : typeof message.internalDate === "string"
            ? new Date(message.internalDate).toISOString()
            : parsed.date?.toISOString() ?? null,
      direction:
        from?.email.toLowerCase() === emailAddress.toLowerCase()
          ? ("outbound" as const)
          : ("inbound" as const),
      hasAttachments: attachmentParts.length > 0,
      attachments: attachmentParts
    });
  }

  return {
    uidValidity,
    messages,
    lastUid: Math.max(...uids)
  };
}

function mapYahooThreads(messages: YahooMappedMessage[]) {
  const grouped = new Map<string, YahooMappedMessage[]>();

  for (const message of messages) {
    const existing = grouped.get(message.threadKey);
    if (existing) {
      existing.push(message);
      continue;
    }

    grouped.set(message.threadKey, [message]);
  }

  const threads: ProviderThreadPayload[] = [];

  for (const [threadKey, threadMessages] of grouped) {
    const sorted = [...threadMessages].sort((left, right) =>
      (left.receivedAt ?? left.sentAt ?? "").localeCompare(right.receivedAt ?? right.sentAt ?? "")
    );
    const lastMessage = sorted[sorted.length - 1];

    threads.push({
      providerThreadId: `yahoo:${threadKey}`,
      subject: lastMessage?.subject ?? "(no subject)",
      snippet: lastMessage?.textBody?.slice(0, 280) ?? null,
      participants: uniqueParticipants(
        sorted.flatMap((message) => [message.from, ...message.to, ...message.cc, ...message.bcc])
      ),
      lastMessageAt:
        lastMessage?.receivedAt ??
        lastMessage?.sentAt ??
        new Date().toISOString(),
      isContractRelated: inferContractRelated(
        lastMessage?.subject ?? "",
        sorted.map((message) => message.textBody ?? "")
      ),
      messages: sorted.map(({ rawUid: _rawUid, threadKey: _threadKey, ...message }) => message)
    });
  }

  return threads.sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
}

export function buildYahooAuthUrl(state: string, nonce: string) {
  const connectScopes = ["openid"];
  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID ?? "",
    redirect_uri: getYahooRedirectUri(),
    response_type: "code",
    scope: connectScopes.join(" "),
    state,
    nonce
  });

  return `${YAHOO_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeYahooCode(code: string) {
  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.YAHOO_CLIENT_ID ?? "",
      client_secret: process.env.YAHOO_CLIENT_SECRET ?? "",
      redirect_uri: getYahooRedirectUri(),
      code,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Yahoo token exchange failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
    scope?: string;
    xoauth_yahoo_guid?: string;
  };
}

export async function refreshYahooAccessToken(refreshToken: string) {
  const response = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.YAHOO_CLIENT_ID ?? "",
      client_secret: process.env.YAHOO_CLIENT_SECRET ?? "",
      redirect_uri: getYahooRedirectUri(),
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Yahoo token refresh failed: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    xoauth_yahoo_guid?: string;
  };
}

export async function getYahooProfile(accessToken: string) {
  const response = await fetch(YAHOO_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo profile request failed: ${await response.text()}`);
  }

  const profile = (await response.json()) as {
    sub?: string;
    name?: string;
    email?: string;
    preferred_username?: string;
  };

  const emailAddress = normalizeYahooEmail(profile.email);
  if (!emailAddress) {
    throw new Error("Yahoo profile did not return an email address.");
  }

  return {
    providerAccountId: profile.sub?.trim() || emailAddress,
    emailAddress,
    displayName:
      profile.name?.trim() ||
      profile.preferred_username?.trim() ||
      emailAddress.split("@")[0] ||
      emailAddress
  };
}

export async function verifyYahooMailboxAccess(emailAddress: string, accessToken: string) {
  const normalizedEmail = normalizeYahooEmail(emailAddress);
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedEmail) {
    throw new Error("Enter a Yahoo email address.");
  }

  if (!normalizedAccessToken) {
    throw new Error("Missing Yahoo access token.");
  }

  const imapClient = new ImapFlow({
    host: YAHOO_IMAP_HOST,
    port: YAHOO_IMAP_PORT,
    secure: true,
    auth: {
      user: normalizedEmail,
      accessToken: normalizedAccessToken
    },
    verifyOnly: true,
    connectionTimeout: 20_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    logger: false
  });

  try {
    await imapClient.connect();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Yahoo IMAP login failed: ${error.message}`
        : "Yahoo IMAP login failed."
    );
  }

  const transporter = nodemailer.createTransport({
    host: YAHOO_SMTP_HOST,
    port: YAHOO_SMTP_PORT,
    secure: true,
    auth: {
      user: normalizedEmail,
      type: "OAuth2",
      accessToken: normalizedAccessToken
    },
    connectionTimeout: 20_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Yahoo SMTP login failed: ${error.message}`
        : "Yahoo SMTP login failed."
    );
  }

  return {
    emailAddress: normalizedEmail
  };
}

export async function listRecentYahooThreads(
  emailAddress: string,
  accessToken: string,
  recentLimit = 20
) {
  return withYahooMailbox(emailAddress, accessToken, async (client) => {
    const allUids = ((await client.search({ all: true }, { uid: true })) || []) as number[];
    const windowUids = allUids.slice(-Math.max(1, recentLimit));
    const parsed = await parseYahooMessages(client, windowUids, emailAddress);

    return {
      threads: mapYahooThreads(parsed.messages),
      cursor:
        allUids.length > 0
          ? buildYahooProviderCursor(allUids[allUids.length - 1], parsed.uidValidity)
          : buildYahooProviderCursor(0, parsed.uidValidity)
    };
  });
}

export async function listYahooThreadsSinceCursor(
  emailAddress: string,
  accessToken: string,
  providerCursor: string | null | undefined,
  windowLimit = 250
) {
  const cursor = parseYahooProviderCursor(providerCursor);
  if (!cursor) {
    return listRecentYahooThreads(emailAddress, accessToken, Math.max(20, Math.min(windowLimit, 100)));
  }

  return withYahooMailbox(emailAddress, accessToken, async (client) => {
    const allUids = ((await client.search({ all: true }, { uid: true })) || []) as number[];
    const uidValidity = client.mailbox ? String(client.mailbox.uidValidity) : null;
    const latestUid = allUids.length > 0 ? allUids[allUids.length - 1] : 0;

    if (uidValidity && cursor.uidValidity && uidValidity !== cursor.uidValidity) {
      const fallbackWindow = allUids.slice(-Math.max(20, Math.min(windowLimit, 100)));
      const parsed = await parseYahooMessages(client, fallbackWindow, emailAddress);

      return {
        threads: mapYahooThreads(parsed.messages),
        cursor: buildYahooProviderCursor(latestUid, uidValidity)
      };
    }

    const newUids = allUids.filter((uid) => uid > cursor.lastUid);
    if (newUids.length === 0) {
      return {
        threads: [],
        cursor: buildYahooProviderCursor(latestUid, uidValidity)
      };
    }

    const fallbackWindow = allUids.slice(-Math.max(windowLimit, newUids.length));
    const selectedUids = [...new Set([...fallbackWindow, ...newUids])].sort((left, right) => left - right);
    const parsed = await parseYahooMessages(client, selectedUids, emailAddress);
    const impactedThreadKeys = new Set(
      parsed.messages
        .filter((message) => newUids.includes(message.rawUid))
        .map((message) => message.threadKey)
    );

    return {
      threads: mapYahooThreads(
        parsed.messages.filter((message) => impactedThreadKeys.has(message.threadKey))
      ),
      cursor: buildYahooProviderCursor(latestUid, uidValidity)
    };
  });
}

export async function fetchYahooAttachment(
  emailAddress: string,
  accessToken: string,
  providerMessageId: string,
  providerAttachmentId: string
) {
  return withYahooMailbox(emailAddress, accessToken, async (client) => {
    const uid = parseProviderMessageUid(providerMessageId);
    const payload = await client.download(String(uid), providerAttachmentId, { uid: true });
    const bytes = await streamToBuffer(payload.content);

    return {
      bytes,
      sizeBytes: bytes.length
    };
  });
}

export async function sendYahooThreadReply(
  emailAddress: string,
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
  const transporter = nodemailer.createTransport({
    host: YAHOO_SMTP_HOST,
    port: YAHOO_SMTP_PORT,
    secure: true,
    auth: {
      user: emailAddress,
      type: "OAuth2",
      accessToken
    },
    connectionTimeout: 20_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });

  const result = await transporter.sendMail({
    from: emailAddress,
    to: input.to.map((participant) => participant.name ? `${participant.name} <${participant.email}>` : participant.email),
    cc: (input.cc ?? []).map((participant) => participant.name ? `${participant.name} <${participant.email}>` : participant.email),
    bcc: (input.bcc ?? []).map((participant) => participant.name ? `${participant.name} <${participant.email}>` : participant.email),
    subject: input.subject,
    text: input.body,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
    attachments: (input.attachments ?? []).map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.mimeType,
      content: attachment.bytes
    }))
  });

  const normalizedMessageId =
    typeof result.messageId === "string" ? result.messageId.replace(/^<|>$/g, "") : null;

  return {
    providerMessageId: normalizedMessageId ?? `${Date.now()}`,
    internetMessageId: normalizedMessageId,
    providerThreadId: input.threadId,
    to: input.to,
    cc: input.cc ?? [],
    bcc: input.bcc ?? []
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppBaseUrl } from "@/lib/email/config";
import { decodeBase64Url, encodeBase64Url } from "@/lib/email/crypto";
import { prisma } from "@/lib/prisma";

export const EMAIL_SUBSCRIPTION_CATEGORIES = ["product_updates"] as const;

export type EmailSubscriptionCategory =
  (typeof EMAIL_SUBSCRIPTION_CATEGORIES)[number];

let hasWarnedAboutMissingSubscriptionTable = false;

function normalizeEmailAddress(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function isEmailSubscriptionCategory(
  value: string
): value is EmailSubscriptionCategory {
  return EMAIL_SUBSCRIPTION_CATEGORIES.includes(
    value as EmailSubscriptionCategory
  );
}

function getEmailSubscriptionSecret() {
  const secret = process.env.EMAIL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("Missing EMAIL_TOKEN_ENCRYPTION_KEY.");
  }

  return secret;
}

function isMissingEmailSubscriptionTableError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return (
    code === "P2021" ||
    message.includes("EmailSubscriptionPreference") ||
    message.includes("does not exist in the current database")
  );
}

function warnAboutMissingSubscriptionTable() {
  if (hasWarnedAboutMissingSubscriptionTable) {
    return;
  }

  hasWarnedAboutMissingSubscriptionTable = true;
  console.warn(
    "Email subscription preferences table is missing. Run `pnpm prisma migrate dev --name add_email_subscription_preferences` to enable unsubscribe preferences."
  );
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getEmailSubscriptionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string) {
  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function formatEmailSubscriptionCategory(
  category: EmailSubscriptionCategory
) {
  switch (category) {
    case "product_updates":
      return "product updates";
  }
}

export async function resolveEmailSubscriptionEnabled(
  email: string | null | undefined,
  category: EmailSubscriptionCategory
) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!normalizedEmail || !process.env.DATABASE_URL) {
    return true;
  }

  let existing = null;

  try {
    existing = await prisma.emailSubscriptionPreference.findUnique({
      where: {
        email_category: {
          email: normalizedEmail,
          category
        }
      }
    });
  } catch (error) {
    if (!isMissingEmailSubscriptionTableError(error)) {
      throw error;
    }

    warnAboutMissingSubscriptionTable();
    return true;
  }

  return existing?.isSubscribed ?? true;
}

export async function setEmailSubscriptionPreference(input: {
  email: string | null | undefined;
  category: EmailSubscriptionCategory;
  isSubscribed: boolean;
  source?: string | null;
}) {
  const normalizedEmail = normalizeEmailAddress(input.email);
  if (!normalizedEmail || !process.env.DATABASE_URL) {
    return null;
  }

  const unsubscribedAt = input.isSubscribed ? null : new Date();

  try {
    return await prisma.emailSubscriptionPreference.upsert({
      where: {
        email_category: {
          email: normalizedEmail,
          category: input.category
        }
      },
      create: {
        email: normalizedEmail,
        category: input.category,
        isSubscribed: input.isSubscribed,
        source: input.source ?? null,
        unsubscribedAt
      },
      update: {
        isSubscribed: input.isSubscribed,
        source: input.source ?? null,
        unsubscribedAt
      }
    });
  } catch (error) {
    if (!isMissingEmailSubscriptionTableError(error)) {
      throw error;
    }

    warnAboutMissingSubscriptionTable();
    return null;
  }
}

export function createEmailSubscriptionToken(input: {
  email: string;
  category: EmailSubscriptionCategory;
}) {
  const normalizedEmail = normalizeEmailAddress(input.email);
  if (!normalizedEmail) {
    throw new Error("A valid email address is required.");
  }

  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      email: normalizedEmail,
      category: input.category
    })
  );

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function parseEmailSubscriptionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8")
    ) as {
      email?: unknown;
      category?: unknown;
    };

    const email =
      typeof payload.email === "string"
        ? normalizeEmailAddress(payload.email)
        : null;
    const category =
      typeof payload.category === "string" &&
      isEmailSubscriptionCategory(payload.category)
        ? payload.category
        : null;

    if (!email || !category) {
      return null;
    }

    return { email, category };
  } catch {
    return null;
  }
}

export function buildEmailSubscriptionHeaders(input: {
  email: string;
  category: EmailSubscriptionCategory;
}) {
  const token = createEmailSubscriptionToken(input);
  const unsubscribeUrl = new URL("/api/email/unsubscribe", `${getAppBaseUrl()}/`);
  unsubscribeUrl.searchParams.set("token", token);

  return {
    unsubscribeUrl: unsubscribeUrl.toString(),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    }
  };
}

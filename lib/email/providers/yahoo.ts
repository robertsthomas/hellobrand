import { getYahooRedirectUri, yahooScopes } from "@/lib/email/config";

const YAHOO_AUTH_BASE = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const YAHOO_USERINFO_URL = "https://api.login.yahoo.com/openid/v1/userinfo";

function normalizeYahooEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

async function yahooRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Yahoo request failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export function buildYahooAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID ?? "",
    redirect_uri: getYahooRedirectUri(),
    response_type: "code",
    language: "en-us",
    scope: yahooScopes.join(" "),
    state
  });

  return `${YAHOO_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeYahooCode(code: string) {
  return yahooRequest<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  }>(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.YAHOO_CLIENT_ID ?? "",
      client_secret: process.env.YAHOO_CLIENT_SECRET ?? "",
      code,
      redirect_uri: getYahooRedirectUri(),
      grant_type: "authorization_code"
    })
  });
}

export async function refreshYahooAccessToken(refreshToken: string) {
  return yahooRequest<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  }>(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.YAHOO_CLIENT_ID ?? "",
      client_secret: process.env.YAHOO_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
}

export async function getYahooProfile(accessToken: string) {
  const profile = await yahooRequest<{
    sub?: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    preferred_username?: string;
  }>(YAHOO_USERINFO_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });

  const email =
    normalizeYahooEmail(profile.email) ||
    normalizeYahooEmail(profile.preferred_username);

  if (!profile.sub || !email) {
    throw new Error("Yahoo profile response is missing an account id or email address.");
  }

  const displayName =
    profile.name?.trim() ||
    [profile.given_name?.trim(), profile.family_name?.trim()]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    email.split("@")[0] ||
    null;

  return {
    providerAccountId: profile.sub,
    emailAddress: email,
    displayName: displayName || null
  };
}

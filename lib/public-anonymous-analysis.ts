import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import { analyzeDocument } from "@/lib/analysis";
import { classifyDocumentHeuristically } from "@/lib/analysis/fallback";
import { stripInlineMarkdown, toPlainDealSummary } from "@/lib/deal-summary";
import { extractDocumentText } from "@/lib/documents/extract";
import { createDealForViewer, updateDealForViewer } from "@/lib/deals";
import { syncPaymentRecordForDeal } from "@/lib/payments";
import { getProfileForViewer } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import {
  getUnsupportedPublicUploadDocumentMessage,
  isAllowedPublicUploadDocumentKind
} from "@/lib/public-upload-document-kind";
import {
  ANONYMOUS_UPLOAD_WINDOW_MS
} from "@/lib/public-upload-guards";
import { getRepository } from "@/lib/repository";
import { getRuntimePath } from "@/lib/runtime-path";
import { deleteStoredBytes, readStoredBytes, storeUploadedBytes } from "@/lib/storage";
import type {
  AnonymousAnalysisSessionRecord,
  AnonymousDealBreakdown,
  AnonymousUploadLedgerRecord,
  DocumentAnalysisResult,
  Viewer
} from "@/lib/types";

const ANONYMOUS_SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const SESSION_FILE_STORE_NAME = "anonymous-analysis-sessions.json";
const LEDGER_FILE_STORE_NAME = "anonymous-upload-ledger.json";
const CLAIM_IN_PROGRESS_PREFIX = "__claiming__:";
const MAINTENANCE_INTERVAL_MS = 1000 * 60 * 5;

let maintenancePromise: Promise<void> | null = null;
let lastMaintenanceStartedAt = 0;

type AnonymousSourceType = "file" | "pasted_text";

type AnonymousSessionInput = {
  fileName: string;
  mimeType: string;
  sourceType: AnonymousSourceType;
  visitorId: string;
  ipHash: string;
  fileHash: string;
  storagePath: string | null;
  rawText: string | null;
  normalizedText: string;
  analysis: DocumentAnalysisResult;
  breakdown: AnonymousDealBreakdown;
};

type AnonymousAnalysisSessionRow = {
  id: string;
  token: string;
  fileName: string;
  mimeType: string;
  sourceType: string;
  visitorId: string | null;
  ipHash: string | null;
  fileHash: string | null;
  storagePath: string | null;
  rawText: string | null;
  normalizedText: string;
  analysisJson: unknown;
  breakdownJson: unknown;
  claimedByUserId: string | null;
  claimedDealId: string | null;
  claimedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type AnonymousUploadLedgerRow = {
  id: string;
  visitorId: string;
  ipHash: string;
  fileHash: string;
  createdAt: Date;
};

function isClaimInProgressValue(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(CLAIM_IN_PROGRESS_PREFIX);
}

function createClaimInProgressValue() {
  return `${CLAIM_IN_PROGRESS_PREFIX}${randomUUID()}`;
}

function getAnonymousSessionDelegate() {
  return (prisma as typeof prisma & {
    anonymousAnalysisSession?: {
      create: (args: unknown) => Promise<AnonymousAnalysisSessionRow>;
      findUnique: (args: unknown) => Promise<AnonymousAnalysisSessionRow | null>;
      findMany: (args: unknown) => Promise<AnonymousAnalysisSessionRow[]>;
      update: (args: unknown) => Promise<AnonymousAnalysisSessionRow>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }).anonymousAnalysisSession;
}

function getAnonymousUploadLedgerDelegate() {
  return (prisma as typeof prisma & {
    anonymousUploadLedger?: {
      create: (args: unknown) => Promise<AnonymousUploadLedgerRow>;
      count: (args: unknown) => Promise<number>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }).anonymousUploadLedger;
}

async function readStore<T>(fileName: string) {
  const target = getRuntimePath(fileName);

  try {
    const raw = await readFile(target, "utf8");
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeStore(fileName: string, entries: unknown[]) {
  const target = getRuntimePath(fileName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(entries, null, 2));
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toSessionRecord(row: AnonymousAnalysisSessionRow): AnonymousAnalysisSessionRecord {
  return {
    id: row.id,
    token: row.token,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sourceType: row.sourceType === "pasted_text" ? "pasted_text" : "file",
    visitorId: row.visitorId ?? null,
    ipHash: row.ipHash ?? null,
    fileHash: row.fileHash ?? null,
    storagePath: row.storagePath,
    rawText: row.rawText,
    normalizedText: row.normalizedText,
    analysis: row.analysisJson as DocumentAnalysisResult,
    breakdown: row.breakdownJson as AnonymousDealBreakdown,
    claimedByUserId: row.claimedByUserId,
    claimedDealId: row.claimedDealId,
    claimedAt: iso(row.claimedAt),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function cleanText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveTitleFromFileName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPaymentSummary(analysis: DocumentAnalysisResult) {
  const terms = analysis.extraction.data;
  const summaryParts: string[] = [];

  if (terms.paymentAmount !== null) {
    summaryParts.push(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: terms.currency ?? "USD",
        maximumFractionDigits: 2
      }).format(terms.paymentAmount)
    );
  }

  if (cleanText(terms.paymentTerms)) {
    summaryParts.push(cleanText(terms.paymentTerms) as string);
  } else if (typeof terms.netTermsDays === "number") {
    summaryParts.push(`Paid within ${terms.netTermsDays} days`);
  } else if (cleanText(terms.paymentTrigger)) {
    summaryParts.push(cleanText(terms.paymentTrigger) as string);
  }

  return summaryParts.length > 0 ? summaryParts.join(" • ") : null;
}

export function buildAnonymousDealBreakdown(input: {
  fileName: string;
  analysis: DocumentAnalysisResult;
}): AnonymousDealBreakdown {
  const terms = input.analysis.extraction.data;
  const brandName = cleanText(terms.brandName);
  const contractTitle =
    cleanText(terms.campaignName) ??
    (brandName ? `${brandName} partnership` : deriveTitleFromFileName(input.fileName));

  return {
    brandName,
    contractTitle,
    contractSummary: toPlainDealSummary(input.analysis.summary.body),
    paymentAmount: terms.paymentAmount ?? null,
    currency: terms.currency ?? "USD",
    paymentSummary: buildPaymentSummary(input.analysis),
    deliverables: Array.isArray(terms.deliverables)
      ? terms.deliverables.map((item, index) => ({
          ...item,
          id: item.id || `deliverable-${index + 1}`
        }))
      : [],
    riskFlags: input.analysis.riskFlags.map((flag, index) => ({
      id: `risk-${index + 1}`,
      title: stripInlineMarkdown(flag.title),
      detail: stripInlineMarkdown(flag.detail),
      severity: flag.severity,
      suggestedAction: flag.suggestedAction
    })),
    documentKind: input.analysis.classification.documentKind,
    sourceFileName: input.fileName
  };
}

export async function createAnonymousAnalysisSession(input: AnonymousSessionInput) {
  const token = `anon_${randomBytes(18).toString("hex")}`;
  const expiresAt = new Date(Date.now() + ANONYMOUS_SESSION_TTL_MS);
  const delegate = getAnonymousSessionDelegate();

  if (delegate) {
    const created = await delegate.create({
      data: {
        token,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sourceType: input.sourceType,
        visitorId: input.visitorId,
        ipHash: input.ipHash,
        fileHash: input.fileHash,
        storagePath: input.storagePath,
        rawText: input.rawText,
        normalizedText: input.normalizedText,
        analysisJson: input.analysis,
        breakdownJson: input.breakdown,
        expiresAt
      }
    });

    return toSessionRecord(created);
  }

  const now = new Date().toISOString();
  const record: AnonymousAnalysisSessionRecord = {
    id: randomUUID(),
    token,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sourceType: input.sourceType,
    visitorId: input.visitorId,
    ipHash: input.ipHash,
    fileHash: input.fileHash,
    storagePath: input.storagePath,
    rawText: input.rawText,
    normalizedText: input.normalizedText,
    analysis: input.analysis,
    breakdown: input.breakdown,
    claimedByUserId: null,
    claimedDealId: null,
    claimedAt: null,
    expiresAt: expiresAt.toISOString(),
    createdAt: now,
    updatedAt: now
  };

  const existing = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  await writeStore(SESSION_FILE_STORE_NAME, [...existing, record]);
  return record;
}

async function cleanupExpiredStoredSessions() {
  const now = Date.now();
  const delegate = getAnonymousSessionDelegate();

  if (delegate) {
    const expired = await delegate.findMany({
      where: {
        expiresAt: { lt: new Date(now) },
        claimedAt: null
      }
    });

    await Promise.all(
      expired
        .map((entry) => entry.storagePath)
        .filter((value): value is string => Boolean(value))
        .map((storagePath) => deleteStoredBytes(storagePath).catch(() => undefined))
    );

    await delegate.deleteMany({
      where: {
        expiresAt: { lt: new Date(now) },
        claimedAt: null
      }
    });

    return;
  }

  const entries = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  const activeEntries: AnonymousAnalysisSessionRecord[] = [];

  for (const entry of entries) {
    const isExpired = new Date(entry.expiresAt).getTime() < now && !entry.claimedAt;
    if (isExpired) {
      if (entry.storagePath) {
        await deleteStoredBytes(entry.storagePath).catch(() => undefined);
      }
      continue;
    }

    activeEntries.push(entry);
  }

  await writeStore(SESSION_FILE_STORE_NAME, activeEntries);
}

async function cleanupOldAnonymousUploadLedgerEntries() {
  const cutoff = new Date(Date.now() - ANONYMOUS_UPLOAD_WINDOW_MS);
  const delegate = getAnonymousUploadLedgerDelegate();

  if (delegate) {
    await delegate.deleteMany({
      where: {
        createdAt: { lt: cutoff }
      }
    });
    return;
  }

  const entries = await readStore<AnonymousUploadLedgerRecord>(LEDGER_FILE_STORE_NAME);
  const activeEntries = entries.filter(
    (entry) => new Date(entry.createdAt).getTime() >= cutoff.getTime()
  );
  await writeStore(LEDGER_FILE_STORE_NAME, activeEntries);
}

function scheduleAnonymousStorageMaintenance() {
  const now = Date.now();

  if (
    maintenancePromise ||
    now - lastMaintenanceStartedAt < MAINTENANCE_INTERVAL_MS
  ) {
    return;
  }

  lastMaintenanceStartedAt = now;
  maintenancePromise = (async () => {
    try {
      await Promise.all([
        cleanupExpiredStoredSessions(),
        cleanupOldAnonymousUploadLedgerEntries()
      ]);
    } finally {
      maintenancePromise = null;
    }
  })();

  void maintenancePromise.catch(() => undefined);
}

export async function getAnonymousAnalysisSessionByToken(token: string) {
  scheduleAnonymousStorageMaintenance();
  const delegate = getAnonymousSessionDelegate();

  if (delegate) {
    const row = await delegate.findUnique({
      where: { token }
    });

    return row ? toSessionRecord(row) : null;
  }

  const entries = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  return entries.find((entry) => entry.token === token) ?? null;
}

export async function findReusableAnonymousAnalysisSession(input: {
  visitorId: string;
  fileHash: string;
}) {
  scheduleAnonymousStorageMaintenance();
  const delegate = getAnonymousSessionDelegate();

  if (delegate) {
    const [row] = await delegate.findMany({
      where: {
        visitorId: input.visitorId,
        fileHash: input.fileHash,
        claimedAt: null,
        expiresAt: { gte: new Date() }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 1
    });

    return row ? toSessionRecord(row) : null;
  }

  const entries = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  return (
    entries
      .filter(
        (entry) =>
          entry.visitorId === input.visitorId &&
          entry.fileHash === input.fileHash &&
          !entry.claimedAt &&
          new Date(entry.expiresAt).getTime() >= Date.now()
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export async function countRecentAnonymousUploadAttempts(input: {
  visitorId: string;
  ipHash: string;
}) {
  scheduleAnonymousStorageMaintenance();
  const since = new Date(Date.now() - ANONYMOUS_UPLOAD_WINDOW_MS);
  const delegate = getAnonymousUploadLedgerDelegate();

  if (delegate) {
    const [visitorCount, ipCount] = await Promise.all([
      delegate.count({
        where: {
          visitorId: input.visitorId,
          createdAt: { gte: since }
        }
      }),
      delegate.count({
        where: {
          ipHash: input.ipHash,
          createdAt: { gte: since }
        }
      })
    ]);

    return { visitorCount, ipCount };
  }

  const entries = await readStore<AnonymousUploadLedgerRecord>(LEDGER_FILE_STORE_NAME);
  const activeEntries = entries.filter(
    (entry) => new Date(entry.createdAt).getTime() >= since.getTime()
  );

  return {
    visitorCount: activeEntries.filter((entry) => entry.visitorId === input.visitorId).length,
    ipCount: activeEntries.filter((entry) => entry.ipHash === input.ipHash).length
  };
}

export async function recordAnonymousUploadAttempt(input: {
  visitorId: string;
  ipHash: string;
  fileHash: string;
}) {
  const delegate = getAnonymousUploadLedgerDelegate();

  if (delegate) {
    await delegate.create({
      data: {
        visitorId: input.visitorId,
        ipHash: input.ipHash,
        fileHash: input.fileHash
      }
    });
    return;
  }

  const entries = await readStore<AnonymousUploadLedgerRecord>(LEDGER_FILE_STORE_NAME);
  const record: AnonymousUploadLedgerRecord = {
    id: randomUUID(),
    visitorId: input.visitorId,
    ipHash: input.ipHash,
    fileHash: input.fileHash,
    createdAt: new Date().toISOString()
  };

  await writeStore(LEDGER_FILE_STORE_NAME, [...entries, record]);
}

export async function updateStoredSession(
  token: string,
  patch: Partial<AnonymousAnalysisSessionRecord>
) {
  const delegate = getAnonymousSessionDelegate();

  if (delegate) {
    const updated = await delegate.update({
      where: { token },
      data: {
        storagePath: patch.storagePath,
        claimedByUserId: patch.claimedByUserId,
        claimedDealId: patch.claimedDealId,
        claimedAt:
          patch.claimedAt === undefined
            ? undefined
            : patch.claimedAt
              ? new Date(patch.claimedAt)
              : null
      }
    });

    return toSessionRecord(updated);
  }

  const entries = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  const updatedEntries = entries.map((entry) =>
    entry.token === token
      ? {
          ...entry,
          ...patch,
          updatedAt: new Date().toISOString()
        }
      : entry
  );

  await writeStore(SESSION_FILE_STORE_NAME, updatedEntries);
  return updatedEntries.find((entry) => entry.token === token) ?? null;
}

async function tryAcquireAnonymousClaimLock(viewer: Viewer, token: string) {
  const delegate = getAnonymousSessionDelegate();
  const claimingValue = createClaimInProgressValue();
  const claimTimestamp = new Date().toISOString();

  if (delegate) {
    const updated = await (delegate as typeof delegate & {
      updateMany: (args: unknown) => Promise<{ count: number }>;
    }).updateMany({
      where: {
        token,
        claimedDealId: null
      },
      data: {
        claimedByUserId: viewer.id,
        claimedDealId: claimingValue,
        claimedAt: new Date(claimTimestamp)
      }
    });

    if (updated.count === 0) {
      return null;
    }

    const locked = await delegate.findUnique({
      where: { token }
    });

    return locked ? toSessionRecord(locked) : null;
  }

  const entries = await readStore<AnonymousAnalysisSessionRecord>(SESSION_FILE_STORE_NAME);
  let lockedEntry: AnonymousAnalysisSessionRecord | null = null;

  const updatedEntries = entries.map((entry) => {
    if (entry.token !== token || entry.claimedDealId !== null) {
      return entry;
    }

    lockedEntry = {
      ...entry,
      claimedByUserId: viewer.id,
      claimedDealId: claimingValue,
      claimedAt: claimTimestamp,
      updatedAt: new Date().toISOString()
    };

    return lockedEntry;
  });

  if (!lockedEntry) {
    return null;
  }

  await writeStore(SESSION_FILE_STORE_NAME, updatedEntries);
  return lockedEntry;
}

export async function analyzeAnonymousUpload(input: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  visitorId: string;
  ipHash: string;
  fileHash: string;
}) {
  const extracted = await extractDocumentText(input.bytes, input.mimeType, input.fileName);
  const classification = classifyDocumentHeuristically(
    extracted.normalizedText,
    input.fileName
  );
  const isSupportedAnonymousDocument = isAllowedPublicUploadDocumentKind(
    classification.documentKind
  );

  if (!isSupportedAnonymousDocument) {
    throw new Error(
      getUnsupportedPublicUploadDocumentMessage(classification.documentKind)
    );
  }

  const analysis = await analyzeDocument(extracted.normalizedText, {
    fileName: input.fileName,
    documentKindHint: classification.documentKind
  });
  const breakdown = buildAnonymousDealBreakdown({
    fileName: input.fileName,
    analysis
  });

  const stored = await storeUploadedBytes({
    fileName: input.fileName,
    bytes: input.bytes,
    contentType: input.mimeType || "application/octet-stream",
    folder: "anonymous-analysis"
  });

  const session = await createAnonymousAnalysisSession({
    fileName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    sourceType: "file",
    visitorId: input.visitorId,
    ipHash: input.ipHash,
    fileHash: input.fileHash,
    storagePath: stored.storagePath,
    rawText: extracted.rawText,
    normalizedText: extracted.normalizedText,
    analysis,
    breakdown
  });

  return {
    token: session.token,
    breakdown: session.breakdown,
    expiresAt: session.expiresAt
  };
}

export async function claimAnonymousAnalysisSession(viewer: Viewer, token: string) {
  const session = await getAnonymousAnalysisSessionByToken(token);

  if (!session) {
    throw new Error("This upload could not be found. Try uploading the contract again.");
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    throw new Error("This upload expired. Try uploading the contract again.");
  }

  if (session.claimedDealId) {
    if (isClaimInProgressValue(session.claimedDealId)) {
      throw new Error("This upload is already being saved. Please wait a moment.");
    }

    if (session.claimedByUserId === viewer.id) {
      return {
        dealId: session.claimedDealId,
        href: `/app/deals/${session.claimedDealId}`,
        alreadyClaimed: true
      };
    }

    throw new Error("This upload has already been claimed.");
  }

  const lockedSession = await tryAcquireAnonymousClaimLock(viewer, token);

  if (!lockedSession) {
    const latestSession = await getAnonymousAnalysisSessionByToken(token);

    if (!latestSession) {
      throw new Error("This upload could not be found. Try uploading the contract again.");
    }

    if (latestSession.claimedDealId) {
      if (isClaimInProgressValue(latestSession.claimedDealId)) {
        throw new Error("This upload is already being saved. Please wait a moment.");
      }

      if (latestSession.claimedByUserId === viewer.id) {
        return {
          dealId: latestSession.claimedDealId,
          href: `/app/deals/${latestSession.claimedDealId}`,
          alreadyClaimed: true
        };
      }

      throw new Error("This upload has already been claimed.");
    }

    throw new Error("This upload could not be claimed. Please try again.");
  }

  const repository = getRepository();
  const profile = await getProfileForViewer(viewer).catch(() => null);

  try {
    const deal = await createDealForViewer(viewer, {
      brandName: lockedSession.breakdown.brandName ?? "Untitled brand",
      campaignName:
        lockedSession.breakdown.contractTitle ??
        deriveTitleFromFileName(lockedSession.fileName)
    });

    let documentStoragePath = lockedSession.storagePath;
    if (lockedSession.storagePath) {
      const bytes = await readStoredBytes(lockedSession.storagePath);
      const stored = await storeUploadedBytes({
        fileName: lockedSession.fileName,
        bytes,
        contentType: lockedSession.mimeType,
        folder: deal.id
      });
      documentStoragePath = stored.storagePath;
    }

    const document = await repository.createDocument({
      dealId: deal.id,
      userId: viewer.id,
      fileName: lockedSession.fileName,
      mimeType: lockedSession.mimeType,
      storagePath: documentStoragePath ?? `pasted:${lockedSession.fileName}`,
      processingStatus: "ready",
      rawText: lockedSession.rawText,
      normalizedText: lockedSession.normalizedText,
      documentKind: lockedSession.analysis.classification.documentKind,
      classificationConfidence: lockedSession.analysis.classification.confidence,
      sourceType: lockedSession.sourceType,
      errorMessage: null
    });

    const savedSections = await repository.replaceDocumentSections(
      document.id,
      lockedSession.analysis.sections.map((section) => ({
        title: section.title,
        content: section.content,
        chunkIndex: section.chunkIndex,
        pageRange: section.pageRange
      }))
    );

    await repository.upsertExtractionResult(document.id, {
      schemaVersion: lockedSession.analysis.extraction.schemaVersion,
      model: lockedSession.analysis.extraction.model,
      confidence: lockedSession.analysis.extraction.confidence,
      data: lockedSession.analysis.extraction.data,
      conflicts: lockedSession.analysis.extraction.conflicts
    });

    await repository.replaceExtractionEvidence(
      document.id,
      lockedSession.analysis.extraction.evidence.map((entry) => ({
        fieldPath: entry.fieldPath,
        snippet: entry.snippet,
        sectionId:
          savedSections.find((section) => `section:${section.chunkIndex}` === entry.sectionKey)
            ?.id ?? null,
        confidence: entry.confidence
      }))
    );

    await repository.replaceRiskFlagsForDocument(
      deal.id,
      document.id,
      lockedSession.analysis.riskFlags.map((flag) => ({
        ...flag,
        sourceDocumentId: document.id
      }))
    );

    await repository.saveSummary(deal.id, document.id, lockedSession.analysis.summary);

    const extractionData = lockedSession.analysis.extraction.data;
    const nextTerms = {
      ...extractionData,
      brandName:
        cleanText(extractionData.brandName) ??
        lockedSession.breakdown.brandName ??
        deal.brandName,
      campaignName:
        cleanText(extractionData.campaignName) ??
        lockedSession.breakdown.contractTitle ??
        deal.campaignName,
      creatorName:
        extractionData.creatorName ??
        profile?.creatorLegalName ??
        profile?.displayName ??
        viewer.displayName,
      pendingExtraction: null
    };

    await repository.upsertTerms(deal.id, nextTerms);
    await syncPaymentRecordForDeal(deal.id, nextTerms);

    await updateDealForViewer(viewer, deal.id, {
      brandName: nextTerms.brandName ?? deal.brandName,
      campaignName: nextTerms.campaignName ?? deal.campaignName,
      summary: lockedSession.breakdown.contractSummary,
      analyzedAt: new Date().toISOString(),
      confirmedAt: deal.confirmedAt ?? new Date().toISOString()
    });

    await updateStoredSession(token, {
      storagePath: null,
      claimedByUserId: viewer.id,
      claimedDealId: deal.id,
      claimedAt: new Date().toISOString()
    });

    if (lockedSession.storagePath) {
      await deleteStoredBytes(lockedSession.storagePath).catch(() => undefined);
    }

    return {
      dealId: deal.id,
      href: `/app/deals/${deal.id}`,
      alreadyClaimed: false
    };
  } catch (error) {
    await updateStoredSession(token, {
      claimedByUserId: null,
      claimedDealId: null,
      claimedAt: null
    }).catch(() => undefined);

    throw error;
  }
}

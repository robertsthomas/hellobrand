import type { protos } from "@google-cloud/documentai";

import { createEmptyTerms } from "@/lib/document-pipeline-shared";
import {
  extractDocumentAiTextAnchor,
  processDocumentWithDocumentAi
} from "@/lib/document-ai";
import type { DealRecord, ExtractionPipelineResult, FieldEvidence } from "@/lib/types";

type DocumentAiDocument = protos.google.cloud.documentai.v1.IDocument;
type DocumentAiEntity = protos.google.cloud.documentai.v1.Document.IEntity;
type DocumentAiMoney = protos.google.type.IMoney;
type DocumentAiDate = protos.google.type.IDate;

const INVOICE_SCHEMA_VERSION = "document-ai-invoice-v1";
const INVOICE_MODEL = "document_ai:invoice_parser";

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDateString(value: string | null | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const isoMatch = normalized.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]!.padStart(2, "0")}-${isoMatch[3]!.padStart(2, "0")}`;
  }

  if (!/\b\d{4}\b/.test(normalized)) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function moneyToAmount(value: DocumentAiMoney | null | undefined) {
  if (!value) {
    return null;
  }

  const units =
    typeof value.units === "number"
      ? value.units
      : typeof value.units === "string"
        ? Number.parseInt(value.units, 10)
        : value.units && typeof value.units.toString === "function"
          ? Number.parseInt(value.units.toString(), 10)
          : 0;
  const nanos = typeof value.nanos === "number" ? value.nanos : 0;

  return Number((units + nanos / 1_000_000_000).toFixed(2));
}

function dateToIso(value: DocumentAiDate | null | undefined) {
  if (!value?.year || !value?.month || !value?.day) {
    return null;
  }

  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(
    value.day
  ).padStart(2, "0")}`;
}

function entitySnippet(document: DocumentAiDocument, entity: DocumentAiEntity) {
  return normalizeString(
    entity.mentionText ??
      entity.textAnchor?.content ??
      extractDocumentAiTextAnchor(document, entity.textAnchor) ??
      entity.normalizedValue?.text ??
      null
  );
}

function entityText(document: DocumentAiDocument, entity: DocumentAiEntity) {
  return (
    normalizeString(entity.normalizedValue?.text) ??
    entitySnippet(document, entity) ??
    null
  );
}

function entityNumber(entity: DocumentAiEntity) {
  if (entity.normalizedValue?.moneyValue) {
    return moneyToAmount(entity.normalizedValue.moneyValue);
  }

  if (typeof entity.normalizedValue?.floatValue === "number") {
    return entity.normalizedValue.floatValue;
  }

  if (typeof entity.normalizedValue?.integerValue === "number") {
    return entity.normalizedValue.integerValue;
  }

  const text = normalizeString(entity.normalizedValue?.text ?? entity.mentionText ?? null);
  if (!text) {
    return null;
  }

  const numeric = text.replace(/[^0-9.-]+/g, "");
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed : null;
}

function entityCurrency(entity: DocumentAiEntity) {
  const code = normalizeString(entity.normalizedValue?.moneyValue?.currencyCode);
  if (code) {
    return code.toUpperCase();
  }

  const text = normalizeString(entity.normalizedValue?.text ?? entity.mentionText ?? null);
  if (!text) {
    return null;
  }

  const directCode = text.match(/\b[A-Z]{3}\b/)?.[0];
  if (directCode) {
    return directCode.toUpperCase();
  }

  if (/\$/.test(text) || /\busd\b/i.test(text)) {
    return "USD";
  }

  return null;
}

function entityDate(entity: DocumentAiEntity) {
  return (
    dateToIso(entity.normalizedValue?.dateValue) ??
    parseDateString(entity.normalizedValue?.text) ??
    parseDateString(entity.mentionText) ??
    null
  );
}

function findFirstEntity(entities: DocumentAiEntity[], ...types: string[]) {
  return entities.find((entity) => entity.type && types.includes(entity.type)) ?? null;
}

function pushEvidence(
  evidence: FieldEvidence[],
  fieldPath: string,
  document: DocumentAiDocument,
  entity: DocumentAiEntity | null,
  confidenceOverride?: number | null
) {
  if (!entity) {
    return;
  }

  const snippet = entitySnippet(document, entity);
  if (!snippet) {
    return;
  }

  evidence.push({
    fieldPath,
    snippet,
    sectionKey: null,
    confidence:
      typeof confidenceOverride === "number"
        ? confidenceOverride
        : typeof entity.confidence === "number"
          ? entity.confidence
          : null
  });
}

function confidentEntityDate(entity: DocumentAiEntity | null) {
  if (!entity) {
    return null;
  }

  if (typeof entity.confidence === "number" && entity.confidence < 0.5) {
    return null;
  }

  return entityDate(entity);
}

function averageConfidence(evidence: FieldEvidence[]) {
  const confidences = evidence
    .map((entry) => entry.confidence)
    .filter((value): value is number => typeof value === "number");

  if (confidences.length === 0) {
    return null;
  }

  return Number(
    (confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(4)
  );
}

export function hasMeaningfulInvoiceExtraction(extraction: ExtractionPipelineResult) {
  return Boolean(
    extraction.data.paymentAmount !== null ||
      extraction.data.brandName ||
      extraction.data.paymentTerms ||
      extraction.evidence.some((entry) => entry.fieldPath.startsWith("invoice."))
  );
}

export function mapDocumentAiInvoiceToExtraction(input: {
  document: DocumentAiDocument;
  deal: Pick<DealRecord, "brandName" | "campaignName"> | { brandName: string | null; campaignName: string | null };
}) {
  const entities = input.document.entities ?? [];
  const evidence: FieldEvidence[] = [];
  const terms = createEmptyTerms(input.deal);

  const amountDueEntity = findFirstEntity(entities, "amount_due", "total_amount", "net_amount");
  const currencyEntity = findFirstEntity(entities, "currency", "amount_due", "total_amount");
  const paymentTermsEntity = findFirstEntity(entities, "payment_terms");
  const receiverNameEntity = findFirstEntity(entities, "receiver_name");
  const receiverAddressEntity = findFirstEntity(entities, "receiver_address");
  const supplierNameEntity = findFirstEntity(entities, "supplier_name");
  const supplierAddressEntity = findFirstEntity(entities, "supplier_address");
  const dueDateEntity = findFirstEntity(entities, "due_date");
  const invoiceDateEntity = findFirstEntity(entities, "invoice_date");
  const invoiceIdEntity = findFirstEntity(entities, "invoice_id");

  const paymentAmount = amountDueEntity ? entityNumber(amountDueEntity) : null;
  const currency =
    (currencyEntity ? entityCurrency(currencyEntity) : null) ??
    (/\$/m.test(input.document.text ?? "") ? "USD" : null);
  const paymentTerms = paymentTermsEntity ? entityText(input.document, paymentTermsEntity) : null;
  const receiverName = receiverNameEntity ? entityText(input.document, receiverNameEntity) : null;

  terms.paymentAmount = paymentAmount;
  terms.currency = currency;
  terms.paymentTerms = paymentTerms;
  terms.brandName = receiverName ?? terms.brandName;

  pushEvidence(evidence, "paymentAmount", input.document, amountDueEntity);
  pushEvidence(evidence, "currency", input.document, currencyEntity);
  pushEvidence(evidence, "paymentTerms", input.document, paymentTermsEntity);
  pushEvidence(evidence, "brandName", input.document, receiverNameEntity);
  pushEvidence(evidence, "invoice.invoiceDate", input.document, invoiceDateEntity);
  pushEvidence(evidence, "invoice.dueDate", input.document, dueDateEntity);
  pushEvidence(evidence, "invoice.invoiceId", input.document, invoiceIdEntity);
  pushEvidence(evidence, "invoice.receiverName", input.document, receiverNameEntity);
  pushEvidence(evidence, "invoice.receiverAddress", input.document, receiverAddressEntity);
  pushEvidence(evidence, "invoice.supplierName", input.document, supplierNameEntity);
  pushEvidence(evidence, "invoice.supplierAddress", input.document, supplierAddressEntity);

  const invoiceDate = confidentEntityDate(invoiceDateEntity);
  const dueDate = confidentEntityDate(dueDateEntity);
  const invoiceId = invoiceIdEntity ? entityText(input.document, invoiceIdEntity) : null;

  if (invoiceId || invoiceDate || dueDate) {
    const noteParts = [
      invoiceId ? `Invoice ${invoiceId}` : null,
      invoiceDate ? `issued ${invoiceDate}` : null,
      dueDate ? `due ${dueDate}` : null
    ].filter(Boolean);

    terms.notes = noteParts.length > 0 ? noteParts.join(" · ") : null;
  }

  return {
    schemaVersion: INVOICE_SCHEMA_VERSION,
    model: INVOICE_MODEL,
    confidence: averageConfidence(evidence),
    data: terms,
    evidence,
    conflicts: []
  } satisfies ExtractionPipelineResult;
}

export async function extractInvoiceTermsWithDocumentAi(input: {
  bytes: Buffer;
  mimeType: string;
  deal: Pick<DealRecord, "brandName" | "campaignName"> | { brandName: string | null; campaignName: string | null };
}) {
  const { extraction } = await extractInvoiceTermsWithDocumentAiDetailed(input);
  return extraction;
}

export async function extractInvoiceTermsWithDocumentAiDetailed(input: {
  bytes: Buffer;
  mimeType: string;
  deal: Pick<DealRecord, "brandName" | "campaignName"> | { brandName: string | null; campaignName: string | null };
}) {
  const response = await processDocumentWithDocumentAi({
    processor: "invoice",
    bytes: input.bytes,
    mimeType: input.mimeType,
    imagelessMode: true,
    fieldMaskPaths: ["text", "entities"]
  });

  return {
    extraction: mapDocumentAiInvoiceToExtraction({
      document: response.document ?? {},
      deal: input.deal
    }),
    rawResponse: response.rawResponse,
    processor: response.processor,
    pageCount: response.pageCount,
    entityCount: response.entityCount
  };
}

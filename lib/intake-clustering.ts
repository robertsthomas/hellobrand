import type { DocumentKind } from "@/lib/types";

export interface ClusterInput {
  documentId: string;
  fileName: string;
  rawText: string;
  documentKind: DocumentKind;
  brandHint: string | null;
}

export interface ClusterOutput {
  groups: Array<{
    label: string;
    confidence: number;
    documentIds: string[];
  }>;
}

export function extractBrandFromText(text: string): string | null {
  const lower = text.toLowerCase();

  const brandPatterns = [
    /(?:brand|client)\s*:\s*([A-Z][A-Za-z0-9&''\- ]{2,40})/i,
    /(?:partnership|campaign)\s+(?:with|for)\s+([A-Z][A-Za-z0-9&''\- ]{2,40})/i,
    /(?:between|behalf of)\s+([A-Z][A-Za-z0-9&''\- ]{2,40})/i
  ];

  for (const pattern of brandPatterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) {
      const candidate = match[1].trim();
      const stopWords = ["the", "creator", "talent", "influencer", "agency", "and", "for", "with"];
      if (!stopWords.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  return null;
}

export function extractBrandFromFileName(fileName: string): string | null {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const parts = withoutExt
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 1);

  const stopWords = new Set([
    "contract", "agreement", "brief", "campaign", "offer",
    "email", "invoice", "deliverables", "creative", "draft",
    "final", "v1", "v2", "signed", "unsigned", "pdf", "doc"
  ]);

  const candidates = parts.filter((p) => !stopWords.has(p.toLowerCase()));
  if (candidates.length > 0 && candidates.length <= 3) {
    return candidates.join(" ");
  }

  return null;
}

export function normalizeBrand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function clusterDocuments(inputs: ClusterInput[]): ClusterOutput {
  if (inputs.length === 0) {
    return { groups: [] };
  }

  if (inputs.length === 1) {
    const brand = inputs[0].brandHint
      ?? extractBrandFromText(inputs[0].rawText)
      ?? extractBrandFromFileName(inputs[0].fileName)
      ?? "Unknown";

    return {
      groups: [{
        label: brand,
        confidence: 0.9,
        documentIds: [inputs[0].documentId]
      }]
    };
  }

  const brandMap = new Map<string, { label: string; documentIds: string[]; exact: boolean }>();

  for (const input of inputs) {
    const brand =
      input.brandHint
      ?? extractBrandFromText(input.rawText)
      ?? extractBrandFromFileName(input.fileName);

    if (brand) {
      const key = normalizeBrand(brand);
      const existing = brandMap.get(key);
      if (existing) {
        existing.documentIds.push(input.documentId);
      } else {
        brandMap.set(key, {
          label: brand,
          documentIds: [input.documentId],
          exact: Boolean(input.brandHint) || Boolean(extractBrandFromText(input.rawText))
        });
      }
    }
  }

  const assignedDocs = new Set<string>();
  for (const group of brandMap.values()) {
    for (const id of group.documentIds) {
      assignedDocs.add(id);
    }
  }

  const unassigned = inputs.filter((i) => !assignedDocs.has(i.documentId));

  if (unassigned.length > 0) {
    if (brandMap.size === 1) {
      const [, group] = [...brandMap.entries()][0];
      for (const doc of unassigned) {
        group.documentIds.push(doc.documentId);
      }
    } else {
      const existing = brandMap.get(normalizeBrand("Unknown"));
      if (existing) {
        for (const doc of unassigned) {
          existing.documentIds.push(doc.documentId);
        }
      } else {
        brandMap.set("unknown", {
          label: "Unknown",
          documentIds: unassigned.map((d) => d.documentId),
          exact: false
        });
      }
    }
  }

  const groups = [...brandMap.values()].map((group) => ({
    label: group.label,
    confidence: group.exact ? 0.9 : 0.6,
    documentIds: group.documentIds
  }));

  return { groups };
}

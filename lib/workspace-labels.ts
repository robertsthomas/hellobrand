function presentText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isGenericWorkspaceLabel(value: string | null | undefined) {
  const normalized = presentText(value)?.toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized === "workspace" ||
    normalized === "new workspace" ||
    normalized === "partnership workspace" ||
    normalized === "partnership" ||
    normalized === "pasted brand context" ||
    normalized === "pasted context" ||
    normalized === "pasted contract" ||
    normalized === "pasted campaign brief" ||
    normalized === "pasted email thread" ||
    normalized === "pasted invoice" ||
    normalized === "email thread" ||
    normalized === "campaign brief" ||
    normalized === "contract" ||
    normalized === "context" ||
    /^\d+$/.test(normalized) ||
    /^\d+\s+uploaded documents?$/.test(normalized) ||
    /^workspace\s*-\s*\d+\s+uploaded documents?$/.test(normalized)
  );
}

export function cleanWorkspaceFileName(fileName: string) {
  const cleaned = presentText(
    fileName
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(
        /\b(influencer brief|campaign brief|deliverables brief|brief|agreement|contract|term sheet|msa|sow|scope of work|pitch deck|deck|copy)\b/gi,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim()
  );

  if (!cleaned || isGenericWorkspaceLabel(cleaned)) {
    return null;
  }

  return cleaned;
}

export function deriveWorkspaceTitleFromFileNames(fileNames: string[]) {
  for (const fileName of fileNames) {
    const cleaned = cleanWorkspaceFileName(fileName);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

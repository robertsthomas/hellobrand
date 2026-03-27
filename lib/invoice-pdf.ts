import type { InvoiceRecord } from "@/lib/types";

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapLine(value: string, maxLength = 82) {
  if (value.length <= maxLength) {
    return [value];
  }

  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export function buildInvoicePlainText(input: {
  invoice: InvoiceRecord;
  workspaceLabel: string;
}) {
  const { invoice, workspaceLabel } = input;
  const lines = [
    `Invoice ${invoice.invoiceNumber}`,
    workspaceLabel,
    `Status: ${invoice.status}`,
    `Invoice date: ${invoice.invoiceDate ?? "Not set"}`,
    `Due date: ${invoice.dueDate ?? "Not set"}`,
    `Currency: ${invoice.currency ?? "USD"}`,
    `Bill to: ${invoice.billTo.companyName ?? invoice.billTo.name}`,
    `Issuer: ${invoice.issuer.companyName ?? invoice.issuer.name}`,
    "",
    "Line items:"
  ];

  for (const item of invoice.lineItems) {
    lines.push(
      `- ${item.title} | Qty ${item.quantity} | Unit ${item.unitRate.toFixed(2)} | Amount ${item.amount.toFixed(2)}`
    );
    if (item.description) {
      lines.push(`  ${item.description}`);
    }
  }

  lines.push("", `Subtotal: ${invoice.subtotal?.toFixed(2) ?? "0.00"}`);
  if (invoice.notes) {
    lines.push("", `Notes: ${invoice.notes}`);
  }

  return lines.join("\n");
}

export function renderInvoicePdf(input: {
  invoice: InvoiceRecord;
  workspaceLabel: string;
}) {
  const lines = buildInvoicePlainText(input)
    .split("\n")
    .flatMap((line) => (line.length > 0 ? wrapLine(line) : [" "]))
    .slice(0, 56);

  const contentLines = [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "50 760 Td"
  ];

  lines.forEach((line, index) => {
    contentLines.push(`(${escapePdfText(line)}) Tj`);
    if (index < lines.length - 1) {
      contentLines.push("T*");
    }
  });

  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "utf8");
}

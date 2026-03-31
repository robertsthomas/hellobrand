import type { InvoiceRecord } from "@/lib/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 50;
const TOP_MARGIN = 748;
const LINE_HEIGHT = 14;
const PAGE_LINE_LIMIT = 46;

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapLine(value: string, maxLength = 84) {
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

function formatMoney(value: number | null | undefined) {
  return (value ?? 0).toFixed(2);
}

function pushSection(
  lines: string[],
  title: string,
  values: Array<string | null | undefined>
) {
  lines.push(title);
  for (const value of values) {
    if (value && value.trim().length > 0) {
      lines.push(value.trim());
    }
  }
  lines.push("");
}

export function buildInvoicePlainText(input: {
  invoice: InvoiceRecord;
  workspaceLabel: string;
}) {
  const { invoice, workspaceLabel } = input;
  const lines: string[] = [
    "INVOICE",
    workspaceLabel,
    "",
    `Invoice number: ${invoice.invoiceNumber}`,
    `Status: ${invoice.status}`,
    `Invoice date: ${invoice.invoiceDate ?? "Not set"}`,
    `Due date: ${invoice.dueDate ?? "Not set"}`,
    `Currency: ${invoice.currency ?? "USD"}`,
    ""
  ];

  pushSection(lines, "Bill to", [
    invoice.billTo.companyName,
    invoice.billTo.name,
    invoice.billTo.email,
    invoice.billTo.address,
    invoice.billTo.taxId ? `Tax ID: ${invoice.billTo.taxId}` : null
  ]);

  pushSection(lines, "Issuer", [
    invoice.issuer.companyName,
    invoice.issuer.name,
    invoice.issuer.email,
    invoice.issuer.address,
    invoice.issuer.taxId ? `Tax ID: ${invoice.issuer.taxId}` : null,
    invoice.issuer.payoutDetails ? `Remittance: ${invoice.issuer.payoutDetails}` : null
  ]);

  lines.push("Line items");
  lines.push("Description | Qty | Rate | Amount");
  for (const item of invoice.lineItems) {
    lines.push(
      `${item.title} | ${item.quantity} | ${formatMoney(item.unitRate)} | ${formatMoney(item.amount)}`
    );
    if (item.channel) {
      lines.push(`  Channel: ${item.channel}`);
    }
    if (item.description) {
      lines.push(`  ${item.description}`);
    }
  }

  lines.push("");
  lines.push(`Subtotal: ${formatMoney(invoice.subtotal)}`);
  if (invoice.notes) {
    lines.push("");
    lines.push("Notes");
    lines.push(invoice.notes);
  }

  return lines.join("\n");
}

function paginateLines(lines: string[]) {
  const wrapped = lines.flatMap((line) => (line.length > 0 ? wrapLine(line) : [" "]));
  const pages: string[][] = [];

  for (let index = 0; index < wrapped.length; index += PAGE_LINE_LIMIT) {
    pages.push(wrapped.slice(index, index + PAGE_LINE_LIMIT));
  }

  return pages.length > 0 ? pages : [[" "]];
}

export function renderInvoicePdf(input: {
  invoice: InvoiceRecord;
  workspaceLabel: string;
}) {
  const pages = paginateLines(buildInvoicePlainText(input).split("\n"));
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const fontObjectNumber = 3 + pages.length * 2;

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = 4 + pageIndex * 2;
    pageObjectNumbers.push(pageObjectNumber);

    const contentLines = ["BT", "/F1 11 Tf", `${LINE_HEIGHT} TL`, `${LEFT_MARGIN} ${TOP_MARGIN} Td`];
    for (const [lineIndex, line] of pages[pageIndex].entries()) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      if (lineIndex < pages[pageIndex].length - 1) {
        contentLines.push("T*");
      }
    }
    contentLines.push("ET");

    const stream = contentLines.join("\n");
    objects.push(
      `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjectNumber} 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  objects.splice(
    1,
    0,
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers.map((value) => `${value} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj`
  );
  objects.push(
    `${fontObjectNumber} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`
  );

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

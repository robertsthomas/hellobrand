import { jsPDF } from "jspdf";

import type { InvoiceParty, InvoiceRecord } from "@/lib/types";

// ── Colors ──
const BLACK = "#0e1116";
const DARK = "#344054";
const GRAY = "#667085";
const LABEL = "#98a2b3";
const TABLE_HEADER_BG = "#f2f4f7";
const ROW_BORDER = "#e4e7ec";
const DASH_COLOR = "#d0d5dd";

// ── Helpers ──

function fmt(value: number | null | undefined, currency?: string | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2
  }).format(value ?? 0);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "Not set";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function split(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function dashedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(DASH_COLOR);
  doc.setLineWidth(0.3);
  const dashLen = 2;
  const gapLen = 2;
  let x = x1;
  while (x < x2) {
    const end = Math.min(x + dashLen, x2);
    doc.line(x, y, end, y);
    x = end + gapLen;
  }
}

function solidLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(ROW_BORDER);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
}

// ── Plain text (for email body) ──

function formatMoney(value: number | null | undefined) {
  return (value ?? 0).toFixed(2);
}

function pushSection(
  lines: string[],
  title: string,
  values: Array<string | null | undefined>
) {
  lines.push(title);
  for (const v of values) {
    if (v && v.trim().length > 0) lines.push(v.trim());
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
    `Invoice date: ${fmtDate(invoice.invoiceDate)}`,
    `Due date: ${fmtDate(invoice.dueDate)}`,
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

  pushSection(lines, "From", [
    invoice.issuer.companyName,
    invoice.issuer.name,
    invoice.issuer.email,
    invoice.issuer.address,
    invoice.issuer.taxId ? `Tax ID: ${invoice.issuer.taxId}` : null,
    invoice.issuer.payoutDetails ? `Remittance: ${invoice.issuer.payoutDetails}` : null
  ]);

  lines.push("Line items");
  for (const item of invoice.lineItems) {
    lines.push(`${item.title} | Qty ${item.quantity} | ${formatMoney(item.unitRate)} | ${formatMoney(item.amount)}`);
    if (item.channel) lines.push(`  Channel: ${item.channel}`);
    if (item.description) lines.push(`  ${item.description}`);
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

// ── Party block ──

function drawParty(
  doc: jsPDF,
  party: InvoiceParty,
  label: string,
  x: number,
  y: number,
  maxW: number,
  align: "left" | "right"
) {
  const tx = align === "right" ? x + maxW : x;

  // Label
  doc.setFontSize(9);
  doc.setTextColor(LABEL);
  doc.setFont("helvetica", "normal");
  doc.text(label, tx, y, { align });
  y += 6;

  // Name (bold, larger)
  doc.setFontSize(12);
  doc.setTextColor(BLACK);
  doc.setFont("helvetica", "bold");
  const name = party.companyName || party.name;
  if (name) {
    doc.text(name, tx, y, { align });
    y += 5.5;
  }

  // Details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(DARK);

  const details = [
    party.companyName && party.name ? party.name : null,
    party.address,
    party.taxId ? `ABN ${party.taxId}` : null,
    party.email
  ].filter(Boolean) as string[];

  for (const detail of details) {
    const lines = split(doc, detail, maxW);
    for (const line of lines) {
      doc.text(line, tx, y, { align });
      y += 4.8;
    }
  }

  return y;
}

// ── PDF renderer ──

// fallow-ignore-next-line complexity
export function renderInvoicePdf(input: {
  invoice: InvoiceRecord;
  workspaceLabel: string;
}) {
  const { invoice, workspaceLabel } = input;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 25; // generous margin
  const cw = pw - m * 2;
  let y = m + 5;

  // ── HEADER ──
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLACK);
  doc.text("Invoice", m, y + 10);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  doc.text(`#${invoice.invoiceNumber}`, m, y + 17);

  y += 25;

  // Dashed separator
  dashedLine(doc, m, y, pw - m);
  y += 8;

  // ── PROJECT + DATES ROW ──
  // Project label + value
  doc.setFontSize(9);
  doc.setTextColor(LABEL);
  doc.setFont("helvetica", "normal");
  doc.text("Project", m, y);

  doc.setFontSize(11);
  doc.setTextColor(BLACK);
  doc.setFont("helvetica", "bold");
  const labelLines = split(doc, workspaceLabel, cw * 0.55);
  doc.text(labelLines[0] ?? workspaceLabel, m, y + 5.5);

  // Dates
  const dateRightX = pw - m;
  const issuedX = dateRightX - 40;

  doc.setFontSize(9);
  doc.setTextColor(LABEL);
  doc.setFont("helvetica", "normal");
  doc.text("Issued Date", issuedX, y);
  doc.text("Due Date", dateRightX, y, { align: "right" });

  doc.setFontSize(11);
  doc.setTextColor(BLACK);
  doc.setFont("helvetica", "bold");
  doc.text(fmtDate(invoice.invoiceDate), issuedX, y + 5.5);
  doc.text(fmtDate(invoice.dueDate), dateRightX, y + 5.5, { align: "right" });

  y += 16;

  // ── FROM / TO ──
  const halfW = cw / 2 - 8;
  const fromEndY = drawParty(doc, invoice.issuer, "From", m, y, halfW, "left");
  const toEndY = drawParty(doc, invoice.billTo, "To", m + cw / 2 + 8, y, halfW, "right");
  y = Math.max(fromEndY, toEndY) + 8;

  // Dashed separator
  dashedLine(doc, m, y, pw - m);
  y += 12;

  // ── LINE ITEMS TABLE ──
  const colDesc = m + 4;
  const colUnits = m + cw * 0.55;
  const colPrice = m + cw * 0.70;
  const colAmt = pw - m - 4;
  const descMaxW = colUnits - colDesc - 8;
  const headerH = 9;

  // Table header with rounded background
  doc.setFillColor(TABLE_HEADER_BG);
  doc.roundedRect(m, y - 3, cw, headerH, 1.5, 1.5, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  doc.text("Description", colDesc, y + 2);
  doc.text("Units", colUnits, y + 2, { align: "center" });
  doc.text("Price", colPrice, y + 2, { align: "center" });
  doc.text("Amount", colAmt, y + 2, { align: "right" });
  y += headerH + 4;

  // Rows
  for (const item of invoice.lineItems) {
    if (y > ph - 55) {
      doc.addPage();
      y = m;
    }

    // Title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLACK);
    const titleLines = split(doc, item.title || "Untitled", descMaxW);
    doc.text(titleLines[0], colDesc, y);

    // Qty, price, amount
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK);
    doc.text(String(item.quantity), colUnits, y, { align: "center" });
    doc.text(fmt(item.unitRate, invoice.currency), colPrice, y, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLACK);
    doc.text(fmt(item.amount, invoice.currency), colAmt, y, { align: "right" });
    y += 4.5;

    // Channel / description
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(LABEL);
    if (item.channel) {
      doc.text(item.channel, colDesc, y);
      y += 3.5;
    }
    if (item.description) {
      const descLines = split(doc, item.description, descMaxW);
      for (const line of descLines.slice(0, 2)) {
        doc.text(line, colDesc, y);
        y += 3.5;
      }
    }
    for (let j = 1; j < titleLines.length; j++) {
      doc.text(titleLines[j], colDesc, y);
      y += 3.5;
    }

    y += 3;
    solidLine(doc, m, y, pw - m);
    y += 5;
  }

  // ── TOTAL ROW ──
  solidLine(doc, m, y - 2, pw - m);
  y += 3;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLACK);
  doc.text("Total Amount", colDesc, y);
  doc.setFontSize(13);
  doc.text(fmt(invoice.subtotal, invoice.currency), colAmt, y, { align: "right" });
  y += 12;

  // ── NOTES ──
  if (invoice.notes?.trim()) {
    if (y > ph - 45) {
      doc.addPage();
      y = m;
    }

    const noteLines = split(doc, invoice.notes, cw - 16);
    const boxH = Math.max(14, noteLines.length * 4.5 + 10);

    doc.setDrawColor(ROW_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(m, y, cw, boxH, 2, 2, "S");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK);
    doc.text("Note:", m + 5, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK);
    let ny = y + 6;
    for (const line of noteLines) {
      doc.text(line, m + 16, ny);
      ny += 4.5;
    }

    y += boxH + 10;
  }

  // ── PAYMENT METHOD ──
  if (invoice.issuer.payoutDetails?.trim()) {
    if (y > ph - 40) {
      doc.addPage();
      y = m;
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLACK);
    doc.text("Payment Method", m, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(DARK);
    const payoutLines = split(doc, invoice.issuer.payoutDetails, cw * 0.5);
    for (const line of payoutLines) {
      doc.text(line, m, y);
      y += 4.5;
    }
  }

  // ── FOOTER ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(LABEL);
    doc.text(
      `${invoice.invoiceNumber}  ·  Page ${i} of ${pageCount}  ·  Generated by HelloBrand`,
      pw / 2,
      ph - 10,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * This file centralizes React Email rendering helpers used by runtime senders.
 * Keeping this in one place avoids duplicating plain-text rendering options.
 */
import type { ReactElement } from "react";
import { render } from "react-email";

export function renderEmailHtml(react: ReactElement) {
  return render(react);
}

export function renderEmailText(react: ReactElement) {
  return render(react, { plainText: true });
}

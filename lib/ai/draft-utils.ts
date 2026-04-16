import type { AssistantTone } from "@/lib/types";

export function toneInstruction(tone: AssistantTone) {
  switch (tone) {
    case "friendly":
      return "Write in a friendly, approachable tone. Keep it warm but still practical and grounded.";
    case "direct":
      return "Write in a direct tone. Keep it concise, sharp, and easy to scan.";
    case "warm":
      return "Write in a warm, human tone. Keep it supportive without becoming vague.";
    case "professional":
    default:
      return "Write in a professional tone. Keep it polished, clear, and business-ready.";
  }
}

export function normalizeDraftText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\[Brand\/Agency Name\]/gi, "there")
    .replace(/\[Brand Name\]/gi, "there")
    .replace(/\[Agency Name\]/gi, "there")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

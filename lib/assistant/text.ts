export function replaceDashesWithCommas(value: string) {
  return value
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/[ \t]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .trim();
}

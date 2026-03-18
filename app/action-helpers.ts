export function parseNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function clampString(value: string, maximum: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maximum) {
    return trimmed;
  }

  return trimmed.slice(0, maximum).trim();
}

export function parseClampedNullableString(
  value: FormDataEntryValue | null,
  maximum: number
) {
  const parsed = parseNullableString(value);
  if (!parsed) {
    return null;
  }

  return clampString(parsed, maximum);
}

export function parseNullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNullableBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

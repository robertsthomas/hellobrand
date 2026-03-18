export function createClientRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dedupeRowsById<T extends { id: string }>(rows: T[]) {
  const seen = new Map<string, number>();

  return rows.map((row) => {
    const count = seen.get(row.id) ?? 0;
    seen.set(row.id, count + 1);

    if (count === 0) {
      return row;
    }

    return {
      ...row,
      id: `${row.id}-${count + 1}`
    };
  });
}

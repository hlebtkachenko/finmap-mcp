export function toTimestamp(dateStr: string): number {
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid date: "${dateStr}". Use YYYY-MM-DD format.`);
  return ms;
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

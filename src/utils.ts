import { z } from "zod";
import { FinmapError, type FinmapClient } from "./finmap-client.js";

const DAY_MS = 86_400_000;

export const READ = { readOnlyHint: true, openWorldHint: false } as const;
export const CREATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
export const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

export const externalIdParam = z
  .string()
  .optional()
  .describe("Your unique ID for this record. Recommended: pass the same value on a retry and Finmap rejects the duplicate (409) instead of creating it twice. Finmap generates one if omitted.");

export function created(what: string, externalId?: string): string {
  return `${what} created.${externalId ? ` externalId: ${externalId}` : ""}`;
}

/** Start of a YYYY-MM-DD day in UTC, as Unix ms. */
function toTimestamp(dateStr: string): number {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? Date.parse(`${dateStr}T00:00:00Z`) : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== dateStr) {
    throw new Error(`Invalid date: "${dateStr}". Use YYYY-MM-DD format.`);
  }
  return ms;
}

/** Last millisecond of a YYYY-MM-DD day in UTC. */
function toEndOfDay(dateStr: string): number {
  return toTimestamp(dateStr) + DAY_MS - 1;
}

/** Request body from tool params: drops empty values, converts `date` (YYYY-MM-DD) to a UTC timestamp. */
export function toBody(params: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    body[k] = k === "date" ? toTimestamp(v as string) : v;
  }
  return body;
}

/** Body for the list endpoints: whole-UTC-day window, sorted by date. */
export function listBody(params: Record<string, unknown> & { startDate?: string; endDate?: string }) {
  return toBody({
    ...params,
    field: "date",
    startDate: params.startDate && toTimestamp(params.startDate),
    endDate: params.endDate && toEndOfDay(params.endDate),
  });
}

/** Shared handler for the details endpoints (lookup by id or externalId). */
export async function detailResult(fm: FinmapClient, path: string, title: string, id?: string, externalId?: string) {
  try {
    if (!id && !externalId) return errorResult(new Error("Provide at least one of id or externalId."));
    const query: Record<string, string> = {};
    if (id) query.id = id;
    if (externalId) query.externalId = externalId;
    const result = asList(await fm.get(path, query), `${title} detail`);
    if (!result.list.length) return textResult(`${title} not found.`);
    return textResult(`# ${title} Detail\n${json(result.list[0])}`);
  } catch (err) {
    return errorResult(err);
  }
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Throws unless the API returned a JSON array, so an error payload never reads as an empty list. */
export function asArray<T>(value: unknown, what: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected Finmap response for ${what}: ${JSON.stringify(value)?.slice(0, 300)}`);
  return value as T[];
}

/** Same guard for { list, total } responses. */
export function asList<T>(value: unknown, what: string): { list: T[]; total: number } {
  const v = value as { list?: unknown; total?: number } | undefined;
  return { list: asArray<T>(v?.list, what), total: v?.total ?? 0 };
}

export function json(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

const PENDING = new Set(["Stored", "In the queue for processing"]);

/**
 * Turns Finmap's OperationInsertStatus (returned by operation/invoice create and delete) into a tool result.
 * "Error" and anything unrecognised are errors; Stored/queued are reported as pending.
 */
export function insertStatusResult(done: string, result: unknown, verify: string) {
  const status = (result as { status?: unknown } | undefined)?.status;
  if (status === "Processed now") return textResult(`${done}\n${json(result)}`);
  if (typeof status === "string" && PENDING.has(status)) {
    return textResult(`Accepted by Finmap but not processed yet (status: ${status}). Check later with ${verify}.\n${json(result)}`);
  }
  if (status === "Error") return errorResult(new Error(`Finmap returned status "Error".\n${json(result)}`));
  return errorResult(new Error(`Unexpected Finmap response, outcome unknown. Verify with ${verify} before retrying.\n${json(result)}`));
}

/** Error result for a write: adds the verify hint when the outcome is unknown and explains 409 duplicates. */
export function writeErrorResult(error: unknown, verify: string) {
  if (error instanceof FinmapError && error.status === 409) {
    return errorResult(new Error(`Finmap says this record already exists (same externalId, or same label for tags and projects), so an earlier call already succeeded; nothing was created. Look it up with ${verify}.\n${error.message}`));
  }
  if (error instanceof FinmapError && error.outcomeUnknown) {
    return errorResult(new Error(`${error.message} Verify with ${verify} before retrying.`));
  }
  return errorResult(error);
}

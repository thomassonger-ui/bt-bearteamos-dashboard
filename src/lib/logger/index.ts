import { v4 as uuidv4 } from "uuid"

export type LogContext = {
  requestId?: string
  route?: string
  batchId?: string
}

export function newRequestId(): string {
  return uuidv4()
}

export function logEvent(
  event: string,
  ctx: LogContext = {},
  data?: Record<string, unknown>
): void {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId ?? uuidv4(),
      route: ctx.route ?? "unknown",
      batchId: ctx.batchId,
      event,
      data,
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[log]", JSON.stringify(entry))
    }
  } catch {
    // Never crash on logging failure
  }
}

export function logError(
  event: string,
  ctx: LogContext = {},
  error: unknown
): void {
  logEvent(event, ctx, { error: error instanceof Error ? error.message : String(error) })
}

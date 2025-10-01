import type { SessionStopResult } from "../types.js";
import { sessionManager } from "../session/manager.js";

/**
 * Stop the current session
 */
export async function sessionStop(): Promise<SessionStopResult> {
  await sessionManager.stop();
  return { ok: true };
}

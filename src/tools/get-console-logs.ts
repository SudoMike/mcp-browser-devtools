import type { GetConsoleLogsParams, GetConsoleLogsResult } from "../types.js";
import { sessionManager } from "../session/manager.js";

/**
 * Get captured console messages from the current session
 */
export async function getConsoleLogs(
  params: GetConsoleLogsParams,
): Promise<GetConsoleLogsResult> {
  const session = sessionManager.getSession();

  // Get all messages
  let messages = session.consoleMessages;

  // Filter by level if specified
  if (params.level) {
    messages = messages.filter((msg) => msg.type === params.level);
  }

  // Filter by search text if specified
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    messages = messages.filter((msg) =>
      msg.text.toLowerCase().includes(searchLower),
    );
  }

  // Get total before applying limit
  const totalMessages = messages.length;

  // Apply limit if specified
  if (params.limit && params.limit > 0) {
    // Get the most recent messages up to the limit
    messages = messages.slice(-params.limit);
  }

  // Touch session to reset idle timer
  sessionManager.touchSession();

  return {
    messages,
    totalMessages,
  };
}

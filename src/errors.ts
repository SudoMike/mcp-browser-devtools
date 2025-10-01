// Error codes as defined in spec
export enum ErrorCode {
  ALREADY_STARTED = "ALREADY_STARTED",
  SESSION_START_IN_PROGRESS = "SESSION_START_IN_PROGRESS",
  NO_ACTIVE_SESSION = "NO_ACTIVE_SESSION",
  PLAYWRIGHT_LAUNCH_FAILED = "PLAYWRIGHT_LAUNCH_FAILED",
  HOOKS_START_FAILED = "HOOKS_START_FAILED",
  HOOKS_STOP_FAILED = "HOOKS_STOP_FAILED",
  NAVIGATION_TIMEOUT = "NAVIGATION_TIMEOUT",
  NAVIGATION_BLOCKED_BY_POLICY = "NAVIGATION_BLOCKED_BY_POLICY",
  ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND",
  CSS_DOMAIN_UNAVAILABLE = "CSS_DOMAIN_UNAVAILABLE",
  QUERY_TIMEOUT = "QUERY_TIMEOUT",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR",
}

export interface DevToolsError {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown,
): DevToolsError {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

export function isDevToolsError(value: unknown): value is DevToolsError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "object" &&
    (value as { error: unknown }).error !== null &&
    "code" in (value as { error: { code: unknown } }).error &&
    "message" in (value as { error: { message: unknown } }).error
  );
}

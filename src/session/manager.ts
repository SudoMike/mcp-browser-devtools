import { chromium } from "playwright";
import type { SessionState, ResolvedConfig } from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { IdleTimer } from "./idle-timer.js";

/**
 * Singleton session manager
 */
class SessionManager {
  private session: SessionState | null = null;
  private startInProgress = false;
  private idleTimer: IdleTimer | null = null;

  /**
   * Check if a session is currently active
   */
  hasSession(): boolean {
    return this.session !== null;
  }

  /**
   * Check if session start is in progress
   */
  isStarting(): boolean {
    return this.startInProgress;
  }

  /**
   * Get the current session (throws if not active)
   */
  getSession(): SessionState {
    if (!this.session) {
      throw createError(
        ErrorCode.NO_ACTIVE_SESSION,
        "No active session. Call devtools.session.start first.",
      );
    }
    return this.session;
  }

  /**
   * Mark that session start is beginning
   */
  markStartInProgress(): void {
    this.startInProgress = true;
  }

  /**
   * Clear the start in progress flag
   */
  clearStartInProgress(): void {
    this.startInProgress = false;
  }

  /**
   * Set the active session
   */
  setSession(session: SessionState): void {
    this.session = session;
    this.startInProgress = false;

    // Start idle timer
    this.idleTimer = new IdleTimer(session.config.policy.idleMs, async () => {
      await this.stop();
    });
    this.idleTimer.reset();
  }

  /**
   * Update last used timestamp and reset idle timer
   */
  touchSession(): void {
    if (this.session) {
      this.session.lastUsedAt = Date.now();
      this.idleTimer?.reset();
    }
  }

  /**
   * Stop the current session
   */
  async stop(): Promise<void> {
    if (!this.session) {
      return;
    }

    const session = this.session;
    this.session = null;
    this.startInProgress = false;

    // Cancel idle timer
    this.idleTimer?.cancel();
    this.idleTimer = null;

    // Close Playwright resources
    try {
      await session.cdpSession.detach();
    } catch {
      // Ignore detach errors
    }

    try {
      await session.page.close();
    } catch {
      // Ignore close errors
    }

    try {
      await session.context.close();
    } catch {
      // Ignore close errors
    }

    try {
      await session.browser.close();
    } catch {
      // Ignore close errors
    }

    // Call hook stop function if present
    if (session.hookStopFn) {
      try {
        await session.hookStopFn();
      } catch (err) {
        throw createError(
          ErrorCode.HOOKS_STOP_FAILED,
          "Hook stop function threw an error",
          { originalError: String(err) },
        );
      }
    }
  }

  /**
   * Create a new Playwright session
   */
  async createPlaywrightSession(
    config: ResolvedConfig,
    hookStopFn?: () => void | Promise<void>,
  ): Promise<SessionState> {
    try {
      // Launch browser
      const browser = await chromium.launch({
        headless: config.playwright.headless,
      });

      // Create context
      const contextOptions: Record<string, unknown> = {};
      if (config.playwright.baseURL) {
        contextOptions.baseURL = config.playwright.baseURL;
      }
      if (config.playwright.storageStatePath) {
        contextOptions.storageState = config.playwright.storageStatePath;
      }

      const context = await browser.newContext(contextOptions);

      // Create page
      const page = await context.newPage();

      // Create CDP session
      const cdpSession = await page.context().newCDPSession(page);

      // Enable DOM and CSS domains (DOM must be enabled first)
      await cdpSession.send("DOM.enable");
      await cdpSession.send("CSS.enable");

      return {
        browser,
        context,
        page,
        cdpSession,
        hookStopFn,
        config,
        lastUsedAt: Date.now(),
      };
    } catch (err) {
      throw createError(
        ErrorCode.PLAYWRIGHT_LAUNCH_FAILED,
        "Failed to launch Playwright",
        { originalError: String(err) },
      );
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

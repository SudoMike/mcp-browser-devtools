import type { Browser, BrowserContext, Page, CDPSession } from "playwright";

// ============================================================================
// Configuration Types
// ============================================================================

export interface Config {
  playwright?: PlaywrightConfig;
  hooks?: HooksConfig;
  policy?: PolicyConfig;
  timeouts?: TimeoutsConfig;
  console?: ConsoleConfig;
}

export interface PlaywrightConfig {
  baseURL?: string;
  headless?: boolean;
  storageStatePath?: string;
  traceOutputPath?: string;
}

export interface ConsoleConfig {
  enabled?: boolean;
  maxMessages?: number;
}

export interface HooksConfig {
  modulePath: string;
  envPath?: string;
  scenarios?: Record<string, ScenarioConfig>;
}

export interface ScenarioConfig {
  use: string; // Function name to call from hooks module
  description?: string; // Optional description to help LLM choose which scenario to use
  device?: string; // Optional Playwright device name (e.g., "iPhone 13", "Pixel 7")
}

export interface PolicyConfig {
  singleInstance?: boolean;
  idleMs?: number;
  allowedOrigins?: string[];
}

export interface TimeoutsConfig {
  navigationMs?: number;
  queryMs?: number;
}

// ============================================================================
// Hooks Module Types
// ============================================================================

export interface HooksModule {
  [key: string]: HookFunction;
}

export type HookFunction = (
  context: HookContext,
) => HookResult | Promise<HookResult>;

export interface HookContext {
  page: Page;
  baseURL?: string;
}

export interface HookResult {
  stop?: () => void | Promise<void>;
}

// ============================================================================
// Session Types
// ============================================================================

export interface ConsoleMessage {
  type: "log" | "warn" | "error" | "info" | "debug";
  text: string;
  timestamp: number;
  args?: string[];
}

export interface SessionState {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  cdpSession: CDPSession;
  hookStopFn?: () => void | Promise<void>;
  config: ResolvedConfig;
  lastUsedAt: number;
  consoleMessages: ConsoleMessage[];
}

export interface ResolvedConfig {
  playwright: {
    baseURL?: string;
    headless: boolean;
    storageStatePath?: string;
    traceOutputPath?: string;
  };
  policy: {
    singleInstance: boolean;
    idleMs: number;
    allowedOrigins?: string[];
  };
  timeouts: {
    navigationMs: number;
    queryMs: number;
  };
  console: {
    enabled: boolean;
    maxMessages: number;
  };
}

// ============================================================================
// Tool Parameter Types
// ============================================================================

export interface SessionStartParams {
  scenario?: string;
  interactive?: boolean;
  fullscreen?: boolean;
  url?: string;
}

export interface NavigateParams {
  url: string;
  wait?: "load" | "domcontentloaded" | "networkidle";
}

export interface ElementTarget {
  kind: "id" | "selector";
  value: string;
}

export interface GetElementParams {
  target: ElementTarget;
  include?: {
    boxModel?: boolean;
    attributes?: boolean;
    role?: boolean;
    computed?: string[]; // Array of CSS property names. Use "ALL_DEFAULTS" to include default properties.
  };
  maxResults?: number;
}

export interface GetCssProvenanceParams {
  target: ElementTarget;
  property: string;
  includeContributors?: boolean;
  maxResults?: number;
}

export interface PageInteractParams {
  actions: PageAction[];
}

export interface GetPageContentParams {
  start?: number;
  length?: number;
}

export interface ScreenshotParams {
  fullPage?: boolean;
  quality?: number;
  type?: "png" | "jpeg";
}

export interface EvaluateJavaScriptParams {
  code: string;
  timeout?: number;
}

export interface GetConsoleLogsParams {
  level?: "log" | "warn" | "error" | "info" | "debug";
  limit?: number;
  search?: string;
}

export type PageAction =
  | ClickAction
  | FillAction
  | TypeAction
  | PressAction
  | SelectAction
  | WaitAction
  | WaitForSelectorAction
  | WaitForNavigationAction;

export interface ClickAction {
  type: "click";
  selector: string;
  options?: {
    button?: "left" | "right" | "middle";
    clickCount?: number;
    delay?: number;
  };
}

export interface FillAction {
  type: "fill";
  selector: string;
  value: string;
}

export interface TypeAction {
  type: "type";
  selector: string;
  text: string;
  options?: {
    delay?: number;
  };
}

export interface PressAction {
  type: "press";
  selector: string;
  key: string;
  options?: {
    delay?: number;
  };
}

export interface SelectAction {
  type: "select";
  selector: string;
  values: string | string[];
}

export interface WaitAction {
  type: "wait";
  delay: number;
}

export interface WaitForSelectorAction {
  type: "waitForSelector";
  selector: string;
  options?: {
    state?: "attached" | "detached" | "visible" | "hidden";
    timeout?: number;
  };
}

export interface WaitForNavigationAction {
  type: "waitForNavigation";
  options?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    timeout?: number;
  };
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface SessionStartResult {
  ok: boolean;
}

export interface SessionStopResult {
  ok: boolean;
}

export interface NavigateResult {
  finalUrl: string;
}

export interface GetElementResult {
  matchCount: number;
  results: ElementInfo[];
}

export interface ElementInfo {
  exists: boolean;
  nodeName?: string;
  attributes?: Record<string, string>;
  role?: string;
  boxModel?: BoxModel;
  computed?: Record<string, string>;
}

export interface BoxModel {
  x: number;
  y: number;
  width: number;
  height: number;
  content: Quad;
  padding: Quad;
  border: Quad;
  margin: Quad;
}

export interface Quad {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GetCssProvenanceResult {
  matchCount: number;
  results: CssProvenanceInfo[];
}

export interface PageInteractResult {
  ok: boolean;
  failedAtIndex?: number;
  error?: string;
  action?: PageAction;
}

export interface GetPageContentResult {
  html: string;
  fullLength: number;
}

export interface ScreenshotResult {
  screenshotPath: string;
}

export interface EvaluateJavaScriptResult {
  result: unknown;
  ok: boolean;
}

export interface GetConsoleLogsResult {
  messages: ConsoleMessage[];
  totalMessages: number;
}

export interface CssProvenanceInfo {
  property: string;
  computedValue: string | null;
  winner?: CssDeclarationSource;
  contributors?: CssDeclarationSource[];
}

export interface CssDeclarationSource {
  source: "inline" | "stylesheet" | "attribute";
  selector?: string;
  stylesheetUrl?: string;
  line?: number;
  column?: number;
  important?: boolean;
  snippet?: string;
  value?: string;
}

// ============================================================================
// CDP Protocol Types (subset we need)
// ============================================================================

export interface CDPNode {
  nodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string;
  attributes?: string[];
}

export interface CDPDocument {
  nodeId: number;
}

export interface CDPComputedStyle {
  name: string;
  value: string;
}

export interface CDPMatchedRule {
  rule: CDPRule;
  matchingSelectors: number[];
}

export interface CDPRule {
  selectorList: CDPSelectorList;
  style: CDPStyle;
  origin: "user-agent" | "user" | "inspector" | "regular";
  styleSheetId?: string;
}

export interface CDPSelectorList {
  selectors: CDPSelector[];
  text: string;
}

export interface CDPSelector {
  text: string;
}

export interface CDPStyle {
  cssProperties: CDPProperty[];
  shorthandEntries: CDPShorthandEntry[];
  styleSheetId?: string;
  range?: CDPSourceRange;
}

export interface CDPProperty {
  name: string;
  value: string;
  important?: boolean;
  implicit?: boolean;
  text?: string;
  parsedOk?: boolean;
  disabled?: boolean;
  range?: CDPSourceRange;
}

export interface CDPShorthandEntry {
  name: string;
  value: string;
  important?: boolean;
}

export interface CDPSourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CDPStyleSheetHeader {
  styleSheetId: string;
  sourceURL: string;
  origin: string;
  title: string;
  disabled: boolean;
  isInline: boolean;
  isMutable: boolean;
  isConstructed: boolean;
  startLine: number;
  startColumn: number;
  length: number;
  endLine: number;
  endColumn: number;
}

export interface CDPMatchedStyles {
  inlineStyle?: CDPStyle;
  matchedCSSRules?: CDPMatchedRule[];
}

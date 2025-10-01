import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { config as loadEnv } from 'dotenv';
import type { Config, ResolvedConfig } from './types.js';

export interface LoadConfigOptions {
  configPath: string;
}

export interface LoadedConfig {
  raw: Config;
  resolved: ResolvedConfig;
  configDir: string;
  hooks?: {
    modulePath: string;
    scenarios?: Record<string, { use: string }>;
  };
  allowedOrigins?: string[];
}

/**
 * Load and validate configuration from file.
 * Relative paths in the config are resolved relative to the config file's directory.
 */
export async function loadConfig(options: LoadConfigOptions): Promise<LoadedConfig> {
  const configPath = resolve(options.configPath);
  const configDir = dirname(configPath);

  // Read and parse config file
  let raw: Config;
  try {
    const contents = readFileSync(configPath, 'utf-8');
    raw = JSON.parse(contents);
  } catch (err) {
    throw new Error(`Failed to load config from ${configPath}: ${err}`);
  }

  // Load .env file if specified
  if (raw.hooks?.envPath) {
    const envPath = resolve(configDir, raw.hooks.envPath);
    loadEnv({ path: envPath });
  }

  // Resolve config with defaults
  const resolved: ResolvedConfig = {
    playwright: {
      baseURL: raw.playwright?.baseURL,
      headless: raw.playwright?.headless ?? true,
      storageStatePath: raw.playwright?.storageStatePath
        ? resolve(configDir, raw.playwright.storageStatePath)
        : undefined,
    },
    policy: {
      singleInstance: raw.policy?.singleInstance ?? true,
      idleMs: raw.policy?.idleMs ?? 300_000,
      allowedOrigins: raw.policy?.allowedOrigins,
    },
    timeouts: {
      navigationMs: raw.timeouts?.navigationMs ?? 15_000,
      queryMs: raw.timeouts?.queryMs ?? 8_000,
    },
  };

  // Prepare hooks config
  let hooksConfig: LoadedConfig['hooks'];
  if (raw.hooks?.modulePath) {
    hooksConfig = {
      modulePath: resolve(configDir, raw.hooks.modulePath),
      scenarios: raw.hooks.scenarios,
    };
  }

  return {
    raw,
    resolved,
    configDir,
    hooks: hooksConfig,
    allowedOrigins: raw.policy?.allowedOrigins,
  };
}

/**
 * Validate that a URL is allowed by the policy
 */
export function isOriginAllowed(url: string, allowedOrigins?: string[]): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

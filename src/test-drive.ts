import { loadConfig, type LoadedConfig } from "./config.js";
import { sessionManager } from "./session/manager.js";
import { isDevToolsError } from "./errors.js";
import { sessionStart } from "./tools/session-start.js";

/**
 * Runs test-drive mode: loads config and starts an interactive browser session.
 * @param args - Command line arguments array
 * @param configPathIndex - Index of --config flag in args
 * @param testDriveIndex - Index of --test-drive flag in args
 */
export async function runTestDrive(
  args: string[],
  configPathIndex: number,
  testDriveIndex: number,
): Promise<void> {
  // Test-drive mode: load config and start session directly
  if (configPathIndex === -1 || !args[configPathIndex + 1]) {
    console.error("Error: --test-drive requires --config <config filename>");
    process.exit(1);
  }

  const configPath = args[configPathIndex + 1];
  const scenario = args[testDriveIndex + 1] || undefined; // Optional scenario name

  let loadedConfig: LoadedConfig;
  try {
    loadedConfig = await loadConfig({ configPath });
  } catch (err) {
    console.error(`Failed to load config: ${err}`);
    process.exit(1);
  }

  // Validate scenario if provided
  if (scenario && !loadedConfig.hooks?.scenarios?.[scenario]) {
    const availableScenarios = loadedConfig.hooks?.scenarios
      ? Object.keys(loadedConfig.hooks.scenarios)
      : [];
    console.error(`Error: Scenario '${scenario}' not found in configuration.`);
    if (availableScenarios.length > 0) {
      console.error(`Available scenarios: ${availableScenarios.join(", ")}`);
    } else {
      console.error("No scenarios defined in configuration.");
    }
    process.exit(1);
  }

  // Start session in interactive mode
  try {
    console.error(
      `Starting test-drive session${scenario ? ` with scenario '${scenario}'` : ""}...`,
    );
    await sessionStart(
      {
        ...(scenario && { scenario }),
        interactive: true,
      },
      loadedConfig,
    );
    console.error("Browser session started. Press Ctrl+C to stop.");
  } catch (err) {
    if (isDevToolsError(err)) {
      console.error(`Failed to start session: ${JSON.stringify(err, null, 2)}`);
    } else {
      console.error(`Failed to start session: ${String(err)}`);
    }
    process.exit(1);
  }

  // Keep process alive until interrupted
  async function shutdown() {
    await sessionManager.stop();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Don't start MCP server in test-drive mode
  // Process will exit when user presses Ctrl+C
}


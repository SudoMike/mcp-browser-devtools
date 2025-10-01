/**
 * Example hooks module
 *
 * This file demonstrates how to create hooks for different scenarios.
 * Hooks can perform setup tasks like starting servers, seeding databases,
 * and logging in users.
 */

/**
 * Default scenario - just starts without any special setup
 */
export async function startDefault({ page, baseURL }) {
  console.error("[hooks] Starting in default mode");

  // You could start your app server here
  // const server = await startMyAppServer();

  return {
    stop: async () => {
      console.error("[hooks] Stopping default mode");
      // await server.stop();
    },
  };
}

/**
 * Logged-in scenario - performs login after browser is ready
 */
export async function startLoggedIn({ page, baseURL }) {
  console.error("[hooks] Starting in logged-in mode");

  // Perform login
  if (baseURL) {
    console.error("[hooks] Performing login...");

    // Example login flow (customize for your app)
    await page.goto(baseURL + "/login");
    await page.fill('input[name="username"]', "testuser@example.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 5000 }).catch(() => {
      console.error(
        "[hooks] Login may have failed or taken longer than expected",
      );
    });

    console.error("[hooks] Login complete");
  }

  return {
    stop: async () => {
      console.error("[hooks] Stopping logged-in mode");
    },
  };
}

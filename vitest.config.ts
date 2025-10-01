import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000, // 30 seconds per test (browser operations can be slow)
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    fileParallelism: false, // Run test files sequentially
    pool: "forks", // Use separate processes for each test file
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork (sequential)
      },
    },
  },
});

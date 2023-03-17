export default {
  // Define the root directory where your tests are located
  root: './',

  // Specify the directory where test files are located (relative to the root)
  testDir: 'test',

  // Specify the file extensions to be treated as test files
  testMatch: ['**/*.test.{ts,tsx,js,jsx}'],

  // Configure the test environment (jsdom, node, or custom)
  env: 'jsdom',

  // Specify any plugins you want to use
  plugins: [],

  // Configure any additional options, such as coverage thresholds, reporters, etc.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}

const config = {
  root: './',
  testDir: 'test',
  testMatch: ['**/*.test.{ts,tsx,js,jsx}'],
  env: 'jsdom',
  plugins: [],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}

export default config

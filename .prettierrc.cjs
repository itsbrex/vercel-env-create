const baseConfig = require('@hideoo/prettier-config')

/**
 * @type {import('prettier').Config}
 */
const prettierConfig = {
  ...baseConfig,
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
}

module.exports = prettierConfig

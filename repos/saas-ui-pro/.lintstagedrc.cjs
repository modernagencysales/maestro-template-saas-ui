module.exports = {
  '*.{js,ts,tsx}': 'pnpm run eslint --config eslint.config.js',
  '*.{js,ts,tsx,css,md}': 'prettier --write',
  '*.{ts,tsx}': () => 'pnpm run typecheck',
}

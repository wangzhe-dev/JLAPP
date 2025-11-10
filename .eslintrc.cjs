/* ESLint 配置 */
module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: false },
    extraFileExtensions: ['.vue'],
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:promise/recommended',
    'standard-with-typescript'
  ],
  plugins: ['vue', '@typescript-eslint'],
  overrides: [
    { files: ['*.vue'], rules: { 'vue/multi-word-component-names': 'off' } },
  ],
  ignorePatterns: ['dist', 'unpackage', 'node_modules', '*.cjs'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/promise-function-async': 'off',
    'no-tabs': 'off',
    'no-console': 'off',
    'no-debugger': 'warn'
  }
}

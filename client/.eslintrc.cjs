module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // Ban inline style attributes — use Tailwind utility classes instead
    'no-restricted-syntax': [
      'error',
      {
        selector: 'JSXAttribute[name.name="style"]',
        message:
          'Inline styles are not allowed. Use Tailwind CSS utility classes instead.',
      },
    ],
  },
  overrides: [
    {
      // Enforce no hardcoded hex codes in component files
      files: ['**/*.jsx', '**/*.tsx'],
      plugins: ['no-hardcoded-hex'],
      rules: {
        'no-hardcoded-hex/no-hardcoded-hex': 'error',
      },
    },
    {
      // Relax rules for test files
      files: ['**/*.test.{js,jsx,ts,tsx}', '**/test/**'],
      env: { node: true },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/'],
};

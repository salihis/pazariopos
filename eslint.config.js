// eslint.config.js
// ─────────────────────────────────────────────────────────────
// ESLint 9 flat config, shared by every workspace package's `lint`
// script (each runs `eslint src --ext .ts[,.tsx]` from its own
// directory; ESLint resolves this file by walking up from the linted
// files, so one root config covers the whole monorepo — no per-package
// eslint.config.js needed).
//
// Kept deliberately close to each tool's own "recommended" rule set
// rather than hand-picking rules: the goal here is a working CI gate
// (previously `lint` failed on every package with "couldn't find an
// eslint.config.js file" — there was no config at all), not a strict
// style regime. Tighten rules incrementally as the team wants them.
// ─────────────────────────────────────────────────────────────

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/src-tauri/target/**',
      '**/*.config.{js,ts}',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Node-environment packages (Fastify server): no browser/React globals.
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Route handlers and Prisma payloads are frequently typed as `any`
      // at integration boundaries (raw request bodies, Prisma JSON
      // fields); the schemas/zod layer is the real type guard there.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Browser + React packages (packages/ui, apps/web, apps/desktop).
  {
    files: [
      'packages/ui/src/**/*.{ts,tsx}',
      'apps/web/src/**/*.{ts,tsx}',
      'apps/web/e2e/**/*.{ts,tsx}',
      'apps/desktop/src/**/*.{ts,tsx}',
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Platform-agnostic shared package (packages/core): runs in both
  // Node (server-side sync jobs) and browser (web/desktop) contexts.
  {
    files: ['packages/core/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Broad, low-risk defaults for all TS files. Placed BEFORE the
  // test-file block below on purpose: flat config applies matching
  // entries in array order, with later entries overriding earlier ones
  // for the same rule on overlapping files. If this came last, it would
  // silently re-enable 'no-explicit-any' for test files despite the
  // test-specific override turning it off.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Prisma-generated / third-party payloads legitimately need this
      // in a few narrow spots; keep it a warning, not a hard fail.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Test files everywhere: relax a couple of rules that fight against
  // common, deliberate test patterns (mock factories returning `any`-ish
  // shapes, intentionally-unused fixture args).
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts', '**/e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
)

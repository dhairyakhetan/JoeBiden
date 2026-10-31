import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Flat config (ESLint 9). The repo previously had NO eslint config at all, so
// `npm run lint` never ran. This restores a working lint that surfaces genuine
// bugs — chiefly React Hooks rule violations and stale-dependency closures —
// while muting stylistic rules that would just be noise on this codebase
// (unused vars are already enforced by tsc's noUnusedLocals; `any` is used
// pervasively and intentionally in places).
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts', 'public', '*.config.js', 'server.cjs', 'src/vite-env.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2021,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Genuine-bug rules kept as ERRORS (a violation here is almost always a real
      // defect): a hook called conditionally, or a value that can't work as written.
      'react-hooks/rules-of-hooks': 'error',
      'no-misleading-character-class': 'error',
      // Useful signal, but frequently intentional here — surfaced as warnings:
      'react-hooks/exhaustive-deps': 'warn',
      // React-Compiler-oriented experimental rules (react-hooks v7): they flag many
      // legitimate, working patterns used throughout this codebase (e.g. setLoading
      // at the start of a fetch effect, hydrating from a cache). Kept as warnings so
      // they inform without failing the build on non-bugs.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Noise on this codebase — off/warn:
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-empty': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
      'prefer-const': 'warn',
    },
  },
)

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      // shadcn/ui co-locates a component with its `cva` variants and prop
      // types. Splitting those into one-export files would fight the
      // component API for no runtime benefit.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: [
      'src/hooks/use-theme.tsx',
      'src/components/forms/form.tsx',
      'src/components/shared/badges.tsx',
      'src/components/shared/date-picker.tsx',
      'src/components/shared/task-form-fields.tsx',
      'src/components/shared/member-select.tsx',
      'src/components/layout/user-menu.tsx',
      'src/components/data-table/data-table.tsx',
      'src/features/organizations/workspace-context.tsx',
      'src/features/projects/project-header.tsx',
      'src/features/tasks/task-dialog-context.tsx',
    ],
    rules: {
      // Context modules intentionally export the provider next to its hook so
      // the pairing is obvious at the call site.
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
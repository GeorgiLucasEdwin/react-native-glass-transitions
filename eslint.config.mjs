import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  {
    ignores: ['lib/', '**/node_modules/', 'example/ios/', 'example/android/', 'example/.expo/', 'marketing/', 'media/', '.github/assets/'],
  },
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // metro.config.js is CommonJS (Metro loads it with require).
    files: ['example/metro.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Optional peers (expo-haptics, react-native-screens), loaded in try/catch so the library works without them.
    files: ['src/haptics.ts', 'src/lib/haptics.ts', 'src/lib/window.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);

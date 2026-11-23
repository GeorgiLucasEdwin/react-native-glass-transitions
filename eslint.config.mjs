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
    // expo-haptics is an optional peer, loaded lazily so the library works without it.
    files: ['src/haptics.ts', 'src/lib/haptics.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);

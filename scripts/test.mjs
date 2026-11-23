// Runs src/tests/*.test.ts with node:test and Node's built-in TypeScript stripping: no jest, no Skia,
// no native modules. Run with `node --experimental-strip-types --no-warnings scripts/test.mjs`.
import { registerHooks } from 'node:module';
import { readdirSync } from 'node:fs';

// The sources import without extensions (bundler style): try `.ts` when Node can't resolve one.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (e) {
      if (!specifier.startsWith('.')) throw e;
      return next(`${specifier}.ts`, context);
    }
  },
});

const dir = new URL('../src/tests/', import.meta.url);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.test.ts'))) await import(new URL(f, dir).href);

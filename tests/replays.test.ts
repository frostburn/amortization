import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildInfo } from '../scripts/build-info';
import { parseReplay, verifyReplay } from '../src/replay/core';

const directory = join(process.cwd(), 'tests/replays');
const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
it.skipIf(!files.length)('completes the curated player recordings under current rules', () => {
  const build = buildInfo(process.cwd());
  for (const file of files) {
    const bundle = parseReplay(readFileSync(join(directory, file), 'utf8'));
    const result = verifyReplay(bundle, build, true);
    expect(result.error, file).toBeNull();
    expect(result.result.status, file).toBe('won');
  }
});

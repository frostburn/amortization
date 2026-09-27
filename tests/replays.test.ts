import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildInfo } from '../scripts/build-info';
import { parseReplay, verifyReplay } from '../src/replay/core';

const directory = join(process.cwd(), 'tests/replays');
const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
it.each(files)('completes the player recording %s under current rules', (file) => {
  const build = buildInfo(process.cwd());
  const bundle = parseReplay(readFileSync(join(directory, file), 'utf8'));
  const result = verifyReplay(bundle, build, true);
  expect(result.error).toBeNull();
  expect(result.result.status).toBe('won');
});

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

it('finishes the depot return without the recorded corrective clicks after the first VAN order', () => {
  const bundle = parseReplay(
    readFileSync(join(directory, 'depot-squad-assault.replay.json'), 'utf8'),
  );
  const firstExtraction = bundle.commands.findIndex(
    ({ command }) => command.kind === 'interact' && command.target === 'extract',
  );
  expect(firstExtraction).toBeGreaterThan(0);
  bundle.commands = bundle.commands.slice(0, firstExtraction + 1);
  const result = verifyReplay(bundle, buildInfo(process.cwd()), true);
  expect(result.error).toBeNull();
  expect(result.result.status).toBe('won');
  expect(result.tick).toBeLessThan(bundle.ticks);
});

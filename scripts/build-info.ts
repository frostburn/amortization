import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function buildInfo(root: string) {
  const hash = createHash('sha256');
  for (const dir of ['src/sim', 'src/replay'])
    for (const file of readdirSync(join(root, dir))
      .filter((f) => f.endsWith('.ts'))
      .sort()) {
      hash.update(`${dir}/${file}\0`);
      hash.update(readFileSync(join(root, dir, file), 'utf8').replace(/\r\n/g, '\n'));
    }
  let revision = 'unversioned',
    dirty = true;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* Source archives still have a simulation fingerprint. */
  }
  return { revision, dirty, simulationHash: hash.digest('hex') };
}

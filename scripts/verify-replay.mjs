import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildInfo } from './build-info.ts';

const args = process.argv.slice(2);
const files = args.filter((arg) => !arg.startsWith('--'));
if (
  !files.length ||
  args.some((arg) => arg.startsWith('--') && !['--current', '--expect-win'].includes(arg))
) {
  console.error('Usage: npm run replay:verify -- [--current] [--expect-win] attempt.json ...');
  process.exitCode = 1;
} else {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { parseReplay, verifyReplay, MAX_FILE_SIZE } =
      await server.ssrLoadModule('/src/replay/core.ts');
    const build = buildInfo(root);
    for (const file of files) {
      try {
        if (statSync(file).size > MAX_FILE_SIZE) throw new Error('Replay is larger than 4 MiB.');
        const bundle = parseReplay(readFileSync(file, 'utf8'));
        const result = verifyReplay(bundle, build, args.includes('--current'));
        if (result.error) throw new Error(result.error);
        if (args.includes('--expect-win') && result.result.status !== 'won')
          throw new Error('Run did not win.');
        console.log(
          `${file}: ${args.includes('--current') ? 'CURRENT RULES' : 'VERIFIED'} · ${result.result.status} · tick ${result.tick} · ${result.result.alive} survivors`,
        );
      } catch (error) {
        console.error(`${file}: ${error.message}`);
        process.exitCode = 1;
      }
    }
  } finally {
    await server.close();
  }
}

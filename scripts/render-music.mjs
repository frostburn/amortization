// One-off authoring tool, deliberately outside build/CI. Uses a prepared Xenpaper
// checkout so the game's runtime never needs its compiler or instrument engine.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2])
  throw new Error('Usage: node scripts/render-music.mjs /path/to/xenpaper3 [calm|combat]');
const xenpaper = resolve(process.argv[2]);
const expectedRevision = '1d1d6850072114b12fd74765d7f9d1230630ff72';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: xenpaper,
  encoding: 'utf8',
}).trim();
if (revision !== expectedRevision)
  throw new Error(`Use Xenpaper ${expectedRevision}; found ${revision}`);
const tracks = { calm: 'negative-carry', combat: 'negative-carry-combat' };
const names = process.argv[3] ? [tracks[process.argv[3]]] : Object.values(tracks);
if (names.some((n) => !n)) throw new Error('Variant must be calm or combat');
const { beats, paddingSeconds } = JSON.parse(readFileSync(join(root, 'music/loop.json'), 'utf8'));
const sampleRate = 48_000,
  padding = Math.round(paddingSeconds * sampleRate);
const temporary = mkdtempSync(join(tmpdir(), 'amortization-music-'));
const server = await createServer({
  root: xenpaper,
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'music-render-entry',
      configureServer(server) {
        server.middlewares.use('/music-render', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><title>Amortization music render</title>');
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const page = await browser.newPage();
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/music-render`);
  for (const name of names) {
    console.log(`Rendering ${name} through Xenpaper…`);
    const source = readFileSync(join(root, 'music', `${name}.xenpaper.json`), 'utf8');
    const [download, metadata] = await Promise.all([
      page.waitForEvent('download', { timeout: 600_000 }),
      page.evaluate(
        async ({ source, name, sampleRate }) => {
          const { parseDawProject } = await import('/src/daw/project.ts');
          const { renderProjectToWavBlob } = await import('/src/daw/audio-engine.ts');
          const raw = JSON.parse(source);
          const marker = raw.instrumentLanes
            .flatMap((l) => l.clips)
            .find((c) => c.source.includes('# Loops from here'));
          if (!marker) throw new Error('Missing authored loop marker');
          const period = marker.start.n / marker.start.d;
          if (raw.globalTrack.tempoChanges.length !== 1)
            throw new Error('Expected a constant-tempo arrangement');
          const bpm = raw.globalTrack.tempoChanges[0].bpm;
          // The marked clip previews the opening again. Repeat the complete form
          // in one graph, then retain cycle two so effect tails cross the seam.
          for (const lane of raw.instrumentLanes) {
            const clips = lane.clips.filter((c) => c.start.n / c.start.d < period);
            lane.clips = [
              ...clips,
              ...clips.map((c) => ({
                ...c,
                id: `${c.id}-repeat`,
                start: { n: c.start.n + period * c.start.d, d: c.start.d },
              })),
            ];
          }
          const project = parseDawProject(JSON.stringify(raw));
          const blob = await renderProjectToWavBlob(project, 6, sampleRate);
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${name}.wav`;
          link.click();
          return {
            period,
            bpm,
            frames: Math.round(((period * 60) / bpm) * sampleRate),
            title: raw.title,
          };
        },
        { source, name, sampleRate },
      ),
    ]);
    if (metadata.period !== beats)
      throw new Error(`Loop metadata must match the authored ${metadata.period}-beat form`);
    const wav = join(temporary, `${name}.wav`);
    await download.saveAs(wav);
    execFileSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        wav,
        '-af',
        `atrim=start_sample=${metadata.frames}:end_sample=${metadata.frames * 2},aloop=loop=2:size=${metadata.frames},atrim=start_sample=${metadata.frames - padding}:end_sample=${metadata.frames * 2 + padding},asetpts=PTS-STARTPTS`,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '160k',
        '-metadata',
        `title=${metadata.title}`,
        '-metadata',
        'artist=Lumi Pakkanen',
        join(root, 'src/audio/tracks', `${name}.mp3`),
      ],
      { stdio: 'inherit' },
    );
    console.log(
      `${name}: ${metadata.period} beats at ${metadata.bpm} BPM; ${metadata.frames} frames at ${sampleRate} Hz`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
  rmSync(temporary, { recursive: true, force: true });
}

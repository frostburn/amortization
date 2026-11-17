// Authoring only. Reuse Xenpaper and SW Patch verbatim; ship their compact results.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { tracePatch } from './music/trace.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/compile-music.mjs /path/to/xenpaper3');
const xenpaper = resolve(process.argv[2]);
const revision = '1d1d6850072114b12fd74765d7f9d1230630ff72';
if (
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: xenpaper, encoding: 'utf8' }).trim() !==
  revision
)
  throw new Error(`Use Xenpaper ${revision}`);
const server = await createServer({
  root: xenpaper,
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { parseDawProject } = await server.ssrLoadModule('/src/daw/project.ts');
  const { createPlaybackPlan } = await server.ssrLoadModule('/src/daw/playback-plan.ts');
  const { createPatch } = await server.ssrLoadModule('/sw-patch/runtime.ts');
  const names = ['negative-carry', 'negative-carry-combat'];
  const recipes = [],
    recipeIds = new Map(),
    notes = new Map();
  const waves = [],
    waveIds = new Map();
  const patchSource = (name) =>
    readFileSync(join(xenpaper, 'src/patches', `${name}.swpatch`), 'utf8');
  const internRecipe = (recipe) => {
    for (const n of recipe.nodes)
      if (n.props.wave) {
        const key = JSON.stringify(n.props.wave);
        if (!waveIds.has(key)) {
          waveIds.set(key, waves.length);
          waves.push(n.props.wave);
        }
        n.props.wave = waveIds.get(key);
      }
    const key = JSON.stringify(recipe);
    if (!recipeIds.has(key)) {
      recipeIds.set(key, recipes.length);
      recipes.push(recipe);
    }
    return recipeIds.get(key);
  };
  let effect, beats;
  const bpms = [],
    sources = [];
  for (const [index, name] of names.entries()) {
    const sourceJSON = readFileSync(join(root, 'music', `${name}.xenpaper.json`), 'utf8');
    sources.push(createHash('sha256').update(sourceJSON).digest('hex'));
    const raw = JSON.parse(sourceJSON);
    const occurrences = new Map();
    const marker = raw.instrumentLanes
      .flatMap((l) => l.clips)
      .find((c) => c.source.includes('# Loops from here'));
    if (!marker) throw new Error('Missing authored loop marker');
    const period = marker.start.n / marker.start.d;
    if (beats !== undefined && period !== beats) throw new Error('Arrangement lengths differ');
    beats = period;
    for (const lane of raw.instrumentLanes)
      lane.clips = lane.clips.filter((c) => c.start.n / c.start.d < beats);
    if (raw.globalTrack.tempoChanges.length !== 1)
      throw new Error('Expected a constant authored tempo');
    const bpm = raw.globalTrack.tempoChanges[0].bpm;
    bpms.push(bpm);
    // A 60 BPM projection keeps glissando curve offsets/durations in beats.
    raw.globalTrack.tempoChanges[0].bpm = 60;
    const plan = createPlaybackPlan(parseDawProject(JSON.stringify(raw)));
    if (plan.effects.length !== 1 || plan.effects[0].configChanges.length)
      throw new Error('Expected one static effect bus');
    const fx = plan.effects[0];
    const trace = tracePatch();
    const delayTime = trace.context.createConstantSource();
    delayTime.offset.value = fx.config.delayTime;
    delayTime.start();
    const patch = createPatch(patchSource(fx.patchPreset), trace.context, {
      config: { ...fx.config, delayTime },
      nativeNoise: true,
    });
    patch.connect(trace.destination);
    const recipe = { ...trace.recipe(), input: patch.id };
    if (effect && JSON.stringify(effect) !== JSON.stringify(recipe))
      throw new Error('Effect buses differ');
    effect = recipe;
    if (fx.gain !== 1) throw new Error('Expected unity effect gain');
    for (const lane of plan.lanes)
      for (const note of lane.notes) {
        const trace = tracePatch();
        const source = lane.kind === 'drum' ? lane.drumkit : lane.instrument;
        if (source.type !== 'patch') throw new Error('Sampled instruments are not asset-light');
        const patch = createPatch(patchSource(source.patchPreset), trace.context, {
          config:
            lane.kind === 'drum' ? {} : { oscillatorType: source.oscillatorType, aperiodic: false },
          nativeNoise: true,
        });
        const velocity = note.velocity * lane.gain;
        const release =
          lane.kind === 'drum'
            ? patch[note.sample](trace.destination, 0, velocity)
            : patch.on(
                trace.destination,
                0,
                trace.pitch,
                velocity,
                ...['attack', 'decay', 'sustain', 'release'].map((k) => note.envelope[k]),
              );
        const tail = trace.release(release);
        const voice = internRecipe(trace.recipe(tail));
        const pitch = {
          initial: note.pitch.initialValue - 900,
          curves: note.pitch.curves.map((c) => ({
            offset: c.offset,
            duration: c.duration,
            values: c.values.map((v) => v - 900),
          })),
        };
        const event = {
          beat: note.startBeat,
          duration: note.endBeat - note.startBeat,
          voice,
          ...(lane.kind === 'instrument' ? { pitch } : {}),
          fx: Boolean(lane.effectBusId),
        };
        const identity = JSON.stringify(event);
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        const key = `${identity}:${occurrence}`;
        if (!notes.has(key)) notes.set(key, { ...event, mask: 0 });
        notes.get(key).mask |= 1 << index;
      }
  }
  const data = {
    revision,
    sources,
    beats,
    bpm: { calm: bpms[0], combat: bpms[1] },
    waves,
    recipes,
    effect,
    notes: [...notes.values()].sort((a, b) => a.beat - b.beat),
  };
  const json = JSON.stringify(data, (_key, v) =>
    typeof v === 'number' ? Math.round(v * 1e7) / 1e7 : v,
  );
  const destination = join(root, 'src/audio/score/negative-carry.json');
  if (process.argv.includes('--check')) {
    if (readFileSync(destination, 'utf8') !== json + '\n')
      throw new Error('Music data is stale; regenerate it');
  } else writeFileSync(destination, json + '\n');
  console.log(
    `${data.notes.length} notes, ${recipes.length} voice recipes, ${waves.length} waves; ${Buffer.byteLength(json)} bytes`,
  );
} finally {
  await server.close();
}

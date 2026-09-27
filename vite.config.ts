import { defineConfig } from 'vite';
import { buildInfo } from './scripts/build-info.ts';

export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [
    {
      name: 'playtest-build-identity',
      apply: 'serve',
      resolveId(id) {
        if (id === 'virtual:playtest-build') return '\0' + id;
      },
      load(id) {
        if (id === '\0virtual:playtest-build')
          return `export default ${JSON.stringify(buildInfo(process.cwd()))}`;
      },
      handleHotUpdate(context) {
        if (!/\/(src|scripts)\/.*\.(ts|mjs)$/.test(context.file)) return;
        const module = context.server.moduleGraph.getModuleById('\0virtual:playtest-build');
        if (module) context.server.moduleGraph.invalidateModule(module);
        // A run must never silently continue under a different simulation or command recorder.
        context.server.ws.send({ type: 'full-reload' });
        return [];
      },
    },
  ],
});

import { expect, test } from '@playwright/test';
import type { Scene, Hit } from '../../src/render/scene';
import type { World, Vec } from '../../src/sim/types';
import type { CharacterOutlines } from '../../src/render/outlines';
import type { Mesh, WebGLRenderer } from 'pixi.js';

declare global {
  interface Window {
    outlineTest: {
      scene: Scene;
      world: World;
      layer: CharacterOutlines;
      frame: () => void;
      focus: (p: Vec, scale: number) => void;
    };
  }
}

for (const touch of [false, true])
  test(`occluded characters: ${touch ? 'touch' : 'desktop'} contours, doors, camera and targeting`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: touch ? 2 : 1,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('PixiJS')))
        errors.push(m.text());
    });
    await page.route('**/outline-fixture', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Amortization / outlines</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
      }),
    );
    await page.goto('/outline-fixture');
    await expect(page).toHaveTitle('Amortization / outlines');
    await page.evaluate(async () => {
      const paths = [
        '/src/render/scene.ts',
        '/src/render/outlines.ts',
        '/src/ui/hud.ts',
        '/src/input/controls.ts',
        '/src/content/settlement.ts',
        '/src/sim/world.ts',
        '/src/sim/commands.ts',
      ];
      const [
        { Scene },
        { CharacterOutlines },
        { Hud },
        { bindControls },
        { settlement },
        { createWorld },
        { applyCommand },
      ] = await Promise.all(paths.map((p) => import(p)));
      const world = createWorld(settlement) as World;
      world.guards = world.guards.slice(0, 2);
      const place = (p: World['agents'][number] | World['guards'][number], x: number, y: number) =>
        Object.assign(p, { x, y, previous: { x, y }, path: [] });
      place(world.guards[0], 31, 18.5); // Completely hidden by the tall central hall.
      place(world.guards[1], 32, 27.5); // In front: no outline.
      place(world.agents[0], 35, 18.5);
      place(world.agents[1], 28, 30);
      place(world.agents[2], 27, 30);
      place(world.agents[3], 27, 29);
      let selected = ['agent-1'];
      const hud = new Hud(
        () => {},
        () => {},
        () => {},
      );
      hud.reset(settlement);
      const scene = new Scene(hud.stage, world) as Scene;
      await scene.init();
      scene.app.ticker.stop();
      const frame = () => {
        hud.update(world, { selected, paused: true, slow: false, sound: false, best: null });
        scene.render(selected, 1, 0);
        scene.app.render();
      };
      frame();
      scene.following = false;
      const focus = (point: Vec, scale: number) => {
        scene.zoomBy(scale / scene.camera.scale.x);
        const p = scene.screen(point);
        scene.panBy(scene.app.screen.width / 2 - p.x, scene.app.screen.height / 2 - p.y);
        frame();
      };
      const layer = scene.camera.children.find(
        (c) => c instanceof CharacterOutlines,
      )! as CharacterOutlines;
      bindControls(scene, hud, {
        world: () => world,
        selection: () => selected,
        select: (ids: string[]) => {
          selected = ids;
          frame();
        },
        action: () => {},
        slow: () => {},
        order: (hit: Hit) => {
          if (hit.kind === 'guard')
            applyCommand(world, { kind: 'attack', agents: selected, target: hit.id });
          frame();
        },
      });
      window.outlineTest = { scene, world, layer, frame, focus };
      focus({ x: 33, y: 22 }, 0.95);
    });
    await expect(page.locator('canvas')).toBeVisible();
    await page.locator('#stage').scrollIntoViewIfNeeded();
    const initial = await page.evaluate(() => {
      const { scene, world, layer } = window.outlineTest;
      const colors = layer.children.filter((c) => c.visible).map((c) => c.tint);
      const guard = scene.screen(world.guards[0], 0.5);
      const filters = new Set(
        layer.children.filter((c) => c.visible).flatMap((c) => c.getChildAt(0).filters ?? []),
      );
      return { colors, hit: scene.hit(guard.x, guard.y), filters: filters.size };
    });
    expect(initial.colors).toEqual(expect.arrayContaining([0xf57869, 0x8be8c4]));
    expect(initial.colors.filter((c) => c === 0xf57869)).toHaveLength(1);
    expect(initial.hit).toEqual({ kind: 'guard', id: 'guard-0' });
    expect(initial.filters).toBe(1);
    await page.screenshot({ path: testInfo.outputPath('through-the-hall.png') });
    const pixelProof = await page.evaluate(() => {
      const { scene, world, layer } = window.outlineTest;
      const p = scene.screen(world.guards[0]);
      const gl = (scene.app.renderer as WebGLRenderer).gl,
        resolution = scene.app.renderer.resolution;
      const x = Math.max(0, Math.floor((p.x - 20) * resolution)),
        y = Math.max(0, Math.floor(scene.app.canvas.height - (p.y + 5) * resolution));
      const read = () => {
        scene.app.render();
        const pixels = new Uint8Array(40 * 50 * resolution * resolution * 4);
        gl.readPixels(x, y, 40 * resolution, 50 * resolution, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      const readVisible = () => {
        const p = scene.screen(world.guards[1]);
        const pixels = new Uint8Array(40 * 50 * resolution * resolution * 4);
        gl.readPixels(
          Math.floor((p.x - 20) * resolution),
          Math.floor(scene.app.canvas.height - (p.y + 5) * resolution),
          40 * resolution,
          50 * resolution,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        return pixels;
      };
      const shown = read();
      const visibleShown = readVisible();
      layer.visible = false;
      const hidden = read();
      const visibleHidden = readVisible();
      layer.visible = true;
      let changed = 0,
        red = 0;
      for (let i = 0; i < shown.length; i += 4) {
        if (
          Math.abs(shown[i] - hidden[i]) +
            Math.abs(shown[i + 1] - hidden[i + 1]) +
            Math.abs(shown[i + 2] - hidden[i + 2]) >
          25
        )
          changed++;
        if (shown[i] > shown[i + 1] * 1.6 && shown[i] > 150) red++;
      }
      return {
        changed,
        red,
        visibleUnchanged: visibleShown.every((v, i) => v === visibleHidden[i]),
      };
    });
    expect(pixelProof.changed).toBeGreaterThan(25);
    expect(pixelProof.red).toBeGreaterThan(8);
    expect(pixelProof.visibleUnchanged).toBe(true);
    const target = await page.evaluate(() => {
      const { scene, world } = window.outlineTest;
      const p = scene.screen(world.guards[0], 0.5),
        r = scene.app.canvas.getBoundingClientRect();
      return { x: p.x + r.x, y: p.y + r.y };
    });
    if (touch) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y, { button: 'right' });
    expect(await page.evaluate(() => window.outlineTest.world.agents[1].order)).toEqual({
      kind: 'attack',
      target: 'guard-0',
    });
    // Opening a real shutter reveals the normal model; death and off-screen culling
    // must remove the silhouette, and paused pan/zoom must restore it without ticks.
    const states = await page.evaluate(() => {
      const { world, layer, frame, focus } = window.outlineTest;
      const g = world.guards[0];
      const visible = () => layer.children.filter((c) => c.visible && c.tint === 0xf57869).length;
      Object.assign(g, { x: 41.5, y: 16.5, previous: { x: 41.5, y: 16.5 } });
      world.guards[1].hp = 0;
      world.agents[0].hp = 0;
      focus(g, 1.8);
      const closed = visible();
      world.shutterOpen = true;
      frame();
      const open = visible();
      world.shutterOpen = false;
      frame();
      const reclosed = visible();
      g.hp = 0;
      frame();
      const dead = visible();
      g.hp = 100;
      focus({ x: 5, y: 39 }, 3);
      const away = visible();
      const zooms = [0.55, 0.95, 3].map((scale) => {
        focus(g, scale);
        return visible();
      });
      // The silhouette shares a posed mesh instead of tessellating its own copy.
      const outlined = layer.children.find((c) => c.visible)!.getChildAt(0) as Mesh;
      return {
        closed,
        open,
        reclosed,
        dead,
        away,
        zooms,
        vertices: outlined.geometry.getAttribute('aPosition').buffer.data.length,
      };
    });
    expect(states).toMatchObject({
      closed: 1,
      open: 0,
      reclosed: 1,
      dead: 0,
      away: 0,
      zooms: [1, 1, 1],
    });
    expect(states.vertices).toBeGreaterThan(100);
    await page.screenshot({ path: testInfo.outputPath('shutter-close-up.png') });
    const clipped = await page.evaluate(() => {
      const { scene, world, layer, frame, focus } = window.outlineTest;
      const gl = (scene.app.renderer as WebGLRenderer).gl;
      const resolution = scene.app.renderer.resolution;
      return [
        { x: 41.5, y: 16.5 },
        { x: 41, y: 15.7 },
      ].flatMap((position) =>
        [0.95, 1.8, 3].map((scale) => {
          Object.assign(world.guards[0], position, { previous: position });
          focus(world.guards[0], scale);
          const p = scene.screen(world.guards[0]);
          const x = Math.floor((p.x - 20 * scale - 4) * resolution);
          const y = Math.floor(scene.app.canvas.height - (p.y + 8 * scale + 4) * resolution);
          const width = Math.ceil((40 * scale + 8) * resolution);
          const height = Math.ceil((50 * scale + 8) * resolution);
          const read = () => {
            scene.app.render();
            const pixels = new Uint8Array(width * height * 4);
            gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
          };
          const shown = read();
          layer.visible = false;
          const closed = read();
          // The real shutter's rendered pixels provide an independent reference:
          // opening it changes covered pixels, but leaves the exposed head alone.
          world.shutterOpen = true;
          frame();
          layer.visible = false;
          const open = read();
          world.shutterOpen = false;
          frame();
          const view = layer.children.find((c) => c.visible)!;
          const mask = view.getChildAt(1);
          view.mask = null;
          mask.visible = false;
          const uncut = read();
          mask.visible = true;
          view.mask = mask;
          frame();
          let covered = 0,
            exposed = 0,
            inventedEdge = 0,
            uncutExposed = 0;
          const delta = (a: Uint8Array, b: Uint8Array, i: number) =>
            Math.max(...[0, 1, 2].map((c) => Math.abs(a[i + c] - b[i + c])));
          for (let i = 0; i < shown.length; i += 4) {
            const changed = delta(shown, closed, i) > 10;
            const uncovered = delta(open, closed, i) === 0;
            if (changed && !uncovered) covered++;
            if (changed && uncovered) exposed++;
            if (delta(uncut, closed, i) > 10 && uncovered) uncutExposed++;
            if (changed && delta(uncut, closed, i) === 0) inventedEdge++;
          }
          return {
            scale,
            toeOnly: position.y === 15.7,
            covered,
            exposed,
            inventedEdge,
            uncutExposed,
          };
        }),
      );
    });
    for (const state of clipped) {
      expect(state.covered, JSON.stringify(state)).toBeGreaterThan(10);
      expect(state.uncutExposed, JSON.stringify(state)).toBeGreaterThan(10);
      expect(state.exposed, JSON.stringify(state)).toBe(0);
      expect(state.inventedEdge, JSON.stringify(state)).toBe(0);
    }
    await page.screenshot({ path: testInfo.outputPath('only-hidden-toes.png') });
    const extra = await page.evaluate(() => {
      const { scene, world, layer, frame, focus } = window.outlineTest;
      const g = world.guards[0];
      // Locators preserve the player's scale, including multiple distant targets.
      const zooms = [0.55, 1.8, 3].map((scale) => {
        focus(g, scale);
        scene.showGuidance(['evidence', 'relay'], { x: 12, y: 12, w: 220, h: 150 });
        scene.focusGuidance();
        scene.showGuidance(['evidence'], { x: 12, y: 12, w: 220, h: 150 });
        scene.focusGuidance();
        return scene.camera.scale.x;
      });
      scene.showGuidance([], { x: 0, y: 0, w: 0, h: 0 });
      // A hidden sentry needs its gun silhouette, not a humanoid placeholder.
      Object.assign(g, { x: 31, y: 18.5, previous: { x: 31, y: 18.5 } });
      g.turret = { circuit: 'power-west', homeAngle: 0, lock: 0 };
      g.angle = Math.PI / 4;
      focus(g, 1.8);
      const turret = layer.children.find((c) => c.visible)!.getChildAt(0);
      const firstWidth = turret.getLocalBounds().width;
      g.angle = -Math.PI / 4;
      frame();
      const rotating = turret.getLocalBounds().width !== firstWidth;
      // Reset destroys old silhouettes without destroying shared pose geometry.
      // The same feature must remain legible over the night lighting layer.
      delete g.turret;
      world.mission = { ...world.mission, daylight: false };
      scene.reset(world);
      const cleared = layer.children.length;
      frame();
      focus(g, 1.8);
      const night = layer.children.filter((c) => c.visible).length;
      world.status = 'lost';
      scene.render([], 1, 0, true);
      scene.app.render();
      const aftermath = layer.visible;
      world.status = 'playing';
      scene.reset(world);
      frame();
      focus(g, 1.8);
      return { zooms, turretClass: turret.constructor.name, rotating, cleared, night, aftermath };
    });
    extra.zooms.forEach((scale, i) => expect(scale).toBeCloseTo([0.55, 1.8, 3][i], 10));
    expect(extra).toMatchObject({
      turretClass: 'Graphics',
      rotating: true,
      cleared: 0,
      night: 1,
      aftermath: false,
    });
    await page.screenshot({ path: testInfo.outputPath('night-restart.png') });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { handleSelectionRoutes, pickSelectionSpeaker } from './selection.ts';
import type { PetRouteDeps } from './types.ts';

/** 用临时用户层 + 仓库内置默认起一条路由依赖；不碰真实用户配置。 */
function makeDeps(
  overrides: { enabled?: boolean; answer?: (input: { prompt: string; text: string }) => Promise<unknown> } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-whalebook-selection-test-'));
  const userFile = join(dir, 'main-config.jsonc');
  writeFileSync(
    userFile,
    JSON.stringify({
      selectionShortcut: {
        enabled: overrides.enabled ?? true,
        accelerator: 'CommandOrControl+Shift+T',
        prompt: '翻译：{text}',
      },
    }),
  );
  const writes: Array<{ petId: string; leaf: string; data: unknown }> = [];
  const deps = {
    configPaths: {
      defaultFile: resolve(import.meta.dirname, '../../../assets/config.jsonc'),
      userFile,
      petDir: join(dir, 'pet'),
    },
    lock: { locked: () => false },
    state: {
      writePet: (petId: string, leaf: string, data: unknown) => writes.push({ petId, leaf, data }),
    },
    effectivePetList: () => [{ id: 'main', display: 'desktop' }],
    answerSelection: overrides.answer ?? (async () => ({ ok: true, text: '你好' })),
    log: { info: () => {}, warn: () => {} },
  } as unknown as PetRouteDeps;
  return { deps, writes, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('pickSelectionSpeaker —— 划词优先桌面', () => {
  test('desktop/both 优先于 web；被占用与 none 跳过', () => {
    assert.equal(
      pickSelectionSpeaker(
        [
          { id: 'web', display: 'web' },
          { id: 'desk', display: 'desktop' },
          { id: 'both', display: 'both' },
        ],
        () => false,
      ),
      'desk',
    );
    assert.equal(
      pickSelectionSpeaker([{ id: 'web', display: 'web' }], () => false),
      'web',
    );
    assert.equal(
      pickSelectionSpeaker([{ id: 'none', display: 'none' }], () => false),
      null,
    );
    assert.equal(
      pickSelectionSpeaker([{ id: 'locked', display: 'desktop' }], () => true),
      null,
    );
  });
});

describe('handleSelectionRoutes —— 全局划词入口', () => {
  test('成功：先写处理中，再写结果；prompt 交给 answerSelection', async () => {
    let seen: { prompt: string; text: string } | undefined;
    const { deps, writes, cleanup } = makeDeps({
      answer: async (input) => {
        seen = input;
        return { ok: true, text: '你好' };
      },
    });
    try {
      const res = await handleSelectionRoutes(deps, {
        url: new URL('http://local/selection'),
        rest: 'selection',
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
      });
      assert.equal(res?.kind === 'json' ? res.status : 0, 200);
      assert.deepEqual(seen, { prompt: '翻译：{text}', text: 'hello' });
      assert.equal(writes.length, 2);
      assert.equal(writes[1]?.petId, 'main');
      assert.deepEqual(writes[1]?.data, { text: '你好', duration: 30_000 });
    } finally {
      cleanup();
    }
  });

  test('未开启：拒绝且不写气泡', async () => {
    const { deps, writes, cleanup } = makeDeps({ enabled: false });
    try {
      const res = await handleSelectionRoutes(deps, {
        url: new URL('http://local/selection'),
        rest: 'selection',
        method: 'POST',
        body: JSON.stringify({ text: 'hello' }),
      });
      assert.equal(res?.kind === 'json' ? res.status : 0, 200);
      assert.equal(writes.length, 0);
    } finally {
      cleanup();
    }
  });

  test('空文字：拒绝且不写气泡', async () => {
    const { deps, writes, cleanup } = makeDeps();
    try {
      await handleSelectionRoutes(deps, {
        url: new URL('http://local/selection'),
        rest: 'selection',
        method: 'POST',
        body: JSON.stringify({ text: '   ' }),
      });
      assert.equal(writes.length, 0);
    } finally {
      cleanup();
    }
  });
});

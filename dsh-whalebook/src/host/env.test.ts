/**
 * 旧环境变量前缀兼容的单元测试：DSH_PET_* → DSH_WHALEBOOK_*，新名优先、幂等。
 *
 * 跑法：node --experimental-strip-types --test src/host/env.test.ts
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { adoptLegacyEnv } from './env.ts';

describe('adoptLegacyEnv —— 旧前缀映射', () => {
  test('旧名复制到新名；新名已存在时不覆盖', () => {
    const env: NodeJS.ProcessEnv = {
      DSH_PET_ELECTRON_PATH: '/old',
      DSH_WHALEBOOK_LOG_DEBUG: '0',
      DSH_OTHER: 'x',
    };
    adoptLegacyEnv(env);
    assert.equal(env.DSH_WHALEBOOK_ELECTRON_PATH, '/old');
    assert.equal(env.DSH_WHALEBOOK_LOG_DEBUG, '0');
    assert.equal(env.DSH_OTHER, 'x', '无关变量不动');
    assert.equal(env.DSH_WHALEBOOK_PET_ELECTRON_PATH, undefined, '只映射 DSH_PET_ 前缀');
  });

  test('幂等：重复调用不改变结果', () => {
    const env: NodeJS.ProcessEnv = { DSH_PET_LOG_DEBUG: '1' };
    adoptLegacyEnv(env);
    adoptLegacyEnv(env);
    assert.equal(env.DSH_WHALEBOOK_LOG_DEBUG, '1');
  });
});

/**
 * 主题判定的单元测试：DSH 暗色标记优先，其次跟随系统偏好。
 *
 * 跑法：node --experimental-strip-types --test src/shared/todo/theme.test.ts
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveTodoTheme } from './theme.ts';

describe('resolveTodoTheme —— 亮/暗色判定', () => {
  test('DSH 暗色标记优先', () => {
    assert.equal(resolveTodoTheme(true, false), 'dark');
    assert.equal(resolveTodoTheme(true, true), 'dark');
  });

  test('没有 DSH 标记时跟随系统', () => {
    assert.equal(resolveTodoTheme(false, true), 'dark');
    assert.equal(resolveTodoTheme(false, false), 'light');
  });
});

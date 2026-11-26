import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { bubbleTopMarginForContent } from './fonts.ts';

describe('bubbleTopMarginForContent —— 长气泡扩窗', () => {
  test('内容不超过基准两行时保持 base', () => {
    assert.equal(bubbleTopMarginForContent(100, 50, 300), 100);
  });

  test('内容更高时按实测高度增加上边距（扣掉探进宠物的那一段）', () => {
    // 300 × 0.108 = 32.4；400 - 32.4 + 2 = 369.6 → 370
    assert.equal(bubbleTopMarginForContent(100, 400, 300), 370);
  });

  test('基准值非法时按 0 处理，仍不会低于内容所需', () => {
    assert.equal(bubbleTopMarginForContent(Number.NaN, 400, 300), 370);
  });
});

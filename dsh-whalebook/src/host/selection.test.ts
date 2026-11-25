import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionUserText, clipSelectionReply } from './selection.ts';
import { SELECTION_REPLY_MAX } from '../shared/selection.ts';

describe('buildSelectionUserText —— 固定指令 + 选中文字', () => {
  test('没有占位符时把文字附在指令后面', () => {
    assert.equal(buildSelectionUserText('翻译：', 'hello'), '翻译：\n\nhello');
  });

  test('有 {text} 时在指定位置替换（可重复）', () => {
    assert.equal(buildSelectionUserText('翻译 {text}，再解释 {text}', 'hello'), '翻译 hello，再解释 hello');
  });

  test('指令两端空白会被去掉，文字原样保留', () => {
    assert.equal(buildSelectionUserText('  总结：  ', ' 原文 '), '总结：\n\n 原文 ');
  });
});

describe('clipSelectionReply —— 气泡长度', () => {
  test('不超长时原样返回（含 trim）', () => {
    assert.equal(clipSelectionReply('  译文  '), '译文');
  });

  test('超长按码点截断并补省略号', () => {
    const text = '鱼'.repeat(SELECTION_REPLY_MAX + 10);
    const clipped = clipSelectionReply(text);
    assert.equal(Array.from(clipped).length, SELECTION_REPLY_MAX + 1);
    assert.ok(clipped.endsWith('…'));
  });
});

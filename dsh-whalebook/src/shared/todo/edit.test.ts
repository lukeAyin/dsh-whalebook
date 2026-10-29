/**
 * 待办编辑校验的单元测试：空正文、超长、可选到期、非法日期。
 *
 * 跑法：node --experimental-strip-types --test src/shared/todo/edit.test.ts
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { parseEditDraft, TODO_TEXT_MAX } from './edit.ts';

describe('parseEditDraft —— 新增与行内编辑共用', () => {
  test('空正文 / 纯空白 → 拒绝', () => {
    assert.equal(parseEditDraft({ text: '', due: '' }).ok, false);
    assert.equal(parseEditDraft({ text: '   ', due: '' }).ok, false);
  });

  test('正文 trim；到期空串 = 无期限', () => {
    assert.deepEqual(parseEditDraft({ text: '  交周报  ', due: '' }), { ok: true, text: '交周报', dueAt: null });
  });

  test('合法 datetime-local → epoch 毫秒', () => {
    const result = parseEditDraft({ text: '交周报', due: '2026-10-29T18:30' });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.dueAt, new Date(2026, 9, 29, 18, 30).getTime());
  });

  test('非法日期 → 明确提示', () => {
    const result = parseEditDraft({ text: '交周报', due: '2026-02-30T09:00' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /时间/);
  });

  test('超长正文 → 拒绝（按码点计）', () => {
    assert.equal(parseEditDraft({ text: '一'.repeat(TODO_TEXT_MAX), due: '' }).ok, true);
    assert.equal(parseEditDraft({ text: '一'.repeat(TODO_TEXT_MAX + 1), due: '' }).ok, false);
  });
});

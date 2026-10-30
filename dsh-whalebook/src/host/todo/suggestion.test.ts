/**
 * 待办建议生成的单元测试：输出浓缩/限长、失败回退、无模型时安静返回 null。
 *
 * 跑法：node --experimental-strip-types --test src/host/todo/suggestion.test.ts
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSuggestionUserText,
  generateTodoSuggestion,
  normalizeSuggestion,
  TODO_SUGGESTION_MAX_CHARS,
} from './suggestion.ts';

function fakeCtx(raw: string | 'throw') {
  const options: Record<string, unknown>[] = [];
  const ctx = {
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
    llm: {
      resolveModelInfo: async () => ({}),
      stream: (o: Record<string, unknown>) => {
        options.push(o);
        return (async function* () {
          if (raw === 'throw') throw new Error('模型不可用');
          yield { type: 'text-delta', index: 0, text: raw };
        })();
      },
    },
  };
  return { ctx, options };
}

describe('normalizeSuggestion —— 一句、限长、可拒绝', () => {
  test('去掉列表/前缀/引号，只留正文', () => {
    assert.equal(normalizeSuggestion('建议：先列出三个要点。'), '先列出三个要点。');
    assert.equal(normalizeSuggestion('- "先写出开头第一句。"'), '先写出开头第一句。');
  });

  test('只取第一句', () => {
    assert.equal(normalizeSuggestion('先列要点。再写开头。'), '先列要点。');
  });

  test('超长按码点截到 30 字', () => {
    const out = normalizeSuggestion('一'.repeat(60));
    assert.equal(out !== null, true);
    assert.equal(Array.from(out ?? '').length, TODO_SUGGESTION_MAX_CHARS);
    assert.match(out ?? '', /…$/);
  });

  test('空内容/纯标点/“无” → null', () => {
    assert.equal(normalizeSuggestion(''), null);
    assert.equal(normalizeSuggestion('……'), null);
    assert.equal(normalizeSuggestion('无'), null);
  });
});

describe('generateTodoSuggestion —— 请求与回退', () => {
  test('返回浓缩后的建议，并带上调用身份/低温度', async () => {
    const { ctx, options } = fakeCtx('好的，建议：先列出三个要点。');
    const out = await generateTodoSuggestion({ ctx, text: '写周报' });
    assert.equal(out, '先列出三个要点。');
    assert.equal(options.length, 1);
    assert.equal(options[0]?.sessionId, 'dsh-whalebook');
    assert.equal(options[0]?.temperature, 0.4);
    assert.match(String(options[0]?.system), /不超过30个汉字/);
    assert.match(String(options[0]?.system), /大肥鱼/);
    assert.match(String(options[0]?.system), /工作时间/);
    assert.equal(buildSuggestionUserText('写周报'), '待办：写周报\n请给出今天就能开始的第一步。');
  });

  test('模型抛错/输出不可用 → null，不抛给调用方', async () => {
    const throwing = fakeCtx('throw');
    assert.equal(await generateTodoSuggestion({ ctx: throwing.ctx, text: '写周报' }), null);
    const unusable = fakeCtx('无');
    assert.equal(await generateTodoSuggestion({ ctx: unusable.ctx, text: '写周报' }), null);
  });

  test('没有可用模型 → null，不发请求', async () => {
    const ctx = { agentDefaultModel: { currentSelection: () => ({ provider: '', model: '' }) } };
    assert.equal(await generateTodoSuggestion({ ctx, text: '写周报' }), null);
  });
});

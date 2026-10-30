/**
 * 待办实施建议：在到期提醒之后，按概率调用一次 LLM，生成一句「今天就能开始的第一步」。
 *
 * 只负责请求、浓缩与长度约束；不决定概率、不写气泡、不读写待办（归 ../plugin/todo-reminders）。
 * 必须始终成立：输出最多 {@link TODO_SUGGESTION_MAX_CHARS} 个字符、只保留一句；
 * 任何失败/超时都返回 null，由调用方静默回退到普通提醒，绝不阻塞或污染提醒本身。
 * @module dsh-whalebook/src/host/todo/suggestion
 */
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { PET_CALL_IDENTITY, noTextReason } from '../llm-call.ts';
import { supportsReasoningOff } from '../llm-reasoning.ts';
import { defaultLog } from '../log-file.ts';
import { modelCandidates, modelLabel, type ModelRef } from '../model-selection.ts';

/** 建议长度上限（码点）：一句话，最多 30 个汉字/字符。 */
export const TODO_SUGGESTION_MAX_CHARS = 30;

/** 单次建议生成超时（ms）：提醒已经先发了，建议慢一点可以等，但不能无限等。 */
export const TODO_SUGGESTION_TIMEOUT_MS = 8_000;

/** 技能化提示词：把「一句话、≤30字、只给第一步」写死，避免模型自由发挥成长篇建议。 */
export const TODO_SUGGESTION_SYSTEM = [
  '你是待办助手，只输出一条可执行建议。',
  '要求：一句话；不超过30个汉字；只给今天就能开始的第一步；',
  '不要称呼、不要解释、不要追问、不要提AI、不要用列表/编号/引号，也不要重复待办原文。',
  '如果确实给不出可执行建议，只输出“无”。',
].join('\n');

/** 建议生成的最小上下文（与平台其他 LLM 调用同形，便于测试替身）。 */
export interface SuggestionContext {
  agentDefaultModel?: { currentSelection(): ModelRef };
  llm?: {
    stream(options: unknown): AsyncIterable<unknown>;
    resolveModelInfo?(provider: string, model: string, signal?: AbortSignal): Promise<unknown>;
  };
}

/** 生成建议的输入。 */
export interface GenerateSuggestionInput {
  ctx: SuggestionContext;
  /** 待办正文（最多 200 字，已由存储层约束）。 */
  text: string;
  /** 超时；测试可传更短的值。 */
  timeoutMs?: number;
}

/** 拼用户消息：只给待办正文与「第一步」要求，不塞完整人设/历史。 */
export function buildSuggestionUserText(text: string): string {
  return `待办：${text}\n请给出今天就能开始的第一步。`;
}

/**
 * 把模型输出浓缩成一句合规建议。
 *
 * 处理：去掉代码围栏/列表符号/“建议：”前缀/引号，只保留第一句，按码点截到 30 字；
 * 空内容、只有标点、“无”等拒绝词一律返回 null。
 *
 * @param raw - 模型原始输出。
 * @returns 合规建议；无法使用时 null。
 */
export function normalizeSuggestion(raw: string): string | null {
  let text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`+/g, '')
    .trim();
  // 只取第一行非空内容，避免模型先写“好的，以下是建议”。
  const line =
    text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find((part) => part !== '') ?? '';
  text = line
    .replace(/^\s*(好的|好|当然)[，,]\s*/u, '')
    .replace(/^\s*[-*•]\s*/u, '')
    .replace(/^\s*\d+[.、)]\s*/u, '')
    .replace(/^\s*(建议|建议是)\s*[:：]\s*/u, '')
    .replace(/^\s*["“'「『]+/u, '')
    .replace(/["”'」』]+\s*$/u, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // 只保留第一句：模型偶尔会写“先做 A。再做 B”，第二句直接丢掉。
  const firstSentence = text.match(/^.*?[。！？!?]/u)?.[0] ?? text;
  text = firstSentence.trim();
  if (text === '' || /^[\s，。；：、,.!?！？'"“”‘’—…-]+$/u.test(text)) return null;
  if (/^(无|没有|暂无|none)$/i.test(text)) return null;
  const chars = Array.from(text);
  if (chars.length > TODO_SUGGESTION_MAX_CHARS) {
    const cut = chars
      .slice(0, TODO_SUGGESTION_MAX_CHARS - 1)
      .join('')
      .replace(/[，。；：、,.;:\s]+$/u, '');
    text = cut + '…';
  }
  return text;
}

/**
 * 生成一句待办建议；失败/超时/无模型时返回 null（调用方静默跳过）。
 *
 * @param input - 模型上下文、待办正文与超时。
 * @returns 合规建议或 null。
 */
export async function generateTodoSuggestion(input: GenerateSuggestionInput): Promise<string | null> {
  const { ctx, text } = input;
  const candidates = modelCandidates(ctx);
  if (candidates.length === 0) return null;
  const llm = ctx.llm;
  if (!llm || typeof llm.stream !== 'function') return null;
  const timeoutMs = input.timeoutMs ?? TODO_SUGGESTION_TIMEOUT_MS;
  for (const [index, sel] of candidates.entries()) {
    const result = await generateOnce(ctx, llm, sel, text, timeoutMs);
    if (result !== null) return result;
    if (index + 1 < candidates.length) {
      defaultLog(
        'warn',
        `dsh-whalebook: 待办建议用 ${modelLabel(sel)} 生成失败，回落到 ${modelLabel(candidates[index + 1])}`,
      );
    }
  }
  return null;
}

/** 用一个确定的模型跑一次建议生成；任何失败都返回 null。 */
async function generateOnce(
  ctx: SuggestionContext,
  llm: NonNullable<SuggestionContext['llm']>,
  sel: ModelRef,
  text: string,
  timeoutMs: number,
): Promise<string | null> {
  const supportsOff = await supportsReasoningOff(ctx, sel.provider, sel.model);
  const options = {
    provider: sel.provider,
    model: sel.model,
    sessionId: PET_CALL_IDENTITY,
    messages: [
      createUserMessage({
        content: [{ type: 'text', text: buildSuggestionUserText(text) }],
        source: { kind: 'user' },
      }),
    ],
    system: TODO_SUGGESTION_SYSTEM,
    // 低温度：建议要稳定、短、少发散；不传 maxTokens（推理模型会把思考计入预算，显式小上限会截断正文）
    temperature: 0.4,
    ...(supportsOff ? { reasoningEffort: ReasoningEffortId('off') } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  };
  const assembler = new BlockAssembler();
  try {
    for await (const chunk of llm.stream(options)) {
      assembler.push(chunk as Parameters<BlockAssembler['push']>[0]);
    }
  } catch (error) {
    defaultLog(
      'warn',
      `dsh-whalebook: 待办建议生成失败（${modelLabel(sel)}）：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
  const raw = assembler
    .blocks()
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? (block as { text: string }).text : ''))
    .join('')
    .trim();
  if (raw === '') {
    defaultLog('warn', `dsh-whalebook: 待办建议没有正文（${modelLabel(sel)}）：${noTextReason(assembler.finish)}`);
    return null;
  }
  const normalized = normalizeSuggestion(raw);
  if (normalized === null) {
    defaultLog('warn', `dsh-whalebook: 待办建议输出不可用（${modelLabel(sel)}），已忽略`);
  }
  return normalized;
}

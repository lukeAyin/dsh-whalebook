/**
 * 全局划词的处理核心：把固定指令与选中文字拼成一次模型请求，并给出可直接进气泡的结果。
 *
 * 只负责提示词组装、模型调用与结果截断；取词权限在桌面 Helper，气泡与宠物选择在路由层。
 * 不读写记忆、不写配置：划词是一次性处理，不污染对话历史。
 * @module dsh-whalebook/src/host/selection
 */
import { generateChat } from './chat.ts';
import { SELECTION_REPLY_MAX } from '../shared/selection.ts';

/** 划词用的 system：严格按用户指令处理文本，别把结果写成解释文。 */
export const SELECTION_SYSTEM =
  '你是桌宠的划词助手。严格按用户给出的指令处理选中的文本；直接输出结果本身，不要解释过程、不要客套、不要提 AI。';

/** 划词失败：模型未配置或调用失败；只回分类文案，不把选中文字带进日志。 */
export type SelectionAnswer =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'provider-missing' | 'generate-error'; readonly message?: string };

/**
 * 拼出这次请求的 user 正文。
 *
 * @param prompt - 用户配置的固定指令；可含 `{text}` 占位。
 * @param text - 选中的文字。
 * @returns 指令与文字的组合；没有占位时把文字追加在指令后。
 */
export function buildSelectionUserText(prompt: string, text: string): string {
  const instruction = prompt.trim();
  if (instruction.includes('{text}')) return instruction.split('{text}').join(text);
  return `${instruction}\n\n${text}`;
}

/** 气泡放不下整篇译文：超长按码点截断并补省略号。 */
export function clipSelectionReply(text: string): string {
  const chars = Array.from(text.trim());
  return chars.length <= SELECTION_REPLY_MAX ? chars.join('') : chars.slice(0, SELECTION_REPLY_MAX).join('') + '…';
}

/**
 * 造一个划词回答函数。
 *
 * @param ctx - 宿主上下文（含 agentDefaultModel / llm）。
 * @returns 按指令处理选中文字的函数；失败返回结构化原因。
 */
export function createSelectionAnswer(
  ctx: Parameters<typeof generateChat>[0]['ctx'],
): (input: { readonly prompt: string; readonly text: string }) => Promise<SelectionAnswer> {
  return async ({ prompt, text }) => {
    const result = await generateChat({
      ctx,
      system: SELECTION_SYSTEM,
      history: [],
      userText: buildSelectionUserText(prompt, text),
    });
    if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
    const clipped = clipSelectionReply(result.text);
    if (clipped === '') return { ok: false, reason: 'generate-error', message: '模型没有返回内容' };
    return { ok: true, text: clipped };
  };
}

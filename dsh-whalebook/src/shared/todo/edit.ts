/**
 * 待办编辑输入的纯校验：正文与 `datetime-local` 值 → 可提交的字段。
 *
 * 新增与行内编辑共用同一套规则，避免两条入口对长度/空值/时间的判断漂移。
 * 不碰 DOM、不发请求；时间解析复用 ./format 的 `parseDateTimeLocal`。
 * @module dsh-whalebook/src/shared/todo/edit
 */
import { parseDateTimeLocal } from './format.ts';

/** 正文上限（码点数）：与宿主 `TODO_TEXT_MAX` 保持一致。 */
export const TODO_TEXT_MAX = 200;

/** 编辑框里的原始值：正文与 `datetime-local` 字符串（空串 = 不设到期）。 */
export interface EditDraft {
  text: string;
  due: string;
}

/** 校验结论：成功给出可直接提交的字段，失败给一句能展示的说明。 */
export type EditParse = { ok: true; text: string; dueAt: number | null } | { ok: false; message: string };

/**
 * 校验一次编辑/新增输入。
 *
 * @param draft - 输入框原值。
 * @returns 已 trim 的正文与到期时刻；非法时返回原因。
 */
export function parseEditDraft(draft: EditDraft): EditParse {
  const text = draft.text.trim();
  if (text === '') return { ok: false, message: '正文不能为空' };
  if (Array.from(text).length > TODO_TEXT_MAX) return { ok: false, message: `正文最多 ${TODO_TEXT_MAX} 个字` };
  const dueText = draft.due.trim();
  if (dueText === '') return { ok: true, text, dueAt: null };
  const dueAt = parseDateTimeLocal(dueText);
  if (dueAt === null) return { ok: false, message: '这个时间看不懂，重新选一个吧' };
  return { ok: true, text, dueAt };
}

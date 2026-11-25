/**
 * 全局划词动作：桌面 Helper 取到选中文字后 POST 到这里，宿主按配置的 prompt 调模型并写进桌宠气泡。
 *
 * 只解析请求与选宠物；提示词与模型调用在 ../selection，配置读取在 ../config，气泡写入在 state。
 * 仅桌面模式使用；取词与权限在 Helper，本模块不接触剪贴板。
 * @module dsh-whalebook/src/host/routes/selection
 */
import { SELECTION_TEXT_MAX, DEFAULT_SELECTION_SHORTCUT } from '../../shared/selection.ts';
import { readAllConfig } from '../config.ts';
import type { SelectionShortcutConfig } from '../../shared/selection.ts';
import type { RouteResult } from '../http.ts';
import { failResult, invalidJson, methodNotAllowed, okResult, payloadTooLarge } from './result.ts';
import type { PetRouteDeps, RouteInput } from './types.ts';

/** 请求体上限：4000 字正文 + JSON 外壳的余量；超过按 413 拒绝。 */
const BODY_LIMIT_BYTES = 64 * 1024;
/** 处理中提示的停留时长：请求失败时也会被错误文案覆盖。 */
const WORKING_MS = 60_000;
/** 结果/失败气泡的停留时长。 */
const REPLY_MS = 30_000;

/** 从配置里取划词配置；缺失或类型不对时回退内置默认（宿主合并器通常已填满）。 */
function selectionConfig(deps: PetRouteDeps): SelectionShortcutConfig {
  const main = readAllConfig(deps.configPaths).main as Record<string, unknown> | undefined;
  const raw = main?.selectionShortcut;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SELECTION_SHORTCUT };
  const sc = raw as Record<string, unknown>;
  return {
    enabled: sc.enabled === true,
    accelerator: typeof sc.accelerator === 'string' ? sc.accelerator : DEFAULT_SELECTION_SHORTCUT.accelerator,
    prompt: typeof sc.prompt === 'string' ? sc.prompt : DEFAULT_SELECTION_SHORTCUT.prompt,
  };
}

/**
 * 挑一只承担划词气泡的宠物：优先桌面可见（desktop/both），没有再用 web。
 *
 * 与待办提醒的「优先网页端」相反：划词由桌面快捷键发起，结果应回到桌面那只。
 *
 * @param pets - 成品配置拍平后的宠物列表。
 * @param isLocked - 该宠物是否正被占用。
 * @returns 宠物 id；没有可用的返回 null。
 */
export function pickSelectionSpeaker(
  pets: readonly Record<string, unknown>[],
  isLocked: (petId: string) => boolean,
): string | null {
  let webOnly: string | null = null;
  for (const pet of pets) {
    const petId = String(pet.id ?? '');
    if (petId === '') continue;
    if (pet.display === 'none') continue;
    if (isLocked(petId)) continue;
    if (pet.display === 'desktop' || pet.display === 'both') return petId;
    if (pet.display === 'web') webOnly ??= petId;
  }
  return webOnly;
}

/** 全局划词领域：未命中返回 undefined，命中返回应答。 */
export async function handleSelectionRoutes(deps: PetRouteDeps, input: RouteInput): Promise<RouteResult | undefined> {
  const { body, method, rest } = input;
  if (rest !== 'selection') return undefined;
  if (method !== 'POST') return methodNotAllowed();
  if (Buffer.byteLength(body ?? '', 'utf8') > BODY_LIMIT_BYTES) return payloadTooLarge();

  let parsed: Record<string, unknown>;
  try {
    parsed = (JSON.parse(body ?? 'null') as Record<string, unknown> | null) ?? {};
  } catch {
    return invalidJson();
  }
  const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  if (text === '') return failResult('bad-request', '选中文字为空');
  if (Array.from(text).length > SELECTION_TEXT_MAX) {
    return failResult('bad-request', `选中文字过长（限 ${SELECTION_TEXT_MAX} 字）`);
  }

  const config = selectionConfig(deps);
  if (!config.enabled) return failResult('disabled', '全局划词未开启');
  const speaker = pickSelectionSpeaker(deps.effectivePetList(), (petId) => deps.lock.locked(petId));
  if (speaker === null) return failResult('no-pet', '没有可用的桌宠');
  if (typeof deps.answerSelection !== 'function') return failResult('generate-error', '划词服务不可用');

  deps.state.writePet(speaker, 'say', { text: '收到，我看一下这段文字…', duration: WORKING_MS });
  try {
    const answer = await deps.answerSelection({ prompt: config.prompt, text });
    if (!answer.ok) {
      deps.state.writePet(speaker, 'say', { text: '这段文字我没能处理成功，再试一次吧', duration: REPLY_MS / 2 });
      return failResult(answer.reason, answer.message ?? '划词生成失败');
    }
    deps.state.writePet(speaker, 'say', { text: answer.text, duration: REPLY_MS });
    // 只记长度与宠物：选中文字是用户内容，不进日志。
    deps.log.info(`[dsh-whalebook] 划词完成 chars=${Array.from(text).length} pet=${speaker}`);
    return okResult({ ok: true, text: answer.text });
  } catch (error) {
    deps.state.writePet(speaker, 'say', { text: '这段文字我没能处理成功，再试一次吧', duration: REPLY_MS / 2 });
    deps.log.warn(`[dsh-whalebook] 划词失败：${error instanceof Error ? error.message : String(error)}`);
    return failResult('generate-error', '划词生成失败');
  }
}

/**
 * 全局划词快捷键的共享契约：配置形状、长度上限与默认值。
 *
 * 只描述「按一次快捷键，把选中文字交给宿主」这一条路；不包含宿主的取词/权限实现，
 * 也不决定模型怎么回答。MVP 只有一组快捷键，后续扩多组时从这里升级为数组。
 * @module dsh-whalebook/src/shared/selection
 */

/** main 级单组全局划词配置。 */
export interface SelectionShortcutConfig {
  /** 是否注册全局快捷键；默认 false，避免无故申请 macOS 辅助功能权限。 */
  enabled: boolean;
  /** Electron accelerator，例如 `CommandOrControl+Shift+T`；跨平台写法。 */
  accelerator: string;
  /** 发给模型的指令；不含选中文字，宿主会把文字附在后面（也可写 `{text}` 占位）。 */
  prompt: string;
}

/** 内置默认：关闭、⌘/Ctrl+Shift+T、划词翻译。 */
export const DEFAULT_SELECTION_SHORTCUT: SelectionShortcutConfig = {
  enabled: false,
  accelerator: 'CommandOrControl+Shift+T',
  prompt: '请把下面选中的内容翻译成中文，只输出译文：',
};

/** accelerator 的最大长度（字符）：只防手滑粘贴整段，不做 Electron 语法预校验。 */
export const SELECTION_ACCELERATOR_MAX = 80;
/** prompt 的最大长度（字符）：够写清任务即可，避免把整篇文档塞进配置。 */
export const SELECTION_PROMPT_MAX = 1000;
/** 单次划词正文上限（字符）：与宿主路由的入参校验同值。 */
export const SELECTION_TEXT_MAX = 4000;
/** 模型回复写进气泡前的截断长度（字符）：气泡不是阅读器。 */
export const SELECTION_REPLY_MAX = 800;

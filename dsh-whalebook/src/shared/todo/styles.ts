/**
 * 待办面板的样式：配色全部走 DSH 的 `--dsw-alias-*` 主题 token（见 ./theme 解析后的 `--wb-*`），
 * 亮色/暗色自动跟随；根节点同时用内联 important 兜底，避免被宿主全局样式覆盖。
 *
 * 只有静态字符串与注入状态，不建 DOM、不读配置；根节点颜色由 applyTodoTheme 写入变量与内联样式。
 * @module dsh-whalebook/src/shared/todo/styles
 */

/** 面板样式：头部 + 添加行 + 可滚动的清单 + 底部提示。 */
export const TODO_CSS = [
  '.dsh-whalebook-todo{position:fixed;z-index:2147483003;width:308px;max-width:calc(100vw - 24px);',
  'max-height:min(70vh,520px);display:flex;flex-direction:column;',
  'background:var(--wb-bg,#fff)!important;border:1px solid var(--wb-border,rgba(0,0,0,.12));',
  'border-radius:var(--dsw-radius-panel,12px);box-shadow:var(--dsw-elevation-prominent,0 12px 36px rgba(0,0,0,.24));',
  'color:var(--wb-label,#1f2329)!important;font-size:13px;line-height:1.5;user-select:none;overflow:hidden;',
  'color-scheme:light;',
  "font-family:var(--dsh-whalebook-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','幼圆','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);",
  '}',
  '.dsh-whalebook-todo[data-theme="dark"]{color-scheme:dark}',
  '.dsh-whalebook-todo *{box-sizing:border-box}',
  '.dsh-whalebook-todo-head{display:flex;align-items:center;gap:8px;padding:10px 12px 8px}',
  '.dsh-whalebook-todo-title{flex:1;font-size:14px;font-weight:600;color:var(--wb-label,#1f2329)}',
  '.dsh-whalebook-todo-count{color:var(--wb-muted,#5c6370);font-size:12px}',
  '.dsh-whalebook-todo-close{border:none;background:transparent;color:var(--wb-muted,#5c6370);font-size:13px;line-height:1;',
  'padding:4px 5px;border-radius:6px;cursor:pointer}',
  '.dsh-whalebook-todo-close:hover{background:var(--wb-hover,rgba(0,0,0,.05));color:var(--wb-label,#1f2329)}',
  '.dsh-whalebook-todo-form{display:flex;flex-direction:column;gap:6px;padding:0 12px 10px;',
  'border-bottom:1px solid var(--wb-border,rgba(0,0,0,.12))}',
  '.dsh-whalebook-todo-input,.dsh-whalebook-todo-due,.dsh-whalebook-todo-edit-text,.dsh-whalebook-todo-edit-due{',
  'width:100%;border:1px solid var(--wb-border,rgba(0,0,0,.12));border-radius:8px;',
  'background:var(--wb-surface,#f5f6f8);padding:6px 8px;font-size:13px;line-height:1.4;color:var(--wb-label,#1f2329);',
  'font-family:inherit;outline:none;color-scheme:inherit}',
  '.dsh-whalebook-todo-input:focus,.dsh-whalebook-todo-due:focus,.dsh-whalebook-todo-edit-text:focus,',
  '.dsh-whalebook-todo-edit-due:focus{border-color:var(--wb-accent,#4a7dff);',
  'box-shadow:0 0 0 2px color-mix(in srgb,var(--wb-accent,#4a7dff) 22%,transparent)}',
  '.dsh-whalebook-todo-input::placeholder{color:var(--wb-faint,#8a919c)}',
  '.dsh-whalebook-todo-row{display:flex;align-items:center;gap:6px}',
  '.dsh-whalebook-todo-due{flex:1;min-width:0;color:var(--wb-muted,#5c6370);cursor:pointer}',
  '.dsh-whalebook-todo-add{border:none;border-radius:8px;background:var(--wb-accent,#4a7dff);',
  'color:var(--wb-on-accent,#fff);font-size:13px;padding:6px 12px;cursor:pointer;font-family:inherit;white-space:nowrap}',
  '.dsh-whalebook-todo-add:hover{background:var(--wb-accent-hover,#3a6ce8)}',
  '.dsh-whalebook-todo-add:disabled,.dsh-whalebook-todo-input:disabled,.dsh-whalebook-todo-due:disabled{opacity:.55;cursor:default}',
  '.dsh-whalebook-todo-list{list-style:none;margin:0;padding:6px;overflow-y:auto;flex:1;scrollbar-color:var(--wb-faint,#8a919c) transparent}',
  '.dsh-whalebook-todo-item{display:flex;align-items:flex-start;gap:8px;padding:7px 6px;border-radius:8px}',
  '.dsh-whalebook-todo-item:hover{background:var(--wb-hover,rgba(0,0,0,.05))}',
  '.dsh-whalebook-todo-check{margin-top:3px;width:15px;height:15px;flex:0 0 auto;cursor:pointer;accent-color:var(--wb-accent,#4a7dff)}',
  '.dsh-whalebook-todo-main{flex:1;min-width:0}',
  '.dsh-whalebook-todo-text{overflow-wrap:anywhere;white-space:pre-wrap;cursor:pointer;border-radius:4px;outline:none;color:inherit}',
  '.dsh-whalebook-todo-text:hover{text-decoration:underline;text-underline-offset:2px}',
  '.dsh-whalebook-todo-text:focus-visible{box-shadow:0 0 0 2px color-mix(in srgb,var(--wb-accent,#4a7dff) 35%,transparent)}',
  '.dsh-whalebook-todo-item.is-editing{background:color-mix(in srgb,var(--wb-accent,#4a7dff) 8%,transparent)}',
  '.dsh-whalebook-todo-edit{display:flex;flex:1;min-width:0;flex-direction:column;gap:6px}',
  '.dsh-whalebook-todo-edit-actions{display:flex;justify-content:flex-end;gap:6px}',
  '.dsh-whalebook-todo-save{border:none;border-radius:8px;background:var(--wb-accent,#4a7dff);color:var(--wb-on-accent,#fff);',
  'font-size:12px;padding:5px 12px;cursor:pointer;font-family:inherit}',
  '.dsh-whalebook-todo-save:hover{background:var(--wb-accent-hover,#3a6ce8)}',
  '.dsh-whalebook-todo-cancel{border:1px solid var(--wb-border,rgba(0,0,0,.12));border-radius:8px;',
  'background:var(--wb-surface,#f5f6f8);color:var(--wb-muted,#5c6370);font-size:12px;padding:5px 12px;',
  'cursor:pointer;font-family:inherit}',
  '.dsh-whalebook-todo-cancel:hover{background:var(--wb-hover,rgba(0,0,0,.05));color:var(--wb-label,#1f2329)}',
  '.dsh-whalebook-todo-meta{margin-top:2px;font-size:11px;color:var(--wb-muted,#5c6370)}',
  '.dsh-whalebook-todo-item[data-urgency="overdue"] .dsh-whalebook-todo-meta{color:var(--wb-danger,#d94f3d)}',
  '.dsh-whalebook-todo-item[data-urgency="soon"] .dsh-whalebook-todo-meta{color:var(--wb-warn,#c9761b)}',
  '.dsh-whalebook-todo-item[data-urgency="today"] .dsh-whalebook-todo-meta{color:var(--wb-info,#3f6fd8)}',
  '.dsh-whalebook-todo-item.is-done .dsh-whalebook-todo-text{text-decoration:line-through;color:var(--wb-muted,#5c6370)}',
  '.dsh-whalebook-todo-del{border:none;background:transparent;color:var(--wb-faint,#8a919c);font-size:12px;line-height:1;',
  'padding:4px 5px;border-radius:6px;cursor:pointer;flex:0 0 auto;min-width:22px}',
  '.dsh-whalebook-todo-del:hover{background:var(--wb-hover,rgba(0,0,0,.05));color:var(--wb-label,#1f2329)}',
  '.dsh-whalebook-todo-del.is-armed{background:color-mix(in srgb,var(--wb-danger,#d94f3d) 15%,transparent);color:var(--wb-danger,#d94f3d)}',
  '.dsh-whalebook-todo-empty{padding:20px 12px;text-align:center;color:var(--wb-faint,#8a919c);font-size:12px}',
  '.dsh-whalebook-todo-empty[hidden]{display:none}',
  '.dsh-whalebook-todo-err{padding:0 12px 8px;color:var(--wb-danger,#d94f3d);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.dsh-whalebook-todo-err[hidden]{display:none}',
  '.dsh-whalebook-todo-hint{padding:6px 12px 9px;color:var(--wb-faint,#8a919c);font-size:11px;text-align:center}',
].join('');

let todoCssInjected = false;

/** 把面板样式注入文档一次；重复挂载不会重复插入。 */
export function injectTodoCss(): void {
  if (todoCssInjected || typeof document === 'undefined') return;
  todoCssInjected = true;
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-whalebook';
  tag.dataset.pluginCss = 'dsh-whalebook/todo';
  tag.textContent = TODO_CSS;
  document.head.appendChild(tag);
}

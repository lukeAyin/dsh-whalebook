/**
 * 待办面板的样式：与对话弹窗同一套视觉（白底、圆角、同款字体），挂在 body 下注入一次。
 *
 * 只有静态字符串与注入状态，不建 DOM、不读配置；颜色沿用对话弹窗的取值（这两个浮层都不在
 * DSH 插槽内，拿不到 `--dsw-*` token，保持与既有浮层一致而不是自创一套）。
 * @module dsh-whalebook/src/shared/todo/styles
 */

/** 面板样式：头部 + 添加行 + 可滚动的清单 + 底部提示。 */
export const TODO_CSS = [
  '.dsh-whalebook-todo{position:fixed;z-index:2147483003;width:308px;max-width:calc(100vw - 24px);',
  'max-height:min(70vh,520px);display:flex;flex-direction:column;',
  'background:rgba(255,255,255,.98);border:1px solid rgba(0,0,0,.12);border-radius:12px;',
  'box-shadow:0 12px 36px rgba(0,0,0,.24);color:#2b2b2b;font-size:13px;line-height:1.5;user-select:none;',
  'overflow:hidden;',
  "font-family:var(--dsh-whalebook-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','幼圆','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);",
  '}',
  '.dsh-whalebook-todo *{box-sizing:border-box}',
  '.dsh-whalebook-todo-head{display:flex;align-items:center;gap:8px;padding:10px 12px 8px}',
  '.dsh-whalebook-todo-title{flex:1;font-size:14px;font-weight:600}',
  '.dsh-whalebook-todo-count{color:rgba(43,43,43,.55);font-size:12px}',
  '.dsh-whalebook-todo-close{border:none;background:transparent;color:rgba(43,43,43,.5);font-size:13px;line-height:1;',
  'padding:4px 5px;border-radius:6px;cursor:pointer}',
  '.dsh-whalebook-todo-close:hover{background:rgba(0,0,0,.06);color:rgba(43,43,43,.9)}',
  '.dsh-whalebook-todo-form{display:flex;flex-direction:column;gap:6px;padding:0 12px 10px;',
  'border-bottom:1px solid rgba(0,0,0,.07)}',
  '.dsh-whalebook-todo-input,.dsh-whalebook-todo-due{width:100%;border:1px solid rgba(0,0,0,.12);border-radius:8px;',
  'background:rgba(255,255,255,.9);padding:6px 8px;font-size:13px;line-height:1.4;color:#2b2b2b;',
  'font-family:inherit;outline:none}',
  '.dsh-whalebook-todo-input:focus,.dsh-whalebook-todo-due:focus{border-color:rgba(64,128,255,.55);',
  'box-shadow:0 0 0 2px rgba(64,128,255,.14)}',
  '.dsh-whalebook-todo-input::placeholder{color:rgba(43,43,43,.42)}',
  '.dsh-whalebook-todo-row{display:flex;align-items:center;gap:6px}',
  '.dsh-whalebook-todo-due{flex:1;min-width:0;color:rgba(43,43,43,.72);cursor:pointer}',
  '.dsh-whalebook-todo-add{border:none;border-radius:8px;background:#4a7dff;color:#fff;font-size:13px;',
  'padding:6px 12px;cursor:pointer;font-family:inherit;white-space:nowrap}',
  '.dsh-whalebook-todo-add:hover{background:#3a6ce8}',
  '.dsh-whalebook-todo-add:disabled,.dsh-whalebook-todo-input:disabled,.dsh-whalebook-todo-due:disabled{opacity:.55;cursor:default}',
  '.dsh-whalebook-todo-list{list-style:none;margin:0;padding:6px;overflow-y:auto;flex:1}',
  '.dsh-whalebook-todo-item{display:flex;align-items:flex-start;gap:8px;padding:7px 6px;border-radius:8px}',
  '.dsh-whalebook-todo-item:hover{background:rgba(0,0,0,.045)}',
  '.dsh-whalebook-todo-check{margin-top:3px;width:15px;height:15px;flex:0 0 auto;cursor:pointer;accent-color:#4a7dff}',
  '.dsh-whalebook-todo-main{flex:1;min-width:0}',
  '.dsh-whalebook-todo-text{overflow-wrap:anywhere;white-space:pre-wrap}',
  '.dsh-whalebook-todo-meta{margin-top:2px;font-size:11px;color:rgba(43,43,43,.5)}',
  '.dsh-whalebook-todo-item[data-urgency="overdue"] .dsh-whalebook-todo-meta{color:#d94f3d}',
  '.dsh-whalebook-todo-item[data-urgency="soon"] .dsh-whalebook-todo-meta{color:#c9761b}',
  '.dsh-whalebook-todo-item[data-urgency="today"] .dsh-whalebook-todo-meta{color:#3f6fd8}',
  '.dsh-whalebook-todo-item.is-done .dsh-whalebook-todo-text{text-decoration:line-through;color:rgba(43,43,43,.42)}',
  '.dsh-whalebook-todo-del{border:none;background:transparent;color:rgba(43,43,43,.34);font-size:12px;line-height:1;',
  'padding:4px 5px;border-radius:6px;cursor:pointer;flex:0 0 auto;min-width:22px}',
  '.dsh-whalebook-todo-del:hover{background:rgba(0,0,0,.07);color:rgba(43,43,43,.8)}',
  '.dsh-whalebook-todo-del.is-armed{background:rgba(217,79,61,.12);color:#d94f3d}',
  '.dsh-whalebook-todo-empty{padding:20px 12px;text-align:center;color:rgba(43,43,43,.44);font-size:12px}',
  '.dsh-whalebook-todo-empty[hidden]{display:none}',
  '.dsh-whalebook-todo-err{padding:0 12px 8px;color:#d94f3d;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
  '.dsh-whalebook-todo-err[hidden]{display:none}',
  '.dsh-whalebook-todo-hint{padding:6px 12px 9px;color:rgba(43,43,43,.4);font-size:11px;text-align:center}',
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

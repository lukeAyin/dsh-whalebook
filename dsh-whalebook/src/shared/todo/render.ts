/**
 * 待办面板的 DOM 骨架与清单渲染：只拼元素、绑事件，不取数、不定位、不关弹窗。
 *
 * 删除做成两步（先变成「确认」，2.5 秒后自动复原）：清单没有撤销，误点一次就没了太容易。
 * 编辑态由调用方给出 `TodoEditing`，这里只把那一行换成输入框，不持有编辑状态。
 * @module dsh-whalebook/src/shared/todo/render
 */
import { metaLabel, todoUrgency } from './format.ts';
import type { TodoItem } from './types.ts';

/** 面板里需要被面板逻辑持有的元素。 */
export interface TodoPanelParts {
  /** 根：定位与显隐的宿主。 */
  root: HTMLElement;
  /** 添加表单：回车提交。 */
  form: HTMLFormElement;
  /** 正文输入框。 */
  input: HTMLInputElement;
  /** 到期时间输入框（`datetime-local`，空 = 无期限）。 */
  due: HTMLInputElement;
  /** 添加按钮。 */
  addButton: HTMLButtonElement;
  /** 关闭按钮（右上角）。 */
  closeButton: HTMLButtonElement;
  /** 清单容器。 */
  list: HTMLUListElement;
  /** 空态提示。 */
  empty: HTMLDivElement;
  /** 顶部的未完成计数。 */
  count: HTMLSpanElement;
  /** 错误行（隐藏时为 `hidden`）。 */
  error: HTMLDivElement;
}

/** 编辑框里的原始值：正文与 `datetime-local` 字符串（空串 = 不设到期）。 */
export interface TodoEditDraft {
  text: string;
  due: string;
}

/** 正在编辑的一条待办。 */
export interface TodoEditing {
  id: string;
  text: string;
  due: string;
}

/** 清单条目上的交互回调。 */
export interface TodoListHandlers {
  /** 勾选 / 取消勾选。 */
  onToggle: (todo: TodoItem, done: boolean) => void;
  /** 删除（调用方已确认过一次）。 */
  onDelete: (todo: TodoItem) => void;
  /** 点击正文进入编辑。 */
  onStartEdit: (todo: TodoItem) => void;
  /** 保存编辑（原始值由调用方校验）。 */
  onSaveEdit: (todo: TodoItem, draft: TodoEditDraft) => void;
  /** 取消编辑。 */
  onCancelEdit: () => void;
}

/** 删除按钮的二次确认窗口（ms）：超时自动复原，避免「确认」态一直挂着。 */
const DELETE_ARM_MS = 2500;

/** 空态文案：加载中会临时替换它，重渲染时再写回来。 */
const EMPTY_TEXT = '还没有待办。记一件要做的事，到点我会提醒你～';

/** 底部提示：把新增的两个交互写在用户看得到的地方。 */
const HINT_TEXT = '点待办可编辑 · 一段时间无操作会自动收起';

/** 造一个带 class 的元素，避免每处都写 createElement + className。 */
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 造面板骨架（尚未挂进文档）。
 *
 * @returns 面板需要的全部元素引用。
 */
export function createTodoPanelParts(): TodoPanelParts {
  const root = element('div', 'dsh-whalebook-todo');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '待办事项');

  const head = element('div', 'dsh-whalebook-todo-head');
  const title = element('span', 'dsh-whalebook-todo-title', '待办事项');
  const count = element('span', 'dsh-whalebook-todo-count', '0 项未完成');
  count.setAttribute('aria-live', 'polite');
  const closeButton = element('button', 'dsh-whalebook-todo-close', '✕');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭待办面板');
  head.append(title, count, closeButton);

  const form = element('form', 'dsh-whalebook-todo-form');
  const input = element('input', 'dsh-whalebook-todo-input');
  input.type = 'text';
  input.maxLength = 200;
  input.placeholder = '记一件要做的事…';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '待办内容');
  const row = element('div', 'dsh-whalebook-todo-row');
  const due = element('input', 'dsh-whalebook-todo-due');
  due.type = 'datetime-local';
  due.setAttribute('aria-label', '提醒时间（可选）');
  const addButton = element('button', 'dsh-whalebook-todo-add', '添加');
  addButton.type = 'submit';
  row.append(due, addButton);
  form.append(input, row);

  const error = element('div', 'dsh-whalebook-todo-err');
  error.hidden = true;

  const empty = element('div', 'dsh-whalebook-todo-empty', EMPTY_TEXT);
  empty.hidden = true;

  const list = element('ul', 'dsh-whalebook-todo-list');
  const hint = element('div', 'dsh-whalebook-todo-hint', HINT_TEXT);

  root.append(head, form, error, empty, list, hint);
  return { root, form, input, due, addButton, closeButton, list, empty, count, error };
}

/**
 * 渲染一整张清单。
 *
 * @param parts - 面板元素。
 * @param todos - 已排序的待办。
 * @param handlers - 勾选、删除与编辑的回调。
 * @param now - 当前时刻，用来生成「还剩多久」。
 * @param editing - 正在编辑的那一条；null 表示全部只读。
 */
export function renderTodoList(
  parts: TodoPanelParts,
  todos: readonly TodoItem[],
  handlers: TodoListHandlers,
  now: number,
  editing: TodoEditing | null = null,
): void {
  parts.list.textContent = '';
  const pending = todos.filter((todo) => !todo.done).length;
  parts.count.textContent = `${pending} 项未完成`;
  parts.empty.textContent = EMPTY_TEXT;
  parts.empty.hidden = todos.length > 0;
  for (const todo of todos) {
    parts.list.appendChild(
      editing !== null && editing.id === todo.id
        ? renderEditItem(todo, editing, handlers)
        : renderItem(todo, handlers, now),
    );
  }
}

/** 渲染一条（只读态）；未完成项带紧迫度，已完成项划线。 */
function renderItem(todo: TodoItem, handlers: TodoListHandlers, now: number): HTMLLIElement {
  const item = element('li', 'dsh-whalebook-todo-item' + (todo.done ? ' is-done' : ''));
  if (!todo.done) item.dataset.urgency = todoUrgency(todo.dueAt, now);

  const check = element('input', 'dsh-whalebook-todo-check');
  check.type = 'checkbox';
  check.checked = todo.done;
  check.setAttribute('aria-label', (todo.done ? '标记未完成：' : '标记完成：') + todo.text);
  check.addEventListener('change', () => handlers.onToggle(todo, check.checked));

  const main = element('div', 'dsh-whalebook-todo-main');
  const text = element('div', 'dsh-whalebook-todo-text', todo.text);
  text.title = '点击编辑';
  text.tabIndex = 0;
  text.setAttribute('role', 'button');
  text.setAttribute('aria-label', '编辑待办：' + todo.text);
  const startEdit = (): void => handlers.onStartEdit(todo);
  text.addEventListener('click', startEdit);
  text.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    startEdit();
  });
  const meta = element('div', 'dsh-whalebook-todo-meta', metaLabel(todo, now));
  main.append(text, meta);

  const remove = element('button', 'dsh-whalebook-todo-del', '✕');
  remove.type = 'button';
  remove.setAttribute('aria-label', '删除：' + todo.text);
  remove.addEventListener('click', () => {
    // 第一次点击只进入确认态；再点一次才真的删。
    if (remove.dataset.armed !== '1') {
      remove.dataset.armed = '1';
      remove.classList.add('is-armed');
      remove.textContent = '确认';
      window.setTimeout(() => {
        // 面板已关闭 / 已重渲染时元素不再在文档里：静默复原即可。
        if (!remove.isConnected) return;
        delete remove.dataset.armed;
        remove.classList.remove('is-armed');
        remove.textContent = '✕';
      }, DELETE_ARM_MS);
      return;
    }
    handlers.onDelete(todo);
  });

  item.append(check, main, remove);
  return item;
}

/** 渲染一条的编辑态：正文 + 到期时间 + 保存/取消；回车提交、Esc 取消由面板统一处理。 */
function renderEditItem(todo: TodoItem, editing: TodoEditing, handlers: TodoListHandlers): HTMLLIElement {
  const item = element('li', 'dsh-whalebook-todo-item is-editing');
  const form = element('form', 'dsh-whalebook-todo-edit');
  const text = element('input', 'dsh-whalebook-todo-edit-text');
  text.type = 'text';
  text.maxLength = 200;
  text.value = editing.text;
  text.autocomplete = 'off';
  text.setAttribute('aria-label', '编辑待办内容');
  const due = element('input', 'dsh-whalebook-todo-edit-due');
  due.type = 'datetime-local';
  due.value = editing.due;
  due.setAttribute('aria-label', '编辑提醒时间（可选）');
  const actions = element('div', 'dsh-whalebook-todo-edit-actions');
  const save = element('button', 'dsh-whalebook-todo-save', '保存');
  save.type = 'submit';
  const cancel = element('button', 'dsh-whalebook-todo-cancel', '取消');
  cancel.type = 'button';
  actions.append(save, cancel);
  form.append(text, due, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSaveEdit(todo, { text: text.value, due: due.value });
  });
  cancel.addEventListener('click', () => handlers.onCancelEdit());
  item.append(form);
  return item;
}

/**
 * 显示 / 清除错误行。
 *
 * @param parts - 面板元素。
 * @param message - 错误文案；null 表示清除。
 */
export function setTodoError(parts: TodoPanelParts, message: string | null): void {
  parts.error.hidden = message === null;
  parts.error.textContent = message ?? '';
}

/**
 * 切换忙碌态：请求在途时禁掉输入与按钮，避免连点建出两条。
 *
 * @param parts - 面板元素。
 * @param busy - 是否请求在途。
 */
export function setTodoBusy(parts: TodoPanelParts, busy: boolean): void {
  parts.input.disabled = busy;
  parts.due.disabled = busy;
  parts.addButton.disabled = busy;
}

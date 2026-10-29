/**
 * 待办面板的挂载与生命周期：取数、提交、行内编辑、无操作自动收起、点外/Esc 关闭与跟随定位。
 *
 * 只负责一次弹窗：骨架与列表在 ./render，输入校验在 ./edit，定位在 ./position，HTTP 在 ./api。
 * 全页同时只允许一个面板；点宠物命中区不算「点外面」，好让再次点击宠物由调用方收起面板。
 * 自动收起不会打断编辑或请求：编辑中、请求中、指针悬停、焦点在面板内时都会顺延。
 * @module dsh-whalebook/src/shared/todo/panel
 */
import { TODOS_PATH, addTodo, loadTodos, patchTodo, removeTodo, type TodoResult } from './api.ts';
import { parseEditDraft } from './edit.ts';
import { formatDateTimeLocal } from './format.ts';
import { placeTodoPanel, type AnchorRect } from './position.ts';
import {
  createTodoPanelParts,
  renderTodoList,
  setTodoBusy,
  setTodoError,
  type TodoEditDraft,
  type TodoEditing,
  type TodoListHandlers,
} from './render.ts';
import { injectTodoCss } from './styles.ts';
import { applyTodoTheme } from './theme.ts';
import type { TodoItem } from './types.ts';

/** 挂载参数。 */
export interface TodoPanelOptions {
  /** 读宠物命中区的当前矩形（视口坐标）；返回 null 表示宠物已不在，面板自行关闭。 */
  anchor: () => AnchorRect | null;
  /** 命中区元素：点它不关闭面板，交给宠物自己的单击开关处理。 */
  anchorEl?: HTMLElement | null;
  /** 接口基址；桌面端可传绝对地址，缺省走同源前缀。 */
  baseUrl?: string;
  /** true = 只走左右侧（桌面端），避免竖向遮住宠物。 */
  horizontalOnly?: boolean;
  /**
   * 可视区域（窗口局部坐标）。桌面窗口可能有一部分在屏幕外，定位要按屏幕可见区夹取，
   * 否则宠物靠近屏幕右缘时面板会被放到屏幕外。缺省 = 整个窗口。
   */
  viewport?: () => TodoViewport;
  /** 面板关闭后调用（点外 / Esc / 关闭按钮 / 自动收起 / 再次挂载顶掉旧面板都会触发一次）。 */
  onClose?: () => void;
}

/** 定位用的可视区域（窗口局部坐标）。 */
export interface TodoViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 面板挂载句柄。 */
export interface TodoPanelMount {
  /** 根元素（`document.body` 下）。 */
  el: HTMLElement;
  /** 关闭并清理（幂等）。 */
  close: () => void;
}

/** 跟随宠物位置的巡检间隔（ms）：宠物会自己走位，面板得跟着挪。 */
const FOLLOW_MS = 200;

/** 无操作自动收起的时长（ms）：面板不该一直占着屏幕。 */
const AUTO_DISMISS_MS = 45 * 1000;

/** 当前打开的面板；全页唯一。 */
let active: TodoPanelMount | null = null;

/**
 * 挂载待办面板（已有面板先关闭）。
 *
 * @param options - 锚点、基址与关闭回调。
 * @returns 挂载句柄；调用方只需在卸载时 `close()`。
 */
export function mountTodoPanel(options: TodoPanelOptions): TodoPanelMount {
  injectTodoCss();
  active?.close();
  const parts = createTodoPanelParts();
  const baseUrl = options.baseUrl ?? TODOS_PATH;

  let closed = false;
  let busy = false;
  let todos: TodoItem[] = [];
  let editing: TodoEditing | null = null;
  let followTimer: number | null = null;
  let idleTimer: number | null = null;
  let disposeTheme: (() => void) | null = null;
  let mount: TodoPanelMount | null = null;

  /** 取消自动收起计时。 */
  function clearIdle(): void {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = null;
  }

  /** 重新起算无操作时间；编辑/请求/悬停/焦点在内时顺延而不是收起。 */
  function armIdle(): void {
    clearIdle();
    if (closed) return;
    idleTimer = window.setTimeout(() => {
      idleTimer = null;
      if (closed) return;
      if (editing !== null || busy || parts.root.matches(':hover')) {
        armIdle();
        return;
      }
      if (parts.root.contains(document.activeElement)) {
        armIdle();
        return;
      }
      close();
    }, AUTO_DISMISS_MS);
  }

  /** 面板里有交互就重新计时。 */
  function noteActivity(): void {
    if (!closed) armIdle();
  }

  /** 关闭并清理：监听、跟随/自动收起定时器、根节点与单例引用一起收。 */
  function close(): void {
    if (closed) return;
    closed = true;
    clearIdle();
    disposeTheme?.();
    disposeTheme = null;
    if (followTimer !== null) window.clearInterval(followTimer);
    followTimer = null;
    window.removeEventListener('resize', place);
    document.removeEventListener('mousedown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeyDown, true);
    parts.root.remove();
    if (active === mount) active = null;
    options.onClose?.();
  }

  /** 把面板贴到宠物命中区旁；宠物没了就收摊。 */
  function place(): void {
    const anchor = options.anchor();
    if (anchor === null) {
      close();
      return;
    }
    const size = { width: parts.root.offsetWidth, height: parts.root.offsetHeight };
    // 桌面窗口可能跨出屏幕：把锚点换算到「可见区」坐标系里定位，再把落点加回窗口坐标。
    const visible = options.viewport?.() ?? {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const localAnchor = {
      left: anchor.left - visible.left,
      top: anchor.top - visible.top,
      right: anchor.right - visible.left,
      bottom: anchor.bottom - visible.top,
    };
    const point = placeTodoPanel(
      localAnchor,
      size,
      { width: visible.width, height: visible.height },
      { horizontalOnly: options.horizontalOnly },
    );
    parts.root.style.left = point.left + visible.left + 'px';
    parts.root.style.top = point.top + visible.top + 'px';
    // 只用于调试/端到端断言：正常位置不与宠物相交，overlap 表示视口太小只能兜底。
    parts.root.dataset.side = point.side;
  }

  /** 渲染清单；编辑态下把焦点放回正文输入框，光标停在末尾。 */
  function render(): void {
    renderTodoList(parts, todos, handlers, Date.now(), editing);
    if (editing === null) return;
    const input = parts.root.querySelector<HTMLInputElement>('.dsh-whalebook-todo-edit-text');
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  // 列表回调 → 修改 → 重拉 → 渲染互相引用：mutate/reload 用函数声明提升，回调里引用不会在构造期求值。
  const handlers: TodoListHandlers = {
    onToggle: (todo, done) => void mutate(() => patchTodo(todo.id, { done }, baseUrl)),
    onDelete: (todo) => void mutate(() => removeTodo(todo.id, baseUrl)),
    onStartEdit: (todo) => {
      if (busy) return;
      clearIdle();
      editing = {
        id: todo.id,
        text: todo.text,
        due: todo.dueAt === null ? '' : formatDateTimeLocal(todo.dueAt),
      };
      setTodoError(parts, null);
      render();
    },
    onSaveEdit: (todo, draft: TodoEditDraft) => {
      const parsed = parseEditDraft(draft);
      if (!parsed.ok) {
        setTodoError(parts, parsed.message);
        const input = parts.root.querySelector<HTMLInputElement>('.dsh-whalebook-todo-edit-text');
        input?.focus();
        return;
      }
      void mutate(async () => {
        const result = await patchTodo(todo.id, { text: parsed.text, dueAt: parsed.dueAt }, baseUrl);
        if (result.ok) editing = null;
        return result;
      });
    },
    onCancelEdit: () => {
      if (editing === null) return;
      editing = null;
      setTodoError(parts, null);
      render();
      armIdle();
    },
    onEditDraftChange: (draft) => {
      if (editing === null) return;
      // 只更新状态、不重渲染：重渲染会把光标移回末尾，打断正在输入的人。
      editing = { id: editing.id, text: draft.text, due: draft.due };
    },
  };

  /** 重新拉整张清单：修改一律以宿主返回为准，不在本地猜结果。 */
  async function reload(): Promise<void> {
    const result = await loadTodos(baseUrl);
    if (closed) return;
    if (!result.ok) {
      setTodoError(parts, result.message);
      // 加载失败时别让空态一直停在「加载中…」。
      parts.empty.textContent = '清单加载失败，关掉面板再开一次试试';
      parts.empty.hidden = false;
      return;
    }
    todos = result.value;
    setTodoError(parts, null);
    render();
  }

  /** 串行执行一次修改：请求在途时禁止再次提交，成功后统一重拉。 */
  async function mutate(task: () => Promise<TodoResult<unknown>>): Promise<void> {
    if (closed || busy) return;
    busy = true;
    clearIdle();
    setTodoBusy(parts, true);
    setTodoError(parts, null);
    const result = await task();
    busy = false;
    if (closed) return;
    setTodoBusy(parts, false);
    if (!result.ok) {
      setTodoError(parts, result.message);
      armIdle();
      return;
    }
    await reload();
    if (!closed) armIdle();
  }

  /** 提交新增：空正文/非法时间由 parseEditDraft 统一拦截。 */
  const submitAdd = (): void => {
    const parsed = parseEditDraft({ text: parts.input.value, due: parts.due.value });
    if (!parsed.ok) {
      setTodoError(parts, parsed.message);
      parts.input.focus();
      return;
    }
    void mutate(async () => {
      const result = await addTodo(parsed.text, parsed.dueAt, baseUrl);
      if (result.ok) {
        parts.input.value = '';
        parts.due.value = '';
      }
      return result;
    });
  };

  const onDocPointerDown = (event: MouseEvent): void => {
    if (closed) return;
    const target = event.target as Node | null;
    if (target === null) return;
    if (parts.root.contains(target)) return;
    // 点宠物本体不关：让 pet 的单击逻辑决定「收起」（否则会先关再被 click 打开）。
    if (options.anchorEl?.contains(target)) return;
    close();
  };

  const onDocKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // 编辑中先退编辑，再按一次 Esc 才收面板。
    if (editing !== null) {
      event.preventDefault();
      event.stopPropagation();
      editing = null;
      setTodoError(parts, null);
      render();
      armIdle();
      return;
    }
    close();
  };

  parts.form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAdd();
  });
  parts.closeButton.addEventListener('click', close);
  // 面板内任何按下/按键都视为「还在用」，重新开始无操作计时。
  parts.root.addEventListener('pointerdown', noteActivity, true);
  parts.root.addEventListener('keydown', noteActivity, true);
  parts.empty.textContent = '加载中…';
  parts.empty.hidden = false;

  document.addEventListener('mousedown', onDocPointerDown, true);
  document.addEventListener('keydown', onDocKeyDown, true);
  window.addEventListener('resize', place);

  // 先入文档再量尺寸：不在文档里时 offsetWidth 恒为 0，面板会贴到左上角。
  document.body.appendChild(parts.root);
  // 主题要等根节点进文档后才能解析 token 与写内联样式；监听 body 的暗色标记切换。
  disposeTheme = applyTodoTheme(parts.root);
  mount = { el: parts.root, close };
  active = mount;
  place();
  // 锚点缺失时 place 已经收摊：定时器与取数都不再启动。
  if (!closed) {
    followTimer = window.setInterval(place, FOLLOW_MS);
    // 不自动聚焦输入框：单击宠物通常只是想摸摸它，抢走 DSH 输入框的焦点比少一次点击更烦。
    armIdle();
    void reload();
  }
  return mount;
}

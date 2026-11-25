/**
 * 快捷键录制：把浏览器 KeyboardEvent 的键位形状转成 Electron accelerator。
 *
 * 只做纯转换，不碰 DOM/React；设置页把 keydown 的字段传进来即可。
 * 至少要求一个修饰键或 F1–F24，避免把普通字母设成全局快捷键。
 * @module dsh-whalebook/src/client/settings/accelerator
 */

/** keydown 里与快捷键有关的字段；浏览器事件结构可直接传。 */
export interface KeyChordLike {
  readonly key: string;
  readonly code?: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/** 纯修饰键不构成组合。 */
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'CapsLock']);

/** 键名与 Electron accelerator 的固定映射。 */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Enter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  '+': 'Plus',
};

/**
 * 把一个按键事件转成 accelerator；不合法返回 `null`。
 *
 * @param chord - keydown 的键位字段。
 * @returns 例如 `CommandOrControl+Shift+T`、`Alt+Space`、`F8`；普通字母无修饰键时返回 `null`。
 */
export function acceleratorFromKeyChord(chord: KeyChordLike): string | null {
  if (MODIFIER_KEYS.has(chord.key)) return null;
  const parts: string[] = [];
  if (chord.metaKey || chord.ctrlKey) parts.push('CommandOrControl');
  if (chord.altKey) parts.push('Alt');
  if (chord.shiftKey) parts.push('Shift');

  let key: string;
  const code = chord.code ?? '';
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(chord.key)) key = chord.key;
  else if (NAMED_KEYS[chord.key]) key = NAMED_KEYS[chord.key];
  else if (chord.key.length === 1 && /[a-zA-Z0-9]/.test(chord.key)) key = chord.key.toUpperCase();
  else return null;

  // F 键可以单独使用；其余组合必须带修饰键，避免录制出一个普通字母当全局键。
  if (parts.length === 0 && !/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)) return null;
  return [...parts, key].join('+');
}

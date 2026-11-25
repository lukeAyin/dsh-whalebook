import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { acceleratorFromKeyChord } from './accelerator.ts';

/** 造一个 keydown 形状；只覆盖录制用到的字段。 */
function chord(
  key: string,
  code: string,
  mods: Partial<{ meta: boolean; ctrl: boolean; alt: boolean; shift: boolean }> = {},
) {
  return {
    key,
    code,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    shiftKey: mods.shift ?? false,
  };
}

describe('acceleratorFromKeyChord —— 录制快捷键', () => {
  test('Command/Control + 字母 → CommandOrControl+字母', () => {
    assert.equal(acceleratorFromKeyChord(chord('t', 'KeyT', { meta: true, shift: true })), 'CommandOrControl+Shift+T');
    assert.equal(acceleratorFromKeyChord(chord('t', 'KeyT', { ctrl: true })), 'CommandOrControl+T');
  });

  test('数字与功能键', () => {
    assert.equal(acceleratorFromKeyChord(chord('1', 'Digit1', { alt: true })), 'Alt+1');
    assert.equal(acceleratorFromKeyChord(chord('F8', 'F8')), 'F8');
    assert.equal(acceleratorFromKeyChord(chord('F24', 'F24')), 'F24');
  });

  test('特殊键映射到 Electron 名称', () => {
    assert.equal(acceleratorFromKeyChord(chord(' ', 'Space', { alt: true })), 'Alt+Space');
    assert.equal(acceleratorFromKeyChord(chord('ArrowUp', 'ArrowUp', { meta: true })), 'CommandOrControl+Up');
    assert.equal(acceleratorFromKeyChord(chord('Enter', 'Enter', { ctrl: true })), 'CommandOrControl+Return');
    assert.equal(acceleratorFromKeyChord(chord('+', 'Equal', { meta: true })), 'CommandOrControl+Plus');
  });

  test('纯修饰键 / 无修饰普通键 / 不支持的键 → null', () => {
    assert.equal(acceleratorFromKeyChord(chord('Meta', 'MetaLeft', { meta: true })), null);
    assert.equal(acceleratorFromKeyChord(chord('t', 'KeyT')), null);
    assert.equal(acceleratorFromKeyChord(chord('Shift', 'ShiftLeft', { shift: true })), null);
    assert.equal(acceleratorFromKeyChord(chord('Dead', 'Dead')), null);
  });
});

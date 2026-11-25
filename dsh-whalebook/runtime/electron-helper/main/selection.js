'use strict';
/**
 * 全局划词快捷键（桌面 Helper 主进程）：注册 Electron globalShortcut，模拟 ⌘C 取选中文字，
 * 再通过 IPC 交给渲染端发给宿主。不负责翻译、气泡与配置持久化。
 *
 * 仅 macOS 支持自动取词：需要「辅助功能」权限（System Events 模拟按键）；没有权限时发通知并中止。
 * 剪贴板在取词后恢复；选中文字与剪贴板内容都不进日志。
 * @module dsh-whalebook/runtime/electron-helper/main/selection
 */
const { app, clipboard, globalShortcut, Notification, systemPreferences } = require('electron');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

/** 等待系统完成复制（ms）：osascript 返回后剪贴板可能还没写完，160ms 覆盖正常延迟。 */
const COPY_WAIT_MS = 160;
/** osascript 单次超时（ms）：权限弹窗或系统卡住时不要永久挂住快捷键。 */
const OSASCRIPT_TIMEOUT_MS = 2500;
/** 单次划词正文上限（字符）：与宿主路由一致；超出部分不发送。 */
const TEXT_MAX = 4000;

/** 发系统通知；平台不支持时安静跳过。 */
function notify(body) {
  try {
    if (Notification.isSupported()) new Notification({ title: '鲸事本', body }).show();
  } catch {
    /* 通知失败不影响主流程 */
  }
}

/** 读 Helper 环境里的快捷键配置；返回 null = 未开启/格式坏。 */
function readShortcutConfig() {
  const raw = process.env.DSH_WHALEBOOK_SELECTION_SHORTCUT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const accelerator = typeof parsed.accelerator === 'string' ? parsed.accelerator.trim() : '';
    return accelerator === '' ? null : { accelerator };
  } catch {
    return null;
  }
}

/** 尽量原样恢复剪贴板：文本 / HTML / 图片；都为空则清空。 */
function restoreClipboard(previous) {
  try {
    if (previous.image && !previous.image.isEmpty()) {
      clipboard.write({
        text: previous.text,
        image: previous.image,
        ...(previous.html ? { html: previous.html } : {}),
      });
      return;
    }
    if (previous.text || previous.html) {
      clipboard.write({ text: previous.text, ...(previous.html ? { html: previous.html } : {}) });
      return;
    }
    clipboard.clear();
  } catch {
    /* 恢复失败不阻塞取词；用户最多需要重新复制一次 */
  }
}

/**
 * 取当前选中文字：备份剪贴板 → 模拟 ⌘C → 读剪贴板 → 恢复。
 *
 * @returns 成功给出 text；失败给出可直接进通知的 reason。
 */
async function captureSelectedText() {
  if (process.platform !== 'darwin') return { ok: false, reason: '全局划词目前仅支持 macOS' };
  try {
    // true = 没权限时弹系统引导；用户拒绝后返回 false，本次不模拟按键。
    if (!systemPreferences.isTrustedAccessibilityClient(true)) {
      return {
        ok: false,
        reason: '需要辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能，允许 DSH 桌面端（Electron）',
      };
    }
  } catch (error) {
    return { ok: false, reason: '检查辅助功能权限失败：' + String(error && error.message ? error.message : error) };
  }

  const previous = { text: clipboard.readText(), html: clipboard.readHTML(), image: clipboard.readImage() };
  try {
    await execFileAsync('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down'], {
      timeout: OSASCRIPT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    await new Promise((resolve) => setTimeout(resolve, COPY_WAIT_MS));
    const text = Array.from(clipboard.readText().trim()).slice(0, TEXT_MAX).join('');
    if (text === '') return { ok: false, reason: '没有取到选中的文字，请先在任意应用里选中文本再按快捷键' };
    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      reason: '复制选中文字失败：' + String(error && error.message ? error.message : error),
    };
  } finally {
    restoreClipboard(previous);
  }
}

/** 从窗口表里挑一个还活着的宠物窗口；没有返回 null。 */
function firstPetWindow(petWindows) {
  for (const win of petWindows.state.windows.values()) {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) continue;
    return win;
  }
  return null;
}

/**
 * 注册全局划词快捷键。
 *
 * @param deps.petWindows - Helper 窗口能力（读取窗口表）。
 * @param deps.log - 主进程日志（console 包装）。
 * @returns 无返回值；未开启、非 macOS 或注册失败时静默/通知后返回。
 */
function registerSelectionShortcut({ petWindows, log }) {
  const config = readShortcutConfig();
  if (config === null) return;
  if (process.platform !== 'darwin') {
    log.warn('[dsh-whalebook-desktop-helper] 全局划词仅支持 macOS，已跳过注册');
    return;
  }

  const trigger = async () => {
    const result = await captureSelectedText();
    if (!result.ok) {
      notify(result.reason);
      return;
    }
    const win = firstPetWindow(petWindows);
    if (!win) {
      notify('桌宠窗口未就绪，稍后再试');
      return;
    }
    win.webContents.send('pet:selection-text', { text: result.text });
  };

  let registered = false;
  try {
    registered = globalShortcut.register(config.accelerator, () => {
      void trigger();
    });
  } catch (error) {
    log.warn(
      `[dsh-whalebook-desktop-helper] 全局划词快捷键注册异常（${config.accelerator}）：` +
        String(error && error.message ? error.message : error),
    );
  }
  if (!registered) {
    notify(`快捷键 ${config.accelerator} 注册失败，可能被其他应用占用`);
    log.warn(`[dsh-whalebook-desktop-helper] 全局划词快捷键注册失败：${config.accelerator}`);
    return;
  }
  log.info(`[dsh-whalebook-desktop-helper] 全局划词快捷键已注册：${config.accelerator}`);
}

// 退出时释放全局快捷键；Electron 通常也会在进程结束时清理，但显式注销不依赖平台实现。
app.on('will-quit', () => globalShortcut.unregisterAll());

module.exports = { registerSelectionShortcut, captureSelectedText };

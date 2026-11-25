/**
 * 全局划词卡：开关、快捷键与固定指令。
 *
 * 只改本地状态，随「保存」写入用户配置；保存会重启桌面 Helper，快捷键随之重新注册。
 * 取词权限与跨应用按键模拟在 Helper，本卡只负责把配置写清楚。
 * @module dsh-whalebook/src/client/settings/selection-card
 */
import type { FunctionComponent } from 'react';
import type { SelectionShortcutConfig } from '../../shared/selection.ts';
import type { SettingsRuntime } from './runtime.ts';
import { INPUT_CLASS, makeUiKit } from './ui.ts';

/** 划词卡的输入。 */
export interface SelectionCardProps {
  /** 保存中或配置未就绪时禁用全部控件。 */
  readonly busy: boolean;
  /** 当前配置。 */
  readonly value: SelectionShortcutConfig;
  /** 任一字段被改。 */
  readonly onChange: (patch: Partial<SelectionShortcutConfig>) => void;
}

/**
 * 造划词卡。
 *
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export function makeSelectionCard(rt: SettingsRuntime): FunctionComponent<SelectionCardProps> {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });

  return function SelectionCard(props: SelectionCardProps) {
    const { busy, value } = props;
    return h('div', {
      className: 'dsh-whalebook-cfg__card',
      children: [
        cardHead(t('selectionTitle'), t('selectionHint')),
        h('div', {
          className: 'dsh-whalebook-cfg__grid2',
          children: [
            toggleCell('selectionEnabled', value.enabled, busy, (enabled) => props.onChange({ enabled })),
            field(
              t('selectionAccelerator'),
              h('input', {
                type: 'text',
                className: INPUT_CLASS,
                value: value.accelerator,
                disabled: busy,
                spellCheck: false,
                autoComplete: 'off',
                placeholder: 'CommandOrControl+Shift+T',
                onChange: (e: { target: { value: string } }) => props.onChange({ accelerator: e.target.value }),
              }),
              t('selectionAcceleratorHint'),
            ),
          ],
        }),
        field(
          t('selectionPrompt'),
          h('textarea', {
            className: INPUT_CLASS + ' dsh-whalebook-cfg__area',
            rows: 3,
            value: value.prompt,
            disabled: busy,
            maxLength: 1000,
            onChange: (e: { target: { value: string } }) => props.onChange({ prompt: e.target.value }),
          }),
          t('selectionPromptHint'),
        ),
        h('p', { className: 'dsh-whalebook-cfg__note', children: t('selectionNote') }),
      ],
    });
  };
}

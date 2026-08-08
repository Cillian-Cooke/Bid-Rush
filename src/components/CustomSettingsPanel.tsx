import { Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CUSTOM_PRESETS,
  type CustomMatchSettings,
  resolveCustomPool,
} from '../game/customSettings';
import { ITEM_LIST } from '../game/items';
import type { ItemId } from '../game/types';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  settings: CustomMatchSettings;
  onChange: (next: CustomMatchSettings) => void;
  onClose: () => void;
};

export function CustomSettingsPanel({ settings, onChange, onClose }: Props) {
  const items = useMemo(
    () =>
      [...ITEM_LIST]
        .filter((i) => i.spawnWeight > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const selected = useMemo(() => new Set(settings.itemIds), [settings.itemIds]);
  const [tab, setTab] = useState<'items' | 'rules'>('items');

  const toggle = (id: ItemId) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({ ...settings, itemIds: [...next] });
  };

  const selectAll = () =>
    onChange({
      ...settings,
      itemIds: items.map((i) => i.id),
    });

  const selectNoneKeepOne = () =>
    onChange({
      ...settings,
      itemIds: items[0] ? [items[0].id] : settings.itemIds,
    });

  return (
    <div className="codex-overlay" role="dialog" aria-label="Custom match settings">
      <div className="codex-sheet custom-settings-sheet">
        <div className="codex-head">
          <h2 className="leaderboard-title">
            <Settings size={20} aria-hidden />
            Custom
          </h2>
          <button
            type="button"
            className="codex-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="ranked-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={tab === 'items' ? 'on' : ''}
            aria-selected={tab === 'items'}
            onClick={() => setTab('items')}
          >
            Items ({resolveCustomPool(settings).length})
          </button>
          <button
            type="button"
            role="tab"
            className={tab === 'rules' ? 'on' : ''}
            aria-selected={tab === 'rules'}
            onClick={() => setTab('rules')}
          >
            Rules
          </button>
        </div>

        {tab === 'items' && (
          <>
            <div className="custom-item-actions">
              <button type="button" className="btn" onClick={selectAll}>
                All
              </button>
              <button type="button" className="btn" onClick={selectNoneKeepOne}>
                Clear
              </button>
            </div>
            <div className="custom-item-matrix" role="group" aria-label="Item pool">
              {items.map((item) => {
                const on = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`custom-item-cell${on ? ' on' : ''}`}
                    aria-pressed={on}
                    title={item.name}
                    onClick={() => toggle(item.id)}
                  >
                    <SpriteIcon
                      id={item.id}
                      className="custom-item-cell-icon"
                      aria-hidden
                    />
                    <span className="custom-item-cell-name">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'rules' && (
          <div className="custom-rules">
            <RuleRow
              label="Match length"
              options={CUSTOM_PRESETS.gameLengthMs}
              value={settings.gameLengthMs}
              onPick={(gameLengthMs) => onChange({ ...settings, gameLengthMs })}
            />
            <RuleRow
              label="Game speed"
              options={CUSTOM_PRESETS.speedMult}
              value={settings.speedMult}
              onPick={(speedMult) => onChange({ ...settings, speedMult })}
            />
            <RuleRow
              label="Starting coins"
              options={CUSTOM_PRESETS.startCoins}
              value={settings.startCoins}
              onPick={(startCoins) => onChange({ ...settings, startCoins })}
            />
            <RuleRow
              label="Shop tile timer"
              options={CUSTOM_PRESETS.tileTimerMs}
              value={settings.tileTimerMs}
              onPick={(tileTimerMs) => onChange({ ...settings, tileTimerMs })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RuleRow<T extends number>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="field lobby-diff custom-rule-row">
      <span>{label}</span>
      <div className="diff-row">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`diff-chip${opt.value === value ? ' selected' : ''}`}
            onClick={() => onPick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

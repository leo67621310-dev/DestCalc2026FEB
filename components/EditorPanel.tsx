import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { ChargeData, CHARGE_TEMPLATES, Group, Row } from '../types';
import { ChargeGroupCard } from './ChargeGroupCard';

interface EditorPanelProps {
  prefix: string;
  data: ChargeData;
  lastScanFeedback: { count: number; target: 'std' | 'req' | 'mgr'; groupIds: string[] } | null;
  onUpdateTitle: (title: string) => void;
  onAddGroup: (prefix: string, templateKey?: string) => void;
  onUpdateGroup: (idx: number, field: keyof Group, value: any) => void;
  onRemoveGroup: (idx: number) => void;
  onUpdateRow: (groupIdx: number, rowIdx: number, field: keyof Row, value: any) => void;
  onRemoveRow: (groupIdx: number, rowIdx: number) => void;
  onAddRow: (groupIdx: number) => void;
}

export function EditorPanel({
  prefix,
  data,
  lastScanFeedback,
  onUpdateTitle,
  onAddGroup,
  onUpdateGroup,
  onRemoveGroup,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
}: EditorPanelProps) {
  const tplSelectId = `${prefix}-tpl-select`;

  return (
    <div>
      <div className="input-row input-row--spaced">
        <div className="input-group">
          <label>Section Title</label>
          <input type="text" value={data.title} onChange={(e) => onUpdateTitle(e.target.value)} className="input-emphasis" />
        </div>
      </div>

      <Droppable droppableId={`groups-${prefix}`} type="group">
        {(provided) => (
          <div id={`${prefix}-groups-container`} {...provided.droppableProps} ref={provided.innerRef}>
            {data.groups.map((g, i) => (
              <ChargeGroupCard
                key={g.id}
                prefix={prefix}
                group={g}
                groupIdx={i}
                isNewlyAdded={lastScanFeedback?.target === prefix && lastScanFeedback?.groupIds?.includes(g.id)}
                onUpdateGroup={(idx, f, v) => onUpdateGroup(idx, f, v)}
                onRemoveGroup={(idx) => onRemoveGroup(idx)}
                onUpdateRow={(gi, ri, f, v) => onUpdateRow(gi, ri, f, v)}
                onRemoveRow={(gi, ri) => onRemoveRow(gi, ri)}
                onAddRow={(gi) => onAddRow(gi)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="preset-action-bar">
        <button className="btn-primary" onClick={() => onAddGroup(prefix, 'EMPTY')}>
          <Plus size={16} /> Add Item
        </button>
        <div className="preset-action-bar__or">
          <span className="label-or-preset">OR ADD PRESET:</span>
          <select id={tplSelectId} className="preset-action-bar__select">
            {Object.keys(CHARGE_TEMPLATES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary"
            onClick={() => {
              const sel = document.getElementById(tplSelectId) as HTMLSelectElement;
              onAddGroup(prefix, sel.value);
            }}
          >
            Add Charges Preset
          </button>
        </div>
      </div>
    </div>
  );
}

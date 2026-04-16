import React from 'react';
import { GripVertical, X, Divide, Plus, Clock } from 'lucide-react';
import { Group, Row, CURRENCIES, CONDITIONS, UNITS } from '../types';
import { Draggable, Droppable } from '@hello-pangea/dnd';

interface Props {
  prefix: string;
  group: Group;
  groupIdx: number;
  isNewlyAdded?: boolean;
  onUpdateGroup: (idx: number, field: keyof Group, val: any) => void;
  onRemoveGroup: (idx: number) => void;
  onUpdateRow: (gIdx: number, rIdx: number, field: keyof Row, val: any) => void;
  onRemoveRow: (gIdx: number, rIdx: number) => void;
  onAddRow: (gIdx: number) => void;
}

export const ChargeGroupCard: React.FC<Props> = ({
  prefix, group, groupIdx, isNewlyAdded, onUpdateGroup, onRemoveGroup, onUpdateRow, onRemoveRow, onAddRow
}) => {
  return (
    <Draggable draggableId={`group-${prefix}-${group.id}`} index={groupIdx}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`charge-group-card${isNewlyAdded ? ' just-scanned' : ''}${snapshot.isDragging ? ' dragging' : ''}`}
          style={{ ...provided.draggableProps.style }}
        >
          {/* HEADER MATCHING HTML STRUCTURE */}
          <div className="cg-header">
            <div className="cg-header__title-row">
              <span 
                 className="group-drag-handle" 
                 {...provided.dragHandleProps}
                 title="Drag to reorder group"
              >
                <GripVertical size={16} />
              </span>
          <input 
            type="text" 
            className="cg-title-input" 
            value={group.title} 
            onChange={(e) => onUpdateGroup(groupIdx, 'title', e.target.value)} 
          />
        </div>
        
        <div className="cg-controls">
          <select 
            className="cg-select--currency"
            value={group.currency} 
            onChange={(e) => onUpdateGroup(groupIdx, 'currency', e.target.value)}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="cg-select--logic"
            value={group.logic} 
            onChange={(e) => onUpdateGroup(groupIdx, 'logic', e.target.value)}
          >
            <option value="MAX">Highest Wins</option>
            <option value="SUM">Sum All</option>
          </select>

          <button className="btn-icon-only btn-danger" onClick={() => onRemoveGroup(groupIdx)}><X size={16} /></button>
        </div>
      </div>

      {/* BODY */}
      <div className="cg-body">
        <div className="cg-header-row">
          <span></span><span>RATE</span><span>UNIT</span><span>CONDITION</span><span>ROUND</span><span>MIN SETTINGS</span><span></span>
        </div>

        <Droppable droppableId={`rows-${prefix}-${groupIdx}`} type="row">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {group.rows.map((row, rIdx) => {
                  const isMin = row.condition === 'MIN';
                  const isPercent = (row.unit || '').includes('%');
                  const mType = row.min_type || 'AMT';
                  const hasMinVal = (row.min_qty || 0) > 0;
                  const rateIsZero = !(parseFloat(row.rate as any) > 0);

                  let minBoxClass = 'min-settings-box';
                  if(isMin) minBoxClass += ' active-min';
                  else if(hasMinVal) minBoxClass += ' has-value';
                  else minBoxClass += ' inactive';

                  return (
                    <Draggable key={row.id} draggableId={`row-${prefix}-${groupIdx}-${row.id}`} index={rIdx}>
                      {(providedRow, snapshotRow) => (
                        <div 
                          ref={providedRow.innerRef}
                          {...providedRow.draggableProps}
                          className={`cg-row${snapshotRow.isDragging ? ' dragging' : ''}`}
                          style={{ ...providedRow.draggableProps.style }}
                        >
                          <span 
                            className="row-drag-handle" 
                            {...providedRow.dragHandleProps}
                            title="Drag to reorder row"
                          >
                            <GripVertical size={16} />
                          </span>

                          {/* RATE INPUT WITH DIVISOR + PER-ROW MULTIPLIER */}
                <div className="rate-input-wrapper">
                  {row.use_divisor && !isPercent ? (
                    <>
                      <input 
                        type="number" 
                        className={`rate-main${rateIsZero ? ' input-warning' : ''}`}
                        value={row.rate} 
                        placeholder="Rate" 
                        title={rateIsZero ? 'Rate is 0 — this row will not appear in the report' : undefined}
                        onChange={(e) => onUpdateRow(groupIdx, rIdx, 'rate', e.target.value)} 
                      />
                      <span className="rate-divider">/</span>
                      <input 
                        type="number" 
                        className="rate-divisor" 
                        value={row.divisor} 
                        placeholder="Div" 
                        onChange={(e) => onUpdateRow(groupIdx, rIdx, 'divisor', e.target.value)} 
                      />
                      <button 
                        type="button"
                        className="btn-icon-only btn-remove-divisor"
                        onClick={() => onUpdateRow(groupIdx, rIdx, 'use_divisor', false)}
                        title="Remove Divisor"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <input 
                        type="number" 
                        className={`rate-main${rateIsZero ? ' input-warning' : ''}`}
                        value={row.rate} 
                        placeholder="0.00" 
                        title={rateIsZero ? 'Rate is 0 — this row will not appear in the report' : undefined}
                        onChange={(e) => onUpdateRow(groupIdx, rIdx, 'rate', e.target.value)} 
                      />
                      {!isPercent && (
                        <button
                          className="btn-enable-div rate-chip"
                          onClick={() => onUpdateRow(groupIdx, rIdx, 'use_divisor', true)}
                          title="Split the rate over N units, e.g. $80 per 1000 KG"
                        >
                          <Divide size={12} aria-hidden />
                          <span className="btn-enable-div__label">per N</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Per-row × qty multiplier — not shown for percentages
                      (silently ignored by the engine) or for MIN-condition rows
                      (would amplify the floor, which is rarely intended). */}
                  {!isPercent && !isMin && (row.multiplier_active ? (
                    <div className="rate-mult-box" title="Row multiplied by this value (e.g. days, shipments)">
                      <span className="rate-mult-box__sign">×</span>
                      <input
                        type="number"
                        className="rate-mult-box__value"
                        min={1}
                        value={row.multiplier_value ?? 1}
                        onChange={(e) => onUpdateRow(groupIdx, rIdx, 'multiplier_value', e.target.value)}
                      />
                      <button
                        type="button"
                        className="rate-mult-box__remove"
                        onClick={() => onUpdateRow(groupIdx, rIdx, 'multiplier_active', false)}
                        title="Remove multiplier"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-enable-mult rate-chip"
                      onClick={() => {
                        onUpdateRow(groupIdx, rIdx, 'multiplier_active', true);
                        if (row.multiplier_value === undefined || row.multiplier_value === null) {
                          onUpdateRow(groupIdx, rIdx, 'multiplier_value', 1);
                        }
                      }}
                      title="Apply a time/qty multiplier to this row (e.g. storage × 3 days)"
                    >
                      <Clock size={12} aria-hidden />
                      <span className="btn-enable-mult__label">× qty</span>
                    </button>
                  ))}
                </div>

                <select 
                  value={row.unit} 
                  onChange={(e) => onUpdateRow(groupIdx, rIdx, 'unit', e.target.value)}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>

                <select 
                  value={row.condition} 
                  onChange={(e) => onUpdateRow(groupIdx, rIdx, 'condition', e.target.value)}
                >
                  {Object.entries(CONDITIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                {['CBM', 'TON', 'RT', 'KGS'].includes(row.unit) ? (
                  <div className="round-up-row">
                    <input 
                      type="checkbox" 
                      className="input-round-checkbox"
                      checked={!!row.round_up} 
                      onChange={(e) => {
                        onUpdateRow(groupIdx, rIdx, 'round_up', e.target.checked);
                        if (e.target.checked && row.round_up_decimals === undefined) {
                          onUpdateRow(groupIdx, rIdx, 'round_up_decimals', 0);
                        }
                      }} 
                      title="Round up unit"
                    />
                    {row.round_up && (
                      <select 
                        value={row.round_up_decimals || 0} 
                        onChange={(e) => onUpdateRow(groupIdx, rIdx, 'round_up_decimals', parseInt(e.target.value))}
                        className="select-round-decimals"
                        title="Decimal places"
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <div></div>
                )}

                <div>
                  <div className={minBoxClass}>
                    <select 
                      className="min-type-select"
                      value={row.min_type}
                      onChange={(e) => onUpdateRow(groupIdx, rIdx, 'min_type', e.target.value)}
                    >
                      <option value="AMT">Fixed Amt</option>
                      <option value="QTY">Fixed Unit</option>
                    </select>
                    <input 
                      type="number" 
                      value={row.min_qty || ''} 
                      className="min-qty-input"
                      placeholder={mType === 'QTY' ? 'Units' : 'Opt. Min'}
                      onChange={(e) => onUpdateRow(groupIdx, rIdx, 'min_qty', e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="button"
                  className="btn-icon-only btn-icon-only--danger"
                  onClick={() => onRemoveRow(groupIdx, rIdx)}
                >
                  <X size={16} />
                </button>
              </div>
                      )}
                    </Draggable>
            );
        })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      <button className="btn-add-row" onClick={() => onAddRow(groupIdx)}>
        <Plus size={14} /> Add Condition Row
      </button>
    </div>
      )}
    </Draggable>
  );
};

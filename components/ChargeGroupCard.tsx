import React, { useRef } from 'react';
import { GripVertical, X, Clock, Divide, Plus } from 'lucide-react';
import { Group, Row, CURRENCIES, CONDITIONS, UNITS } from '../types';

interface Props {
  prefix: string;
  group: Group;
  groupIdx: number;
  onUpdateGroup: (idx: number, field: keyof Group, val: any) => void;
  onRemoveGroup: (idx: number) => void;
  onUpdateRow: (gIdx: number, rIdx: number, field: keyof Row, val: any) => void;
  onRemoveRow: (gIdx: number, rIdx: number) => void;
  onAddRow: (gIdx: number) => void;
  onDragStart: (e: React.DragEvent, type: 'group' | 'row', gIdx: number, rIdx?: number) => void;
  onDrop: (e: React.DragEvent, type: 'group' | 'row', gIdx: number, rIdx?: number) => void;
}

export const ChargeGroupCard: React.FC<Props> = ({
  prefix, group, groupIdx, onUpdateGroup, onRemoveGroup, onUpdateRow, onRemoveRow, onAddRow, onDragStart, onDrop
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const handleDragOver = (e: React.DragEvent) => {
    // Only show group-level preview when a GROUP is being dragged
    if (!e.dataTransfer.types.includes('text/plain')) return;

    const payload = e.dataTransfer.getData('text/plain') || '';
    const isGroupDrag = payload.startsWith('group-');
    
    if (isGroupDrag) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent, rIdx?: number) => {
    e.preventDefault();
    e.stopPropagation();

    const payload = e.dataTransfer.getData('text/plain') || '';
    const isRowDrag = payload.startsWith('row-');
    const isGroupDrag = payload.startsWith('group-');

    e.currentTarget.classList.remove('drag-over');

    // Route drop based on what is actually being dragged
    if (rIdx !== undefined && isRowDrag) {
      onDrop(e, 'row', groupIdx, rIdx);
    } else if (rIdx === undefined && isGroupDrag) {
      onDrop(e, 'group', groupIdx);
    }
  };

  const handleRowDragOver = (e: React.DragEvent, rowEl: HTMLElement) => {
    // Only show row-level preview when a ROW is being dragged
    if (!e.dataTransfer.types.includes('text/plain')) return;

    const payload = e.dataTransfer.getData('text/plain') || '';
    const isRowDrag = payload.startsWith('row-');

    if (isRowDrag) {
      e.preventDefault();
      e.stopPropagation();
      rowEl.classList.add('row-drag-over');
    }
  }

  const handleRowDragLeave = (e: React.DragEvent, rowEl: HTMLElement) => {
    rowEl.classList.remove('row-drag-over');
  }

  return (
    <div 
      ref={cardRef}
      className="charge-group-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e)}
    >
      {/* HEADER MATCHING HTML STRUCTURE */}
      <div className="cg-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
             className="group-drag-handle" 
             draggable 
             onDragStart={(e) => { 
                 e.stopPropagation(); 
                 e.dataTransfer.setData('text/plain', `group-${prefix}-${groupIdx}`);
                 e.dataTransfer.effectAllowed = 'move';

                 // Set drag image to the whole card
                 if (cardRef.current) {
                     e.dataTransfer.setDragImage(cardRef.current, 20, 20);
                     // Defer styling to allow browser to capture drag image first
                     setTimeout(() => cardRef.current?.classList.add('dragging'), 0);
                 }

                 onDragStart(e, 'group', groupIdx); 
             }}
             onDragEnd={(e) => {
                 if (cardRef.current) cardRef.current.classList.remove('dragging');
             }}
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
          {group.multiplier_active ? (
            <div className="multiplier-box">
              <span>×</span>
              <input 
                type="number" 
                value={group.multiplier_value} 
                style={{ width: '50px', padding: '2px', border: '1px solid #bae6fd', fontSize: '11px' }}
                onChange={(e) => onUpdateGroup(groupIdx, 'multiplier_value', e.target.value)}
              />
              <span 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                onClick={() => onUpdateGroup(groupIdx, 'multiplier_active', false)} 
                title="Remove Multiplier"
              >
                <X size={14} />
              </span>
            </div>
          ) : (
            <button 
              className="btn-icon-only" 
              style={{ border: '1px solid var(--border)' }}
              onClick={() => onUpdateGroup(groupIdx, 'multiplier_active', true)}
              title="Add Time/Qty Multiplier"
            >
              <Clock size={14} />
            </button>
          )}

          <select 
            style={{ width: '60px', padding: '4px' }}
            value={group.currency} 
            onChange={(e) => onUpdateGroup(groupIdx, 'currency', e.target.value)}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            style={{ width: '110px', padding: '4px' }}
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
          <span></span><span>RATE</span><span>UNIT</span><span>CONDITION</span><span>MIN SETTINGS</span><span></span>
        </div>

        {group.rows.map((row, rIdx) => {
            const isMin = row.condition === 'MIN';
            const mType = row.min_type || 'AMT';
            const hasMinVal = (row.min_qty || 0) > 0;
            
            let minBoxClass = 'min-settings-box';
            if(isMin) minBoxClass += ' active-min';
            else if(hasMinVal) minBoxClass += ' has-value';
            else minBoxClass += ' inactive';

            return (
              <div 
                key={rIdx}
                className="cg-row"
                onDragOver={(e) => handleRowDragOver(e, e.currentTarget as HTMLElement)}
                onDragLeave={(e) => handleRowDragLeave(e, e.currentTarget as HTMLElement)}
                onDrop={(e) => {
                   e.currentTarget.classList.remove('row-drag-over');
                   handleDrop(e, rIdx);
                }}
              >
                <span 
                  className="row-drag-handle" 
                  draggable 
                  onDragStart={(e) => { 
                    e.stopPropagation(); 
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', `row-${prefix}-${groupIdx}-${rIdx}`); // Tag payload
                    
                    // Add visual feedback class to the row itself
                    e.currentTarget.parentElement?.classList.add('row-dragging'); 
                    
                    onDragStart(e, 'row', groupIdx, rIdx); 
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.parentElement?.classList.remove('row-dragging');
                  }}
                  title="Drag to reorder row"
                >
                  <GripVertical size={16} />
                </span>

                {/* RATE INPUT WITH DIVISOR LOGIC */}
                {row.use_divisor ? (
                  <div className="rate-input-wrapper">
                    <input 
                      type="number" 
                      className="rate-main" 
                      value={row.rate} 
                      placeholder="Rate" 
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
                      className="btn-icon-only" 
                      style={{ width: '24px', height: '100%', marginLeft: '2px', color: 'var(--danger)' }}
                      onClick={() => onUpdateRow(groupIdx, rIdx, 'use_divisor', false)}
                      title="Remove Divisor"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="rate-input-wrapper">
                    <input 
                      type="number" 
                      className="rate-main" 
                      value={row.rate} 
                      placeholder="0.00" 
                      onChange={(e) => onUpdateRow(groupIdx, rIdx, 'rate', e.target.value)} 
                    />
                    <button 
                      className="btn-enable-div" 
                      onClick={() => onUpdateRow(groupIdx, rIdx, 'use_divisor', true)}
                      title="Add Divisor (Per X)"
                    >
                      <Divide size={14} />
                    </button>
                  </div>
                )}

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

                <div>
                  <div className={minBoxClass}>
                    <select 
                      style={{ width: '85px', fontSize: '10px', padding: '2px' }}
                      value={row.min_type}
                      onChange={(e) => onUpdateRow(groupIdx, rIdx, 'min_type', e.target.value)}
                    >
                      <option value="AMT">Fixed Amt</option>
                      <option value="QTY">Fixed Unit</option>
                    </select>
                    <input 
                      type="number" 
                      value={row.min_qty || ''} 
                      style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
                      placeholder={mType === 'QTY' ? 'Units' : 'Opt. Min'}
                      onChange={(e) => onUpdateRow(groupIdx, rIdx, 'min_qty', e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  className="btn-icon-only" 
                  style={{ color: 'var(--danger)' }}
                  onClick={() => onRemoveRow(groupIdx, rIdx)}
                >
                  <X size={16} />
                </button>
              </div>
            );
        })}
      </div>

      <button className="btn-add-row" onClick={() => onAddRow(groupIdx)}>
        <Plus size={14} /> Add Condition Row
      </button>
    </div>
  );
};

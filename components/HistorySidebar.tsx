import React from 'react';
import { Download, Upload, Trash2, X } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistorySidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (next: boolean) => void;
  historyView: 'saved' | 'imported';
  setHistoryView: (view: 'saved' | 'imported') => void;
  history: HistoryItem[];
  importedHistory: HistoryItem[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  activeHistoryList: HistoryItem[];
  onExportCurrentHistory: () => void;
  onImportClick: () => void;
  onImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCurrentHistory: () => void;
  onLoadHistory: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: number) => void;
}

export function HistorySidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  historyView,
  setHistoryView,
  history,
  importedHistory,
  searchTerm,
  setSearchTerm,
  activeHistoryList,
  onExportCurrentHistory,
  onImportClick,
  onImportFileChange,
  onClearCurrentHistory,
  onLoadHistory,
  onDeleteHistoryItem,
}: HistorySidebarProps) {
  const filtered = activeHistoryList.filter((h) => h.ref.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`history-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-head">
        <h4>History</h4>
        <div className="sidebar-head-actions">
          <button type="button" className="btn-secondary btn-icon-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="sidebar-tabs">
        <div className={`sidebar-tab ${historyView === 'saved' ? 'active' : ''}`} onClick={() => setHistoryView('saved')}>
          Saved ({history.length})
        </div>
        {importedHistory.length > 0 && (
          <div className={`sidebar-tab ${historyView === 'imported' ? 'active' : ''}`} onClick={() => setHistoryView('imported')}>
            Imported ({importedHistory.length})
          </div>
        )}
      </div>

      <div className="history-toolbar">
        <button type="button" className="btn-info" onClick={onExportCurrentHistory} title={`Export ${historyView}`}>
          <Download size={12} /> Export
        </button>
        <button type="button" className="btn-dark" onClick={onImportClick} title="Import (Temp View)">
          <Upload size={12} /> Import
        </button>
        <input id="hist-import" type="file" className="visually-hidden-file" accept=".json" onChange={onImportFileChange} />
        <button type="button" className="btn-secondary" onClick={onClearCurrentHistory} title={`Clear ${historyView}`}>
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <input type="text" className="history-search" placeholder="Search Ref#..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

      <div id="history-list">
        {filtered.length === 0 && (
          <div className="empty-state empty-state--padded">
            {historyView === 'saved' ? (
              <>
                <strong>No snapshots yet</strong>
                <p>
                  Compare standard vs requested charges, then click <strong>Snap</strong> to save a snapshot here for quick recall.
                </p>
              </>
            ) : (
              <>
                <strong>No imported file loaded</strong>
                <p>
                  Use <strong>Import</strong> to load a history JSON from another device. It appears here temporarily and won't replace your saved history.
                </p>
              </>
            )}
          </div>
        )}
        {filtered.map((h) => (
          <div key={h.id} className="history-card" onClick={() => onLoadHistory(h)}>
            <button
              className="btn-hist-del"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteHistoryItem(h.id);
              }}
            >
              <X size={14} />
            </button>
            <span className="history-ref">{h.ref}</span>
            <div className="history-meta">
              {h.timestamp} | {h.cbm}m³ | {h.kgs}kg | {h.pkgs}pkgs
            </div>
            <div className="history-res">
              {Object.entries(h.summary).map(([curr, val]) => (
                <div key={curr} className="history-diff-line">
                  <span>
                    {curr} {val.std.toFixed(2)}
                  </span>
                  <span className={`history-diff-line__delta ${val.diff >= 0 ? 'history-diff-line__delta--pos' : 'history-diff-line__delta--neg'}`}>
                    {val.diff >= 0 ? '+' : ''}
                    {val.diff.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

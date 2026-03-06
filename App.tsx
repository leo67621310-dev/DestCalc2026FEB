import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, History as HistoryIcon, Camera, Bot, Settings, ChevronUp, ChevronDown, Download, Upload, Trash2, X, Plus } from 'lucide-react';
import { ChargeData, Group, HistoryItem, CHARGE_TEMPLATES, CURRENCIES, DEFAULT_PRESETS, PresetsMap } from './types';
import { calculateCharges } from './utils/calculations';
import { ChargeGroupCard } from './components/ChargeGroupCard';

const STORAGE_KEY = 'fcc_v5_modular_react';

const EMPTY_STRUCTURE: ChargeData = { groups: [], title: '' };

export default function App() {
  // --- STATE ---
  const [stdData, setStdData] = useState<ChargeData>({ title: "Standard Charges", groups: [] });
  const [reqData, setReqData] = useState<ChargeData>({ title: "Requested Charges", groups: [] });
  const [mgrData, setMgrData] = useState<ChargeData>({ title: "New Template", groups: [] });
  const [savedPresets, setSavedPresets] = useState<PresetsMap>(DEFAULT_PRESETS);
  
  const [activeTab, setActiveTab] = useState<'std' | 'req' | 'mgr'>('std');
  
  const [globals, setGlobals] = useState({ cbm: 3.000, kgs: 250.0, pkgs: 3, ref: '' });
  const [viewMode, setViewMode] = useState('Comparison');
  const [showInlineDiff, setShowInlineDiff] = useState(false);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [reasoning, setReasoning] = useState('low');
  
  // HISTORY STATES
  const [history, setHistory] = useState<HistoryItem[]>([]); // Saved in localStorage
  const [importedHistory, setImportedHistory] = useState<HistoryItem[]>([]); // Temp session cache
  const [historyView, setHistoryView] = useState<'saved' | 'imported'>('saved'); // Active tab
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [toast, setToast] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // --- DRAG STATE ---
  const dragItem = useRef<{ type: 'group' | 'row', prefix: string, gIdx: number, rIdx?: number } | null>(null);

  // --- INIT & PERSIST ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStdData(parsed.std || EMPTY_STRUCTURE);
        setReqData(parsed.req || EMPTY_STRUCTURE);
        setSavedPresets(parsed.presets || DEFAULT_PRESETS);
        setHistory(parsed.history || []);
        if (parsed.globals) setGlobals(parsed.globals);
      } catch (e) {
        console.error("Load error", e);
      }
    }
  }, []);

  useEffect(() => {
    const state = { std: stdData, req: reqData, presets: savedPresets, history, globals };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [stdData, reqData, savedPresets, history, globals]);

  // --- HELPERS ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getTarget = (tab: string) => {
    if (tab === 'std') return { data: stdData, set: setStdData };
    if (tab === 'req') return { data: reqData, set: setReqData };
    return { data: mgrData, set: setMgrData };
  };

  // --- ACTIONS ---
  const handleUpdateGroup = (prefix: string, idx: number, field: keyof Group, val: any) => {
    const { data, set } = getTarget(prefix);
    const newGroups = [...data.groups];
    newGroups[idx] = { ...newGroups[idx], [field]: val };
    set({ ...data, groups: newGroups });
  };

  const handleUpdateRow = (prefix: string, gIdx: number, rIdx: number, field: any, val: any) => {
    const { data, set } = getTarget(prefix);
    const newGroups = [...data.groups];
    
    if (field === 'use_divisor') {
       newGroups[gIdx].rows[rIdx] = { ...newGroups[gIdx].rows[rIdx], use_divisor: val, divisor: val ? newGroups[gIdx].rows[rIdx].divisor : 1 };
    } else {
       newGroups[gIdx].rows[rIdx] = { ...newGroups[gIdx].rows[rIdx], [field]: val };
    }
    set({ ...data, groups: newGroups });
  };

  const addGroup = (prefix: string, templateKey: string = "EMPTY") => {
    const { data, set } = getTarget(prefix);
    const tpl = CHARGE_TEMPLATES[templateKey] || CHARGE_TEMPLATES["EMPTY"];
    const newGroup = JSON.parse(JSON.stringify({ ...tpl, id: 'g_' + Date.now() }));
    set({ ...data, groups: [...data.groups, newGroup] });
  };

  const addRow = (prefix: string, gIdx: number) => {
    const { data, set } = getTarget(prefix);
    const newGroups = [...data.groups];
    newGroups[gIdx].rows.push({ rate: 0, divisor: 1, use_divisor: false, unit: 'FLAT', condition: 'NONE', min_type: 'AMT', min_qty: 0 });
    set({ ...data, groups: newGroups });
  };

  const removeGroup = (prefix: string, idx: number) => {
    const { data, set } = getTarget(prefix);
    const ng = [...data.groups]; ng.splice(idx, 1);
    set({ ...data, groups: ng });
  };

  const removeRow = (prefix: string, gIdx: number, rIdx: number) => {
    const { data, set } = getTarget(prefix);
    const ng = [...data.groups]; ng[gIdx].rows.splice(rIdx, 1);
    set({ ...data, groups: ng });
  };

  // --- PRESETS ---
  const [mgrSelectedKey, setMgrSelectedKey] = useState('Create New...');
  const [mgrNameInput, setMgrNameInput] = useState('');

  const loadPresetToTab = (prefix: string, key: string) => {
    if (savedPresets[key]) {
      const { set } = getTarget(prefix);
      set(JSON.parse(JSON.stringify(savedPresets[key])));
      showToast(`✅ Loaded ${key}`);
    }
  };

  const handleMgrSelectChange = (key: string) => {
    setMgrSelectedKey(key);
    if (key === 'Create New...') {
      setMgrData(JSON.parse(JSON.stringify(EMPTY_STRUCTURE)));
      setMgrNameInput('');
    } else {
      setMgrData(JSON.parse(JSON.stringify(savedPresets[key])));
      setMgrNameInput(key);
    }
  };

  const savePreset = () => {
    if (!mgrNameInput.trim()) return alert("Name required");
    const newPresets = { ...savedPresets, [mgrNameInput]: JSON.parse(JSON.stringify(mgrData)) };
    setSavedPresets(newPresets);
    setMgrSelectedKey(mgrNameInput);
    showToast(`✅ Saved Preset: ${mgrNameInput}`);
  };

  const deletePreset = () => {
    if (mgrSelectedKey === 'Create New...' || !savedPresets[mgrSelectedKey]) return;
    const newPresets = { ...savedPresets };
    delete newPresets[mgrSelectedKey];
    setSavedPresets(newPresets);
    handleMgrSelectChange('Create New...');
    showToast("🗑️ Preset Deleted");
  };

  // --- SCANNING ---
  const addGroupsToTarget = (prefix: string, newGroups: Group[]) => {
      if (prefix === 'std') {
          setStdData(prev => ({ ...prev, groups: [...prev.groups, ...newGroups] }));
      } else if (prefix === 'req') {
          setReqData(prev => ({ ...prev, groups: [...prev.groups, ...newGroups] }));
      } else {
          setMgrData(prev => ({ ...prev, groups: [...prev.groups, ...newGroups] }));
      }
  };

  const processScanFile = async (file: File, prefix: string) => {
    setIsScanning(true);
    showToast(`⏳ Processing image for ${prefix.toUpperCase()}...`);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type, model, reasoning })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        
        // Parse result
        const parsed = JSON.parse(result.text);
        
        // Map to structure
        const newGroups = (parsed.groups || []).map((g: any) => ({
            id: 'g_' + Math.random().toString(36).substr(2, 9),
            title: g.title || "Charge",
            currency: (g.currency || 'EUR').toUpperCase(),
            logic: g.logic || 'SUM',
            multiplier_active: !!g.is_storage,
            multiplier_value: g.min_days || 1,
            rows: (g.rows || []).map((r: any) => ({
                rate: r.rate || 0,
                divisor: r.divisor || 1,
                use_divisor: (r.divisor && r.divisor !== 1),
                unit: (r.unit || 'FLAT').toUpperCase().replace('M3','CBM').replace('KG','KGS').replace('TONS','TON').replace('LS','FLAT').replace('SHIPMENT','SHPT').replace('% GROUP', '% ITEM'),
                condition: r.condition || 'NONE',
                min_type: 'AMT',
                min_qty: 0
            }))
        }));

        addGroupsToTarget(prefix, newGroups);
        showToast(`✅ Added ${newGroups.length} groups.`);
      };
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>, prefix: string) => {
    const file = e.target.files?.[0];
    if (file) {
        await processScanFile(file, prefix);
        e.target.value = '';
    }
  };

  // --- PASTE LISTENER ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    processScanFile(file, activeTab);
                }
                break;
            }
        }
    };
    
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, model, reasoning]);


  // --- DRAG AND DROP ---
  const onDragStart = (e: React.DragEvent, type: 'group' | 'row', prefix: string, gIdx: number, rIdx?: number) => {
     dragItem.current = { type, prefix, gIdx, rIdx };
     e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e: React.DragEvent, type: 'group' | 'row', prefix: string, targetGIdx: number, targetRIdx?: number) => {
     const src = dragItem.current;
     if (!src || src.prefix !== prefix) return;

     const { data, set } = getTarget(prefix);
     const newGroups = [...data.groups];

     // Case 1: Reordering Groups
     if (type === 'group' && src.type === 'group') {
        const [moved] = newGroups.splice(src.gIdx, 1);
        newGroups.splice(targetGIdx, 0, moved);
        set({ ...data, groups: newGroups });
     } 
     // Case 2: Reordering Rows (Strictly within same group)
     else if (type === 'row' && src.type === 'row' && src.gIdx === targetGIdx) {
        const rows = newGroups[src.gIdx].rows;
        // Verify indices exist
        if (typeof src.rIdx === 'number' && typeof targetRIdx === 'number') {
            const [moved] = rows.splice(src.rIdx, 1);
            // Correct index if shifting down
            const finalIdx = (src.rIdx < targetRIdx) ? targetRIdx - 1 : targetRIdx;
            rows.splice(finalIdx, 0, moved);
            set({ ...data, groups: newGroups });
        }
     }
     dragItem.current = null;
  };

  // --- REPORTS ---
  const stdRes = calculateCharges(globals.cbm, globals.kgs, globals.pkgs, stdData.groups);
  const reqRes = calculateCharges(globals.cbm, globals.kgs, globals.pkgs, reqData.groups);

  const saveToHistory = () => {
    const summary: any = {};
    CURRENCIES.forEach(c => { 
        if(stdRes.totals[c] > 0 || reqRes.totals[c] > 0) {
            summary[c] = { std: stdRes.totals[c], diff: reqRes.totals[c] - stdRes.totals[c] }; 
        }
    });

    const newItem: HistoryItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ref: globals.ref || 'No Ref',
        cbm: globals.cbm, kgs: globals.kgs, pkgs: globals.pkgs,
        summary,
        snap_std: JSON.parse(JSON.stringify(stdData)),
        snap_req: JSON.parse(JSON.stringify(reqData))
    };
    // Always save to persistent history
    const newHist = [newItem, ...history].slice(0, 300);
    setHistory(newHist);
    // Switch to Saved view if we are on imported
    if (historyView === 'imported') setHistoryView('saved');
    showToast("📸 Snapshot Saved");
  };

  const loadHist = (item: HistoryItem) => {
      setGlobals({ ...globals, ref: item.ref, cbm: item.cbm, kgs: item.kgs, pkgs: item.pkgs });
      setStdData(item.snap_std);
      setReqData(item.snap_req);
      showToast("✅ History Restored");
  };

  const exportCurrentHistory = () => {
    // Export whichever view is active
    const dataToExport = historyView === 'saved' ? history : importedHistory;
    const label = historyView === 'saved' ? 'freight_history' : 'imported_history';
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✅ Exported ${dataToExport.length} records`);
  };

  const handleHistoryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (Array.isArray(imported)) {
           // Sort descending by ID
           imported.sort((a: any, b: any) => b.id - a.id);
           
           // Set to TEMPORARY state
           setImportedHistory(imported as HistoryItem[]);
           setHistoryView('imported');
           setSidebarCollapsed(false); // Open sidebar to see it
           showToast(`✅ Loaded ${imported.length} records temporarily`);
        } else {
           alert("Invalid history file format");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse history file");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };
  
  const deleteHistoryItem = (id: number) => {
     if (historyView === 'saved') {
         setHistory(history.filter(h => h.id !== id));
     } else {
         setImportedHistory(importedHistory.filter(h => h.id !== id));
     }
  };

  const clearCurrentHistory = () => {
      if (historyView === 'saved') {
          if(confirm("Clear All Saved History?")) setHistory([]);
      } else {
          if(confirm("Clear Imported View?")) {
              setImportedHistory([]);
              setHistoryView('saved'); // Switch back after clearing
          }
      }
  };

  // Determine active list for sidebar
  const activeHistoryList = historyView === 'saved' ? history : importedHistory;

  // --- RENDERERS ---
  const renderEditor = (prefix: string) => {
      const { data, set } = getTarget(prefix);
      return (
        <div>
          <div className="input-row" style={{ marginBottom: '20px' }}>
             <div className="input-group">
                 <label>Section Title</label>
                 <input type="text" value={data.title} onChange={e => set({...data, title: e.target.value})} style={{ fontWeight: 600 }} />
             </div>
          </div>
          
          <div id={`${prefix}-groups-container`}>
             {data.groups.map((g, i) => (
                 <ChargeGroupCard 
                    key={g.id}
                    prefix={prefix}
                    group={g}
                    groupIdx={i}
                    onUpdateGroup={(idx, f, v) => handleUpdateGroup(prefix, idx, f, v)}
                    onRemoveGroup={(idx) => removeGroup(prefix, idx)}
                    onUpdateRow={(gi, ri, f, v) => handleUpdateRow(prefix, gi, ri, f, v)}
                    onRemoveRow={(gi, ri) => removeRow(prefix, gi, ri)}
                    onAddRow={(gi) => addRow(prefix, gi)}
                    onDragStart={(e, t, g, r) => onDragStart(e, t, prefix, g, r)}
                    onDrop={(e, t, g, r) => onDrop(e, t, prefix, g, r)}
                 />
             ))}
          </div>

          <div style={{ marginTop: '20px', background: '#f8fafc', padding: '10px', border: '1px dashed var(--border)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
             <button className="btn-primary" onClick={() => addGroup(prefix, 'EMPTY')}><Plus size={16} /> Add Item</button>
             <div style={{ flex: 1, borderLeft: '1px solid #e2e8f0', paddingLeft: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                 <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', whiteSpace: 'nowrap' }}>OR ADD PRESET:</span>
                 <select id={`${prefix}-tpl-select`} style={{ flex: 1, minWidth: '150px' }}>
                    {Object.keys(CHARGE_TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                 </select>
                 <button className="btn-secondary" onClick={() => {
                     const sel = document.getElementById(`${prefix}-tpl-select`) as HTMLSelectElement;
                     addGroup(prefix, sel.value);
                 }}>Add Charges Preset</button>
             </div>
          </div>
        </div>
      );
  };

  const renderReportTable = (res: any, title: string, showDiff: boolean, diffRes?: any, minRows?: number, activeCurrencies: string[] = []) => {
      // Use passed activeCurrencies for consistent footer height/alignment
      // If not passed (single view), fall back to active in current result
      const currenciesToShow = activeCurrencies.length > 0 
          ? activeCurrencies 
          : CURRENCIES.filter(c => res.totals[c] > 0);
      
      // Calculate rows to render, adding padding if needed
      const displayRows = [...res.rows];
      if (minRows && displayRows.length < minRows) {
          const padCount = minRows - displayRows.length;
          for(let i=0; i<padCount; i++) {
              displayRows.push({ is_pad: true });
          }
      }

      return (
        <div className="report-card">
           <div className="table-title">{title}</div>
           <div className="table-wrapper">
             <table className="xl-table">
               <thead><tr><th className="xl-header col-item">Item</th><th className="xl-header col-desc">Description</th><th className="xl-header col-curr">Cur</th><th className="xl-header col-amt">Amount</th></tr></thead>
               <tbody>
                  {displayRows.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', padding:'20px', color:'#ccc'}}>No Charges</td></tr>}
                  {displayRows.map((r: any, i: number) => {
                    if (r.is_pad) {
                        return (
                            <tr key={`pad-${i}`} className="xl-row pad-row">
                                <td colSpan={4}>&nbsp;</td>
                            </tr>
                        )
                    }

                    let diffClass = '';
                    let diffAmountStr = '';
                    if (showInlineDiff && diffRes && showDiff) {
                        const match = diffRes.rows.find((dr: any) => dr.item === r.item && dr.curr === r.curr);
                        if (!match) {
                            diffClass = 'row-diff-new';
                            diffAmountStr = ' (New)';
                        } else if (r.amount > match.amount) {
                            diffClass = 'row-diff-higher';
                            diffAmountStr = ` (+${(r.amount - match.amount).toFixed(2)})`;
                        } else if (r.amount < match.amount) {
                            diffClass = 'row-diff-lower';
                            diffAmountStr = ` (${(r.amount - match.amount).toFixed(2)})`;
                        }
                    }

                    return (
                        <tr key={i} className={`xl-row ${diffClass}`}>
                        <td className="col-item">{r.item}</td>
                        <td className="col-desc">
                            {r.desc}
                            {r.subtext && <span className="calc-subtext"><span className="min-highlight">{r.subtext}</span></span>}
                        </td>
                        <td className="col-curr">{r.curr}</td>
                        <td className="col-amt">
                            {r.amount.toFixed(2)}
                            {diffAmountStr && <span style={{ fontSize: '11px', marginLeft: '6px', opacity: 0.8 }}>{diffAmountStr}</span>}
                        </td>
                        </tr>
                    )
                  })}
               </tbody>
             </table>
           </div>
           <div className="footer-container">
               <div className="footer-section totals">
                  {currenciesToShow.length > 0 ? currenciesToShow.map(c => (
                      <div key={c} className="stat-line">
                         <span className="stat-lbl">TOTAL {c}</span> <span className="stat-val">{res.totals[c]?.toFixed(2) || '0.00'}</span>
                      </div>
                  )) : <div className="stat-line"><span className="stat-lbl">TOTAL</span> <span className="stat-val">0.00</span></div>}
               </div>
               
               <div className="footer-section diffs" style={{ visibility: showDiff ? 'visible' : 'hidden' }}>
                  {currenciesToShow.length > 0 ? currenciesToShow.map(c => {
                      let d = 0;
                      if (showDiff && diffRes) {
                         d = (res.totals[c] || 0) - (diffRes.totals[c] || 0);
                      }
                      const sign = d >= 0 ? '+' : '';
                      return (
                        <div key={c} className="stat-line">
                            <span className="stat-lbl">DIFF {c}</span> <span className="stat-val">{sign}{d.toFixed(2)}</span>
                        </div>
                      )
                  }) : <div className="stat-line"><span className="stat-lbl">DIFF</span> <span className="stat-val">0.00</span></div>}
               </div>
           </div>
        </div>
      );
  };

  const maxRows = Math.max(stdRes.rows.length, reqRes.rows.length);
  const unionCurrencies = CURRENCIES.filter(c => stdRes.totals[c] > 0 || reqRes.totals[c] > 0);

  return (
    <>
      <div id="toast-container">{toast && <div className="toast">{toast}</div>}</div>
      
      <div className="app-wrapper">
        <div className="main-content">
           {/* HEADER & GLOBALS */}
           <div className="dashboard-header">
               <div className="header-row">
                  <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h3>Destination Charges Calculator</h3>
                          <span style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--border-light)', color: 'var(--secondary)', borderRadius: '6px', fontWeight: 600, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Bot size={12} />
                              {
                                model === 'gemini-3.1-pro-preview'
                                  ? 'Gemini 3.1 Pro'
                                  : model === 'gemini-3.1-flash-lite'
                                  ? 'Gemini 3.1 Flash Lite'
                                  : model === 'gemini-3-flash-preview'
                                  ? 'Gemini 3.0 Flash'
                                  : 'Gemini 2.5 Flash'
                              }
                          </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--secondary)' }}>Comparison & Generation Tool</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-danger" onClick={() => { if(confirm('Reset all data?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); }}} style={{ fontSize: '11px', padding: '6px 10px' }}><AlertTriangle size={14} /> Reset App</button>
                      <button className="btn-secondary" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                          <HistoryIcon size={16} /> History
                      </button>
                  </div>
               </div>

               <div className="global-inputs">
                  <div className="input-group" style={{ flex: 2, minWidth: '200px', borderRight: '1px solid var(--border)', paddingRight: '20px', marginRight: '10px' }}>
                      <label>Job Reference #</label>
                      <input type="text" value={globals.ref} onChange={e => setGlobals({...globals, ref: e.target.value})} placeholder="e.g. HMB-2023-001" />
                  </div>
                  <div className="input-group narrow">
                      <label>CBM (m³)</label>
                      <input type="number" value={globals.cbm} onChange={e => setGlobals({...globals, cbm: parseFloat(e.target.value)})} step="0.001" />
                  </div>
                  <div className="input-group narrow">
                      <label>KGS</label>
                      <input type="number" value={globals.kgs} onChange={e => setGlobals({...globals, kgs: parseFloat(e.target.value)})} step="0.001" />
                  </div>
                  <div className="input-group narrow">
                      <label>PKGS</label>
                      <input type="number" value={globals.pkgs} onChange={e => setGlobals({...globals, pkgs: parseFloat(e.target.value)})} step="1" />
                  </div>
                  <div className="input-group" style={{ flex: '0 0 auto', paddingBottom: '1px' }}>
                      <button className="btn-primary" onClick={saveToHistory} title="Save Snapshot">
                          <Camera size={16} /> Snap
                      </button>
                  </div>
               </div>
           </div>

           {/* TABS */}
           <div className="tabs">
              <div className={`tab-btn ${activeTab === 'std' ? 'active' : ''}`} onClick={() => setActiveTab('std')}>Standard (Left)</div>
              <div className={`tab-btn ${activeTab === 'req' ? 'active' : ''}`} onClick={() => setActiveTab('req')}>Requested (Right)</div>
              <div className={`tab-btn ${activeTab === 'mgr' ? 'active' : ''}`} onClick={() => setActiveTab('mgr')}>Manage Presets</div>
           </div>

           {/* TAB CONTENT */}
           {activeTab === 'std' && (
             <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                   <select id="std-load-select" style={{ maxWidth: '300px' }}>
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('std', (document.getElementById('std-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info" style={{ marginLeft: '10px' }} onClick={() => document.getElementById('scan-std')?.click()}>
                       <Bot size={16} /> Scan / Paste (Ctrl+V) {isScanning && '(Processing...)'}
                   </button>
                   <input id="scan-std" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'std')} />
                </div>
                {renderEditor('std')}
             </div>
           )}

           {activeTab === 'req' && (
             <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                   <select id="req-load-select" style={{ maxWidth: '300px' }}>
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('req', (document.getElementById('req-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info" style={{ marginLeft: '10px' }} onClick={() => document.getElementById('scan-req')?.click()}>
                       <Bot size={16} /> Scan / Paste (Ctrl+V) {isScanning && '(Processing...)'}
                   </button>
                   <input id="scan-req" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'req')} />
                </div>
                {renderEditor('req')}
             </div>
           )}

           {activeTab === 'mgr' && (
             <div>
                 <div style={{ background: '#fffbeb', color: '#92400e', padding: '12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #fcd34d', marginBottom: '20px' }}>
                    <strong>Tip:</strong> Select "Create New..." to start fresh, or select an existing preset to edit it. Changes are Auto-Saved.
                 </div>
                 <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', marginBottom: '20px' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                        <label>Select Preset</label>
                        <select value={mgrSelectedKey} onChange={(e) => handleMgrSelectChange(e.target.value)}>
                            <option>Create New...</option>
                            {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                        <label>Preset Name</label>
                        <input type="text" value={mgrNameInput} onChange={(e) => setMgrNameInput(e.target.value)} disabled={mgrSelectedKey !== 'Create New...'} placeholder="Enter Preset Name" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                         <button className="btn-info" onClick={() => document.getElementById('scan-mgr')?.click()} title="Scan into this Preset"><Bot size={16} /> Scan / Paste</button>
                         <input id="scan-mgr" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'mgr')} />
                         <button className="btn-success" onClick={savePreset}>Save Preset</button>
                         <button className="btn-danger" onClick={deletePreset}>Delete</button>
                    </div>
                 </div>
                 <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '20px 0' }} />
                 {renderEditor('mgr')}

                 <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <div style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => setAdvOpen(!advOpen)}>
                        <Settings size={14} />
                        <span>Advanced Options (Import/Export)</span>
                        {advOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                    {advOpen && (
                        <div style={{ marginTop: '15px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', display: 'block', marginBottom: '5px' }}>AI MODEL</label>
                                <select value={model} onChange={e => setModel(e.target.value)} style={{ width: '100%' }}>
                                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #e2e8f0' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', display: 'block', marginBottom: '5px' }}>
                                    REASONING EFFORT {(!model.includes('gemini-3')) && <span style={{fontWeight:'normal', color: '#ef4444'}}>(Not available for 2.5)</span>}
                                </label>
                                <select 
                                    value={reasoning} 
                                    onChange={e => setReasoning(e.target.value)} 
                                    style={{ width: '100%', opacity: model.includes('gemini-3') ? 1 : 0.5, cursor: model.includes('gemini-3') ? 'default' : 'not-allowed' }}
                                    disabled={!model.includes('gemini-3')}
                                >
                                    <option value="auto">Default (Auto)</option>
                                    <option value="low">Low (Fast)</option>
                                    <option value="high">High (Deep)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-info" onClick={() => {
                                    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(savedPresets,null,2)],{type:"application/json"})); a.download = "presets.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                }}>Export JSON</button>
                                <button className="btn-dark" onClick={() => document.getElementById('json-import')?.click()}>Import JSON</button>
                                <input id="json-import" type="file" style={{display:'none'}} accept=".json" onChange={(e) => {
                                    if(e.target.files?.[0]) {
                                        const r = new FileReader();
                                        r.onload = ev => { try { setSavedPresets({...savedPresets, ...JSON.parse(ev.target?.result as string)}); showToast("✅ Imported"); } catch(er){ console.error(er); } };
                                        r.readAsText(e.target.files[0]);
                                    }
                                }} />
                            </div>
                        </div>
                    )}
                 </div>
             </div>
           )}

           {/* OUTPUT */}
           <div style={{ marginTop: '30px', borderTop: '1px solid var(--border)', paddingTop: '25px', display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--secondary)' }}>VIEW MODE:</label>
                    <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} style={{ width: '220px' }}>
                        <option value="Comparison">Side-by-Side Comparison</option>
                        <option value="Standard">Standard Only</option>
                        <option value="Requested">Requested Only</option>
                    </select>
                </div>
                {viewMode === 'Comparison' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px', paddingLeft: '20px', borderLeft: '1px solid var(--border)' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="checkbox" checked={showInlineDiff} onChange={e => setShowInlineDiff(e.target.checked)} style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', boxShadow: 'none' }} />
                            Highlight Differences
                        </label>
                    </div>
                )}
           </div>
           
           <div className="xl-wrapper" style={{marginTop:'30px'}}>
              <div className="xl-info-box"><strong>SHIPMENT DETAILS:</strong>&nbsp;&nbsp; CBM: {globals.cbm.toFixed(3)} &nbsp;|&nbsp; KGS: {globals.kgs.toFixed(3)} &nbsp;|&nbsp; PKGS: {globals.pkgs}</div>
              {viewMode === 'Comparison' && (
                  <div className="comparison-container">
                      <div className="comparison-col">{renderReportTable(stdRes, stdData.title, false, undefined, maxRows, unionCurrencies)}</div>
                      <div className="comparison-col">{renderReportTable(reqRes, reqData.title, true, stdRes, maxRows, unionCurrencies)}</div>
                  </div>
              )}
              {viewMode === 'Standard' && renderReportTable(stdRes, stdData.title, false)}
              {viewMode === 'Requested' && renderReportTable(reqRes, reqData.title, false)}
           </div>

        </div>

        {/* SIDEBAR */}
        <div className={`history-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} id="sidebar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontWeight: 700 }}>History</h4>
                <div style={{ display: 'flex', gap: '4px' }}>
                   <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><X size={14} /></button>
                </div>
            </div>

            {/* HISTORY VIEW TABS */}
            <div className="sidebar-tabs">
                <div 
                    className={`sidebar-tab ${historyView === 'saved' ? 'active' : ''}`} 
                    onClick={() => setHistoryView('saved')}
                >
                    Saved ({history.length})
                </div>
                {importedHistory.length > 0 && (
                    <div 
                        className={`sidebar-tab ${historyView === 'imported' ? 'active' : ''}`} 
                        onClick={() => setHistoryView('imported')}
                    >
                        Imported ({importedHistory.length})
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                   <button className="btn-info" style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }} onClick={exportCurrentHistory} title={`Export ${historyView}`}><Download size={12} /> Export</button>
                   <button className="btn-dark" style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }} onClick={() => document.getElementById('hist-import')?.click()} title="Import (Temp View)"><Upload size={12} /> Import</button>
                   <input id="hist-import" type="file" style={{display:'none'}} accept=".json" onChange={handleHistoryImport} />
                   <button className="btn-secondary" style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }} onClick={clearCurrentHistory} title={`Clear ${historyView}`}><Trash2 size={12} /> Clear</button>
            </div>

            <input type="text" placeholder="Search Ref#..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ marginBottom: '15px' }} />
            
            <div id="history-list">
                {activeHistoryList.filter(h => h.ref.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && <div style={{ color: '#ccc', textAlign: 'center', marginTop: '20px' }}>No {historyView} History</div>}
                {activeHistoryList.filter(h => h.ref.toLowerCase().includes(searchTerm.toLowerCase())).map(h => {
                    return (
                        <div key={h.id} className="history-card" onClick={() => loadHist(h)}>
                            <button className="btn-hist-del" onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h.id); }}><X size={14} /></button>
                            <span className="history-ref">{h.ref}</span>
                            <div className="history-meta">{h.timestamp} | {h.cbm}m³ | {h.kgs}kg | {h.pkgs}pkgs</div>
                            <div className="history-res" style={{ fontSize: '11px' }}>
                                {Object.entries(h.summary).map(([curr, val]) => (
                                    <div key={curr} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{curr} {val.std.toFixed(2)}</span>
                                        <span style={{ color: val.diff >= 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                                            {val.diff >= 0 ? '+' : ''}{val.diff.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </>
  );
}

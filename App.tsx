import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, History as HistoryIcon, Camera, Bot, Settings, ChevronUp, ChevronDown, Download, Upload, Trash2, X, Plus, Image as ImageIcon } from 'lucide-react';
import { toJpeg } from 'html-to-image';
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
  const [lastScanFeedback, setLastScanFeedback] = useState<{ count: number; target: 'std' | 'req' | 'mgr'; groupIds: string[] } | null>(null);

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

  useEffect(() => {
    if (!lastScanFeedback) return;
    const t = setTimeout(() => setLastScanFeedback(null), 4500);
    return () => clearTimeout(t);
  }, [lastScanFeedback]);

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
    newGroups[gIdx].rows.push({ rate: 0, divisor: 1, use_divisor: false, unit: 'FLAT', condition: 'NONE', min_type: 'AMT', min_qty: 0, round_up: false, round_up_decimals: 0 });
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
    if (!mgrNameInput.trim()) return alert("Enter a preset name so you can find it later.");
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
                min_qty: 0,
                round_up: r.round_up || false,
                round_up_decimals: r.round_up_decimals !== undefined ? r.round_up_decimals : 0
            }))
        }));

        addGroupsToTarget(prefix, newGroups);
        showToast(`✅ Added ${newGroups.length} groups.`);
        setLastScanFeedback({ count: newGroups.length, target: prefix as 'std' | 'req' | 'mgr', groupIds: newGroups.map((gr: Group) => gr.id) });
      };
    } catch (err: any) {
      alert("Scan failed: " + (err?.message || "Something went wrong.") + " Use a clear image of a charges table or try again.");
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
           alert("That file isn't a valid history export. Choose a JSON file previously exported from this app.");
        }
      } catch (err) {
        console.error(err);
        alert("The file couldn't be read. Make sure it's a valid JSON file exported from this calculator.");
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
          if(confirm("Clear all saved snapshots? This can't be undone.")) setHistory([]);
      } else {
          if(confirm("Clear the imported list? You'll stay on Saved history.")) {
              setImportedHistory([]);
              setHistoryView('saved'); // Switch back after clearing
          }
      }
  };

  // Determine active list for sidebar
  const activeHistoryList = historyView === 'saved' ? history : importedHistory;

  // --- EXPORT IMAGE ---
  // Uses html-to-image (browser SVG snapshot) instead of html2canvas, which often breaks on
  // modern CSS such as oklch() used in index.css.
  const exportAsImage = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) {
      showToast('Could not find report area to export.');
      return;
    }
    try {
      showToast('Generating image…');
      const dataUrl = await toJpeg(el, {
        quality: 0.92,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Image downloaded');
    } catch (err) {
      console.error(err);
      alert('Export failed. If this keeps happening, try collapsing long tables or use the browser Print dialog instead.');
    }
  };

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
                    isNewlyAdded={lastScanFeedback?.target === prefix && lastScanFeedback?.groupIds?.includes(g.id)}
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

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
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
        <div className="report-card" id={`report-${title.replace(/\s+/g, '-')}`}>
           <div className="table-title">
               {title}
           </div>
           <div className="table-wrapper">
             <table className="xl-table">
               <thead><tr><th className="xl-header col-item">Item</th><th className="xl-header col-desc">Description</th><th className="xl-header col-curr">Cur</th><th className="xl-header col-amt">Amount</th></tr></thead>
               <tbody>
                  {displayRows.length === 0 && <tr><td colSpan={4}><div className="empty-state"><strong>No charge lines yet</strong><p>Add items above or load a preset to see totals and differences here.</p></div></td></tr>}
                  {displayRows.map((r: any, i: number) => {
                    if (r.is_pad) {
                        return (
                            <tr key={`pad-${i}`} className="xl-row pad-row">
                                <td colSpan={4}>&nbsp;</td>
                            </tr>
                        )
                    }

                    return (
                        <React.Fragment key={i}>
                        <tr 
                            className={`xl-row ${r.candidates && r.candidates.length > 0 ? 'expandable' : ''}`}
                            onClick={() => {
                                if (r.candidates && r.candidates.length > 0) {
                                    toggleRow(`${title}-${i}`);
                                }
                            }}
                        >
                        <td className="col-item">
                            {r.item}
                        </td>
                        <td className="col-desc">
                            {r.desc}
                            {r.subtext && <span className="calc-subtext"><span className="min-highlight">{r.subtext}</span></span>}
                        </td>
                        <td className="col-curr">{r.curr}</td>
                        <td className="col-amt">
                            {r.amount.toFixed(2)}
                        </td>
                        </tr>
                        {expandedRows[`${title}-${i}`] && r.candidates && (
                            <tr className="xl-row expanded-details-row">
                                <td colSpan={4} style={{ padding: 0 }}>
                                    <div className="expanded-details">
                                        <div className="expanded-header">Calculation Details</div>
                                        {r.candidates.map((c: any, cIdx: number) => (
                                            <div key={cIdx} className={`candidate-item ${c.is_winner ? 'winner' : ''}`}>
                                                <div className="candidate-desc">
                                                    <strong>{c.cond !== 'NONE' ? `[${c.cond}] ` : ''}</strong>
                                                    {c.desc}
                                                    {c.is_winner && <span className="winner-badge">Applied</span>}
                                                </div>
                                                <div className="candidate-calc">{c.calc_string}</div>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        )}
                        </React.Fragment>
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

  const unionCurrencies = CURRENCIES.filter(c => stdRes.totals[c] > 0 || reqRes.totals[c] > 0);

  /** Single merged table so each row index shares one tr — left/right cells stay horizontally aligned. */
  const renderComparisonTable = () => {
    const stdRows = stdRes.rows;
    const reqRows = reqRes.rows;
    const n = Math.max(stdRows.length, reqRows.length);
    const currenciesStd = CURRENCIES.filter(c => stdRes.totals[c] > 0);
    const currenciesReq = CURRENCIES.filter(c => reqRes.totals[c] > 0);

    const renderExpanded = (r: any, key: string) => {
      if (!r?.candidates?.length || !expandedRows[key]) return null;
      return (
        <div className="expanded-details">
          <div className="expanded-header">Calculation Details</div>
          {r.candidates.map((c: any, cIdx: number) => (
            <div key={cIdx} className={`candidate-item ${c.is_winner ? 'winner' : ''}`}>
              <div className="candidate-desc">
                <strong>{c.cond !== 'NONE' ? `[${c.cond}] ` : ''}</strong>
                {c.desc}
                {c.is_winner && <span className="winner-badge">Applied</span>}
              </div>
              <div className="candidate-calc">{c.calc_string}</div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="report-card report-card-comparison" id="report-comparison-merged">
        <div className="table-wrapper table-wrapper-comparison">
          <table className="xl-table xl-table-comparison">
            <thead>
              <tr>
                <th className="xl-header comparison-panel-title" colSpan={4}>{stdData.title.toUpperCase()}</th>
                <th className="xl-header comparison-panel-title comparison-divider" colSpan={4}>{reqData.title.toUpperCase()}</th>
              </tr>
              <tr>
                <th className="xl-header col-item">Item</th>
                <th className="xl-header col-desc">Description</th>
                <th className="xl-header col-curr">Cur</th>
                <th className="xl-header col-amt">Amount</th>
                <th className="xl-header col-item comparison-divider">Item</th>
                <th className="xl-header col-desc">Description</th>
                <th className="xl-header col-curr">Cur</th>
                <th className="xl-header col-amt">Amount</th>
              </tr>
            </thead>
            <tbody>
              {n === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <strong>No charge lines yet</strong>
                      <p>Add items above or load a preset to see totals and differences here.</p>
                    </div>
                  </td>
                </tr>
              )}
              {Array.from({ length: n }, (_, i) => {
                const l = stdRows[i];
                const rrow = reqRows[i];
                const lPad = !l || l.is_pad;
                const rPad = !rrow || rrow.is_pad;
                const lKey = `cmp-L-${i}`;
                const rKey = `cmp-R-${i}`;
                const lHas = !!(l && !l.is_pad && l.candidates?.length);
                const rHas = !!(rrow && !rrow.is_pad && rrow.candidates?.length);

                return (
                  <React.Fragment key={i}>
                    <tr
                      className={`xl-row comparison-pair-row ${i % 2 === 1 ? 'comparison-row-alt' : ''} ${lHas || rHas ? 'expandable' : ''}`}
                    >
                      {lPad ? (
                        <>
                          <td className="col-item comparison-cell-pad" colSpan={4}>&nbsp;</td>
                        </>
                      ) : (
                        <>
                          <td
                            className={`col-item ${lHas ? 'comparison-cell-interactive' : ''}`}
                            onClick={() => lHas && toggleRow(lKey)}
                          >
                            {l!.item}
                          </td>
                          <td
                            className={`col-desc ${lHas ? 'comparison-cell-interactive' : ''}`}
                            onClick={() => lHas && toggleRow(lKey)}
                          >
                            {l!.desc}
                            {l!.subtext && (
                              <span className="calc-subtext">
                                <span className="min-highlight">{l!.subtext}</span>
                              </span>
                            )}
                          </td>
                          <td className={`col-curr ${lHas ? 'comparison-cell-interactive' : ''}`} onClick={() => lHas && toggleRow(lKey)}>
                            {l!.curr}
                          </td>
                          <td className={`col-amt ${lHas ? 'comparison-cell-interactive' : ''}`} onClick={() => lHas && toggleRow(lKey)}>
                            {l!.amount.toFixed(2)}
                          </td>
                        </>
                      )}
                      {rPad ? (
                        <td className="col-item comparison-cell-pad comparison-divider" colSpan={4}>
                          &nbsp;
                        </td>
                      ) : (
                        <>
                          <td
                            className={`col-item comparison-divider ${rHas ? 'comparison-cell-interactive' : ''}`}
                            onClick={() => rHas && toggleRow(rKey)}
                          >
                            {rrow!.item}
                          </td>
                          <td
                            className={`col-desc ${rHas ? 'comparison-cell-interactive' : ''}`}
                            onClick={() => rHas && toggleRow(rKey)}
                          >
                            {rrow!.desc}
                            {rrow!.subtext && (
                              <span className="calc-subtext">
                                <span className="min-highlight">{rrow!.subtext}</span>
                              </span>
                            )}
                          </td>
                          <td className={`col-curr ${rHas ? 'comparison-cell-interactive' : ''}`} onClick={() => rHas && toggleRow(rKey)}>
                            {rrow!.curr}
                          </td>
                          <td className={`col-amt ${rHas ? 'comparison-cell-interactive' : ''}`} onClick={() => rHas && toggleRow(rKey)}>
                            {rrow!.amount.toFixed(2)}
                          </td>
                        </>
                      )}
                    </tr>
                    {(expandedRows[lKey] || expandedRows[rKey]) && (
                      <tr className="xl-row expanded-details-row comparison-expanded-row">
                        <td colSpan={4} style={{ padding: 0, verticalAlign: 'top' }}>
                          {renderExpanded(l, lKey)}
                        </td>
                        <td colSpan={4} className="comparison-divider" style={{ padding: 0, verticalAlign: 'top' }}>
                          {renderExpanded(rrow, rKey)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="comparison-footer-row">
                <td colSpan={4} className="comparison-footer-cell">
                  <div className="footer-section totals">
                    {currenciesStd.length > 0 ? (
                      currenciesStd.map(c => (
                        <div key={c} className="stat-line">
                          <span className="stat-lbl">TOTAL {c}</span>{' '}
                          <span className="stat-val">{stdRes.totals[c]?.toFixed(2) || '0.00'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="stat-line">
                        <span className="stat-lbl">TOTAL</span> <span className="stat-val">0.00</span>
                      </div>
                    )}
                  </div>
                </td>
                <td colSpan={4} className="comparison-footer-cell comparison-divider">
                  <div className="footer-section totals">
                    {currenciesReq.length > 0 ? (
                      currenciesReq.map(c => (
                        <div key={c} className="stat-line">
                          <span className="stat-lbl">TOTAL {c}</span>{' '}
                          <span className="stat-val">{reqRes.totals[c]?.toFixed(2) || '0.00'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="stat-line">
                        <span className="stat-lbl">TOTAL</span> <span className="stat-val">0.00</span>
                      </div>
                    )}
                  </div>
                  <div className="footer-section diffs">
                    {unionCurrencies.length > 0 ? (
                      unionCurrencies.map(c => {
                        const d = (reqRes.totals[c] || 0) - (stdRes.totals[c] || 0);
                        const sign = d >= 0 ? '+' : '';
                        return (
                          <div key={c} className="stat-line">
                            <span className="stat-lbl">DIFF {c}</span>{' '}
                            <span className="stat-val">
                              {sign}
                              {d.toFixed(2)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="stat-line">
                        <span className="stat-lbl">DIFF</span> <span className="stat-val">0.00</span>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
                                  : model === 'gemini-3.1-flash-lite-preview'
                                  ? 'Gemini 3.1 Flash Lite'
                                  : model === 'gemini-3-flash-preview'
                                  ? 'Gemini 3.0 Flash'
                                  : 'Gemini 2.5 Flash'
                              }
                          </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--secondary)' }}>Compare standard vs requested charges and see what to collect from agent or consignee.</span>
                      <span style={{ fontSize: '11px', color: 'var(--secondary)', opacity: 0.9, display: 'block', marginTop: '4px' }}>Enter shipment details, load or add charges for Standard and Requested, then check the DIFF totals below.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-danger" onClick={() => { if(confirm('Reset all data? Your presets and history will be cleared. This can\'t be undone.')) { localStorage.removeItem(STORAGE_KEY); location.reload(); }}} style={{ fontSize: '11px', padding: '6px 10px' }}><AlertTriangle size={14} /> Reset App</button>
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
                      <button className="btn-primary" onClick={saveToHistory} title="Save this comparison to history">
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                   <select id="std-load-select" style={{ maxWidth: '300px' }}>
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('std', (document.getElementById('std-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info" style={{ marginLeft: '10px' }} onClick={() => document.getElementById('scan-std')?.click()}>
                       <Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}
                   </button>
                   <input id="scan-std" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'std')} />
                </div>
                {lastScanFeedback?.target === 'std' && (
                   <div className="scan-feedback" role="status">{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                )}
                {renderEditor('std')}
             </div>
           )}

           {activeTab === 'req' && (
             <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                   <select id="req-load-select" style={{ maxWidth: '300px' }}>
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('req', (document.getElementById('req-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info" style={{ marginLeft: '10px' }} onClick={() => document.getElementById('scan-req')?.click()}>
                       <Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}
                   </button>
                   <input id="scan-req" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'req')} />
                </div>
                {lastScanFeedback?.target === 'req' && (
                   <div className="scan-feedback" role="status">{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                )}
                {renderEditor('req')}
             </div>
           )}

           {activeTab === 'mgr' && (
             <div>
                 <div style={{ background: '#fffbeb', color: '#92400e', padding: '12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #fcd34d', marginBottom: '20px' }}>
                    <strong>Presets:</strong> Choose <strong>Create New...</strong> to add a preset from scratch, or pick an existing one to edit. Saving overwrites that preset.
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
                        <input type="text" value={mgrNameInput} onChange={(e) => setMgrNameInput(e.target.value)} disabled={mgrSelectedKey !== 'Create New...'} placeholder="e.g. EU Dest 2024" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                         <button className="btn-info" onClick={() => document.getElementById('scan-mgr')?.click()} title="Add charges from a photo or pasted image"><Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}</button>
                         <input id="scan-mgr" type="file" style={{display:'none'}} accept="image/*" onChange={(e) => handleFileScan(e, 'mgr')} />
                         <button className="btn-success" onClick={savePreset}>Save Preset</button>
                         <button className="btn-danger" onClick={deletePreset}>Delete</button>
                    </div>
                 </div>
                 {lastScanFeedback?.target === 'mgr' && (
                   <div className="scan-feedback" role="status" style={{ marginBottom: '16px' }}>{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                 )}
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
                                    <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
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
           <div className="output-controls">
                <div className="output-controls-row">
                    <label className="output-controls-label" htmlFor="report-view-select">Report view</label>
                    <select id="report-view-select" value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="output-controls-select">
                        <option value="Comparison">Side-by-side (standard vs requested)</option>
                        <option value="Standard">Standard only</option>
                        <option value="Requested">Requested only</option>
                    </select>
                </div>
                <div className="output-controls-row">
                    <button type="button" className="btn-secondary" onClick={() => exportAsImage('full-report-area', `Freight-Report-${globals.ref || 'Export'}.jpg`)}>
                        <ImageIcon size={16} /> Export Report to JPG
                    </button>
                </div>
           </div>
           
           <div id="full-report-area" className={`xl-wrapper ${viewMode === 'Comparison' ? 'xl-wrapper-comparison' : 'report-single'}`} style={{marginTop:'20px', padding: '20px', backgroundColor: 'var(--bg-body)', borderRadius: '12px'}}>
              <div className="xl-info-box"><strong>SHIPMENT DETAILS:</strong>&nbsp;&nbsp; CBM: {globals.cbm.toFixed(3)} &nbsp;|&nbsp; KGS: {globals.kgs.toFixed(3)} &nbsp;|&nbsp; PKGS: {globals.pkgs}</div>
              {viewMode === 'Comparison' && renderComparisonTable()}
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
                {activeHistoryList.filter(h => h.ref.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <div className="empty-state" style={{ marginTop: '20px' }}>
                  {historyView === 'saved' ? (
                    <>
                      <strong>No snapshots yet</strong>
                      <p>Compare standard vs requested charges, then click <strong>Snap</strong> to save a snapshot here for quick recall.</p>
                    </>
                  ) : (
                    <>
                      <strong>No imported file loaded</strong>
                      <p>Use <strong>Import</strong> to load a history JSON from another device. It appears here temporarily and won't replace your saved history.</p>
                    </>
                  )}
                </div>
              )}
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

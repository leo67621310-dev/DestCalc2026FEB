import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, History as HistoryIcon, Camera, Bot, Settings, ChevronUp, ChevronDown, Image as ImageIcon, Zap, HelpCircle } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { ChargeData, Group, HistoryItem, CHARGE_TEMPLATES, CURRENCIES, DEFAULT_PRESETS, PresetsMap } from './types';
import { calculateCharges } from './utils/calculations';
import { ensureIds, mapScannedGroups } from './utils/dataTransforms';
import { ComparisonTable, ReportTable } from './components/ReportTables';
import { EditorPanel } from './components/EditorPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { HelpDrawer } from './components/HelpDrawer';

const STORAGE_KEY = 'fcc_v5_modular_react';

const EMPTY_STRUCTURE: ChargeData = { groups: [], title: '' };

export default function App() {
  type ToastType = 'info' | 'success' | 'warning' | 'error';
  type ToastEntry = { id: number; message: string; type: ToastType };

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
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const modelPopoverRef = useRef<HTMLDivElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const toastIdRef = useRef(0);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{ count: number; target: 'std' | 'req' | 'mgr'; groupIds: string[] } | null>(null);
  const scanDelayTimerRef = useRef<number | null>(null);

  // --- DRAG STATE ---
  const dragItem = useRef<{ type: 'group' | 'row', prefix: string, gIdx: number, rIdx?: number } | null>(null);

  // --- INIT & PERSIST ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        setStdData(ensureIds(parsed.std) || EMPTY_STRUCTURE);
        setReqData(ensureIds(parsed.req) || EMPTY_STRUCTURE);
        
        if (parsed.presets) {
           Object.values(parsed.presets).forEach((p: any) => ensureIds(p));
           setSavedPresets(parsed.presets);
        } else {
           setSavedPresets(DEFAULT_PRESETS);
        }
        
        if (parsed.history) {
            parsed.history.forEach((h: any) => {
                ensureIds(h.snap_std);
                ensureIds(h.snap_req);
            });
            setHistory(parsed.history);
        } else {
            setHistory([]);
        }
        
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

  // Close model popover on outside click or ESC
  useEffect(() => {
    if (!modelPopoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!modelPopoverRef.current) return;
      if (e.target instanceof Node && !modelPopoverRef.current.contains(e.target)) {
        setModelPopoverOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelPopoverOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [modelPopoverOpen]);

  const modelLabel =
    model === 'gemini-3.1-pro-preview'
      ? 'Gemini 3.1 Pro'
      : model === 'gemini-3.1-flash-lite-preview'
      ? 'Gemini 3.1 Flash Lite'
      : model === 'gemini-3-flash-preview'
      ? 'Gemini 3.0 Flash'
      : 'Gemini 2.5 Flash';

  // --- HELPERS ---
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => dismissToast(id), duration);
  };

  const clearScanDelayTimer = () => {
    if (scanDelayTimerRef.current !== null) {
      window.clearTimeout(scanDelayTimerRef.current);
      scanDelayTimerRef.current = null;
    }
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
    newGroup.rows.forEach((r: any) => r.id = 'r_' + Math.random().toString(36).substr(2, 9));
    set({ ...data, groups: [...data.groups, newGroup] });
  };

  const addRow = (prefix: string, gIdx: number) => {
    const { data, set } = getTarget(prefix);
    const newGroups = [...data.groups];
    newGroups[gIdx].rows.push({ id: 'r_' + Date.now(), rate: 0, divisor: 1, use_divisor: false, unit: 'FLAT', condition: 'NONE', min_type: 'AMT', min_qty: 0, round_up: false, round_up_decimals: 0 });
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
    showToast(`⏳ Processing image for ${prefix.toUpperCase()}...`, 'info', 3200);
    clearScanDelayTimer();
    scanDelayTimerRef.current = window.setTimeout(() => {
      showToast('Still scanning... this can take longer for larger images or slower API responses.', 'warning', 5000);
    }, 8000);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const encoded = dataUrl?.split(',')[1];
          if (!encoded) reject(new Error('Invalid image data.'));
          else resolve(encoded);
        };
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, model, reasoning })
      });

      let result: any = {};
      try {
        result = await res.json();
      } catch {
        throw new Error(`Scan service returned ${res.status} without valid JSON.`);
      }

      if (!res.ok) throw new Error(result?.error || `Scan request failed with ${res.status}.`);

      // Parse result
      const parsed = JSON.parse(result.text);

      // Map to structure
      const newGroups = mapScannedGroups(parsed);

      addGroupsToTarget(prefix, newGroups);
      showToast(`✅ Added ${newGroups.length} groups.`, 'success');
      setLastScanFeedback({ count: newGroups.length, target: prefix as 'std' | 'req' | 'mgr', groupIds: newGroups.map((gr: Group) => gr.id) });
    } catch (err: any) {
      showToast(`Scan failed: ${err?.message || 'Something went wrong.'} Use a clear image of a charges table or try again.`, 'error', 8000);
    } finally {
      clearScanDelayTimer();
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
  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;

    const sourcePrefix = source.droppableId.split('-')[1];
    const destPrefix = destination.droppableId.split('-')[1];

    if (sourcePrefix !== destPrefix) return; // Don't allow dragging between tabs

    const { data, set } = getTarget(sourcePrefix);
    const newGroups = [...data.groups];

    if (type === 'group') {
      const [moved] = newGroups.splice(source.index, 1);
      newGroups.splice(destination.index, 0, moved);
      set({ ...data, groups: newGroups });
    } else if (type === 'row') {
      const srcGIdx = parseInt(source.droppableId.split('-')[2], 10);
      const destGIdx = parseInt(destination.droppableId.split('-')[2], 10);

      if (srcGIdx === destGIdx) {
        const rows = [...newGroups[srcGIdx].rows];
        const [moved] = rows.splice(source.index, 1);
        rows.splice(destination.index, 0, moved);
        newGroups[srcGIdx] = { ...newGroups[srcGIdx], rows };
        set({ ...data, groups: newGroups });
      }
    }
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
           
            imported.forEach((h: any) => {
                ensureIds(h.snap_std);
                ensureIds(h.snap_req);
            });

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

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const unionCurrencies = CURRENCIES.filter(c => stdRes.totals[c] > 0 || reqRes.totals[c] > 0);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div id="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            role="status"
            onClick={() => dismissToast(t.id)}
            title="Dismiss"
          >
            {t.message}
          </div>
        ))}
      </div>
      
      <div className="app-wrapper">
        <div className="main-content">
           {/* HEADER & GLOBALS */}
           <div className="dashboard-header">
               <div className="header-row">
                  <div>
                      <div className="dashboard-title-row">
                          <h3>Destination Charges Calculator</h3>
                          <div className="model-badge-wrapper" ref={modelPopoverRef}>
                              <button
                                type="button"
                                className={`model-badge model-badge--interactive${modelPopoverOpen ? ' is-open' : ''}`}
                                onClick={() => setModelPopoverOpen((v) => !v)}
                                aria-haspopup="dialog"
                                aria-expanded={modelPopoverOpen}
                                title="Change scan model and reasoning effort"
                              >
                                  <Bot size={12} />
                                  {modelLabel}
                                  <ChevronDown size={12} aria-hidden />
                              </button>
                              {modelPopoverOpen && (
                                <div className="model-popover" role="dialog" aria-label="Scan model settings">
                                  <div className="model-popover__section">
                                    <label className="model-popover__label" htmlFor="model-popover-model">
                                      <Bot size={12} aria-hidden /> Model
                                    </label>
                                    <select
                                      id="model-popover-model"
                                      value={model}
                                      onChange={(e) => setModel(e.target.value)}
                                      className="model-popover__select"
                                    >
                                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                      <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                                      <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    </select>
                                  </div>
                                  <div className="model-popover__section">
                                    <label className="model-popover__label" htmlFor="model-popover-reasoning">
                                      <Zap size={12} aria-hidden /> Reasoning effort
                                      {!model.includes('gemini-3') && <span className="model-popover__hint">Not available for 2.5</span>}
                                    </label>
                                    <select
                                      id="model-popover-reasoning"
                                      value={reasoning}
                                      onChange={(e) => setReasoning(e.target.value)}
                                      className={`model-popover__select${!model.includes('gemini-3') ? ' model-popover__select--disabled' : ''}`}
                                      disabled={!model.includes('gemini-3')}
                                    >
                                      <option value="auto">Default (Auto)</option>
                                      <option value="low">Low (Fast)</option>
                                      <option value="high">High (Deep)</option>
                                    </select>
                                  </div>
                                  <div className="model-popover__footer">Used for image scans. Mirrored in Advanced Options.</div>
                                </div>
                              )}
                          </div>
                          <button
                            type="button"
                            className="help-trigger"
                            onClick={() => setHelpOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={helpOpen}
                            title="Open the help guide — units, conditions, formulas, examples"
                          >
                            <HelpCircle size={14} aria-hidden />
                            <span>Help</span>
                          </button>
                      </div>
                      <span className="dashboard-tagline">Compare standard vs requested charges and see what to collect from agent or consignee.</span>
                      <span className="dashboard-tagline--sub">Enter shipment details, load or add charges for Standard and Requested, then check the DIFF totals below.</span>
                  </div>
                  <div className="header-actions">
                      <button className="btn-secondary" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                          <HistoryIcon size={16} /> History
                      </button>
                  </div>
               </div>

               <div className="global-inputs">
                  <div className="input-group global-inputs__ref">
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
                  <div className="input-group global-inputs__snap">
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
                <div className="tab-toolbar">
                   <select id="std-load-select" className="tab-toolbar__select">
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('std', (document.getElementById('std-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info tab-toolbar__scan" onClick={() => document.getElementById('scan-std')?.click()}>
                       <Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}
                   </button>
                   <input id="scan-std" type="file" className="visually-hidden-file" accept="image/*" onChange={(e) => handleFileScan(e, 'std')} />
                </div>
                {lastScanFeedback?.target === 'std' && (
                   <div className="scan-feedback" role="status">{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                )}
                <EditorPanel
                  prefix="std"
                  data={stdData}
                  lastScanFeedback={lastScanFeedback}
                  onUpdateTitle={(title) => setStdData({ ...stdData, title })}
                  onAddGroup={addGroup}
                  onUpdateGroup={(idx, f, v) => handleUpdateGroup('std', idx, f, v)}
                  onRemoveGroup={(idx) => removeGroup('std', idx)}
                  onUpdateRow={(gi, ri, f, v) => handleUpdateRow('std', gi, ri, f, v)}
                  onRemoveRow={(gi, ri) => removeRow('std', gi, ri)}
                  onAddRow={(gi) => addRow('std', gi)}
                />
             </div>
           )}

           {activeTab === 'req' && (
             <div>
                <div className="tab-toolbar">
                   <select id="req-load-select" className="tab-toolbar__select">
                      {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                   <button className="btn-warning" onClick={() => loadPresetToTab('req', (document.getElementById('req-load-select') as HTMLSelectElement).value)}>Load Preset</button>
                   <button className="btn-info tab-toolbar__scan" onClick={() => document.getElementById('scan-req')?.click()}>
                       <Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}
                   </button>
                   <input id="scan-req" type="file" className="visually-hidden-file" accept="image/*" onChange={(e) => handleFileScan(e, 'req')} />
                </div>
                {lastScanFeedback?.target === 'req' && (
                   <div className="scan-feedback" role="status">{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                )}
                <EditorPanel
                  prefix="req"
                  data={reqData}
                  lastScanFeedback={lastScanFeedback}
                  onUpdateTitle={(title) => setReqData({ ...reqData, title })}
                  onAddGroup={addGroup}
                  onUpdateGroup={(idx, f, v) => handleUpdateGroup('req', idx, f, v)}
                  onRemoveGroup={(idx) => removeGroup('req', idx)}
                  onUpdateRow={(gi, ri, f, v) => handleUpdateRow('req', gi, ri, f, v)}
                  onRemoveRow={(gi, ri) => removeRow('req', gi, ri)}
                  onAddRow={(gi) => addRow('req', gi)}
                />
             </div>
           )}

           {activeTab === 'mgr' && (
             <div>
                 <div className="mgr-callout">
                    <strong>Presets:</strong> Choose <strong>Create New...</strong> to add a preset from scratch, or pick an existing one to edit. Saving overwrites that preset.
                 </div>
                 <div className="mgr-form-row">
                    <div className="input-group mgr-form-row__field">
                        <label>Select Preset</label>
                        <select value={mgrSelectedKey} onChange={(e) => handleMgrSelectChange(e.target.value)}>
                            <option>Create New...</option>
                            {Object.keys(savedPresets).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                    <div className="input-group mgr-form-row__field">
                        <label>Preset Name</label>
                        <input type="text" value={mgrNameInput} onChange={(e) => setMgrNameInput(e.target.value)} disabled={mgrSelectedKey !== 'Create New...'} placeholder="e.g. EU Dest 2024" />
                    </div>
                    <div className="mgr-actions">
                         <button className="btn-info" onClick={() => document.getElementById('scan-mgr')?.click()} title="Add charges from a photo or pasted image"><Bot size={16} /> {isScanning ? 'Scanning…' : 'Scan image or paste (Ctrl+V)'}</button>
                         <input id="scan-mgr" type="file" className="visually-hidden-file" accept="image/*" onChange={(e) => handleFileScan(e, 'mgr')} />
                         <button className="btn-success" onClick={savePreset}>Save Preset</button>
                         <button className="btn-danger" onClick={deletePreset}>Delete</button>
                    </div>
                 </div>
                 {lastScanFeedback?.target === 'mgr' && (
                   <div className="scan-feedback scan-feedback--mb" role="status">{lastScanFeedback.count === 1 ? 'Added 1 charge group from image.' : `Added ${lastScanFeedback.count} charge groups from image.`}</div>
                 )}
                 <hr className="rule-hr" />
                 <EditorPanel
                   prefix="mgr"
                   data={mgrData}
                   lastScanFeedback={lastScanFeedback}
                   onUpdateTitle={(title) => setMgrData({ ...mgrData, title })}
                   onAddGroup={addGroup}
                   onUpdateGroup={(idx, f, v) => handleUpdateGroup('mgr', idx, f, v)}
                   onRemoveGroup={(idx) => removeGroup('mgr', idx)}
                   onUpdateRow={(gi, ri, f, v) => handleUpdateRow('mgr', gi, ri, f, v)}
                   onRemoveRow={(gi, ri) => removeRow('mgr', gi, ri)}
                   onAddRow={(gi) => addRow('mgr', gi)}
                 />

                 <div className="adv-block">
                    <button type="button" className="adv-disclosure" aria-expanded={advOpen} onClick={() => setAdvOpen(!advOpen)}>
                        <Settings size={14} aria-hidden />
                        <span>Advanced Options (Import/Export)</span>
                        {advOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                    </button>
                    {advOpen && (
                        <div className="adv-panel">
                            <div className="adv-panel__section">
                                <label className="adv-panel__label">AI MODEL</label>
                                <select value={model} onChange={e => setModel(e.target.value)} className="adv-panel__select">
                                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                    <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                </select>
                            </div>
                            <div className="adv-panel__section">
                                <label className="adv-panel__label">
                                    REASONING EFFORT {(!model.includes('gemini-3')) && <span className="text-unavailable">(Not available for 2.5)</span>}
                                </label>
                                <select 
                                    value={reasoning} 
                                    onChange={e => setReasoning(e.target.value)} 
                                    className={`adv-panel__select${!model.includes('gemini-3') ? ' adv-panel__select--disabled' : ''}`}
                                    disabled={!model.includes('gemini-3')}
                                >
                                    <option value="auto">Default (Auto)</option>
                                    <option value="low">Low (Fast)</option>
                                    <option value="high">High (Deep)</option>
                                </select>
                            </div>
                            <div className="adv-panel__actions">
                                <button className="btn-info" onClick={() => {
                                    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(savedPresets,null,2)],{type:"application/json"})); a.download = "presets.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                }}>Export JSON</button>
                                <button className="btn-dark" onClick={() => document.getElementById('json-import')?.click()}>Import JSON</button>
                                <input id="json-import" type="file" className="visually-hidden-file" accept=".json" onChange={(e) => {
                                    if(e.target.files?.[0]) {
                                        const r = new FileReader();
                                        r.onload = ev => { try { setSavedPresets({...savedPresets, ...JSON.parse(ev.target?.result as string)}); showToast("✅ Imported"); } catch(er){ console.error(er); } };
                                        r.readAsText(e.target.files[0]);
                                    }
                                }} />
                            </div>
                            <div className="adv-panel__danger">
                                <div className="adv-panel__danger-text">
                                    <strong>Danger zone</strong>
                                    <span>Clears all presets, history, and saved charges from this device.</span>
                                </div>
                                <button
                                    className="btn-danger btn-compact-danger"
                                    onClick={() => { if (confirm("Reset all data? Your presets and history will be cleared. This can't be undone.")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } }}
                                >
                                    <AlertTriangle size={14} /> Reset App
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
             </div>
           )}

           {/* OUTPUT */}
           <div className="output-controls">
                <div className="output-controls-row">
                    <span className="output-controls-label" id="report-view-label">Report view</span>
                    <div className="segmented" role="radiogroup" aria-labelledby="report-view-label">
                        {[
                            { value: 'Comparison', label: 'Side-by-side' },
                            { value: 'Standard', label: 'Standard only' },
                            { value: 'Requested', label: 'Requested only' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                role="radio"
                                aria-checked={viewMode === opt.value}
                                className={`segmented__option${viewMode === opt.value ? ' is-active' : ''}${opt.value === 'Requested' ? ' segmented__option--requested' : ''}`}
                                onClick={() => setViewMode(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="output-controls-row">
                    <button type="button" className="btn-secondary" onClick={() => exportAsImage('full-report-area', `Freight-Report-${globals.ref || 'Export'}.jpg`)}>
                        <ImageIcon size={16} /> Export Report to JPG
                    </button>
                </div>
           </div>
           
           <div id="full-report-area" className={`xl-wrapper full-report-surface ${viewMode === 'Comparison' ? 'xl-wrapper-comparison' : 'report-single'}`}>
              <div className="xl-info-box"><strong>SHIPMENT DETAILS:</strong>&nbsp;&nbsp; CBM: {globals.cbm.toFixed(3)} &nbsp;|&nbsp; KGS: {globals.kgs.toFixed(3)} &nbsp;|&nbsp; PKGS: {globals.pkgs}</div>
              {viewMode === 'Comparison' && (
                <ComparisonTable
                  stdRes={stdRes}
                  reqRes={reqRes}
                  stdTitle={stdData.title}
                  reqTitle={reqData.title}
                  unionCurrencies={unionCurrencies}
                  expandedRows={expandedRows}
                  onToggleRow={toggleRow}
                />
              )}
              {viewMode === 'Standard' && (
                <ReportTable
                  res={stdRes}
                  title={stdData.title}
                  showDiff={false}
                  expandedRows={expandedRows}
                  onToggleRow={toggleRow}
                />
              )}
              {viewMode === 'Requested' && (
                <ReportTable
                  res={reqRes}
                  title={reqData.title}
                  showDiff={false}
                  activeCurrencies={[]}
                  reportVariant="requested"
                  expandedRows={expandedRows}
                  onToggleRow={toggleRow}
                />
              )}
           </div>

        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            className="sidebar-edge-tab"
            onClick={() => setSidebarCollapsed(false)}
            title="Open history"
            aria-label="Open history sidebar"
          >
            <HistoryIcon size={16} />
            <span className="sidebar-edge-tab__label">History</span>
          </button>
        )}

        <HistorySidebar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          historyView={historyView}
          setHistoryView={setHistoryView}
          history={history}
          importedHistory={importedHistory}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          activeHistoryList={activeHistoryList}
          onExportCurrentHistory={exportCurrentHistory}
          onImportClick={() => document.getElementById('hist-import')?.click()}
          onImportFileChange={handleHistoryImport}
          onClearCurrentHistory={clearCurrentHistory}
          onLoadHistory={loadHist}
          onDeleteHistoryItem={deleteHistoryItem}
        />
      </div>
    </DragDropContext>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, BookOpen } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTION_IDS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'building-blocks', label: 'Building blocks' },
  { id: 'how-math-works', label: 'How the math works' },
  { id: 'worked-examples', label: 'Worked examples' },
  { id: 'scan-troubleshooting', label: 'Scan troubleshooting' },
  { id: 'tips-shortcuts', label: 'Tips & shortcuts' },
];

export function HelpDrawer({ open, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) drawerRef.current?.focus();
  }, [open]);

  const jumpTo = (id: string) => {
    const el = drawerRef.current?.querySelector(`#help-${id}`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(HELP_MARKDOWN);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  };

  return (
    <>
      {open && <div className="help-backdrop" onClick={onClose} aria-hidden />}
      <aside
        ref={drawerRef}
        className={`help-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        tabIndex={-1}
      >
        <header className="help-drawer__head">
          <div className="help-drawer__title">
            <BookOpen size={18} aria-hidden />
            <h2 id="help-drawer-title">How this calculator works</h2>
          </div>
          <div className="help-drawer__actions">
            <button
              type="button"
              className="btn-secondary help-drawer__copy"
              onClick={copyMarkdown}
              title="Copy the full guide as markdown. Useful as AI context."
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy as markdown'}
            </button>
            <button
              type="button"
              className="btn-icon-only help-drawer__close"
              onClick={onClose}
              aria-label="Close help"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="help-toc" aria-label="Help sections">
          {SECTION_IDS.map((s) => (
            <button key={s.id} type="button" className="help-toc__link" onClick={() => jumpTo(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="help-drawer__body">
          <p className="help-intro">
            A quick reference for units, conditions, group logic, and the exact math the calculator
            runs. Examples are traced against the real calculation engine so the "which row wins"
            results are reproducible.
          </p>

          {/* 1 ------------------------------------------------------------ */}
          <section id="help-getting-started" className="help-section">
            <h3>1. Getting started</h3>
            <ol className="help-steps">
              <li>
                Enter <strong>CBM</strong>, <strong>KGS</strong> and <strong>PKGS</strong> at the
                top. These drive every row's quantity calculation.
              </li>
              <li>
                On the <strong>Standard</strong> tab, add charges. Three ways:
                <ul>
                  <li>Pick a preset from <em>Load Preset</em> or <em>Add Charges Preset</em>.</li>
                  <li>Click <strong>Add Item</strong> to start from blank.</li>
                  <li>Paste a screenshot of a tariff (<kbd>Ctrl</kbd>+<kbd>V</kbd>) or click <em>Scan image</em>.</li>
                </ul>
              </li>
              <li>
                Duplicate/edit the list on the <strong>Requested</strong> tab, then scroll to the
                report below. Switch between <em>Side-by-side</em>, <em>Standard only</em>, and{' '}
                <em>Requested only</em> views. Click <strong>Snap</strong> to save a history entry.
              </li>
            </ol>
          </section>

          {/* 2 ------------------------------------------------------------ */}
          <section id="help-building-blocks" className="help-section">
            <h3>2. Building blocks</h3>

            <h4>Units</h4>
            <ul className="help-definition-list">
              <li><code>FLAT</code> — One flat fee, ignores cargo size.</li>
              <li><code>SHPT</code> — Per shipment.</li>
              <li><code>BL</code> — Per Bill of Lading.</li>
              <li><code>CBM</code> — Per m³.</li>
              <li><code>TON</code> — Per metric ton (<code>KGS ÷ 1000</code>).</li>
              <li><code>KGS</code> — Per kilogram.</li>
              <li><code>PKG</code> — Per package count.</li>
              <li><code>RT</code> — Revenue Ton = <code>max(CBM, KGS ÷ 1000)</code>. Bills on the higher of volume vs. weight.</li>
              <li><code>% ITEM</code> — Percentage of this group's own sub-total.</li>
              <li><code>% TOTAL</code> — Percentage of the grand total across all non-% groups in the same currency.</li>
            </ul>
            <p className="help-callout">
              For CBM/TON/RT the billable qty clamps at 1 — a 0.5 m³ shipment is billed as 1 m³.
            </p>

            <h4>Conditions</h4>
            <ul className="help-definition-list">
              <li><strong>None</strong> — Always applies.</li>
              <li><strong>Minimum (MIN)</strong> — The row is a floor; it wins only if it's higher than every other active row.</li>
              <li><strong>Heavy (&gt;20 kg/pkg)</strong> — Applies when <code>KGS ÷ PKGS &gt; 20</code>.</li>
              <li><strong>Light (≤20 kg/pkg)</strong> — Applies when <code>KGS ÷ PKGS ≤ 20</code>.</li>
              <li><strong>Over 5x (CBM/ton ≥ 5)</strong> — Applies when <code>CBM ÷ (KGS ÷ 1000) ≥ 5</code>. Very bulky, low-density cargo.</li>
            </ul>

            <h4>Group logic</h4>
            <ul className="help-definition-list">
              <li><strong>Highest Wins (MAX)</strong> — Charge the single highest applicable row. Classic for pier/LCL schedules.</li>
              <li><strong>Sum All (SUM)</strong> — Add every applicable row. Use when charges stack (fuel + doc fee + storage days).</li>
            </ul>

            <h4>Row modifiers (in the rate cell)</h4>
            <ul className="help-definition-list">
              <li><strong>÷ per N</strong> — Split the rate across N units. <code>EUR 80 / 1000 KGS</code> means 80 applies once per 1,000 kg. Billable clamps to <code>max(1, qty ÷ N)</code>.</li>
              <li><strong>× qty</strong> — Per-row multiplier (e.g. <em>storage × 3 days</em>). Applied last.</li>
              <li><strong>MIN settings</strong> — Optional floor per row. <code>AMT</code> = minimum money; <code>QTY</code> = minimum billable units.</li>
              <li><strong>Round up</strong> — Only for CBM/TON/RT/KGS. Rounds billable qty up to N decimals (commonly 3 for CBM).</li>
            </ul>
          </section>

          {/* 3 ------------------------------------------------------------ */}
          <section id="help-how-math-works" className="help-section">
            <h3>3. How the math works</h3>
            <h4>Order of operations per row</h4>
            <ol className="help-steps">
              <li>Resolve <code>qty</code> from the unit (with <code>max(1, …)</code> clamp for CBM/TON/RT).</li>
              <li>If Round up is enabled: <code>qty = ⌈qty × 10^d⌉ ÷ 10^d</code>.</li>
              <li>If <code>÷ per N</code> is set with <code>N &gt; 1</code>: <code>billable = max(1, qty ÷ N)</code>; otherwise <code>billable = qty</code>.</li>
              <li><code>amt = rate × billable</code>.</li>
              <li>Check the condition (HEAVY / LIGHT / OVER_5X) — if not met, row is excluded from MAX/SUM.</li>
              <li>If the row's condition is <code>MIN</code>, its amt is the minimum itself (<code>AMT</code> or <code>rate × min_qty</code>).</li>
              <li>Apply optional <strong>MIN settings</strong> (amount floor or qty floor).</li>
              <li>Apply the per-row <strong>× qty</strong> multiplier if active.</li>
              <li>Group logic (MAX / SUM) combines all "met" rows.</li>
            </ol>

            <h4>Key formulas</h4>
            <pre className="help-code"><code>{`RT           = max(CBM, KGS ÷ 1000)
billable     = (N > 1) ? max(1, qty ÷ N) : qty
round_up(x,d)= ⌈x × 10^d⌉ ÷ 10^d
%_ITEM       = (rate / 100) × group_subtotal
%_TOTAL      = (rate / 100) × (grand_total_in_currency − this_group_subtotal)
kg_per_pkg   = KGS ÷ PKGS
cbm_per_ton  = CBM ÷ (KGS ÷ 1000)`}</code></pre>
          </section>

          {/* 4 ------------------------------------------------------------ */}
          <section id="help-worked-examples" className="help-section">
            <h3>4. Worked examples (pier charges)</h3>
            <p>Shared tariff for all four examples — currency <code>EUR</code>, logic <strong>Highest Wins (MAX)</strong>:</p>
            <table className="help-table">
              <thead>
                <tr><th>Row</th><th>Rate</th><th>Condition</th></tr>
              </thead>
              <tbody>
                <tr><td>HEAVY</td><td>EUR 25 / TON</td><td>kg/pkg &gt; 20</td></tr>
                <tr><td>LIGHT</td><td>EUR 30 / TON</td><td>kg/pkg ≤ 20</td></tr>
                <tr><td>OVER_5X</td><td>EUR 35 / RT</td><td>CBM/ton ≥ 5</td></tr>
                <tr><td>MIN</td><td>EUR 60 / SHPT</td><td>minimum floor</td></tr>
              </tbody>
            </table>

            <div className="help-example">
              <h4>Example 1 — MIN wins (tiny parcel)</h4>
              <p className="help-example__inputs">Inputs: <code>CBM = 0.5</code>, <code>KGS = 50</code>, <code>PKGS = 5</code></p>
              <ul>
                <li>kg/pkg = 10 → HEAVY <strong>not met</strong>, LIGHT <strong>met</strong></li>
                <li>CBM/ton = 0.5 / 0.05 = 10 → OVER_5X <strong>met</strong></li>
                <li>LIGHT: tons = 0.05 → clamped to <strong>1</strong> → 1 × 30 = <strong>30.00</strong></li>
                <li>OVER_5X: RT = max(0.5, 0.05) = 0.5 → clamped to <strong>1</strong> → 1 × 35 = <strong>35.00</strong></li>
                <li>MIN: fixed <strong>60.00</strong></li>
              </ul>
              <p className="help-example__result">Winner: <strong>MIN at EUR 60.00</strong> — both variable rows calc below the floor.</p>
            </div>

            <div className="help-example">
              <h4>Example 2 — HEAVY wins (dense cargo)</h4>
              <p className="help-example__inputs">Inputs: <code>CBM = 3</code>, <code>KGS = 4,000</code>, <code>PKGS = 10</code></p>
              <ul>
                <li>kg/pkg = 400 → HEAVY <strong>met</strong>, LIGHT <strong>not met</strong></li>
                <li>CBM/ton = 3 / 4 = 0.75 → OVER_5X <strong>not met</strong></li>
                <li>HEAVY: tons = 4 → 4 × 25 = <strong>100.00</strong></li>
                <li>MIN: 60</li>
              </ul>
              <p className="help-example__result">Winner: <strong>HEAVY at EUR 100.00</strong>.</p>
            </div>

            <div className="help-example">
              <h4>Example 3 — LIGHT wins (many light cartons)</h4>
              <p className="help-example__inputs">Inputs: <code>CBM = 2</code>, <code>KGS = 3,000</code>, <code>PKGS = 200</code></p>
              <ul>
                <li>kg/pkg = 15 → LIGHT <strong>met</strong>, HEAVY <strong>not met</strong></li>
                <li>CBM/ton = 2 / 3 = 0.67 → OVER_5X <strong>not met</strong></li>
                <li>LIGHT: tons = 3 → 3 × 30 = <strong>90.00</strong></li>
                <li>MIN: 60</li>
              </ul>
              <p className="help-example__result">Winner: <strong>LIGHT at EUR 90.00</strong> — tonnage is high enough for LIGHT to exceed the floor.</p>
            </div>

            <div className="help-example">
              <h4>Example 4 — OVER_5X wins (bulky, low-density)</h4>
              <p className="help-example__inputs">Inputs: <code>CBM = 20</code>, <code>KGS = 1,000</code>, <code>PKGS = 5</code></p>
              <ul>
                <li>kg/pkg = 200 → HEAVY <strong>met</strong></li>
                <li>CBM/ton = 20 / 1 = 20 → OVER_5X <strong>met</strong></li>
                <li>HEAVY: tons = 1 → 1 × 25 = <strong>25.00</strong></li>
                <li>OVER_5X: RT = max(20, 1) = 20 → 20 × 35 = <strong>700.00</strong></li>
                <li>MIN: 60</li>
              </ul>
              <p className="help-example__result">Winner: <strong>OVER_5X at EUR 700.00</strong> — CBM dominates so RT explodes, catching the bulky-cargo premium.</p>
            </div>

            <div className="help-example help-example--bonus">
              <h4>Bonus — Storage with <code>× 3</code> multiplier</h4>
              <p className="help-example__inputs">Group: STORAGE preset, logic <strong>Sum All</strong>. Row: <code>rate = 4 / CBM</code>, <code>× 3</code>. Inputs: <code>CBM = 3, KGS = 250, PKGS = 3</code>.</p>
              <ul>
                <li>qty = max(1, 3) = 3</li>
                <li>Base amt = 3 × 4 = 12</li>
                <li>× 3 multiplier = <strong>36.00</strong></li>
              </ul>
              <p className="help-example__result">Total: <strong>EUR 36.00</strong> — three days of storage at EUR 4 / CBM / day.</p>
            </div>
          </section>

          {/* 5 ------------------------------------------------------------ */}
          <section id="help-scan-troubleshooting" className="help-section">
            <h3>5. Scan troubleshooting (Gemini OCR)</h3>

            <h4>Symptoms → causes → fixes</h4>
            <div className="help-trouble">
              <h5>"Scan service returned 401/403"</h5>
              <p>API key missing/expired, or the request is blocked by region.</p>
              <ul>
                <li>Verify <code>GEMINI_API_KEY</code> is set in your deployment.</li>
                <li>If your region doesn't have Gemini availability, route through a VPN to a supported region.</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h5>"Scan request failed with 429"</h5>
              <p>Rate-limit or quota hit.</p>
              <ul>
                <li>Wait 30-60 seconds and retry.</li>
                <li>Drop reasoning effort (Gemini 3.x only) or switch to Gemini 2.5 Flash for looser limits.</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h5>"Scan service returned XYZ without valid JSON"</h5>
              <p>Model responded but not in the expected schema.</p>
              <ul>
                <li>Crop the image to show just the charges table — background clutter confuses the model.</li>
                <li>Try a stronger model (3.x Pro &gt; 3.x Flash Lite &gt; 2.5 Flash for structure fidelity).</li>
                <li>Bump reasoning to <strong>High</strong> on 3.x models.</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h5>Toast stuck on "Still scanning…"</h5>
              <p>Normal for first call and large images. If it never completes (&gt; 45s), it's usually network or regional blocking.</p>
            </div>

            <h4>"Added N groups" but values look wrong</h4>
            <ul>
              <li>Unit synonyms are mapped: <code>M³→CBM</code>, <code>KG→KGS</code>, <code>MT/TONS→TON</code>, <code>SHIPMENT→SHPT</code>, <code>LS→FLAT</code>, <code>% GROUP→% ITEM</code>. Anything else falls back to <code>FLAT</code>.</li>
              <li>Gemini sometimes misreads the currency column when it sits far right; fix it via the row's currency dropdown.</li>
              <li>Percentages and minimums are the most frequently swapped — verify the row's condition before trusting totals.</li>
            </ul>

            <h4>What scan does <em>not</em> do</h4>
            <ul>
              <li><strong>No merge</strong> — scanned groups are appended; existing rows are never overwritten.</li>
              <li><strong>No retry</strong> — if it fails, click Scan again. The red error toast explains why.</li>
              <li><strong>No learning</strong> — corrections aren't remembered. If a tariff keeps getting misread, build it once and save as a preset.</li>
            </ul>

            <h4>Rules of thumb</h4>
            <ul>
              <li><strong>2.5 Flash</strong> is the most permissive with messy tables.</li>
              <li><strong>3.x + High reasoning</strong> is best for cleanly formatted tariffs; may reject unusual layouts.</li>
              <li>A screenshot or crop always beats a phone photo. Printed text &gt; handwriting.</li>
            </ul>
          </section>

          {/* 6 ------------------------------------------------------------ */}
          <section id="help-tips-shortcuts" className="help-section">
            <h3>6. Tips & shortcuts</h3>
            <ul className="help-definition-list">
              <li><kbd>Ctrl</kbd>+<kbd>V</kbd> anywhere — pastes a screenshot and auto-scans it into the active tab.</li>
              <li><strong>Drag handles</strong> — the grip icon on the left of every group and row is draggable for reordering.</li>
              <li><strong>Snap</strong> — top header, saves a history snapshot with both tabs and the current inputs.</li>
              <li><strong>History edge tab</strong> — when the sidebar is collapsed, a vertical HISTORY tab appears on the right edge; click to reopen.</li>
              <li><strong>Report view</strong> — segmented switch below the tabs: Side-by-side / Standard only / Requested only.</li>
              <li><strong>Export to JPG</strong> — dumps the full report card as an image. Respects the current view.</li>
              <li><strong>Model badge</strong> — click it next to the title to change scan model and reasoning effort without leaving the page.</li>
              <li><strong>Advanced Options</strong> — on the Manage Presets tab. Holds Import/Export JSON and the <strong>Reset App</strong> danger button.</li>
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}

// Markdown mirror of the drawer content. Copied to clipboard via the header button.
// Keep in sync with the JSX above when editing.
const HELP_MARKDOWN = `# How this calculator works

A quick reference for units, conditions, group logic, and the exact math the
calculator runs. Examples are traced against the real calculation engine.

## 1. Getting started

1. Enter **CBM**, **KGS**, and **PKGS** at the top. These drive every row's
   quantity calculation.
2. On the **Standard** tab, add charges. Three ways:
   - Pick a preset from *Load Preset* or *Add Charges Preset*.
   - Click **Add Item** to start from blank.
   - Paste a screenshot of a tariff (Ctrl+V) or click *Scan image*.
3. Duplicate/edit the list on the **Requested** tab, then scroll to the report
   below. Switch between *Side-by-side*, *Standard only*, and *Requested only*
   views. Click **Snap** to save a history entry.

## 2. Building blocks

### Units
- \`FLAT\` — One flat fee, ignores cargo size.
- \`SHPT\` — Per shipment.
- \`BL\` — Per Bill of Lading.
- \`CBM\` — Per m³.
- \`TON\` — Per metric ton (\`KGS ÷ 1000\`).
- \`KGS\` — Per kilogram.
- \`PKG\` — Per package count.
- \`RT\` — Revenue Ton = \`max(CBM, KGS ÷ 1000)\`. Bills on the higher of volume vs weight.
- \`% ITEM\` — Percentage of this group's own sub-total.
- \`% TOTAL\` — Percentage of the grand total across all non-% groups in the same currency.

> For CBM/TON/RT the billable qty clamps at 1 — a 0.5 m³ shipment is billed as 1 m³.

### Conditions
- **None** — Always applies.
- **Minimum (MIN)** — The row is a floor; wins only if higher than every other active row.
- **Heavy (>20 kg/pkg)** — \`KGS ÷ PKGS > 20\`.
- **Light (≤20 kg/pkg)** — \`KGS ÷ PKGS ≤ 20\`.
- **Over 5x (CBM/ton ≥ 5)** — \`CBM ÷ (KGS ÷ 1000) ≥ 5\`. Very bulky, low-density cargo.

### Group logic
- **Highest Wins (MAX)** — Charge the single highest applicable row. Classic for pier/LCL schedules.
- **Sum All (SUM)** — Add every applicable row. Use when charges stack.

### Row modifiers (in the rate cell)
- **÷ per N** — Split the rate across N units. Billable clamps to \`max(1, qty ÷ N)\`.
- **× qty** — Per-row multiplier (e.g. storage × 3 days). Applied last.
- **MIN settings** — Optional floor per row. \`AMT\` = minimum money; \`QTY\` = minimum billable units.
- **Round up** — Only for CBM/TON/RT/KGS. Rounds billable qty up to N decimals.

## 3. How the math works

### Order of operations per row
1. Resolve \`qty\` from the unit (with \`max(1, …)\` clamp for CBM/TON/RT).
2. If Round up is enabled: \`qty = ⌈qty × 10^d⌉ ÷ 10^d\`.
3. If \`÷ per N\` is set with \`N > 1\`: \`billable = max(1, qty ÷ N)\`; otherwise \`billable = qty\`.
4. \`amt = rate × billable\`.
5. Check the condition (HEAVY / LIGHT / OVER_5X) — if not met, row is excluded.
6. If the condition is \`MIN\`, its amt is the minimum itself (\`AMT\` or \`rate × min_qty\`).
7. Apply optional MIN settings (amount floor or qty floor).
8. Apply the per-row \`× qty\` multiplier if active.
9. Group logic (MAX / SUM) combines all met rows.

### Key formulas
\`\`\`
RT           = max(CBM, KGS ÷ 1000)
billable     = (N > 1) ? max(1, qty ÷ N) : qty
round_up(x,d)= ⌈x × 10^d⌉ ÷ 10^d
%_ITEM       = (rate / 100) × group_subtotal
%_TOTAL      = (rate / 100) × (grand_total_in_currency − this_group_subtotal)
kg_per_pkg   = KGS ÷ PKGS
cbm_per_ton  = CBM ÷ (KGS ÷ 1000)
\`\`\`

## 4. Worked examples (pier charges)

Shared tariff — currency EUR, logic **Highest Wins (MAX)**:

| Row     | Rate          | Condition       |
|---------|---------------|-----------------|
| HEAVY   | EUR 25 / TON  | kg/pkg > 20     |
| LIGHT   | EUR 30 / TON  | kg/pkg ≤ 20     |
| OVER_5X | EUR 35 / RT   | CBM/ton ≥ 5     |
| MIN     | EUR 60 / SHPT | minimum floor   |

### Example 1 — MIN wins (tiny parcel)
Inputs: CBM = 0.5, KGS = 50, PKGS = 5

- kg/pkg = 10 → HEAVY not met, LIGHT met
- CBM/ton = 0.5 / 0.05 = 10 → OVER_5X met
- LIGHT: tons = 0.05 → clamp to 1 → 1 × 30 = 30.00
- OVER_5X: RT = max(0.5, 0.05) = 0.5 → clamp to 1 → 1 × 35 = 35.00
- MIN: 60.00

Winner: **MIN at EUR 60.00** — both variable rows calc below the floor.

### Example 2 — HEAVY wins (dense cargo)
Inputs: CBM = 3, KGS = 4,000, PKGS = 10

- kg/pkg = 400 → HEAVY met
- CBM/ton = 0.75 → OVER_5X not met
- HEAVY: tons = 4 → 4 × 25 = 100.00
- MIN: 60

Winner: **HEAVY at EUR 100.00**.

### Example 3 — LIGHT wins (many light cartons)
Inputs: CBM = 2, KGS = 3,000, PKGS = 200

- kg/pkg = 15 → LIGHT met
- CBM/ton = 0.67 → OVER_5X not met
- LIGHT: tons = 3 → 3 × 30 = 90.00
- MIN: 60

Winner: **LIGHT at EUR 90.00**.

### Example 4 — OVER_5X wins (bulky, low-density)
Inputs: CBM = 20, KGS = 1,000, PKGS = 5

- kg/pkg = 200 → HEAVY met
- CBM/ton = 20 → OVER_5X met
- HEAVY: tons = 1 → 1 × 25 = 25.00
- OVER_5X: RT = max(20, 1) = 20 → 20 × 35 = 700.00
- MIN: 60

Winner: **OVER_5X at EUR 700.00** — CBM dominates so RT explodes.

### Bonus — Storage with × 3 multiplier
Group: STORAGE preset, logic **Sum All**. Row: rate = 4 / CBM, × 3. Inputs:
CBM = 3, KGS = 250, PKGS = 3.

- qty = max(1, 3) = 3
- Base amt = 3 × 4 = 12
- × 3 multiplier = 36.00

Total: **EUR 36.00**.

## 5. Scan troubleshooting (Gemini OCR)

### Symptoms → causes → fixes

**"Scan service returned 401/403"** — API key missing/expired, or blocked by region.
- Verify \`GEMINI_API_KEY\` is set.
- If your region lacks Gemini availability, route through a VPN to a supported region.

**"Scan request failed with 429"** — Rate-limit or quota hit.
- Wait 30-60 seconds and retry.
- Drop reasoning effort (3.x only) or switch to 2.5 Flash.

**"Scan service returned X without valid JSON"** — Responded but wrong shape.
- Crop to just the charges table.
- Try 3.x Pro > 3.x Flash Lite > 2.5 Flash for structure fidelity.
- Bump reasoning to High on 3.x.

**Toast stuck on "Still scanning…"** — Normal for first call and large images. If > 45s, it's usually network/regional blocking.

### "Added N groups" but values look wrong
- Unit synonyms mapped: M³→CBM, KG→KGS, MT/TONS→TON, SHIPMENT→SHPT, LS→FLAT, % GROUP→% ITEM.
- Currency sometimes misread — fix via row dropdown.
- Percentages and minimums are the most frequently swapped — verify the row's condition.

### What scan does NOT do
- **No merge** — scanned groups are appended; existing rows are never overwritten.
- **No retry** — if it fails, click Scan again.
- **No learning** — corrections aren't remembered. Build persistent presets instead.

### Rules of thumb
- 2.5 Flash: most permissive with messy tables.
- 3.x + High reasoning: best for clean tariffs; may reject unusual layouts.
- Screenshot/crop > phone photo. Printed text > handwriting.

## 6. Tips & shortcuts

- **Ctrl+V** anywhere — pastes a screenshot and auto-scans into the active tab.
- **Drag handles** — grip icon on the left of every group and row reorders.
- **Snap** (header) — saves a history snapshot with both tabs and current inputs.
- **History edge tab** — vertical tab on the right edge when sidebar is collapsed.
- **Report view** — segmented switch: Side-by-side / Standard only / Requested only.
- **Export to JPG** — full report card image, respects the current view.
- **Model badge** — click next to the title to change scan model and reasoning.
- **Advanced Options** — Manage Presets tab. Import/Export JSON + **Reset App** (danger).
`;

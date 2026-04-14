import React from 'react';
import { CURRENCIES } from '../types';

type AnyResult = {
  rows: any[];
  totals: Record<string, number>;
};

type ExpandedRowsMap = Record<string, boolean>;

interface ReportTableProps {
  res: AnyResult;
  title: string;
  showDiff: boolean;
  diffRes?: AnyResult;
  minRows?: number;
  activeCurrencies?: string[];
  reportVariant?: 'standard' | 'requested';
  expandedRows: ExpandedRowsMap;
  onToggleRow: (id: string) => void;
}

interface ComparisonTableProps {
  stdRes: AnyResult;
  reqRes: AnyResult;
  stdTitle: string;
  reqTitle: string;
  unionCurrencies: string[];
  expandedRows: ExpandedRowsMap;
  onToggleRow: (id: string) => void;
}

const renderDescLines = (desc?: string) => {
  if (!desc) return null;
  const parts = String(desc)
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return <>{desc}</>;
  return (
    <>
      {parts.map((part, idx) => (
        <span key={`${part}-${idx}`} className="desc-line">
          {part}
        </span>
      ))}
    </>
  );
};

export function ReportTable({
  res,
  title,
  showDiff,
  diffRes,
  minRows,
  activeCurrencies = [],
  reportVariant = 'standard',
  expandedRows,
  onToggleRow,
}: ReportTableProps) {
  const currenciesToShow =
    activeCurrencies.length > 0
      ? activeCurrencies
      : CURRENCIES.filter((c) => res.totals[c] > 0);

  const displayRows = [...res.rows];
  if (minRows && displayRows.length < minRows) {
    const padCount = minRows - displayRows.length;
    for (let i = 0; i < padCount; i++) displayRows.push({ is_pad: true });
  }

  return (
    <div
      className={`report-card${reportVariant === 'requested' ? ' report-card--requested' : ''}`}
      id={`report-${title.replace(/\s+/g, '-')}`}
    >
      <div className={`table-title${reportVariant === 'requested' ? ' table-title--requested' : ''}`}>{title}</div>
      <div className="table-wrapper">
        <table className="xl-table">
          <thead>
            <tr>
              <th className="xl-header col-item">Item</th>
              <th className="xl-header col-desc">Description</th>
              <th className="xl-header col-curr">Cur</th>
              <th className="xl-header col-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <strong>No charge lines yet</strong>
                    <p>Add items above or load a preset to see totals and differences here.</p>
                  </div>
                </td>
              </tr>
            )}
            {displayRows.map((r: any, i: number) => {
              if (r.is_pad) {
                return (
                  <tr key={`pad-${i}`} className="xl-row pad-row">
                    <td colSpan={4}>&nbsp;</td>
                  </tr>
                );
              }

              return (
                <React.Fragment key={i}>
                  <tr
                    className={`xl-row ${r.candidates && r.candidates.length > 0 ? 'expandable' : ''}`}
                    onClick={() => {
                      if (r.candidates && r.candidates.length > 0) {
                        onToggleRow(`${title}-${i}`);
                      }
                    }}
                  >
                    <td className="col-item">{r.item}</td>
                    <td className="col-desc">
                      {renderDescLines(r.desc)}
                      {r.subtext && (
                        <span className="calc-subtext">
                          <span className="min-highlight">{r.subtext}</span>
                        </span>
                      )}
                    </td>
                    <td className="col-curr">{r.curr}</td>
                    <td className="col-amt">{r.amount.toFixed(2)}</td>
                  </tr>
                  {expandedRows[`${title}-${i}`] && r.candidates && (
                    <tr className="xl-row expanded-details-row">
                      <td colSpan={4} className="td-cell-flush">
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
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="footer-container">
        <div className="footer-section totals">
          {currenciesToShow.length > 0 ? (
            currenciesToShow.map((c) => (
              <div key={c} className="stat-line">
                <span className="stat-lbl">TOTAL {c}</span> <span className="stat-val">{res.totals[c]?.toFixed(2) || '0.00'}</span>
              </div>
            ))
          ) : (
            <div className="stat-line">
              <span className="stat-lbl">TOTAL</span> <span className="stat-val">0.00</span>
            </div>
          )}
        </div>
        <div className={`footer-section diffs${!showDiff ? ' footer-section--diff-hidden' : ''}`}>
          {currenciesToShow.length > 0 ? (
            currenciesToShow.map((c) => {
              let d = 0;
              if (showDiff && diffRes) d = (res.totals[c] || 0) - (diffRes.totals[c] || 0);
              const sign = d >= 0 ? '+' : '';
              return (
                <div key={c} className="stat-line">
                  <span className="stat-lbl">DIFF {c}</span> <span className="stat-val">{sign}{d.toFixed(2)}</span>
                </div>
              );
            })
          ) : (
            <div className="stat-line">
              <span className="stat-lbl">DIFF</span> <span className="stat-val">0.00</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ComparisonTable({
  stdRes,
  reqRes,
  stdTitle,
  reqTitle,
  unionCurrencies,
  expandedRows,
  onToggleRow,
}: ComparisonTableProps) {
  const stdRows = stdRes.rows;
  const reqRows = reqRes.rows;
  const n = Math.max(stdRows.length, reqRows.length);
  const currenciesStd = CURRENCIES.filter((c) => stdRes.totals[c] > 0);
  const currenciesReq = CURRENCIES.filter((c) => reqRes.totals[c] > 0);

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
              <th className="xl-header comparison-panel-title comparison-panel-standard" colSpan={4}>
                {stdTitle.toUpperCase()}
              </th>
              <th className="xl-header comparison-panel-title comparison-divider comparison-panel-requested" colSpan={4}>
                {reqTitle.toUpperCase()}
              </th>
            </tr>
            <tr>
              <th className="xl-header col-item">Item</th>
              <th className="xl-header col-desc">Description</th>
              <th className="xl-header col-curr">Cur</th>
              <th className="xl-header col-amt">Amount</th>
              <th className="xl-header col-item comparison-divider comparison-subheader-requested">Item</th>
              <th className="xl-header col-desc comparison-subheader-requested">Description</th>
              <th className="xl-header col-curr comparison-subheader-requested">Cur</th>
              <th className="xl-header col-amt comparison-subheader-requested">Amount</th>
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
                  <tr className={`xl-row comparison-pair-row ${i % 2 === 1 ? 'comparison-row-alt' : ''} ${lHas || rHas ? 'expandable' : ''}`}>
                    {lPad ? (
                      <td className="col-item comparison-cell-pad" colSpan={4}>
                        &nbsp;
                      </td>
                    ) : (
                      <>
                        <td className="col-item" onClick={() => lHas && onToggleRow(lKey)}>
                          {l!.item}
                        </td>
                        <td className="col-desc" onClick={() => lHas && onToggleRow(lKey)}>
                          {renderDescLines(l!.desc)}
                          {l!.subtext && (
                            <span className="calc-subtext">
                              <span className="min-highlight">{l!.subtext}</span>
                            </span>
                          )}
                        </td>
                        <td className="col-curr" onClick={() => lHas && onToggleRow(lKey)}>
                          {l!.curr}
                        </td>
                        <td className="col-amt" onClick={() => lHas && onToggleRow(lKey)}>
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
                        <td className="col-item comparison-divider" onClick={() => rHas && onToggleRow(rKey)}>
                          {rrow!.item}
                        </td>
                        <td className="col-desc" onClick={() => rHas && onToggleRow(rKey)}>
                          {renderDescLines(rrow!.desc)}
                          {rrow!.subtext && (
                            <span className="calc-subtext">
                              <span className="min-highlight">{rrow!.subtext}</span>
                            </span>
                          )}
                        </td>
                        <td className="col-curr" onClick={() => rHas && onToggleRow(rKey)}>
                          {rrow!.curr}
                        </td>
                        <td className="col-amt" onClick={() => rHas && onToggleRow(rKey)}>
                          {rrow!.amount.toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                  {(expandedRows[lKey] || expandedRows[rKey]) && (
                    <tr className="xl-row expanded-details-row comparison-expanded-row">
                      <td colSpan={4} className="td-cell-flush">
                        {renderExpanded(l, lKey)}
                      </td>
                      <td colSpan={4} className="comparison-divider td-cell-flush">
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
                    currenciesStd.map((c) => (
                      <div key={c} className="stat-line">
                        <span className="stat-lbl">TOTAL {c}</span> <span className="stat-val">{stdRes.totals[c]?.toFixed(2) || '0.00'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="stat-line">
                      <span className="stat-lbl">TOTAL</span> <span className="stat-val">0.00</span>
                    </div>
                  )}
                </div>
              </td>
              <td colSpan={4} className="comparison-footer-cell comparison-divider comparison-footer-requested">
                <div className="footer-section totals">
                  {currenciesReq.length > 0 ? (
                    currenciesReq.map((c) => (
                      <div key={c} className="stat-line">
                        <span className="stat-lbl">TOTAL {c}</span> <span className="stat-val">{reqRes.totals[c]?.toFixed(2) || '0.00'}</span>
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
                    unionCurrencies.map((c) => {
                      const d = (reqRes.totals[c] || 0) - (stdRes.totals[c] || 0);
                      const sign = d >= 0 ? '+' : '';
                      return (
                        <div key={c} className="stat-line">
                          <span className="stat-lbl">DIFF {c}</span> <span className="stat-val">{sign}{d.toFixed(2)}</span>
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
}

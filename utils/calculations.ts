import { Group, Row, CalculationResult, CalculatedRow } from '../types';
import { CURRENCIES } from '../types';

export function calculateCharges(cbm: number, kgs: number, pkgs: number, groups: Group[]): CalculationResult {
  let rt = Math.max(cbm, kgs / 1000.0);
  let tons = kgs / 1000.0;
  
  if (!groups) groups = [];
  
  // --- HELPER: Calculate Row Value ---
  function calculateRow(r: Row, currency: string, base_amt_for_pct: number) {
    let u = (r.unit || '').toUpperCase().trim();
    
    // SAFE PARSING: Ensure inputs are numbers to prevent string contamination
    let rate = parseFloat(r.rate as any) || 0;
    let minVal = parseFloat(r.min_qty as any) || 0;
    let divisor = parseFloat(r.divisor as any);
    if (isNaN(divisor) || divisor === 0) divisor = 1;

    // 1. Percentage Handling
    if (u.includes('%')) {
      let base = base_amt_for_pct || 0;
      let amt = base * (rate / 100.0);
      
      // Min on Percentage
      let appliedMin = false;
      if (minVal > 0 && amt < minVal) { amt = minVal; appliedMin = true; }
      
      let typeLabel = u.includes('ITEM') ? 'Item' : 'Total';
      let desc = `${rate}% of ${typeLabel} (${currency} ${amt.toFixed(2)})`;
      if (appliedMin) desc += ` [Min: ${minVal}]`;
      
      let calc_string = `${rate}% of ${base.toFixed(2)} = ${amt.toFixed(2)}`;
      
      return { amt, desc, met: true, is_min: false, cond: 'NONE', unit: u, is_pct: true, calc_string };
    }

    // 2. Standard Unit Handling
    let qty = 1;
    if (u === 'RT') qty = Math.max(1, rt);
    else if (u === 'CBM') qty = Math.max(1, cbm);
    else if (u === 'TON') qty = Math.max(1, tons);
    else if (u === 'KGS') qty = kgs;
    else if (u === 'PKG') qty = pkgs;
    else if (u === 'BL' || u === 'SHPT' || u === 'FLAT') qty = 1;
    
    let original_qty = qty;
    // ROUND UP LOGIC
    if (r.round_up && typeof r.round_up_decimals === 'number') {
      const factor = Math.pow(10, r.round_up_decimals);
      qty = Math.ceil(qty * factor) / factor;
    }
    
    // DIVISOR LOGIC
    let div = divisor;
    
    let billableUnits = qty / div;
    if (div > 1) {
      // FIXED LOGIC FROM SOURCE: When using divisor, ensure at least 1 full unit is charged
      billableUnits = Math.max(1, billableUnits);
    }
    
    let amt = rate * billableUnits;
    
    // Conditions
    let met = true;
    let avg = (pkgs > 0) ? kgs / pkgs : 0;
    let ratio = (tons > 0) ? cbm / tons : 0;
    
    if (r.condition === 'HEAVY' && avg <= 20) met = false;
    if (r.condition === 'LIGHT' && avg > 20) met = false;
    if (r.condition === 'OVER_5X' && ratio < 5) met = false;
    
    // Min Logic
    let mType = r.min_type || 'AMT';
    let desc_suffix = "";
    
    if (r.condition === 'MIN') {
      if (mType === 'AMT') { 
        amt = minVal > 0 ? minVal : rate; 
      } else { 
        let effQty = minVal;
        let adjustedEffQty = effQty / div;
        if (div > 1) {
          adjustedEffQty = Math.max(1, adjustedEffQty);
        }
        amt = rate * adjustedEffQty; 
      }
      met = true;
    } else {
      if (minVal > 0) {
        if (met) {
          if (mType === 'AMT' && amt < minVal) { amt = minVal; }
          else if (mType === 'QTY') {
            let eff = Math.max(qty, minVal);
            if (eff > qty) { 
              let adjustedEff = eff / div;
              if (div > 1) {
                adjustedEff = Math.max(1, adjustedEff);
              }
              amt = rate * adjustedEff; 
            }
          }
        }
        if (mType === 'AMT') desc_suffix = ` [Min ${currency} ${minVal.toFixed(2)}]`;
        else desc_suffix = ` [Min Qty ${minVal}]`;
      }
    }
    
    let desc = `${currency} ${rate}`;
    if (div !== 1) {
      desc += `/ ${div}${r.unit}`;
    } else {
      desc += `/${r.unit}`;
    }
    
    if (r.round_up && typeof r.round_up_decimals === 'number') {
      desc += ` (ROUND UP TO ${r.round_up_decimals} DEC)`;
    }
    
    let calc_string = "";
    if (r.condition === 'MIN') {
        desc = `MIN ${currency} ${amt.toFixed(2)}`;
        calc_string = `Fixed Minimum: ${amt.toFixed(2)}`;
    } else {
      if (r.condition === 'HEAVY') desc += ' (Heavy)';
      else if (r.condition === 'LIGHT') desc += ' (Light)';
      else if (r.condition === 'OVER_5X') desc += ' (>5x)';
      desc += desc_suffix;
      
      calc_string = `${original_qty.toFixed(3)} ${u}`;
      if (r.round_up && typeof r.round_up_decimals === 'number') {
          calc_string += ` -> rounded up to ${qty.toFixed(r.round_up_decimals)} ${u}`;
      }
      if (div !== 1) {
          calc_string += ` ÷ ${div} = ${billableUnits.toFixed(3)} billable`;
      }
      calc_string += ` × ${rate} = ${amt.toFixed(2)}`;
      if (minVal > 0 && amt === minVal && mType === 'AMT') {
          calc_string += ` (Minimum applied)`;
      }
    }

    return { amt, desc, met, is_min: r.condition === 'MIN', cond: r.condition, unit: u, is_pct: false, calc_string };
  }

  // --- HELPER: Resolve Candidates ---
  function resolveCandidates(candidates: any[], logic: string, multiplier_active: boolean, multiplier_value: number) {
    let active = candidates.filter(c => c.met);
    if (active.length === 0) return { val: 0, desc: '', subtext: '', winner: null, all_candidates: candidates };
    
    let val = 0;
    let final_desc = "";
    let subtext = "";
    let winner = null;

    if (logic === 'MAX') {
      active.sort((a: any, b: any) => b.amt - a.amt);
      winner = active[0];
      val = winner.amt;
      
      // FIXED LOGIC: Show ALL candidates in description
      final_desc = candidates.map(c => c.desc).join(' | ');

      if (candidates.length > 1) {
        if (winner.is_pct) subtext = `[APPLIED: % ${winner.unit.includes('ITEM') ? 'ITEM' : 'TOTAL'}]`;
        else if (winner.is_min) subtext = `[APPLIED: MINIMUM]`;
        else subtext = `[APPLIED: ${winner.cond !== 'NONE' ? winner.cond : winner.unit} RATE]`;
      }
    } else {
      val = active.reduce((acc: number, c: any) => acc + c.amt, 0);
      final_desc = active.map(c => c.desc).join(' + ');
      winner = active[0];
    }

    if (multiplier_active && multiplier_value > 0) {
      val *= multiplier_value;
      if (val > 0) subtext += ` [x${multiplier_value}]`;
    }
    
    candidates.forEach(c => c.is_winner = (c === winner || logic === 'SUM'));

    return { val, desc: final_desc, subtext, winner, all_candidates: candidates };
  }

  let group_context = groups.map((g, idx) => {
    let std_rows = g.rows.filter(r => !r.unit.includes('%'));
    let pct_item_rows = g.rows.filter(r => r.unit.includes('ITEM') || r.unit.includes('GROUP'));
    let pct_total_rows = g.rows.filter(r => r.unit.includes('TOTAL'));

    let std_candidates = std_rows.map(r => calculateRow(r, g.currency, 0));
    let std_res = resolveCandidates(std_candidates, g.logic, false, 1);
    let base_for_item_pct = std_res.val;

    let item_pct_candidates = pct_item_rows.map(r => calculateRow(r, g.currency, base_for_item_pct));
    let all_local_candidates = [...std_candidates, ...item_pct_candidates];
    
    // SAFE PARSING for Multiplier
    let safeMultiplier = parseFloat(g.multiplier_value as any) || 0;
    let local_res = resolveCandidates(all_local_candidates, g.logic, g.multiplier_active, safeMultiplier);
    
    return {
      g,
      idx,
      std_candidates,
      item_pct_candidates,
      pct_total_rows,
      pre_total_val: local_res.val,
      local_res,
      safeMultiplier
    };
  });

  let gross_totals: Record<string, number> = {};
  CURRENCIES.forEach(c => gross_totals[c] = 0);
  group_context.forEach(ctx => {
    if (gross_totals[ctx.g.currency] !== undefined) {
      gross_totals[ctx.g.currency] += ctx.pre_total_val;
    }
  });

  let final_rows: CalculatedRow[] = [];

  group_context.forEach(ctx => {
    let final_val = 0;
    let final_desc = "";
    let subtext = "";
    let is_pct_total_group = (ctx.pct_total_rows.length > 0);

    if (!is_pct_total_group) {
      final_val = ctx.local_res.val;
      final_desc = ctx.local_res.desc;
      subtext = ctx.local_res.subtext;
    } else {
      let base_total = (gross_totals[ctx.g.currency] || 0) - ctx.pre_total_val;
      if (base_total < 0) base_total = 0;

      let total_pct_candidates = ctx.pct_total_rows.map(r => calculateRow(r, ctx.g.currency, base_total));
      let all_candidates = [...ctx.std_candidates, ...ctx.item_pct_candidates, ...total_pct_candidates];
      let final_res = resolveCandidates(all_candidates, ctx.g.logic, ctx.g.multiplier_active, ctx.safeMultiplier);
      
      final_val = final_res.val;
      final_desc = final_res.desc;
      subtext = final_res.subtext;
    }

    if (final_val > 0) {
      final_rows.push({
        item: ctx.g.title.toUpperCase(),
        desc: final_desc,
        curr: ctx.g.currency,
        amount: final_val,
        originalIndex: ctx.idx,
        isPctTotal: is_pct_total_group,
        subtext: subtext,
        candidates: is_pct_total_group ? undefined : ctx.local_res.all_candidates
      });
    }
  });

  let totals: Record<string, number> = {};
  CURRENCIES.forEach(c => totals[c] = 0);
  final_rows.forEach(r => { if (totals[r.curr] !== undefined) totals[r.curr] += r.amount; });

  final_rows.sort((a, b) => {
    if (a.curr !== b.curr) return a.curr.localeCompare(b.curr);
    if (a.isPctTotal !== b.isPctTotal) return a.isPctTotal ? 1 : -1;
    return a.originalIndex - b.originalIndex;
  });

  return { rows: final_rows, totals, meta: { cbm, kgs, pkgs } };
}
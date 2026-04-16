export interface Row {
  id: string;
  rate: number;
  divisor: number;
  use_divisor: boolean;
  unit: string;
  condition: string;
  min_type: 'AMT' | 'QTY';
  min_qty: number;
  round_up?: boolean;
  round_up_decimals?: number;
  /** Per-row time/qty multiplier. Multiplies this row's calculated amount by multiplier_value. */
  multiplier_active?: boolean;
  multiplier_value?: number;
}

export interface Group {
  id: string;
  title: string;
  currency: string;
  logic: 'MAX' | 'SUM';
  /** @deprecated Legacy group-level multiplier. Migrated into each row's multiplier_* on load. */
  multiplier_active?: boolean;
  /** @deprecated Legacy group-level multiplier value. Migrated into each row's multiplier_value on load. */
  multiplier_value?: number;
  rows: Row[];
}

export interface ChargeData {
  title: string;
  groups: Group[];
}

export type PresetsMap = Record<string, ChargeData>;

export interface HistoryItem {
  id: number;
  timestamp: string;
  ref: string;
  cbm: number;
  kgs: number;
  pkgs: number;
  summary: Record<string, { std: number; diff: number }>;
  snap_std: ChargeData;
  snap_req: ChargeData;
}

export interface CalculationResult {
  rows: CalculatedRow[];
  totals: Record<string, number>;
  meta: { cbm: number; kgs: number; pkgs: number };
}

export interface CandidateDetail {
  desc: string;
  amt: number;
  met: boolean;
  is_winner: boolean;
  calc_string: string;
}

export interface CalculatedRow {
  item: string;
  desc: string;
  curr: string;
  amount: number;
  originalIndex: number;
  isPctTotal: boolean;
  subtext?: string;
  is_pad?: boolean;
  candidates?: CandidateDetail[];
}

export const CURRENCIES = ['EUR', 'USD', 'HKD', 'RMB'];
export const CONDITIONS = {
  'NONE': '-',
  'MIN': 'Minimum',
  'HEAVY': 'Heavy (>20kg)',
  'LIGHT': 'Light (<20kg)',
  'OVER_5X': 'Over 5x (>5:1)'
};
export const UNITS = ['FLAT', 'SHPT', 'RT', 'CBM', 'TON', 'KGS', 'PKG', 'BL', '% ITEM', '% TOTAL'];

export const CHARGE_TEMPLATES: Record<string, Group> = {
  "EMPTY": {
    id: "", title: "NEW CHARGE", logic: "MAX", currency: "EUR",
    rows: [{ id: "", rate: 0, divisor: 1, use_divisor: false, unit: "FLAT", condition: "NONE", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 }]
  },
  "LCL CHARGES": {
      id: "", title: "LCL CHARGES", logic: "MAX", currency: "EUR",
      rows: [
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "CBM", condition: "NONE", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 },
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "TON", condition: "NONE", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 },
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "SHPT", condition: "MIN", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 }
      ]
  },
  "PIER CHARGES": {
      id: "", title: "PIER CHARGES", logic: "MAX", currency: "EUR",
      rows: [
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "TON", condition: "HEAVY", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 },
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "TON", condition: "LIGHT", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 },
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "RT", condition: "OVER_5X", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 },
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "SHPT", condition: "MIN", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 }
      ]
  },
  "STORAGE": {
      id: "", title: "STORAGE", logic: "SUM", currency: "EUR",
      rows: [
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "RT", condition: "NONE", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0, multiplier_active: true, multiplier_value: 3 }
      ]
  },
  "DELIVERY ORDER": {
      id: "", title: "DELIVERY ORDER", logic: "SUM", currency: "EUR",
      rows: [
          { id: "", rate: 0, divisor: 1, use_divisor: false, unit: "BL", condition: "NONE", min_type: "AMT", min_qty: 0, round_up: false, round_up_decimals: 0 }
      ]
  }
};

export const DEFAULT_PRESETS: PresetsMap = {
    "EMPTY": { groups: [], title: "Empty Template" }
};

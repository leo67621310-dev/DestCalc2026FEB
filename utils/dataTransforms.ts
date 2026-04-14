import { Group } from '../types';

const randomId = (prefix: 'g' | 'r') => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

export const ensureIds = <T extends { groups?: any[] }>(data: T): T => {
  if (!data || !data.groups) return data;
  data.groups.forEach((g: any) => {
    if (!g.id) g.id = randomId('g');
    (g.rows || []).forEach((r: any) => {
      if (!r.id) r.id = randomId('r');
    });
  });
  return data;
};

export const mapScannedGroups = (parsed: any): Group[] =>
  (parsed?.groups || []).map((g: any) => ({
    id: randomId('g'),
    title: g.title || 'Charge',
    currency: (g.currency || 'EUR').toUpperCase(),
    logic: g.logic || 'SUM',
    multiplier_active: !!g.is_storage,
    multiplier_value: g.min_days || 1,
    rows: (g.rows || []).map((r: any) => ({
      id: randomId('r'),
      rate: r.rate || 0,
      divisor: r.divisor || 1,
      use_divisor: r.divisor && r.divisor !== 1,
      unit: (r.unit || 'FLAT')
        .toUpperCase()
        .replace('M3', 'CBM')
        .replace('KG', 'KGS')
        .replace('TONS', 'TON')
        .replace('LS', 'FLAT')
        .replace('SHIPMENT', 'SHPT')
        .replace('% GROUP', '% ITEM'),
      condition: r.condition || 'NONE',
      min_type: 'AMT',
      min_qty: 0,
      round_up: r.round_up || false,
      round_up_decimals: r.round_up_decimals !== undefined ? r.round_up_decimals : 0,
    })),
  }));

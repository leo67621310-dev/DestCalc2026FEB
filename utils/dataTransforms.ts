import { Group } from '../types';

const randomId = (prefix: 'g' | 'r') => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Normalize a ChargeData-shaped object:
 *  - Assign stable ids to groups/rows that are missing them.
 *  - Migrate the legacy group-level multiplier (multiplier_active/multiplier_value)
 *    down onto each row so the per-row multiplier semantics take effect.
 *    Rows that already have their own multiplier are preserved.
 *    After migration, the legacy group fields are cleared so the app has one
 *    source of truth going forward.
 */
export const ensureIds = <T extends { groups?: any[] }>(data: T): T => {
  if (!data || !data.groups) return data;
  data.groups.forEach((g: any) => {
    if (!g.id) g.id = randomId('g');
    const rows = g.rows || [];
    const groupMultActive = !!g.multiplier_active;
    const groupMultValue = parseFloat(g.multiplier_value as any);
    const hasLegacyGroupMultiplier = groupMultActive && !isNaN(groupMultValue) && groupMultValue > 0;

    rows.forEach((r: any) => {
      if (!r.id) r.id = randomId('r');
      if (hasLegacyGroupMultiplier && r.multiplier_active === undefined && r.multiplier_value === undefined) {
        r.multiplier_active = true;
        r.multiplier_value = groupMultValue;
      }
    });

    if (hasLegacyGroupMultiplier) {
      delete g.multiplier_active;
      delete g.multiplier_value;
    }
  });
  return data;
};

export const mapScannedGroups = (parsed: any): Group[] =>
  (parsed?.groups || []).map((g: any) => {
    const isStorage = !!g.is_storage;
    const storageDays = parseFloat(g.min_days as any);
    const storageMultiplier = !isNaN(storageDays) && storageDays > 0 ? storageDays : 1;
    return {
      id: randomId('g'),
      title: g.title || 'Charge',
      currency: (g.currency || 'EUR').toUpperCase(),
      logic: g.logic || 'SUM',
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
        ...(isStorage ? { multiplier_active: true, multiplier_value: storageMultiplier } : {}),
      })),
    };
  });

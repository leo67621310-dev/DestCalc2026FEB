import { Group, UNITS } from '../types';

const randomId = (prefix: 'g' | 'r') => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Normalize a raw unit string (from Gemini scan, paste, or legacy data) to
 * one of the whitelisted app units. Falls back to 'FLAT' for anything we
 * can't confidently map, so the calculator never ends up with an unknown
 * unit (which previously silently behaved like FLAT but leaked the raw
 * label into the report description, e.g. "EUR 4.5/BILL").
 */
export const normalizeUnit = (raw: unknown): string => {
  if (!raw) return 'FLAT';
  let s = String(raw)
    .toUpperCase()
    .trim()
    .replace(/\./g, '')           // BILL. -> BILL
    .replace(/³/g, '3')           // M³ -> M3
    .replace(/\s+/g, ' ');        // collapse whitespace
  // Drop a leading "PER " so "PER KG" / "PER SHIPMENT" map cleanly.
  if (s.startsWith('PER ')) s = s.slice(4);

  // Exact already-whitelisted values pass through first.
  if (UNITS.includes(s)) return s;

  const SYNONYMS: Record<string, string> = {
    // BL
    'BILL': 'BL', 'B/L': 'BL', 'BOL': 'BL', 'HBL': 'BL', 'MBL': 'BL',
    'HOUSE BL': 'BL', 'MASTER BL': 'BL', 'HOUSE B/L': 'BL', 'MASTER B/L': 'BL',
    // TON
    'MT': 'TON', 'M/T': 'TON', 'METRIC TON': 'TON', 'METRIC TONS': 'TON',
    'TONNE': 'TON', 'TONNES': 'TON', 'TONS': 'TON', '1000KG': 'TON', '1000 KGS': 'TON',
    // CBM
    'M3': 'CBM', 'CUBIC METER': 'CBM', 'CUBIC METERS': 'CBM', 'CBM.': 'CBM',
    // KGS
    'KG': 'KGS', 'KILO': 'KGS', 'KILOS': 'KGS', 'KILOGRAM': 'KGS', 'KILOGRAMS': 'KGS',
    '100 KG': 'KGS', '100 KGS': 'KGS', '1000 KG': 'KGS',
    // PKG
    'PLT': 'PKG', 'PLTS': 'PKG', 'PALLET': 'PKG', 'PALLETS': 'PKG',
    'CTN': 'PKG', 'CTNS': 'PKG', 'CARTON': 'PKG', 'CARTONS': 'PKG',
    'BOX': 'PKG', 'BOXES': 'PKG', 'PKGS': 'PKG', 'PACKAGE': 'PKG', 'PACKAGES': 'PKG',
    'PCS': 'PKG', 'PIECE': 'PKG', 'PIECES': 'PKG', 'UNIT': 'PKG', 'UNITS': 'PKG',
    // SHPT
    'SHIPMENT': 'SHPT', 'SHPT.': 'SHPT', 'JOB': 'SHPT',
    // FLAT
    'LS': 'FLAT', 'LUMP SUM': 'FLAT', 'LUMPSUM': 'FLAT', 'FIXED': 'FLAT', 'FLAT FEE': 'FLAT',
    // RT
    'R/T': 'RT', 'REVENUE TON': 'RT', 'W/M': 'RT', 'WM': 'RT', 'WEIGHT MEASURE': 'RT',
    // Percentages
    '% GROUP': '% ITEM', '% OF ITEM': '% ITEM', '% OF CHARGE': '% ITEM', 'ITEM %': '% ITEM',
    '% OF TOTAL': '% TOTAL', '% INVOICE': '% TOTAL', 'TOTAL %': '% TOTAL', 'VAT': '% TOTAL',
  };

  if (SYNONYMS[s]) return SYNONYMS[s];

  // Heuristic: anything containing a % is percentage-based.
  if (s.includes('%')) {
    if (s.includes('TOTAL') || s.includes('INVOICE') || s === 'VAT') return '% TOTAL';
    return '% ITEM';
  }

  // Last-resort: if the normalized string contains a known token, match it.
  for (const u of UNITS) {
    if (u.includes('%')) continue;
    if (s === u || s.startsWith(u + ' ') || s.endsWith(' ' + u)) return u;
  }

  return 'FLAT';
};

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
        unit: normalizeUnit(r.unit),
        condition: r.condition || 'NONE',
        min_type: 'AMT',
        min_qty: 0,
        round_up: r.round_up || false,
        round_up_decimals: r.round_up_decimals !== undefined ? r.round_up_decimals : 0,
        ...(isStorage ? { multiplier_active: true, multiplier_value: storageMultiplier } : {}),
      })),
    };
  });

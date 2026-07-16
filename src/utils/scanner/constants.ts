import { TContractType, TScanAsset, TScannerFilterFlags, TScannerFilterTab } from './types';

// Faithful port of SCAN_ASSETS (reference/index-335-black-bars.html, lines 16639-16658) —
// the 15 synthetic symbols the Scanner always scans: 5 Volatility Indices, 5 Volatility
// (1s) Indices, 5 Jump Indices.
export const SCAN_ASSETS: TScanAsset[] = [
    { v: 'R_10', l: 'Volatility 10', g: 'vol' },
    { v: 'R_25', l: 'Volatility 25', g: 'vol' },
    { v: 'R_50', l: 'Volatility 50', g: 'vol' },
    { v: 'R_75', l: 'Volatility 75', g: 'vol' },
    { v: 'R_100', l: 'Volatility 100', g: 'vol' },
    { v: '1HZ10V', l: 'Vol 10 (1s)', g: 'vol1s' },
    { v: '1HZ25V', l: 'Vol 25 (1s)', g: 'vol1s' },
    { v: '1HZ50V', l: 'Vol 50 (1s)', g: 'vol1s' },
    { v: '1HZ75V', l: 'Vol 75 (1s)', g: 'vol1s' },
    { v: '1HZ100V', l: 'Vol 100 (1s)', g: 'vol1s' },
    { v: 'JD10', l: 'Jump 10 Index', g: 'jump' },
    { v: 'JD25', l: 'Jump 25 Index', g: 'jump' },
    { v: 'JD50', l: 'Jump 50 Index', g: 'jump' },
    { v: 'JD75', l: 'Jump 75 Index', g: 'jump' },
    { v: 'JD100', l: 'Jump 100 Index', g: 'jump' },
];

// Faithful port of CONTRACT_TYPES / CT_LABELS (reference lines 16660-16679).
export const CONTRACT_TYPES: TContractType[] = [
    'DIGITEVEN',
    'DIGITODD',
    'CALL',
    'PUT',
    'DIGITOVER',
    'DIGITUNDER',
    'DIGITMATCH',
    'DIGITDIFF',
];

export const CT_LABELS: Record<TContractType, string> = {
    DIGITEVEN: 'Even',
    DIGITODD: 'Odd',
    CALL: 'Rise',
    PUT: 'Fall',
    DIGITOVER: 'Over',
    DIGITUNDER: 'Under',
    DIGITMATCH: 'Match',
    DIGITDIFF: 'Differs',
};

// Filter tabs -> the ctsFilter array passed to _runScan (reference window._scout.scanFor
// call sites, lines 22981-22990) — 'all' passes null (score every contract type).
export const FILTER_TAB_CONTRACT_TYPES: Record<TScannerFilterTab, TContractType[] | null> = {
    all: null,
    eo: ['DIGITEVEN', 'DIGITODD'],
    ou: ['DIGITOVER', 'DIGITUNDER'],
    rf: ['CALL', 'PUT'],
    md: ['DIGITMATCH', 'DIGITDIFF'],
};

// Faithful port of window._DS (reference lines 18567-18586). Kept as a fixed constant —
// v1 defers the settings UI for these toggles (see task scope notes); the filter logic
// itself (_dsApplyImprovements) is still fully ported and always runs with these values.
export const SCANNER_FILTER_DEFAULTS: TScannerFilterFlags = {
    crossConfirm: true,
    regimeDetector: true,
    consecFilter: true,
    spreadFilter: true,
    clusterScore: true,
    contagion: false,
    stepParity: false,
    resistance9: false,
    timeOfDay: false,
    relaxedScoring: false,
    pctDiffMode: false,
};

// The reference's own functional default was 150 (window._scout.scan/scanFor's
// `parseInt(...) || 150`, lines 22976/22983) — this deliberately deviates from that,
// raising it to 1000 (matching the reference HTML input's own placeholder value) so a scan
// requires a full ~1000-tick sample per asset before scoring it, for higher-confidence
// signals.
export const DEFAULT_MIN_TICKS = 1000;

// Faithful port of _runScan's minTicks-not-reached log message (reference line 16884-16886)
// — used to know how many ticks TicksService.request() returns per asset (1000, per
// requestTicks' `count: 1000` — reference/ticks_service.js parity, not scanner-specific).
export const SCAN_ASSET_COUNT = SCAN_ASSETS.length;

// Faithful port of _runScan's tradetype family per contract (derived from
// src/pages/bot-builder/quick-strategy/config.ts's LAST_DIGIT_PREDICTION should_have gate
// and src/xml/*.xml TRADETYPE_LIST values — see TradeSetupStore.runBot).
export const CT_TO_TRADETYPE: Record<TContractType, string> = {
    DIGITEVEN: 'evenodd',
    DIGITODD: 'evenodd',
    CALL: 'callput',
    PUT: 'callput',
    DIGITOVER: 'overunder',
    DIGITUNDER: 'overunder',
    DIGITMATCH: 'matchesdiffers',
    DIGITDIFF: 'matchesdiffers',
};

// Contract families whose Quick Strategy form needs a `last_digit_prediction` (barrier)
// value — Rise/Fall (CALL/PUT) does not (see config.ts's LAST_DIGIT_PREDICTION
// should_have: multiple: ['matchesdiffers', 'overunder']).
export const CT_NEEDS_PREDICTION: Record<TContractType, boolean> = {
    DIGITEVEN: false,
    DIGITODD: false,
    CALL: false,
    PUT: false,
    DIGITOVER: true,
    DIGITUNDER: true,
    DIGITMATCH: true,
    DIGITDIFF: true,
};

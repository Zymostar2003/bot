import { TDigitPct, TFullHistoryTick } from '@/utils/signal-engine/types';

// Faithful port of SCAN_ASSETS entries (reference/index-335-black-bars.html, lines
// 16639-16658): v=symbol code, l=display label, g=asset group (used for grouping only,
// not currently surfaced in the UI).
export type TScanAssetGroup = 'vol' | 'vol1s' | 'jump';

export type TScanAsset = {
    v: string;
    l: string;
    g: TScanAssetGroup;
};

// Faithful port of CONTRACT_TYPES (reference lines 16660-16669).
export type TContractType =
    | 'DIGITEVEN'
    | 'DIGITODD'
    | 'CALL'
    | 'PUT'
    | 'DIGITOVER'
    | 'DIGITUNDER'
    | 'DIGITMATCH'
    | 'DIGITDIFF';

export type TScanQuality = 'SIGNAL' | 'WATCH' | 'REJECT';

// Session-local trend vs. this asset's previous scan score (ScannerStore._previous_scores)
// — new capability, no reference equivalent (the reference never compares across scans).
// Absent on an asset's first-ever appearance in a scan (nothing to compare against).
export type TScanTrend = 'up' | 'down' | 'flat';

// Tally of ScannerStore.helpers' dsRegime(hist) classification across every scanned asset
// in the current scan — new capability, no reference equivalent. Surfaced as a market-wide
// context banner so a scan that finds zero qualifying signals is explained ("market is
// volatile right now") instead of just looking broken.
export type TRegimeCounts = {
    quiet: number;
    normal: number;
    volatile: number;
    spiking: number;
};

// Filter tab shown in the Scanner UI — 'all' scores every CONTRACT_TYPES entry, the rest
// narrow to one contract family (matching the reference's per-tab ctsFilter passed to
// window._scout.scanFor — reference lines 22981-22990).
export type TScannerFilterTab = 'all' | 'eo' | 'ou' | 'rf' | 'md';

// Return shape of _scoreCombo/_dsApplyImprovements (reference lines 16888,
// 18666-18778, 18999-20190) before an asset/ctLabel is attached.
export type TScoreResult = {
    score: number;
    dir: string;
    reasons: string[];
    quality: TScanQuality;
    barrier?: number | null;
    // Set by _dsApplyImprovements' matches cluster-strength gate (reference line 18737) —
    // carried through for transparency only, not surfaced in v1 UI.
    dsClusterStrength?: number;
};

// One row of _sc.results (reference lines 16898-16911).
export type TScanResult = {
    asset: string;
    assetLabel: string;
    ct: TContractType;
    ctLabel: string;
    dir: string;
    score: number;
    reasons: string[];
    ticks: number;
    barrier: number | null;
    quality: TScanQuality;
    trend?: TScanTrend;
};

// window._DS toggle flags (reference lines 18567-18586). All fixed at their reference
// defaults for v1 — no settings UI is built for these (see task scope notes).
export type TScannerFilterFlags = {
    crossConfirm: boolean;
    regimeDetector: boolean;
    consecFilter: boolean;
    spreadFilter: boolean;
    clusterScore: boolean;
    contagion: boolean;
    stepParity: boolean;
    resistance9: boolean;
    timeOfDay: boolean;
    relaxedScoring: boolean;
    pctDiffMode: boolean;
};

// Signal-only payload passed to QuickStrategyStore.applySignalFromScanner — deliberately
// excludes every risk/money-management field (stake, size/unit, take_profit, loss,
// tick_count, max_stake, growth_rate); see that method's own boundary comment.
export type TScannerSignal = {
    symbol: string;
    tradetype: string;
    contractType: TContractType;
    prediction?: number;
};

export type { TDigitPct, TFullHistoryTick };

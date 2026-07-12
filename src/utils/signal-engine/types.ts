export type TTick = {
    epoch: number;
    quote: number;
};

export type TCandle = {
    epoch: number;
    open: number;
    high: number;
    low: number;
    close: number;
};

// Reference fullHistory tick shape (index-335-black-bars.html, state var comment at line 5436).
export type TFullHistoryTick = {
    price: number;
    digit: number;
    diff: number;
    time: number;
};

export type TGravitonPoint = {
    time: number;
    value: number;
    sigma: number;
    atr: number;
};

export type TPulsePoint = {
    time: number;
    value: number;
    atr: number;
};

export type TVfpiRegime = 'trending' | 'ranging';

export type TVfpiSignal = 'buy' | 'sell' | 'exhaustion' | null;

export type TVfpiResult = {
    time: number;
    vfpi: number;
    smooth: number;
    fama: number;
    famaSlow: number;
    confidence: number;
    regime: TVfpiRegime;
    er: number;
    hfd: number;
    stms: number;
    bps: number;
    famaVel: number;
    famaAcc: number;
    bullCross: boolean;
    bearCross: boolean;
    signal: TVfpiSignal;
};

export type TIndicatorBias = 'bull' | 'bear' | 'neutral';

export type TDigitPct = {
    digit: number;
    count: number;
    pct: number;
};

export type THysteresisEntry = {
    dir: string | null;
    holdTicks: number;
};

export type THysteresisState = {
    rf: THysteresisEntry;
    eo: THysteresisEntry;
    ou: THysteresisEntry;
};

export type TProSignalRF = {
    dir: 'RISE' | 'FALL';
    score: number;
    runs: number;
    streak: number;
};

export type TProSignalEO = {
    dir: 'EVEN' | 'ODD';
    score: number;
    runs: number;
    streak: number;
};

export type TProSignalOU = {
    dir: 'OVER' | 'UNDER';
    score: number;
    runs: number;
    gap: string;
};

export type TProSignalDiff = {
    digit: number;
    score: number;
    runs: number;
    pct: string;
};

export type TProSignalMatch = {
    digit: number;
    score: number;
    runs: number;
    pct: string;
};

export type TProSignalResult = {
    rf: TProSignalRF;
    eo: TProSignalEO;
    ou: TProSignalOU;
    diff: TProSignalDiff;
    mtch: TProSignalMatch;
    entropy: number;
    stable: boolean;
    vol: string;
};

export type TCrossSignal = 'BUY' | 'SELL' | null;

export type TCrossoverResult = {
    signal: TCrossSignal;
    lastSignal: TCrossSignal;
};

export type TChartMarker = {
    time: number;
    position: 'belowBar' | 'aboveBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown';
    text: string;
};

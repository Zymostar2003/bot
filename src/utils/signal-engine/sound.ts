// Faithful port of beep/beepSignal (reference: reference/index-335-black-bars.html,
// lines 5491-5501, 7279-7280).
//
// Structural change: the reference lazily creates a module-global `audioCtx` inside
// beep() itself, guarded by `soundOn`, and tracks `lastSignalPlay` as another module
// global. Here both are owned by the caller (SignalEngineStore) and passed in — a lazy
// `getAudioCtx` factory (so the AudioContext is still only ever constructed on the first
// actual beep, matching the reference) and the previous `lastSignalPlay` value.
export function beep(
    getAudioCtx: () => AudioContext,
    soundOn: boolean,
    freq = 880,
    dur = 0.15,
    type: OscillatorType = 'sine'
) {
    if (!soundOn) return;
    const audioCtx = getAudioCtx();
    const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.value = freq;
    o.type = type;
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start();
    o.stop(audioCtx.currentTime + dur);
}

// Returns the new lastSignalPlay value (faithful to beepSignal's `lastSignalPlay=sig`
// mutation, which happens whenever sig differs — regardless of whether soundOn is true).
export function beepSignal(
    getAudioCtx: () => AudioContext,
    soundOn: boolean,
    sig: 'RISE' | 'FALL',
    lastSignalPlay: string
): string {
    if (sig !== lastSignalPlay) {
        beep(getAudioCtx, soundOn, sig === 'RISE' ? 660 : 440, 0.3, 'sine');
        return sig;
    }
    return lastSignalPlay;
}

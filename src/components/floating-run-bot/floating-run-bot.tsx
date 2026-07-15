import React, { useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './floating-run-bot.scss';

const POS_KEY = 'dbot_fab_pos';
const CLICK_DEBOUNCE_MS = 350;
const DRAG_THRESHOLD_PX = 5;
const FAB_SIZE_PX = 62;

type TFabPosition = { left: number; top: number };

const loadSavedPosition = (): TFabPosition | null => {
    try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            const max_left = window.innerWidth - FAB_SIZE_PX - 4;
            const max_top = window.innerHeight - FAB_SIZE_PX - 4;
            return {
                left: Math.max(4, Math.min(max_left, saved.left)),
                top: Math.max(4, Math.min(max_top, saved.top)),
            };
        }
    } catch {
        // ignore corrupt storage
    }
    return null;
};

// Faithful port of the reference's draggable floating bot button (reference lines
// 25887-26153: "DRAGGABLE FLOATING BOT BUTTON (freeze-proof)") — toggled on/off via
// TradeSetupStore.is_fab_visible (see fab-toggle-section.tsx), rendered globally in
// main.tsx so it stays visible across every tab, not just Trade Setup.
//
// Structural simplification: the reference hand-rolls separate mousedown/touchstart/
// mousemove/touchmove/mouseup/touchend/touchcancel listeners, plus a 6s "drag safety timer",
// an 800ms watchdog interval, and window blur/visibilitychange listeners — all there to
// recover from a pointer getting "stuck" mid-drag across the two separate mouse/touch event
// models. The Pointer Events API used here (onPointerDown/Move/Up/Cancel +
// setPointerCapture) unifies mouse/touch/pen into one model and guarantees a matching up/
// cancel event even if the pointer leaves the element, so that whole class of stuck-drag
// bug — and everything built to work around it — doesn't apply; there's nothing to recover
// from. Likewise, the reference's tpFabSync()/800ms poll to keep the icon in sync with bot
// state is replaced by plain MobX reactivity (this component is an observer of
// run_panel.is_running), so the button's look is never stale.
const FloatingRunBot = observer(() => {
    const { trade_setup, run_panel } = useStore();
    const fab_ref = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState<TFabPosition | null>(loadSavedPosition);
    const drag_state = useRef({ dragging: false, moved: false, start_x: 0, start_y: 0, orig_x: 0, orig_y: 0 });
    const last_fire_ref = useRef(0);

    if (!trade_setup.is_fab_visible) return null;

    // Faithful port of fireToggle (reference lines 26064-26085) — reads the bot's true
    // running state directly from run_panel_store (dbot's own real run/stop state) rather
    // than a separate `TP.botRunning` flag, since Trade Setup's Run Bot already starts the
    // same underlying bot engine run_panel controls.
    const fireToggle = () => {
        const now = Date.now();
        if (now - last_fire_ref.current < CLICK_DEBOUNCE_MS) return;
        last_fire_ref.current = now;
        if (run_panel.is_running) {
            run_panel.onStopButtonClick();
        } else {
            trade_setup.runBot();
        }
    };

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        const fab = fab_ref.current;
        if (!fab) return;
        drag_state.current.dragging = true;
        drag_state.current.moved = false;
        drag_state.current.start_x = e.clientX;
        drag_state.current.start_y = e.clientY;
        const rect = fab.getBoundingClientRect();
        drag_state.current.orig_x = rect.left;
        drag_state.current.orig_y = rect.top;
        fab.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!drag_state.current.dragging) return;
        const dx = e.clientX - drag_state.current.start_x;
        const dy = e.clientY - drag_state.current.start_y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) drag_state.current.moved = true;

        const fab = fab_ref.current;
        if (!fab) return;
        const max_left = window.innerWidth - fab.offsetWidth - 4;
        const max_top = window.innerHeight - fab.offsetHeight - 4;
        setPosition({
            left: Math.max(4, Math.min(max_left, drag_state.current.orig_x + dx)),
            top: Math.max(4, Math.min(max_top, drag_state.current.orig_y + dy)),
        });
    };

    const onPointerUp = () => {
        if (!drag_state.current.dragging) return;
        drag_state.current.dragging = false;

        if (drag_state.current.moved) {
            // A drag, not a tap — persist the new position (reference lines 26045-26051).
            setPosition(current => {
                if (current) {
                    try {
                        localStorage.setItem(POS_KEY, JSON.stringify(current));
                    } catch {
                        // ignore storage errors (e.g. private browsing quota)
                    }
                }
                return current;
            });
            drag_state.current.moved = false;
        } else {
            fireToggle();
        }
    };

    const style: React.CSSProperties = position ? { left: position.left, top: position.top } : {};

    return (
        <button
            ref={fab_ref}
            type='button'
            className={classNames('floating-run-bot', { 'floating-run-bot--running': run_panel.is_running })}
            style={style}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <span className='floating-run-bot__icon'>{run_panel.is_running ? '⏹' : '▶'}</span>
            <span className='floating-run-bot__label'>{run_panel.is_running ? 'STOP' : 'RUN'}</span>
        </button>
    );
});

export default FloatingRunBot;

import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';

// Faithful port of Trade Setup's "▶ RUN BOT 1" button (reference lines 5719-5742) —
// TradeSetupStore.runBot() writes the panel's current config into dbot's Quick Strategy
// (MARTINGALE) form and submits with action:'RUN', starting the bot immediately, matching
// the reference's own "configure + run in one press" behaviour. Bot 2's separate
// "alternating contract pair" engine (reference lines 5745-6076) has no equivalent in dbot's
// bot engine and is out of scope for this pass — see trade-setup-store.ts's runBot comment.
const RunButton = observer(() => {
    const { trade_setup } = useStore();

    return (
        <button type='button' className='trade-setup__run-btn' onClick={trade_setup.runBot}>
            <Localize i18n_default_text='▶ Run Bot' />
        </button>
    );
});

export default RunButton;

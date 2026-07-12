import React from 'react';
import classNames from 'classnames';
import { TIndicatorBias } from '@/utils/signal-engine/types';
import { Localize } from '@deriv-com/translations';

type TBiasBadgeProps = {
    bias: TIndicatorBias;
};

// Faithful port of renderRF's biasBadge (reference: reference/index-335-black-bars.html,
// lines 7161-7166).
const BiasBadge = ({ bias }: TBiasBadgeProps) => (
    <span className={classNames('signal-engine-bias-badge', `signal-engine-bias-badge--${bias}`)}>
        {bias === 'bull' && (
            <>
                {'▲ '}
                <Localize i18n_default_text='VFPI BULL' />
            </>
        )}
        {bias === 'bear' && (
            <>
                {'▼ '}
                <Localize i18n_default_text='VFPI BEAR' />
            </>
        )}
        {bias === 'neutral' && <Localize i18n_default_text='VFPI — WAIT' />}
    </span>
);

export default BiasBadge;

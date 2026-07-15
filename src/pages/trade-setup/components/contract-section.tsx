import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { TRADE_SETUP_CONTRACT_TYPES } from '@/stores/trade-setup-store';
import { CT_LABELS } from '@/utils/scanner/constants';
import { TContractType } from '@/utils/scanner/types';
import { localize } from '@deriv-com/translations';
import TradeSetupSection from './trade-setup-section';

// Faithful port of Trade Setup's Contract Type chip row (reference lines 5160-5173).
const ContractSection = observer(() => {
    const { trade_setup } = useStore();
    const { contract_type, setContractType } = trade_setup;

    return (
        <TradeSetupSection title={localize('Contract Type')}>
            <div className='trade-setup__chips'>
                {TRADE_SETUP_CONTRACT_TYPES.map((ct: TContractType) => (
                    <button
                        key={ct}
                        type='button'
                        className={classNames('trade-setup__chip', {
                            'trade-setup__chip--active': ct === contract_type,
                        })}
                        onClick={() => setContractType(ct)}
                    >
                        {CT_LABELS[ct]}
                    </button>
                ))}
            </div>
        </TradeSetupSection>
    );
});

export default ContractSection;

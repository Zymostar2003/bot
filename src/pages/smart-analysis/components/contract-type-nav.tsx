import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { TSaContractType } from '@/utils/smart-analysis/types';
import { Localize } from '@deriv-com/translations';

// Faithful port of .sa-contract-grid (reference: index-335-black-bars.html, lines 4525-4530,
// click handler at 10932-10940) — hidden entirely for categories where the reference's
// showNav gate is false (Crash & Boom, Step; see shouldShowContractNav).
const CONTRACT_TYPES: { key: TSaContractType; label: React.ReactNode }[] = [
    { key: 'rise_fall', label: <Localize i18n_default_text='Rise / Fall' /> },
    { key: 'even_odd', label: <Localize i18n_default_text='Even / Odd' /> },
    { key: 'over_under', label: <Localize i18n_default_text='Over / Under' /> },
    { key: 'matches_differs', label: <Localize i18n_default_text='Matches / Differs' /> },
];

const ContractTypeNav = observer(() => {
    const { smart_analysis } = useStore();
    const { show_contract_nav, contract_type, setContractType } = smart_analysis;

    if (!show_contract_nav) return null;

    return (
        <div className='smart-analysis-contract-nav' role='tablist'>
            {CONTRACT_TYPES.map(ct => (
                <button
                    key={ct.key}
                    type='button'
                    role='tab'
                    aria-selected={contract_type === ct.key}
                    className={classNames('smart-analysis-contract-nav__btn', {
                        'smart-analysis-contract-nav__btn--active': contract_type === ct.key,
                    })}
                    onClick={() => setContractType(ct.key)}
                >
                    {ct.label}
                </button>
            ))}
        </div>
    );
});

export default ContractTypeNav;

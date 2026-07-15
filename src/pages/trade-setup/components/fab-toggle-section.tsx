import React from 'react';
import { observer } from 'mobx-react-lite';
import ToggleSwitch from '@/components/shared_ui/toggle-switch';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';

// Faithful port of the reference's "🎯 Floating Bot Button" menu item (reference lines
// 4744-4746) — placed inside Trade Setup itself rather than dbot's account/hamburger menu,
// since that menu is a shared, config-driven platform component (Cashier/TradersHub links,
// etc.) that only renders on mobile, unlike the reference's own bespoke sidebar. This keeps
// the toggle scoped to the feature it controls and reachable on every screen size.
const FabToggleSection = observer(() => {
    const { trade_setup } = useStore();

    return (
        <div className='trade-setup__section'>
            <div className='trade-setup__fab-toggle-row'>
                <span className='trade-setup__section-title trade-setup__section-title--inline'>
                    {'🎯 '}
                    <Localize i18n_default_text='Floating Bot Button' />
                </span>
                <ToggleSwitch
                    id='trade-setup-fab-toggle'
                    is_enabled={trade_setup.is_fab_visible}
                    handleToggle={trade_setup.toggleFab}
                />
            </div>
        </div>
    );
});

export default FabToggleSection;

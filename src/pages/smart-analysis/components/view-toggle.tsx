import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { Localize } from '@deriv-com/translations';

// Faithful port of #sa-view-toggle / saSetView (reference: index-335-black-bars.html, lines
// 4538-4580 markup, 10908-10924 logic) — switches between the Digit Stats and Last 50 views.
const ViewToggle = observer(() => {
    const { smart_analysis } = useStore();
    const { active_view, setActiveView } = smart_analysis;

    return (
        <div className='smart-analysis-view-toggle' role='tablist'>
            <button
                type='button'
                role='tab'
                aria-selected={active_view === 'digits'}
                className={classNames('smart-analysis-view-toggle__tab', {
                    'smart-analysis-view-toggle__tab--active': active_view === 'digits',
                })}
                onClick={() => setActiveView('digits')}
            >
                {'📊 '}
                <Localize i18n_default_text='Digit Stats' />
            </button>
            <button
                type='button'
                role='tab'
                aria-selected={active_view === 'worm'}
                className={classNames('smart-analysis-view-toggle__tab', {
                    'smart-analysis-view-toggle__tab--active': active_view === 'worm',
                })}
                onClick={() => setActiveView('worm')}
            >
                {'📈 '}
                <Localize i18n_default_text='Last 50' />
            </button>
        </div>
    );
});

export default ViewToggle;

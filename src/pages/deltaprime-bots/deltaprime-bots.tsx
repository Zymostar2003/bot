import React from 'react';
import { Localize } from '@deriv-com/translations';

// Placeholder tab — content (the actual bot list) is added later. Reuses the app's own
// pre-existing .tab-placeholder class (main.scss), previously defined but unused by any page.
const DeltaprimeBots = () => (
    <div className='tab-placeholder'>
        <Localize i18n_default_text='Deltaprime Bots — coming soon.' />
    </div>
);

export default DeltaprimeBots;

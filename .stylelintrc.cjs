module.exports = {
    plugins: ['stylelint-no-unsupported-browser-features'],
    rules: {
        'scss/at-mixin-pattern': null,
        'scss/no-global-function-names': null,
        'scss/dollar-variable-pattern': null,
        'color-named': 'never',
        'color-no-invalid-hex': true,
        'declaration-block-no-duplicate-properties': [true, { ignore: ['consecutive-duplicates'] }],
        'declaration-block-no-shorthand-property-overrides': true,
        'declaration-block-no-redundant-longhand-properties': null,
        'font-family-name-quotes': 'always-unless-keyword',
        'function-calc-no-unspaced-operator': true,
        'function-name-case': 'lower',
        'function-url-quotes': 'always',
        'no-duplicate-selectors': true,
        'no-invalid-double-slash-comments': true,
        'number-max-precision': 3,
        'no-descending-specificity': null,
        'no-invalid-position-at-import-rule': null,
        'selector-pseudo-class-no-unknown': [
            true,
            {
                ignorePseudoClasses: ['export'],
            },
        ],
        'selector-class-pattern': null,
        'selector-id-pattern': null,
        'selector-pseudo-element-colon-notation': 'single',
        'selector-pseudo-element-no-unknown': true,
        'selector-type-case': 'lower',
        'selector-type-no-unknown': [true, { ignoreTypes: ['from', 'to', '0%', '50%', '100%', '_'] }],
        'shorthand-property-no-redundant-values': true,
        'string-no-newline': true,
        'time-min-milliseconds': 100,
        'unit-allowed-list': ['fr', 'px', 'em', 'rem', '%', 'svh', 'vw', 'vh', 'deg', 'ms', 's', 'dpcm'],
        'value-keyword-case': 'lower',
        'scss/at-extend-no-missing-placeholder': null,
        'scss/percent-placeholder-pattern': null,
        'custom-property-pattern': null,
    },
    extends: ['stylelint-config-standard-scss'],
    ignoreFiles: ['packages/*/dist/**/*.css'],
    overrides: [
        {
            // Signal Engine ports literal rgba() from its reference implementation
            // (avoids color-mix()'s unsupported-browser-feature risk) — keep it from
            // being rewritten to modern rgb()-slash notation by lint-staged.
            files: ['src/pages/signal-engine/**/*.scss'],
            rules: {
                'color-function-notation': null,
                'alpha-value-notation': null,
            },
        },
        {
            // Smart Analysis ports literal rgba() from its reference implementation, same
            // rationale as the Signal Engine override above.
            files: ['src/pages/smart-analysis/**/*.scss'],
            rules: {
                'color-function-notation': null,
                'alpha-value-notation': null,
            },
        },
        {
            // Scanner follows the same convention as Signal Engine above: literal rgba()
            // for quality/status tint alphas ported from the reference implementation.
            files: ['src/pages/scanner/**/*.scss'],
            rules: {
                'color-function-notation': null,
                'alpha-value-notation': null,
            },
        },
        {
            // Digit Psychology (Over/Under + Even/Odd, split out of Signal Engine into its
            // own tab) inherits the same literal rgba() ports as the Signal Engine override
            // above, since this CSS was moved from signal-engine.scss largely unchanged.
            files: ['src/pages/digit-psychology/**/*.scss'],
            rules: {
                'color-function-notation': null,
                'alpha-value-notation': null,
            },
        },
        {
            // Tools (Risk/Calc/Report, ported from #tools-overlay) follows the same
            // convention as Signal Engine above: literal rgba() for pill/status tint alphas
            // ported from the reference implementation.
            files: ['src/pages/tools/**/*.scss'],
            rules: {
                'color-function-notation': null,
                'alpha-value-notation': null,
            },
        },
    ],
};

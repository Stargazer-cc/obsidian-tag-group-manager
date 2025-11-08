import tseslint from 'typescript-eslint';
import globals from 'globals';
import eslint from '@eslint/js'; // Import ESLint's recommended config

export default [
    eslint.configs.recommended, // Add ESLint's recommended rules
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    'argsIgnorePattern': '^_',
                    'varsIgnorePattern': '^_',
                },
            ],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/require-await': 'warn',
            'no-useless-escape': 'warn',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
        },
    }
];
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.next/**', 'out/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
)

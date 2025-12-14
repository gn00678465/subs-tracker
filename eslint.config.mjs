import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  stylistic: true,
  gitignore: true,
  jsonc: false,
  yaml: false,
  markdown: false,
}, {
  ignores: [
    'index.js',
  ],
}).overrideRules({
  'no-console': 'warn',
})

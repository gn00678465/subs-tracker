export default {
  'pre-commit': 'bun run lint:fix',
  'pre-push': 'bun run typecheck',
}

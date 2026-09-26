const gitleaks =
  'if command -v gitleaks >/dev/null 2>&1; then gitleaks git --staged --no-banner; else echo "[pre-commit] gitleaks 未安裝，略過 secret 掃描（brew install gitleaks）"; fi'

export default {
  'pre-commit': `${gitleaks} && bun run fmt:check && bun run lint`,
  'pre-push': 'bun run typecheck',
}

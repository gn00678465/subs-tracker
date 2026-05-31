export default {
  // gitleaks 為可選工具（非 npm 依賴）：已安裝時掃描 staged secret 並在命中時阻擋提交；
  // 未安裝時印出提示並略過（不擋乾淨環境/CI runner）。安裝：brew install gitleaks。
  'pre-commit': 'if command -v gitleaks >/dev/null 2>&1; then gitleaks git --staged --no-banner; else echo "[pre-commit] gitleaks 未安裝，略過 secret 掃描（brew install gitleaks）"; fi && bun run lint:fix',
  'pre-push': 'bun run typecheck && bun run test',
}

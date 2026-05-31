// Side-effect-free shared constants for the visual harness.
// visual.spec.ts imports from here (not seed.ts) so importing credentials
// never triggers the seed()'s KV writes.

// 已知 admin 帳密：getConfig 首次讀取時會把明文 ADMIN_PASSWORD 自動 hash，
// 因此 seed 明文、登入用同一明文即可成功。
export const ADMIN_USERNAME = 'admin'
export const ADMIN_PASSWORD = 'visual-harness-pw'

import type { Page, TestInfo } from '@playwright/test'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { ADMIN_PASSWORD, ADMIN_USERNAME } from './constants'

// 本機視覺審查工具（非 CI/PR gate；快照刻意不入庫且與平台相關，見 AGENTS.md）。
// 兩種模式 x 兩個 viewport（projects: desktop / mobile）：
// - 擷取模式（設定 VISUAL_CAPTURE_DIR）：每頁輸出 light + dark 全頁截圖，檔名帶 viewport
//   後綴（`<page>-<vp>.png` / `<page>-dark-<vp>.png`）避免 mobile/desktop 互蓋。**不做斷言**，
//   故 before（舊 style.css）與 after（HEAD）皆能產圖。
// - 比對模式（預設）：對 HEAD 跑 RWD + design-token 斷言，再以 toHaveScreenshot 對照本機基準。
const CAPTURE_DIR = process.env.VISUAL_CAPTURE_DIR

function vp(testInfo: TestInfo): string {
  return testInfo.project.name // 'desktop' | 'mobile'
}
function onMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name === 'mobile'
}

// RWD + design-token 斷言（僅比對模式對 HEAD 執行）。ctaSelector 為該頁的具名主要 CTA。
async function assertResponsiveAndTokens(page: Page, ctaSelector: string, testInfo: TestInfo): Promise<void> {
  // AC#8 cream canvas — 頁面畫布為暖奶油，非純白/透明（DESIGN.md「never pure white」）
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg, 'page canvas must be warm cream, not pure white').not.toBe('rgb(255, 255, 255)')
  expect(bg, 'page canvas must not be transparent').not.toBe('rgba(0, 0, 0, 0)')

  // AC#9 primary CTA pill radius >= 24px（兩 viewport）— 驗證 global .btn pill 覆寫
  const radius = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return el ? Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) : -1
  }, ctaSelector)
  expect(radius, `${ctaSelector} must render as a full pill (>=24px radius)`).toBeGreaterThanOrEqual(24)

  if (onMobile(testInfo)) {
    // AC#5 no horizontal overflow @390px
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'no horizontal body overflow on mobile').toBeLessThanOrEqual(1)

    // AC#6 named CTA tap-target >= 40px（floor；~48px expected）
    const box = await page.locator(ctaSelector).boundingBox()
    expect(box?.height ?? 0, `${ctaSelector} tap-target >=40px on mobile`).toBeGreaterThanOrEqual(40)
  }

  // AC#10 dark theme yields a dark (non-cream/non-white) canvas
  const darkBg = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const c = getComputedStyle(document.body).backgroundColor
    document.documentElement.setAttribute('data-theme', 'light')
    return c
  })
  expect(darkBg, 'dark theme canvas must be dark, not white').not.toBe('rgb(255, 255, 255)')
  expect(darkBg, 'dark theme canvas must differ from light cream').not.toBe('rgb(242, 240, 235)')
}

// AC#7 admin 列表在 mobile 以 .overflow-x-auto 包裹表格，水平捲動侷限於 wrapper 而非 body
async function assertTableReflow(page: Page): Promise<void> {
  const wrapped = await page.evaluate(() => {
    const wrap = document.querySelector('div.overflow-x-auto')
    if (!wrap || !wrap.querySelector('[role="table"]'))
      return false
    const ox = getComputedStyle(wrap).overflowX
    return ox === 'auto' || ox === 'scroll'
  })
  expect(wrapped, 'admin table must sit in an overflow-x wrapper').toBe(true)
}

// AC#6b NON-BLOCKING 探針：記錄 mobile 上 row-action .btn-xs 的最小高度，僅報告不擋
async function probeRowActions(page: Page, testInfo: TestInfo): Promise<void> {
  const minH = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#subscriptionsBody .btn-xs'))
    return btns.length ? Math.min(...btns.map(b => b.getBoundingClientRect().height)) : -1
  })
  testInfo.annotations.push({ type: 'row-action-min-height-mobile', description: `${minH}px` })
  console.warn(`[probe] /admin row-action .btn-xs min height (mobile): ${minH}px`)
}

async function shoot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  await page.waitForLoadState('networkidle')
  if (CAPTURE_DIR) {
    const tag = vp(testInfo)
    await page.screenshot({ path: `e2e/__screenshots__/${CAPTURE_DIR}/${name}-${tag}.png`, fullPage: true, animations: 'disabled' })
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.screenshot({ path: `e2e/__screenshots__/${CAPTURE_DIR}/${name}-dark-${tag}.png`, fullPage: true, animations: 'disabled' })
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    return
  }
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.locator('#systemTime')],
  })
}

test('login page', async ({ page }, testInfo) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  if (!CAPTURE_DIR)
    await assertResponsiveAndTokens(page, '#submitBtn', testInfo)
  await shoot(page, 'login', testInfo)
})

test('authenticated pages', async ({ page, context, request }, testInfo) => {
  const loginResponse = await request.post('/api/login', {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  })
  expect(loginResponse.status()).toBe(200)

  const cookies = await request.storageState()
  await context.addCookies(cookies.cookies)

  const adminResponse = await page.goto('/admin')
  expect(adminResponse?.status()).toBe(200)
  if (!CAPTURE_DIR) {
    await assertResponsiveAndTokens(page, '#addSubscriptionBtn', testInfo)
    if (onMobile(testInfo)) {
      await assertTableReflow(page)
      await probeRowActions(page, testInfo)
    }
  }
  await shoot(page, 'admin', testInfo)

  const configResponse = await page.goto('/admin/config')
  expect(configResponse?.status()).toBe(200)
  if (!CAPTURE_DIR)
    await assertResponsiveAndTokens(page, '#submitBtn', testInfo)
  await shoot(page, 'admin-config', testInfo)
})

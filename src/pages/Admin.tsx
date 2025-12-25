import type { FC } from 'hono/jsx'
import { Script } from 'vite-ssr-components/hono'
import { SubscriptionModal } from '../components/admin/SubscriptionModal'
import { Layout } from '../components/Layout'
import { Navbar } from '../components/Navbar'

interface AdminPageProps {
  username?: string
}

export const AdminPage: FC<AdminPageProps> = ({ username }) => {
  return (
    <Layout title="訂閱列表 - SubsTracker" description="管理訂閱提醒">
      <Navbar currentPage="admin" username={username} />

      <div class="container mx-auto p-4 max-w-7xl">
        {/* 搜索與篩選區域 */}
        <div class="card bg-base-100 shadow-xl mb-6">
          <div class="card-body">
            <div class="flex flex-col md:flex-row gap-4 items-end">
              {/* 搜索框 */}
              <div class="form-control flex-1">
                <label class="label">
                  <span class="label-text">搜索訂閱</span>
                </label>
                <div class="relative">
                  <input
                    type="text"
                    id="searchKeyword"
                    placeholder="搜索名稱、類型或備註..."
                    class="input input-bordered w-full pl-10"
                  />
                  <i data-lucide="search" class="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"></i>
                </div>
              </div>

              {/* 分類篩選 */}
              <div class="form-control w-full md:w-48">
                <label class="label">
                  <span class="label-text">分類篩選</span>
                </label>
                <select id="categoryFilter" class="select select-bordered">
                  <option value="">全部分類</option>
                </select>
              </div>

              {/* 添加按鈕 */}
              <button id="addSubscriptionBtn" class="btn btn-primary gap-2">
                <i data-lucide="plus" class="size-5"></i>
                添加訂閱
              </button>
            </div>
          </div>
        </div>

        {/* 訂閱列表表格 */}
        <div class="card bg-base-100 shadow-xl">
          <div class="overflow-x-auto">
            <div role="table" aria-label="訂閱列表" class="w-full table">
              {/* 桌面版標題 - 只在 md 以上顯示 */}
              <div
                role="rowgroup"
                class="hidden md:grid md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr] gap-4 px-4 py-3 bg-base-100 border-b border-base-content/10 font-semibold text-sm sticky top-0 z-10"
              >
                <div role="columnheader" class="flex items-center gap-1">名稱</div>
                <div role="columnheader" class="flex items-center gap-1">類型</div>
                <div role="columnheader" class="flex items-center gap-1">
                  到期時間
                </div>
                <div role="columnheader" class="flex items-center gap-1">提醒設置</div>
                <div role="columnheader" class="flex items-center gap-1">狀態</div>
                <div role="columnheader" class="flex items-center gap-1">操作</div>
              </div>

              {/* 內容區域 */}
              <div
                id="subscriptionsBody"
                role="rowgroup"
                class="[&>*:nth-child(even)]:bg-base-200"
              >
                {/* 初始 loading 狀態 */}
                <div role="row" class="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr]">
                  <div role="cell" class="md:col-span-6 text-center py-8">
                    <span class="loading loading-spinner loading-lg"></span>
                    <p class="mt-2 text-base-content/70">載入中...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubscriptionModal />

      <Script src="/src/client/admin/index.ts" type="module" />
      <Script src="/src/client/admin/subscriptionModal.ts" type="module" />
    </Layout>
  )
}

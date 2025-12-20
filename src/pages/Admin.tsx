import type { FC } from 'hono/jsx'
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

      {/* Toast 容器 */}
      <div id="toast" class="toast toast-top toast-end hidden z-50">
        <div id="toastAlert" class="alert shadow-lg">
          <span id="toastMessage"></span>
        </div>
      </div>

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
                  <svg
                    class="absolute left-3 top-3 w-5 h-5 text-base-content/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
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
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                添加訂閱
              </button>
            </div>
          </div>
        </div>

        {/* 訂閱列表表格 */}
        <div class="card bg-base-100 shadow-xl">
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th class="w-1/4">名稱</th>
                  <th class="w-1/6">類型</th>
                  <th class="w-1/5">
                    到期時間
                    <svg
                      class="inline w-4 h-4 ml-1 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 11l5-5m0 0l5 5m-5-5v12"
                      />
                    </svg>
                  </th>
                  <th class="w-1/6">提醒設置</th>
                  <th class="w-1/12">狀態</th>
                  <th class="w-1/6">操作</th>
                </tr>
              </thead>
              <tbody id="subscriptionsBody">
                {/* 由客戶端 JavaScript 動態填充 */}
                <tr>
                  <td colspan={6} class="text-center py-8">
                    <span class="loading loading-spinner loading-lg"></span>
                    <p class="mt-2 text-base-content/70">載入中...</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SubscriptionModal />

      <script type="module" src="/src/client/admin/index.ts"></script>
      <script type="module" src="/src/client/admin/subscriptionModal.ts"></script>
    </Layout>
  )
}

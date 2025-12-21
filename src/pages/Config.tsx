import type { FC } from 'hono/jsx'
import { Layout } from '../components/Layout'
import { Navbar } from '../components/Navbar'

interface ConfigPageProps {
  username?: string
}

export const ConfigPage: FC<ConfigPageProps> = ({ username }) => {
  return (
    <Layout title="系統配置 - SubsTracker" description="管理系統配置">
      <Navbar currentPage="config" username={username} />

      <div class="container mx-auto p-4 max-w-6xl">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title text-2xl mb-6">系統配置</h2>

            <form id="configForm">
              <div role="tablist" class="tabs tabs-border mb-6">
                {/* Tab 1: 基本設定 */}
                <input
                  type="radio"
                  name="config_tabs"
                  role="tab"
                  class="tab"
                  aria-label="基本設定"
                  checked
                />
                <div role="tabpanel" class="tab-content p-6">
                  {/* 管理員帳號 */}
                  <div class="form-control mb-6">
                    <h3 class="text-lg font-semibold mb-4">管理員帳號</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="label" for="adminUsername">
                          <span class="label-text">用戶名</span>
                        </label>
                        <input
                          type="text"
                          id="adminUsername"
                          name="ADMIN_USERNAME"
                          class="input input-bordered w-full"
                        />
                      </div>
                      <div>
                        <label class="label" for="adminPassword">
                          <span class="label-text">密碼</span>
                        </label>
                        <input
                          type="password"
                          id="adminPassword"
                          name="ADMIN_PASSWORD"
                          placeholder="留空表示不修改"
                          class="input input-bordered w-full"
                        />
                        <label class="label">
                          <span class="label-text-alt text-base-content/70">
                            留空表示不修改當前密碼
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 時區設定 */}
                  <div class="form-control mb-6">
                    <label class="label" for="timezone">
                      <span class="label-text">時區</span>
                    </label>
                    <select id="timezone" name="TIMEZONE" class="select select-bordered w-full">
                      <option value="UTC">世界標準時間（UTC+0）</option>
                      <option value="Asia/Shanghai">中國標準時間（UTC+8）</option>
                      <option value="Asia/Hong_Kong">香港時間（UTC+8）</option>
                      <option value="Asia/Taipei">台北時間（UTC+8）</option>
                      <option value="Asia/Singapore">新加坡時間（UTC+8）</option>
                      <option value="Asia/Tokyo">東京時間（UTC+9）</option>
                      <option value="America/New_York">紐約時間（UTC-5/-4）</option>
                      <option value="America/Los_Angeles">洛杉磯時間（UTC-8/-7）</option>
                      <option value="Europe/London">倫敦時間（UTC+0/+1）</option>
                      <option value="Europe/Paris">巴黎時間（UTC+1/+2）</option>
                    </select>
                  </div>

                  {/* 通知時段 */}
                  <div class="form-control">
                    <label class="label" for="notificationHours">
                      <span class="label-text">通知時段</span>
                    </label>
                    <input
                      type="text"
                      id="notificationHours"
                      name="NOTIFICATION_HOURS"
                      placeholder="例如：08, 12, 20 或輸入 * 表示全天"
                      class="input input-bordered w-full"
                    />
                    <label class="label">
                      <span class="label-text-alt">
                        可輸入多個小時（0-23），使用逗號或空格分隔，* 表示全天
                      </span>
                    </label>
                  </div>
                </div>

                {/* Tab 2: 通知渠道 */}
                <input type="radio" name="config_tabs" role="tab" class="tab" aria-label="通知渠道" />
                <div role="tabpanel" class="tab-content p-6">
                  {/* 渠道選擇 */}
                  <div class="form-control mb-6">
                    <h3 class="text-lg font-semibold mb-4">啟用的通知渠道</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          name="ENABLED_NOTIFIERS"
                          value="telegram"
                          class="checkbox checkbox-primary"
                        />
                        <span class="label-text">Telegram</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          name="ENABLED_NOTIFIERS"
                          value="notifyx"
                          class="checkbox checkbox-primary"
                          checked
                        />
                        <span class="label-text font-semibold">NotifyX</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          name="ENABLED_NOTIFIERS"
                          value="webhook"
                          class="checkbox checkbox-primary"
                        />
                        <span class="label-text">Webhook</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          name="ENABLED_NOTIFIERS"
                          value="email"
                          class="checkbox checkbox-primary"
                        />
                        <span class="label-text">郵件通知（Resend）</span>
                      </label>
                      <label class="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          name="ENABLED_NOTIFIERS"
                          value="bark"
                          class="checkbox checkbox-primary"
                        />
                        <span class="label-text">Bark</span>
                      </label>
                    </div>
                  </div>

                  {/* 第三方 API Token */}
                  <div class="form-control">
                    <label class="label" for="apiToken">
                      <span class="label-text">第三方 API 訪問令牌</span>
                    </label>
                    <div class="join w-full">
                      <input
                        type="text"
                        id="apiToken"
                        name="API_TOKEN"
                        placeholder="建議使用隨機字符串"
                        class="input input-bordered join-item flex-1"
                      />
                      <button type="button" id="generateToken" class="btn btn-primary join-item">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                          />
                        </svg>
                        生成令牌
                      </button>
                    </div>
                    <label class="label">
                      <span class="label-text-alt">
                        調用 /api/notify/&#123;token&#125; 接口時需攜帶此令牌
                      </span>
                    </label>
                  </div>
                </div>

                {/* Tab 3: 渠道配置 */}
                <input type="radio" name="config_tabs" role="tab" class="tab" aria-label="渠道配置" />
                <div role="tabpanel" class="tab-content p-6">
                  {/* Telegram 配置 */}
                  <div id="telegramConfig" class="card bg-base-200 mb-6 hidden">
                    <div class="card-body">
                      <h3 class="card-title">Telegram 配置</h3>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control">
                          <label class="label" for="tgBotToken">
                            <span class="label-text">Bot Token</span>
                          </label>
                          <input
                            type="text"
                            id="tgBotToken"
                            name="TELEGRAM_BOT_TOKEN"
                            placeholder="從 @BotFather 獲取"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="tgChatId">
                            <span class="label-text">Chat ID</span>
                          </label>
                          <input
                            type="text"
                            id="tgChatId"
                            name="TELEGRAM_CHAT_ID"
                            placeholder="可從 @userinfobot 獲取"
                            class="input input-bordered"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NotifyX 配置 */}
                  <div id="notifyxConfig" class="card bg-base-200 mb-6">
                    <div class="card-body">
                      <h3 class="card-title">NotifyX 配置</h3>
                      <div class="form-control">
                        <label class="label" for="notifyxApiKey">
                          <span class="label-text">API Key</span>
                        </label>
                        <input
                          type="text"
                          id="notifyxApiKey"
                          name="NOTIFYX_API_KEY"
                          placeholder="從 NotifyX 平台獲取"
                          class="input input-bordered"
                        />
                        <label class="label">
                          <span class="label-text-alt">
                            從
                            {' '}
                            <a
                              href="https://www.notifyx.cn/"
                              target="_blank"
                              class="link link-primary"
                            >
                              NotifyX 平台
                            </a>
                            {' '}
                            獲取
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Webhook 配置 */}
                  <div id="webhookConfig" class="card bg-base-200 mb-6 hidden">
                    <div class="card-body">
                      <h3 class="card-title">Webhook 配置</h3>
                      <div class="grid grid-cols-1 gap-4">
                        <div class="form-control">
                          <label class="label" for="webhookUrl">
                            <span class="label-text">Webhook URL</span>
                          </label>
                          <input
                            type="url"
                            id="webhookUrl"
                            name="WEBHOOK_URL"
                            placeholder="https://your-webhook-endpoint.com/path"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="webhookMethod">
                            <span class="label-text">HTTP 方法</span>
                          </label>
                          <select
                            id="webhookMethod"
                            name="WEBHOOK_METHOD"
                            class="select select-bordered"
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                        <div class="form-control">
                          <label class="label" for="webhookHeaders">
                            <span class="label-text">自訂請求頭（JSON 格式）</span>
                          </label>
                          <textarea
                            id="webhookHeaders"
                            name="WEBHOOK_HEADERS"
                            placeholder='{"Authorization": "Bearer your-token"}'
                            class="textarea textarea-bordered h-24"
                          >
                          </textarea>
                        </div>
                        <div class="form-control">
                          <label class="label" for="webhookTemplate">
                            <span class="label-text">請求體模板（JSON 格式）</span>
                          </label>
                          <textarea
                            id="webhookTemplate"
                            name="WEBHOOK_TEMPLATE"
                            placeholder='{"title": "{{title}}", "content": "{{content}}", "timestamp": "{{timestamp}}"}'
                            class="textarea textarea-bordered h-24"
                          >
                          </textarea>
                          <label class="label">
                            <span class="label-text-alt">
                              支持變數：&#123;&#123;title&#125;&#125;、&#123;&#123;content&#125;&#125;、&#123;&#123;timestamp&#125;&#125;
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Email 配置 */}
                  <div id="emailConfig" class="card bg-base-200 mb-6 hidden">
                    <div class="card-body">
                      <h3 class="card-title">郵件通知配置（Resend）</h3>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control">
                          <label class="label" for="resendApiKey">
                            <span class="label-text">Resend API Key</span>
                          </label>
                          <input
                            type="text"
                            id="resendApiKey"
                            name="RESEND_API_KEY"
                            placeholder="re_xxxxxxxxxx"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="emailFrom">
                            <span class="label-text">發件人郵箱</span>
                          </label>
                          <input
                            type="email"
                            id="emailFrom"
                            name="EMAIL_FROM"
                            placeholder="noreply@yourdomain.com"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="emailFromName">
                            <span class="label-text">發件人名稱</span>
                          </label>
                          <input
                            type="text"
                            id="emailFromName"
                            name="EMAIL_FROM_NAME"
                            placeholder="訂閱提醒系統"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="emailTo">
                            <span class="label-text">收件人郵箱</span>
                          </label>
                          <input
                            type="email"
                            id="emailTo"
                            name="EMAIL_TO"
                            placeholder="user@example.com"
                            class="input input-bordered"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bark 配置 */}
                  <div id="barkConfig" class="card bg-base-200 mb-6 hidden">
                    <div class="card-body">
                      <h3 class="card-title">Bark 配置</h3>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control">
                          <label class="label" for="barkServer">
                            <span class="label-text">Bark 服務器地址</span>
                          </label>
                          <input
                            type="url"
                            id="barkServer"
                            name="BARK_SERVER"
                            placeholder="https://api.day.app"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control">
                          <label class="label" for="barkKey">
                            <span class="label-text">設備 Key</span>
                          </label>
                          <input
                            type="text"
                            id="barkKey"
                            name="BARK_KEY"
                            placeholder="從 Bark 應用獲取的設備 Key"
                            class="input input-bordered"
                          />
                        </div>
                        <div class="form-control col-span-2">
                          <label class="label cursor-pointer justify-start gap-3">
                            <input
                              type="checkbox"
                              id="barkSave"
                              name="BARK_SAVE"
                              class="checkbox checkbox-primary"
                            />
                            <span class="label-text">保存推送消息到歷史記錄</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div class="alert alert-info">
                    <svg
                      class="stroke-current shrink-0 w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      渠道配置會根據「通知渠道」頁籤中的選擇自動顯示或隱藏
                    </span>
                  </div>
                </div>
              </div>

              {/* 提交按鈕 */}
              <div class="flex justify-end gap-2">
                <button type="button" id="resetBtn" class="btn btn-ghost">
                  重置
                </button>
                <button type="submit" id="submitBtn" class="btn btn-primary">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span id="submitText">保存配置</span>
                  <span id="submitLoading" class="loading loading-spinner loading-sm hidden"></span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 客戶端邏輯 */}
      <script type="module" src="/src/client/config/index.ts"></script>
    </Layout>
  )
}

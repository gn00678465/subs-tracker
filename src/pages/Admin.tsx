import type { FC } from 'hono/jsx'
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

      {/* 添加/編輯模態框 */}
      <dialog id="subscriptionModal" class="modal">
        <div class="modal-box w-11/12 max-w-3xl">
          {/* 關閉按鈕 */}
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>

          <h3 id="modalTitle" class="font-bold text-lg mb-4">添加新訂閱</h3>

          <form id="subscriptionForm" class="space-y-4">
            <input type="hidden" id="subscriptionId" />

            {/* 基本信息 - 3列佈局 */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">訂閱名稱 *</span>
                </label>
                <input type="text" id="name" required class="input input-bordered" />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">訂閱類型</span>
                </label>
                <input
                  type="text"
                  id="customType"
                  placeholder="例如：流媒體、雲服務"
                  class="input input-bordered"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">分類標籤</span>
                </label>
                <input
                  type="text"
                  id="category"
                  placeholder="例如：個人、家庭"
                  class="input input-bordered"
                />
                <label class="label">
                  <span class="label-text-alt">可使用 / 分隔多個標籤</span>
                </label>
              </div>
            </div>

            {/* 日期設置 - 使用原生 date input */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">開始日期</span>
                </label>
                <input
                  type="date"
                  id="startDate"
                  class="input input-bordered"
                  min="1900-01-01"
                  max="2100-12-31"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">到期日期 *</span>
                </label>
                <input
                  type="date"
                  id="expiryDate"
                  required
                  class="input input-bordered"
                  min="1900-01-01"
                  max="2100-12-31"
                />
              </div>
            </div>

            {/* 周期設置 */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">周期數值 *</span>
                </label>
                <input
                  type="number"
                  id="periodValue"
                  required
                  min="1"
                  value="1"
                  class="input input-bordered"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">周期單位</span>
                </label>
                <select id="periodUnit" class="select select-bordered">
                  <option value="day">天</option>
                  <option value="month" selected>月</option>
                  <option value="year">年</option>
                </select>
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">&nbsp;</span>
                </label>
                <button type="button" id="calculateBtn" class="btn btn-outline btn-sm">
                  自動計算到期日期
                </button>
              </div>
            </div>

            {/* 提醒設置 */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">提醒提前量</span>
                </label>
                <input
                  type="number"
                  id="reminderValue"
                  min="0"
                  value="7"
                  class="input input-bordered"
                />
              </div>
              <div class="form-control">
                <label class="label">
                  <span class="label-text">提醒單位</span>
                </label>
                <select id="reminderUnit" class="select select-bordered">
                  <option value="day" selected>天</option>
                  <option value="hour">小時</option>
                </select>
              </div>
            </div>

            {/* 備註 */}
            <div class="form-control">
              <label class="label">
                <span class="label-text">備註</span>
              </label>
              <textarea
                id="notes"
                placeholder="添加備註信息..."
                class="textarea textarea-bordered h-24"
              >
              </textarea>
            </div>

            {/* 選項 */}
            <div class="flex gap-6">
              <label class="label cursor-pointer gap-2">
                <input type="checkbox" id="isActive" checked class="checkbox checkbox-primary" />
                <span class="label-text">啟用訂閱</span>
              </label>
              <label class="label cursor-pointer gap-2">
                <input type="checkbox" id="autoRenew" checked class="checkbox checkbox-primary" />
                <span class="label-text">自動續訂</span>
              </label>
            </div>

            {/* 提交按鈕 */}
            <div class="modal-action">
              <button type="button" id="cancelBtn" class="btn btn-ghost">取消</button>
              <button type="submit" class="btn btn-primary">
                <span id="submitText">保存</span>
                <span id="submitLoading" class="loading loading-spinner loading-sm hidden"></span>
              </button>
            </div>
          </form>
        </div>

        {/* 模態框背景 */}
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* 客戶端 JavaScript */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  'use strict';

  // ===== 全局變量 =====
  let subscriptionsCache = [];
  let searchDebounceTimer = null;

  // ===== 工具函數 =====
  function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    const alert = document.getElementById('toastAlert');
    const msg = document.getElementById('toastMessage');

    alert.className = 'alert shadow-lg alert-' + type;
    msg.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(function() {
      toast.classList.add('hidden');
    }, 3000);
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  // ===== API 交互 =====
  async function loadSubscriptions(showLoading) {
    showLoading = showLoading !== false;
    try {
      const tbody = document.getElementById('subscriptionsBody');

      if (tbody && showLoading) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="loading loading-spinner loading-lg"></span><p class="mt-2 text-base-content/70">載入中...</p></td></tr>';
      }

      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error('載入失敗');

      const data = await response.json();
      subscriptionsCache = data.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

      populateCategoryFilter(subscriptionsCache);
      renderSubscriptionTable();
    } catch (error) {
      console.error('載入訂閱失敗:', error);
      const tbody = document.getElementById('subscriptionsBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-error"><svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p>載入失敗，請刷新頁面重試</p></td></tr>';
      }
      showToast('載入訂閱列表失敗', 'error');
    }
  }

  function populateCategoryFilter(subscriptions) {
    const select = document.getElementById('categoryFilter');
    if (!select) return;

    const previousValue = select.value;
    const categories = new Set();

    subscriptions.forEach(function(sub) {
      if (sub.category) {
        sub.category.split(/[\\/,\\s]+/).forEach(function(token) {
          const trimmed = token.trim();
          if (trimmed) categories.add(trimmed);
        });
      }
    });

    const sorted = Array.from(categories).sort(function(a, b) {
      return a.localeCompare(b, 'zh-TW');
    });

    select.innerHTML = '<option value="">全部分類</option>';
    sorted.forEach(function(cat) {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });

    if (previousValue && sorted.indexOf(previousValue) !== -1) {
      select.value = previousValue;
    }
  }

  function renderSubscriptionTable() {
    const tbody = document.getElementById('subscriptionsBody');
    if (!tbody) return;

    const searchKeyword = (document.getElementById('searchKeyword').value || '').trim().toLowerCase();
    const categoryFilter = (document.getElementById('categoryFilter').value || '').trim().toLowerCase();

    let filtered = subscriptionsCache.slice();

    if (categoryFilter) {
      filtered = filtered.filter(function(sub) {
        if (!sub.category) return false;
        const tokens = sub.category.split(/[\\/,\\s]+/).map(function(t) {
          return t.trim().toLowerCase();
        });
        return tokens.indexOf(categoryFilter) !== -1;
      });
    }

    if (searchKeyword) {
      filtered = filtered.filter(function(sub) {
        const haystack = [sub.name, sub.customType, sub.notes, sub.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.indexOf(searchKeyword) !== -1;
      });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-base-content/70"><svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p>沒有符合條件的訂閱</p></td></tr>';
      return;
    }

    filtered.sort(function(a, b) {
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    tbody.innerHTML = '';
    const currentTime = new Date();

    filtered.forEach(function(sub) {
      const row = document.createElement('tr');
      row.className = sub.isActive === false ? 'opacity-60' : '';

      const expiryDate = new Date(sub.expiryDate);
      const diffMs = expiryDate - currentTime;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

      const reminderValue = sub.reminderValue || 7;
      const reminderUnit = sub.reminderUnit || 'day';
      const isSoon = reminderUnit === 'hour'
        ? diffHours >= 0 && diffHours <= reminderValue
        : diffDays >= 0 && diffDays <= reminderValue;

      let statusBadge = '';
      if (!sub.isActive) {
        statusBadge = '<div class="badge badge-neutral gap-2">已停用</div>';
      } else if (diffDays < 0) {
        statusBadge = '<div class="badge badge-error gap-2">已過期</div>';
      } else if (isSoon) {
        statusBadge = '<div class="badge badge-warning gap-2">即將到期</div>';
      } else {
        statusBadge = '<div class="badge badge-success gap-2">正常</div>';
      }

      let daysLeftText = '';
      if (diffMs < 0) {
        const absDays = Math.abs(diffDays);
        daysLeftText = absDays >= 1
          ? '已過期 ' + absDays + ' 天'
          : '已過期 ' + Math.abs(diffHours) + ' 小時';
      } else if (diffDays >= 1) {
        daysLeftText = '還剩 ' + diffDays + ' 天';
      } else {
        daysLeftText = diffHours > 0
          ? '約 ' + diffHours + ' 小時後到期'
          : '即將到期';
      }

      const categoryBadges = sub.category
        ? sub.category.split(/[\\/,\\s]+/)
            .filter(function(t) { return t.trim(); })
            .map(function(cat) {
              return '<div class="badge badge-outline badge-sm">' + cat.trim() + '</div>';
            })
            .join(' ')
        : '';

      const unitText = sub.periodUnit === 'day' ? '天' : (sub.periodUnit === 'month' ? '月' : '年');
      const reminderUnitText = reminderUnit === 'hour' ? '小時' : '天';

      row.innerHTML = '<td><div class="font-medium">' + sub.name + '</div>' +
        (sub.notes ? '<div class="text-sm text-base-content/70 mt-1">' + (sub.notes.length > 50 ? sub.notes.substring(0, 50) + '...' : sub.notes) + '</div>' : '') +
        '</td><td><div>' + (sub.customType || '其他') + '</div>' +
        (sub.periodValue ? '<div class="text-sm text-base-content/70 mt-1">周期: ' + sub.periodValue + ' ' + unitText + '</div>' : '') +
        (categoryBadges ? '<div class="flex flex-wrap gap-1 mt-2">' + categoryBadges + '</div>' : '') +
        '</td><td><div>' + formatDate(sub.expiryDate) + '</div><div class="text-sm text-base-content/70 mt-1">' + daysLeftText + '</div>' +
        (sub.startDate ? '<div class="text-xs text-base-content/50 mt-1">開始: ' + formatDate(sub.startDate) + '</div>' : '') +
        '</td><td><div>提前 ' + reminderValue + ' ' + reminderUnitText + '</div>' +
        (reminderValue === 0 ? '<div class="text-sm text-base-content/70 mt-1">僅到期時提醒</div>' : '') +
        '</td><td>' + statusBadge +
        '</td><td><div class="flex flex-wrap gap-1"><button class="btn btn-primary btn-xs" onclick="editSubscription(\\'' + sub.id + '\\')">編輯</button>' +
        '<button class="btn btn-info btn-xs" onclick="testNotify(\\'' + sub.id + '\\')">測試</button>' +
        '<button class="btn btn-error btn-xs" onclick="deleteSubscription(\\'' + sub.id + '\\')">刪除</button>' +
        (sub.isActive
          ? '<button class="btn btn-warning btn-xs" onclick="toggleStatus(\\'' + sub.id + '\\', false)">停用</button>'
          : '<button class="btn btn-success btn-xs" onclick="toggleStatus(\\'' + sub.id + '\\', true)">啟用</button>') +
        '</div></td>';

      tbody.appendChild(row);
    });
  }

  // ===== 模態框邏輯 =====
  function openAddModal() {
    const modal = document.getElementById('subscriptionModal');
    const form = document.getElementById('subscriptionForm');
    const title = document.getElementById('modalTitle');

    form.reset();
    document.getElementById('subscriptionId').value = '';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('periodValue').value = '1';
    document.getElementById('periodUnit').value = 'month';
    document.getElementById('reminderValue').value = '7';
    document.getElementById('reminderUnit').value = 'day';
    document.getElementById('isActive').checked = true;
    document.getElementById('autoRenew').checked = true;

    calculateExpiryDate();

    title.textContent = '添加新訂閱';
    modal.showModal();
  }

  function calculateExpiryDate() {
    const startDateInput = document.getElementById('startDate');
    const periodValueInput = document.getElementById('periodValue');
    const periodUnitSelect = document.getElementById('periodUnit');
    const expiryDateInput = document.getElementById('expiryDate');

    const startDate = startDateInput.value;
    const periodValue = parseInt(periodValueInput.value);
    const periodUnit = periodUnitSelect.value;

    if (!startDate || !periodValue || periodValue < 1 || !periodUnit) {
      return;
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) return;

    const expiry = new Date(start);

    if (periodUnit === 'day') {
      expiry.setDate(start.getDate() + periodValue);
    } else if (periodUnit === 'month') {
      expiry.setMonth(start.getMonth() + periodValue);
    } else if (periodUnit === 'year') {
      expiry.setFullYear(start.getFullYear() + periodValue);
    }

    expiryDateInput.value = expiry.toISOString().split('T')[0];
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const submitText = document.getElementById('submitText');
    const submitLoading = document.getElementById('submitLoading');

    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');

    try {
      const id = document.getElementById('subscriptionId').value;
      const data = {
        name: document.getElementById('name').value.trim(),
        customType: document.getElementById('customType').value.trim() || undefined,
        category: document.getElementById('category').value.trim() || undefined,
        startDate: document.getElementById('startDate').value || undefined,
        expiryDate: document.getElementById('expiryDate').value,
        periodValue: parseInt(document.getElementById('periodValue').value),
        periodUnit: document.getElementById('periodUnit').value,
        reminderValue: parseInt(document.getElementById('reminderValue').value),
        reminderUnit: document.getElementById('reminderUnit').value,
        notes: document.getElementById('notes').value.trim() || undefined,
        isActive: document.getElementById('isActive').checked,
        autoRenew: document.getElementById('autoRenew').checked
      };

      if (!data.name) {
        throw new Error('請輸入訂閱名稱');
      }
      if (!data.expiryDate) {
        throw new Error('請選擇到期日期');
      }
      if (!data.periodValue || data.periodValue < 1) {
        throw new Error('周期數值必須大於 0');
      }

      const url = id ? '/api/subscriptions/' + id : '/api/subscriptions';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '保存失敗');
      }

      showToast(id ? '更新成功' : '添加成功', 'success');
      document.getElementById('subscriptionModal').close();
      loadSubscriptions();
    } catch (error) {
      console.error('保存失敗:', error);
      showToast(error.message || '保存失敗，請稍後再試', 'error');
    } finally {
      submitBtn.disabled = false;
      submitText.classList.remove('hidden');
      submitLoading.classList.add('hidden');
    }
  }

  async function editSubscriptionImpl(id) {
    try {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error('獲取訂閱詳情失敗');

      const data = await response.json();
      const subscriptions = data.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      const sub = subscriptions.find(function(s) { return s.id === id; });

      if (!sub) {
        throw new Error('訂閱不存在');
      }

      document.getElementById('subscriptionId').value = sub.id;
      document.getElementById('name').value = sub.name;
      document.getElementById('customType').value = sub.customType || '';
      document.getElementById('category').value = sub.category || '';
      document.getElementById('startDate').value = sub.startDate ? sub.startDate.split('T')[0] : '';
      document.getElementById('expiryDate').value = sub.expiryDate.split('T')[0];
      document.getElementById('periodValue').value = sub.periodValue || 1;
      document.getElementById('periodUnit').value = sub.periodUnit || 'month';

      const reminderUnit = sub.reminderUnit || (sub.reminderHours !== undefined ? 'hour' : 'day');
      const reminderValue = sub.reminderValue || (reminderUnit === 'hour' ? sub.reminderHours : sub.reminderDays) || 7;

      document.getElementById('reminderUnit').value = reminderUnit;
      document.getElementById('reminderValue').value = reminderValue;
      document.getElementById('notes').value = sub.notes || '';
      document.getElementById('isActive').checked = sub.isActive !== false;
      document.getElementById('autoRenew').checked = sub.autoRenew !== false;

      document.getElementById('modalTitle').textContent = '編輯訂閱';
      document.getElementById('subscriptionModal').showModal();
    } catch (error) {
      console.error('編輯訂閱失敗:', error);
      showToast('獲取訂閱詳情失敗', 'error');
    }
  }

  // ===== 事件綁定 =====
  function attachEventListeners() {
    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function() {
          renderSubscriptionTable();
        }, 300);
      });
    }

    const categorySelect = document.getElementById('categoryFilter');
    if (categorySelect) {
      categorySelect.addEventListener('change', function() {
        renderSubscriptionTable();
      });
    }

    const addBtn = document.getElementById('addSubscriptionBtn');
    if (addBtn) {
      addBtn.addEventListener('click', openAddModal);
    }

    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', calculateExpiryDate);
    }

    const startDate = document.getElementById('startDate');
    if (startDate) {
      startDate.addEventListener('change', calculateExpiryDate);
    }

    const periodValue = document.getElementById('periodValue');
    if (periodValue) {
      periodValue.addEventListener('input', calculateExpiryDate);
    }

    const periodUnit = document.getElementById('periodUnit');
    if (periodUnit) {
      periodUnit.addEventListener('change', calculateExpiryDate);
    }

    const subscriptionForm = document.getElementById('subscriptionForm');
    if (subscriptionForm) {
      subscriptionForm.addEventListener('submit', handleFormSubmit);
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        document.getElementById('subscriptionModal').close();
      });
    }
  }

  // ===== 初始化 =====
  document.addEventListener('DOMContentLoaded', function() {
    loadSubscriptions();
    attachEventListeners();
  });

  // ===== 操作功能 =====
  async function deleteSubscriptionImpl(id) {
    if (!confirm('確定要刪除這個訂閱嗎？此操作不可恢復。')) {
      return;
    }

    try {
      const response = await fetch('/api/subscriptions/' + id, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '刪除失敗');
      }

      showToast('刪除成功', 'success');
      loadSubscriptions();
    } catch (error) {
      console.error('刪除失敗:', error);
      showToast(error.message || '刪除失敗，請稍後再試', 'error');
    }
  }

  async function toggleStatusImpl(id, isActive) {
    try {
      const response = await fetch('/api/subscriptions/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: isActive })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '操作失敗');
      }

      showToast(isActive ? '啟用成功' : '停用成功', 'success');
      loadSubscriptions();
    } catch (error) {
      console.error('切換狀態失敗:', error);
      showToast(error.message || '操作失敗，請稍後再試', 'error');
    }
  }

  async function testNotifyImpl(id) {
    try {
      const response = await fetch('/api/subscriptions/' + id + '/test', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '發送失敗');
      }

      const result = await response.json();
      showToast(result.message || '測試通知已發送', 'success');
    } catch (error) {
      console.error('測試通知失敗:', error);
      showToast(error.message || '發送測試通知失敗', 'error');
    }
  }

  // ===== 暴露全局函數（供 onclick 使用）=====
  window.editSubscription = editSubscriptionImpl;
  window.deleteSubscription = deleteSubscriptionImpl;
  window.toggleStatus = toggleStatusImpl;
  window.testNotify = testNotifyImpl;
})();
          `,
        }}
      />
    </Layout>
  )
}

import type { FC } from 'hono/jsx'
import { Layout } from '../components/Layout'
import ThemeToggle from '../components/ToggleTheme'

export const LoginPage: FC = () => {
  return (
    <Layout title="登入 - SubsTracker" description="登入訂閱管理系統">
      <ThemeToggle class="fixed top-4 right-4 z-50" />
      <div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div class="card w-full max-w-md bg-base-100 shadow-xl">
          <div class="card-body">
            {/* 標題 */}
            <div class="text-center mb-6">
              <h1 class="text-3xl font-bold text-base-content">SubsTracker</h1>
              <p class="text-base-content/70 mt-2">登入管理您的訂閱提醒</p>
            </div>

            {/* 表單 */}
            <form id="loginForm" class="space-y-4">
              {/* 用戶名輸入 */}
              <div class="form-control">
                <label class="label" for="username">
                  <span class="label-text">用戶名</span>
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="請輸入用戶名"
                  class="input input-bordered w-full"
                  required
                  autocomplete="username"
                />
              </div>

              {/* 密碼輸入 */}
              <div class="form-control">
                <label class="label" for="password">
                  <span class="label-text">密碼</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="請輸入密碼"
                  class="input input-bordered w-full"
                  required
                  autocomplete="current-password"
                />
              </div>

              {/* 錯誤訊息 */}
              <div id="errorMsg" class="alert alert-error hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span id="errorText"></span>
              </div>

              {/* 提交按鈕 */}
              <div class="form-control mt-6">
                <button type="submit" class="btn btn-primary w-full" id="submitBtn">
                  <span id="btnText">登入</span>
                  <span id="btnLoading" class="loading loading-spinner loading-sm hidden"></span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 表單提交邏輯 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              const form=document.getElementById('loginForm');
              const btn=document.getElementById('submitBtn');
              const btnText=document.getElementById('btnText');
              const btnLoading=document.getElementById('btnLoading');
              const errorMsg=document.getElementById('errorMsg');
              const errorText=document.getElementById('errorText');

              form.addEventListener('submit',async function(e){
                e.preventDefault();

                // 隱藏錯誤訊息
                errorMsg.classList.add('hidden');

                // 顯示 loading 狀態
                btn.disabled=true;
                btnText.classList.add('hidden');
                btnLoading.classList.remove('hidden');

                try{
                  const response=await fetch('/api/login',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                      username:document.getElementById('username').value,
                      password:document.getElementById('password').value
                    })
                  });

                  const data=await response.json();

                  if(data.success){
                    // 登入成功，重定向到管理頁面
                    window.location.href='/admin';
                  }else{
                    // 登入失敗，顯示錯誤訊息
                    errorText.textContent=data.message||'登入失敗，請檢查用戶名和密碼';
                    errorMsg.classList.remove('hidden');

                    // 恢復按鈕狀態
                    btn.disabled=false;
                    btnText.classList.remove('hidden');
                    btnLoading.classList.add('hidden');
                  }
                }catch(error){
                  // 發生錯誤
                  errorText.textContent='發生錯誤，請稍後再試';
                  errorMsg.classList.remove('hidden');

                  // 恢復按鈕狀態
                  btn.disabled=false;
                  btnText.classList.remove('hidden');
                  btnLoading.classList.add('hidden');
                }
              });
            })();
          `,
        }}
      />
    </Layout>
  )
}

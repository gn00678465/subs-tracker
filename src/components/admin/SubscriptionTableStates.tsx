/** @jsxImportSource hono/jsx/dom */

export function LoadingState() {
  return (
    <div
      role="row"
      class="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr]"
    >
      <div role="cell" class="md:col-span-6 text-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 text-base-content/70">載入中...</p>
      </div>
    </div>
  )
}

export function EmptyState() {
  return (
    <div
      role="row"
      class="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr]"
    >
      <div role="cell" class="md:col-span-6 text-center py-8 text-base-content/70">
        <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>沒有符合條件的訂閱</p>
      </div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="row"
      class="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr]"
    >
      <div role="cell" class="md:col-span-6 text-center py-8 text-error">
        <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>{message}</p>
      </div>
    </div>
  )
}

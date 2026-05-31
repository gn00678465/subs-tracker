/** @jsxImportSource hono/jsx/dom */
import type { StoredCredential } from '../../types/webauthn'

export type PasskeyCredential = Omit<StoredCredential, 'publicKey'>

interface PasskeyItemProps {
  credential: PasskeyCredential
  onEdit: (credentialID: string) => void
  onDelete: (credentialID: string) => void
}

export function PasskeyItem({ credential, onEdit, onDelete }: PasskeyItemProps) {
  const createdAt = new Date(credential.createdAt).toLocaleString('zh-TW')
  const lastUsedAt = credential.lastUsedAt
    ? new Date(credential.lastUsedAt).toLocaleString('zh-TW')
    : null
  const transports = credential.transports?.length ? credential.transports.join(', ') : null

  return (
    <div class="card bg-base-200">
      <div class="card-body p-4">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h5 class="font-semibold text-base">
              {credential.nickname || '未命名 Passkey'}
            </h5>
            <div class="text-sm text-base-content/70 mt-1">
              <div>
                建立於：
                {createdAt}
              </div>
              {lastUsedAt && (
                <div>
                  最後使用：
                  {lastUsedAt}
                </div>
              )}
              {transports && (
                <div>
                  傳輸方式：
                  {transports}
                </div>
              )}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onClick={() => onEdit(credential.credentialID)}
            >
              <i data-lucide="edit-3" class="size-4" />
            </button>
            <button
              type="button"
              class="btn btn-error btn-sm"
              onClick={() => onDelete(credential.credentialID)}
            >
              <i data-lucide="trash-2" class="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

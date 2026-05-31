/** @jsxImportSource hono/jsx/dom */
import type { PasskeyCredential } from './PasskeyItem'
import { PasskeyItem } from './PasskeyItem'

interface PasskeyListProps {
  credentials: PasskeyCredential[]
  onRegister: () => void
  onEdit: (credentialID: string) => void
  onDelete: (credentialID: string) => void
}

export function PasskeyList({ credentials, onRegister, onEdit, onDelete }: PasskeyListProps) {
  if (credentials.length === 0) {
    return (
      <div class="card bg-base-200 border-2 border-dashed border-base-300">
        <div class="card-body items-center text-center py-12">
          <div class="bg-primary/10 rounded-full p-4 mb-4">
            <i data-lucide="fingerprint" class="size-12 text-primary" />
          </div>
          <h5 class="font-semibold text-lg">尚未註冊 Passkey</h5>
          <p class="text-sm text-base-content/70 max-w-md mt-2">
            Passkey 讓您可以使用指紋、臉部辨識或安全金鑰快速登入，無需記憶密碼
          </p>
          <button type="button" class="btn btn-primary btn-sm mt-4" onClick={onRegister}>
            <i data-lucide="plus" class="size-4" />
            註冊第一個 Passkey
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {credentials.map(credential => (
        <PasskeyItem
          key={credential.credentialID}
          credential={credential}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

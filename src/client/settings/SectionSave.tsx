import { LoaderCircle } from 'lucide'

import { Icon } from '../../components/Icon'

interface SectionSaveProps {
  label: string
  dirty: boolean
  /** 儲存成功後、再次修改前顯示「已儲存」 */
  saved: boolean
  busy: boolean
  readOnly: boolean
  onSave: () => void
}

/** 每一段各自儲存；有未儲存的修改時，按鈕才可以按 */
export const SectionSave = ({ label, dirty, saved, busy, readOnly, onSave }: SectionSaveProps) => {
  const enabled = dirty && !busy && !readOnly
  return (
    <div class="section-save">
      <span>{readOnly ? '連上網路後才能修改' : dirty ? '有未儲存的修改' : saved ? '已儲存' : '沒有未儲存的修改'}</span>
      <button
        class="btn btn-primary"
        type="button"
        aria-disabled={String(!enabled)}
        onClick={() => enabled && onSave()}
      >
        {busy ? (
          <>
            <Icon node={LoaderCircle} class="spin" />
            儲存中
          </>
        ) : (
          label
        )}
      </button>
    </div>
  )
}

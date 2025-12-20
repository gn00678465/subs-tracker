/**
 * ConfirmDialog utility
 * Provides a DaisyUI-styled confirm dialog to replace native window.confirm()
 */

export type DialogVariant = 'info' | 'danger'

export interface ConfirmDialogOptions {
  variant?: DialogVariant
  confirmText?: string
  cancelText?: string
}

let dialogElement: HTMLDialogElement | null = null
let titleElement: HTMLElement | null = null
let contentElement: HTMLElement | null = null
let confirmButton: HTMLButtonElement | null = null
let cancelButton: HTMLButtonElement | null = null

/**
 * Initialize confirm dialog container (called on first use)
 */
function initConfirmDialog(): void {
  if (dialogElement)
    return // Already initialized

  // Create dialog element
  dialogElement = document.createElement('dialog')
  dialogElement.id = 'confirmDialog'
  dialogElement.className = 'modal'

  // Create modal box
  const modalBox = document.createElement('div')
  modalBox.className = 'modal-box'

  // Create title
  titleElement = document.createElement('h3')
  titleElement.className = 'font-bold text-lg'

  // Create content
  contentElement = document.createElement('div')
  contentElement.className = 'py-4'

  // Create modal action (button container)
  const modalAction = document.createElement('div')
  modalAction.className = 'modal-action'

  // Create cancel button
  cancelButton = document.createElement('button')
  cancelButton.className = 'btn btn-ghost'
  cancelButton.type = 'button'

  // Create confirm button
  confirmButton = document.createElement('button')
  confirmButton.className = 'btn btn-primary'
  confirmButton.type = 'button'

  // Assemble the dialog
  modalAction.appendChild(cancelButton)
  modalAction.appendChild(confirmButton)

  modalBox.appendChild(titleElement)
  modalBox.appendChild(contentElement)
  modalBox.appendChild(modalAction)

  dialogElement.appendChild(modalBox)

  // Add to document body
  document.body.appendChild(dialogElement)
}

/**
 * Show confirm dialog and return user's choice
 * @param title - Dialog title
 * @param content - Dialog content (supports HTML)
 * @param options - Optional configuration (variant, button labels)
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
export function confirmDialog(
  title: string,
  content: string,
  options?: ConfirmDialogOptions,
): Promise<boolean> {
  // Ensure dialog exists
  if (!dialogElement)
    initConfirmDialog()

  // Extract options with defaults
  const variant = options?.variant || 'info'
  const confirmText = options?.confirmText || '確認'
  const cancelText = options?.cancelText || '取消'

  // Update dialog content
  titleElement!.textContent = title
  contentElement!.innerHTML = content
  cancelButton!.textContent = cancelText
  confirmButton!.textContent = confirmText

  // Update button style based on variant
  const confirmButtonClass = variant === 'danger' ? 'btn btn-error' : 'btn btn-primary'
  confirmButton!.className = confirmButtonClass

  // Show the dialog
  dialogElement!.showModal()

  // Return a promise that resolves based on user action
  return new Promise<boolean>((resolve) => {
    // Handle confirm button click
    const handleConfirm = () => {
      cleanup()
      dialogElement!.close()
      resolve(true)
    }

    // Handle cancel button click
    const handleCancel = () => {
      cleanup()
      dialogElement!.close()
      resolve(false)
    }

    // Handle dialog close (ESC key or backdrop click)
    const handleClose = () => {
      cleanup()
      resolve(false)
    }

    // Cleanup function to remove event listeners
    function cleanup() {
      confirmButton!.removeEventListener('click', handleConfirm)
      cancelButton!.removeEventListener('click', handleCancel)
      dialogElement!.removeEventListener('close', handleClose)
    }

    // Attach event listeners
    confirmButton!.addEventListener('click', handleConfirm)
    cancelButton!.addEventListener('click', handleCancel)
    dialogElement!.addEventListener('close', handleClose, { once: true })
  })
}

/**
 * Cleanup confirm dialog (optional, for unmounting)
 */
export function destroyConfirmDialog(): void {
  if (dialogElement && dialogElement.parentNode)
    dialogElement.parentNode.removeChild(dialogElement)

  dialogElement = null
  titleElement = null
  contentElement = null
  confirmButton = null
  cancelButton = null
}

// Make globally accessible for inline scripts
declare global {
  interface Window {
    confirmDialog: typeof confirmDialog
  }
}

if (typeof window !== 'undefined')
  window.confirmDialog = confirmDialog

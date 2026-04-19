interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="ds-card w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 id="confirm-modal-title" className="font-display font-600" style={{ color: 'var(--text1)' }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            style={{ color: 'var(--text2)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text1)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex gap-2 justify-end px-5 pb-5"
        >
          <button
            onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)')}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-4 py-2 rounded-lg font-500 transition-colors"
            style={{ color: 'var(--red)', background: 'var(--red-muted)', border: '1px solid rgba(248,113,113,0.3)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.6)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.3)')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
}

const styles = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-primary-50 text-primary-800 border-primary-200'
}

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-5 z-[100] flex flex-col gap-2 w-80">
      {toasts.map(toast => {
        const Icon = icons[toast.type] || icons.info
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2 p-3 rounded-lg border shadow-card ${styles[toast.type] || styles.info}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

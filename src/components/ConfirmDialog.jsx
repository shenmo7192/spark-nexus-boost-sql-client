import { AlertTriangle } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function ConfirmDialog() {
  const { confirm, clearConfirm } = useAppStore()

  if (!confirm) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={confirm.onCancel}
      />
      {/* 对话框 */}
      <div className="relative bg-white rounded-xl shadow-lg border border-surface-200 p-6 mx-4 max-w-sm w-full">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-surface-800">确认操作</h3>
            <p className="text-sm text-surface-600 mt-1 leading-relaxed">
              {confirm.message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={confirm.onCancel}
            className="btn-secondary text-sm"
          >
            取消
          </button>
          <button
            onClick={confirm.onConfirm}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}

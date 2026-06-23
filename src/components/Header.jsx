import { Database, Settings, FolderOpen } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function Header() {
  const { appInfo, currentDb, dataDir, setDataDir, addToast } = useAppStore()

  const handleSelectDataDir = async () => {
    try {
      const result = await window.electronAPI.selectDataDir()
      if (result.success) {
        setDataDir(result.dataDir)
        addToast(`数据目录已切换到: ${result.dataDir}`, 'success')
        // 刷新数据库列表
        const databases = await window.electronAPI.listDatabases()
        useAppStore.getState().setDatabases(databases)
      }
    } catch (error) {
      addToast(error.message || '选择目录失败', 'error')
    }
  }

  return (
    <header className="h-14 bg-surface-900 text-white flex items-center justify-between px-4 shrink-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg overflow-hidden">
          <img
            src="/这是迷人的Logo.png"
            alt="Logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>'
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold leading-tight tracking-tight">
            {appInfo.name}
          </span>
          <span className="text-[11px] text-surface-400 leading-tight">
            {appInfo.nameEn}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentDb && (
          <div className="badge badge-primary">
            <Database className="w-3 h-3 mr-1" />
            {currentDb}
          </div>
        )}

        <button
          onClick={handleSelectDataDir}
          className="btn-ghost text-surface-300 hover:text-white hover:bg-surface-800"
          title={`当前数据目录: ${dataDir || '默认'}`}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">数据目录</span>
        </button>

        <button
          onClick={() => addToast(`${appInfo.name} v${appInfo.version} | 数据目录: ${dataDir || '默认'}`, 'info')}
          className="btn-ghost text-surface-300 hover:text-white hover:bg-surface-800"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

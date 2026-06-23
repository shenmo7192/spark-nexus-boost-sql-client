import { Upload, Code2, BarChart3, SlidersHorizontal, BookOpen } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const navItems = [
  { id: 'import', label: '数据导入', icon: Upload },
  { id: 'sql', label: 'SQL 查询', icon: Code2 },
  { id: 'chart', label: '图表分析', icon: BarChart3 },
  { id: 'hypothesis', label: '假设参数', icon: SlidersHorizontal },
  { id: 'tutorial', label: 'SQLite 教程', icon: BookOpen }
]

export default function Sidebar() {
  const { activePage, setActivePage } = useAppStore()

  return (
    <aside className="w-56 bg-surface-800 text-surface-300 flex flex-col shrink-0">
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-primary-600/15 text-primary-400 border-l-2 border-primary-400'
                  : 'hover:bg-surface-700/50 hover:text-white border-l-2 border-transparent'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-surface-700">
        <div className="text-[10px] text-surface-500 leading-relaxed">
          <p>Spark Nexus Boost SQL</p>
          <p>本地离线 SQL 分析工具</p>
        </div>
      </div>
    </aside>
  )
}

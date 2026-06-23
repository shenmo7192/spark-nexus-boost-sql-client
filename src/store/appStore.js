import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // 应用信息
  appInfo: {
    name: '星火汇速SQL客户端',
    nameEn: 'Spark NB SQL',
    fullNameEn: 'Spark Nexus Boost SQL',
    version: '1.0.0'
  },
  setAppInfo: (appInfo) => set({ appInfo }),

  // 数据目录
  dataDir: '',
  setDataDir: (dataDir) => set({ dataDir }),

  // 当前数据库
  currentDb: null,
  setCurrentDb: (currentDb) => set({ currentDb }),

  // 数据库列表
  databases: [],
  setDatabases: (databases) => set({ databases }),

  // 导航
  activePage: 'import',
  setActivePage: (activePage) => set({ activePage }),

  // 通知
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      get().removeToast(id)
    }, 5000)
  },
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  }
}))

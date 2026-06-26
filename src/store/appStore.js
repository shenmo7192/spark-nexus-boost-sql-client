import { create } from 'zustand'

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

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

  // SQL 编辑器草稿（切换页面后保留）
  sqlDraft: '',
  setSqlDraft: (sqlDraft) => set({ sqlDraft }),

  // 导航
  activePage: 'import',
  setActivePage: (activePage) => set({ activePage }),

  // 通知
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = genId()
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      get().removeToast(id)
    }, 5000)
  },
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },

  // ========== 结果 Sheets（多标签页结果集） ==========
  // 每张 sheet: { id, name, result, sql }
  sheets: [],
  activeSheetId: null,

  addSheet: (name, result = null, sql = '') => {
    const id = genId()
    const n = get().sheets.length + 1
    const sheet = { id, name: name || `Sheet${n}`, result, sql }
    set(state => ({
      sheets: [...state.sheets, sheet],
      activeSheetId: id
    }))
    return id
  },

  ensureSheets: () => {
    if (get().sheets.length === 0) {
      get().addSheet('Sheet1')
    } else if (!get().activeSheetId) {
      set({ activeSheetId: get().sheets[0].id })
    }
  },

  removeSheet: (id) => {
    set(state => {
      let sheets = state.sheets.filter(s => s.id !== id)
      // 至少保留一张空 sheet
      if (sheets.length === 0) {
        const newId = genId()
        sheets = [{ id: newId, name: 'Sheet1', result: null, sql: '' }]
        return { sheets, activeSheetId: newId }
      }
      let activeSheetId = state.activeSheetId
      if (activeSheetId === id) {
        activeSheetId = sheets[0].id
      }
      return { sheets, activeSheetId }
    })
  },

  renameSheet: (id, name) => {
    set(state => ({
      sheets: state.sheets.map(s => s.id === id ? { ...s, name } : s)
    }))
  },

  reorderSheets: (fromId, toId) => {
    set(state => {
      const sheets = [...state.sheets]
      const fromIdx = sheets.findIndex(s => s.id === fromId)
      const toIdx = sheets.findIndex(s => s.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return {}
      const [moved] = sheets.splice(fromIdx, 1)
      sheets.splice(toIdx, 0, moved)
      return { sheets }
    })
  },

  setActiveSheet: (id) => set({ activeSheetId: id }),

  updateSheetResult: (id, result, sql = '') => {
    set(state => ({
      sheets: state.sheets.map(s => s.id === id ? { ...s, result, sql } : s)
    }))
  },

  updateSheetSql: (id, sql) => {
    set(state => ({
      sheets: state.sheets.map(s => s.id === id ? { ...s, sql } : s)
    }))
  },

  clearSheet: (id) => {
    set(state => ({
      sheets: state.sheets.map(s => s.id === id ? { ...s, result: null, sql: '' } : s)
    }))
  }
}))

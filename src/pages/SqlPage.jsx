import { useState, useEffect, useRef, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete'
import { Prec } from '@codemirror/state'
import {
  Play, Save, Trash2, Download,
  History, Database, FileSpreadsheet, Plus, X, Table2,
  ChevronDown, ChevronRight as ChevR, Search, RefreshCw
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import LazyDataTable from '../components/LazyDataTable'

const MAX_HISTORY = 20

// 图标按列类型变色
function columnIcon(type) {
  const t = (type || '').toUpperCase()
  if (t.includes('INT') || t.includes('REAL') || t.includes('NUM') || t.includes('FLOAT') || t.includes('DOUBLE')) {
    return '#3b82f6'
  }
  if (t.includes('DATE') || t.includes('TIME')) return '#f59e0b'
  return '#10b981'
}

export default function SqlPage() {
  const {
    databases, currentDb, setCurrentDb, addToast, setDatabases,
    sheets, activeSheetId, sqlDraft, setSqlDraft,
    addSheet, removeSheet, renameSheet, reorderSheets,
    setActiveSheet, updateSheetResult, ensureSheets, showConfirm
  } = useAppStore()

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [scenarios, setScenarios] = useState([])
  const [selectedScenario, setSelectedScenario] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [history, setHistory] = useState([])
  const [templates, setTemplates] = useState([])
  const [splitResults, setSplitResults] = useState(false)
  const editorRef = useRef(null)
  const executeRef = useRef(() => {})

  // ========== 导航树状态 ==========
  const [expandedDbs, setExpandedDbs] = useState(() => new Set())
  const [expandedTables, setExpandedTables] = useState(() => new Set())
  const [dbInfos, setDbInfos] = useState({}) // { [dbName]: { tables: [{name, columns, rowCount}] } }
  const [tableFilter, setTableFilter] = useState('')
  const [infoLoading, setInfoLoading] = useState(false)

  // ========== Sheet 重命名 ==========
  const [editingSheetId, setEditingSheetId] = useState(null)
  const [editingName, setEditingName] = useState('')
  // ========== Sheet 拖拽排序 ==========
  const dragSheetId = useRef(null)

  useEffect(() => {
    ensureSheets()
  }, [ensureSheets])

  // 默认展开当前数据库
  useEffect(() => {
    if (currentDb) {
      setExpandedDbs(prev => prev.has(currentDb) ? prev : new Set([...prev, currentDb]))
      loadDbInfo(currentDb)
    }
  }, [currentDb])

  const loadDbInfo = async (dbName) => {
    if (dbInfos[dbName]) return
    setInfoLoading(true)
    try {
      const info = await window.electronAPI.getDatabaseInfo(dbName)
      setDbInfos(prev => ({ ...prev, [dbName]: info }))
    } catch (error) {
      addToast('加载数据库结构失败: ' + error.message, 'error')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleExecute = async (overrideSheetId = null) => {
    // 优先执行选中的 SQL，无选中则执行全部
    const view = editorRef.current?.view
    const selection = view?.state.selection.main
    const selectedText = selection && !selection.empty ? view.state.doc.sliceString(selection.from, selection.to) : ''
    const sqlToRun = selectedText.trim() || sqlDraft.trim()
    if (!sqlToRun) {
      addToast('请输入 SQL 语句', 'warning')
      return
    }
    if (!currentDb) {
      addToast('请先选择一个数据库', 'warning')
      return
    }

    setIsExecuting(true)
    try {
      const result = await window.electronAPI.runQuery({
        sql: sqlToRun,
        dbName: currentDb,
        scenarioId: selectedScenario || undefined
      })

      // 保存历史
      const newHistory = [{ sql: sqlToRun, time: new Date().toISOString() }, ...history]
      const updatedHistory = newHistory.slice(0, MAX_HISTORY)
      setHistory(updatedHistory)
      saveHistory(updatedHistory)

      const targetId = overrideSheetId || activeSheetId

      if (result.multi) {
        const results = result.results
        if (results.length > 0) {
          updateSheetResult(targetId, { ...results[0], exportConfig: result.exportConfig }, results[0].sqlPreview || sqlToRun)
        }
        if (splitResults) {
          for (let i = 1; i < results.length; i++) {
            const r = results[i]
            addSheet(`结果${i + 1}`, { ...r, exportConfig: result.exportConfig }, r.sqlPreview || sqlToRun)
          }
        } else {
          // 默认覆盖模式：最后一个结果留在当前 sheet，其余被覆盖
          for (let i = 1; i < results.length; i++) {
            const r = results[i]
            updateSheetResult(targetId, { ...r, exportConfig: result.exportConfig }, r.sqlPreview || sqlToRun)
          }
        }
      } else {
        updateSheetResult(targetId, { ...result }, sqlToRun)
      }

      if (!result.success) {
        addToast('SQL 执行失败: ' + (result.error || ''), 'error')
      } else {
        addToast('SQL 执行成功', 'success')
      }

      // 若执行了 DDL，刷新左侧数据库树
      if (result.success && /\b(create|drop|alter)\s+table\b/i.test(sqlToRun)) {
        try {
          const list = await window.electronAPI.listDatabases()
          setDatabases(list)
          setDbInfos(prev => {
            const next = { ...prev }
            delete next[currentDb]
            return next
          })
          loadDbInfo(currentDb)
        } catch (e) {}
      }
    } catch (error) {
      addToast('执行失败: ' + error.message, 'error')
    } finally {
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    executeRef.current = () => handleExecute()
  }, [handleExecute])

  // 全局 F9 执行快捷键（即使编辑器未聚焦也生效，仅在 SQL 页面）
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault()
        if (useAppStore.getState().activePage === 'sql') {
          executeRef.current()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const currentDbInfo = databases.find(db => db.name === currentDb)

  const editorExtensions = useMemo(() => {
    const schema = {}
    const info = currentDb ? dbInfos[currentDb] : null
    if (info) {
      for (const t of info.tables) {
        schema[t.name] = t.columns.map(c => c.name)
      }
    } else if (currentDbInfo) {
      for (const table of currentDbInfo.tables) {
        schema[table] = []
      }
    }
    return [
      sql({ schema }),
      autocompletion(),
      Prec.highest(keymap.of([
        { key: 'Tab', run: (view) => acceptCompletion(view) ? true : true }
      ])),
      Prec.highest(keymap.of([
        { key: 'Ctrl-Enter', run: () => { executeRef.current(); return true } },
        { key: 'Cmd-Enter', run: () => { executeRef.current(); return true } },
        { key: 'F9', run: () => { executeRef.current(); return true } }
      ]))
    ]
  }, [currentDbInfo, dbInfos, currentDb])

  useEffect(() => {
    loadScenarios()
    loadHistory()
    loadTemplates()
  }, [])

  const loadScenarios = async () => {
    try {
      const list = await window.electronAPI.listScenarios()
      setScenarios(list)
    } catch (error) {
      addToast('加载假设方案失败: ' + error.message, 'error')
    }
  }

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('spark_nb_sql_history')
      if (saved) setHistory(JSON.parse(saved))
    } catch (e) {}
  }

  const saveHistory = (items) => {
    localStorage.setItem('spark_nb_sql_history', JSON.stringify(items.slice(0, MAX_HISTORY)))
  }

  const loadTemplates = () => {
    try {
      const saved = localStorage.getItem('spark_nb_sql_templates')
      if (saved) setTemplates(JSON.parse(saved))
    } catch (e) {}
  }

  const saveTemplates = (items) => {
    localStorage.setItem('spark_nb_sql_templates', JSON.stringify(items))
  }

  // ========== 导出：所有 sheet → 一个 Excel（每 sheet 一个 Excel sheet） ==========
  const handleExport = async () => {
    const validSheets = sheets.filter(s => s.result?.success && s.result?.columns && s.result?.rows)
    if (validSheets.length === 0) {
      addToast('没有可导出的结果，请先执行查询', 'warning')
      return
    }

    const defaultName = `${currentDb || 'export'}.xlsx`
    const savePath = await window.electronAPI.selectExportPath(defaultName)
    if (!savePath) {
      addToast('已取消导出', 'info')
      return
    }

    const results = validSheets.map(s => s.result)
    const sheetNames = {}
    validSheets.forEach((s, idx) => { sheetNames[String(idx)] = s.name })

    try {
      const result = await window.electronAPI.exportQueryResults({
        results,
        exportConfig: { savePath, sheetNames }
      })
      if (result.success) {
        addToast(`导出成功: ${result.savedPath || result.filename}`, 'success')
      } else {
        addToast('导出失败: ' + result.error, 'error')
      }
    } catch (error) {
      addToast('导出失败: ' + error.message, 'error')
    }
  }

  // ========== 编辑器插入 ==========
  const insertText = (text, quote = true) => {
    const view = editorRef.current?.view
    const insertStr = quote ? `"${text}"` : text
    if (view) {
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: insertStr },
        selection: { anchor: from + insertStr.length }
      })
      view.focus()
    } else {
      setSqlDraft(prev => prev ? `${prev} ${insertStr}` : insertStr)
    }
  }

  const saveTemplate = () => {
    setTemplateName('')
    setTemplateDialogOpen(true)
  }

  const confirmSaveTemplate = () => {
    const name = templateName.trim()
    if (!name) {
      addToast('请输入模板名称', 'warning')
      return
    }
    const newTemplates = [{ name, sql: sqlDraft }, ...templates]
    setTemplates(newTemplates)
    saveTemplates(newTemplates)
    setTemplateDialogOpen(false)
    setTemplateName('')
    addToast('模板已保存', 'success')
  }

  const loadTemplate = (tpl) => setSqlDraft(tpl.sql)

  const deleteTemplate = (idx) => {
    const tpl = templates[idx]
    showConfirm(`确定删除 SQL 模板 "${tpl.name}" 吗？`, () => {
      const newTemplates = templates.filter((_, i) => i !== idx)
      setTemplates(newTemplates)
      saveTemplates(newTemplates)
    })
  }

  // ========== 树操作 ==========
  const toggleDb = (dbName) => {
    setExpandedDbs(prev => {
      const next = new Set(prev)
      if (next.has(dbName)) next.delete(dbName)
      else next.add(dbName)
      return next
    })
    loadDbInfo(dbName)
  }

  const switchDb = async (dbName) => {
    setCurrentDb(dbName)
    try {
      await window.electronAPI.setCurrentDatabase(dbName)
    } catch (e) {}
    setExpandedDbs(prev => new Set([...prev, dbName]))
    loadDbInfo(dbName)
  }

  const toggleTable = (dbName, tableName) => {
    const key = `${dbName}::${tableName}`
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ========== Sheet 操作 ==========
  const activeSheet = sheets.find(s => s.id === activeSheetId) || sheets[0]
  const activeResult = activeSheet?.result

  const commitRename = (id) => {
    const name = editingName.trim()
    if (name) renameSheet(id, name)
    setEditingSheetId(null)
  }

  const startRename = (sheet) => {
    setEditingSheetId(sheet.id)
    setEditingName(sheet.name)
  }

  const onTabDragStart = (id) => { dragSheetId.current = id }
  const onTabDrop = (toId) => {
    const fromId = dragSheetId.current
    if (fromId && fromId !== toId) reorderSheets(fromId, toId)
    dragSheetId.current = null
  }

  const filteredNavDbs = databases

  return (
    <div className="h-full flex gap-3 min-h-0">
      {/* ============ 左侧：数据库导航树 ============ */}
      <div className="w-64 shrink-0 flex flex-col gap-3 min-h-0">
        <div className="card flex-1 flex flex-col min-h-0">
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> 数据库导航
            </span>
            <button
              onClick={() => { setDbInfos({}); databases.forEach(d => loadDbInfo(d.name)) }}
              className="btn-ghost p-1"
              title="刷新"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${infoLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-2 border-b border-surface-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="搜索表名..."
                className="form-input pl-7 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-1.5">
            {filteredNavDbs.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-4">暂无数据库<br />请先在「数据导入」页导入</p>
            ) : (
              <div className="space-y-0.5">
                {filteredNavDbs.map(db => {
                  const isOpen = expandedDbs.has(db.name)
                  const isCurrent = db.name === currentDb
                  const info = dbInfos[db.name]
                  const tables = info ? info.tables : db.tables.map(t => ({ name: t, columns: [], rowCount: null }))
                  const filtered = tableFilter
                    ? tables.filter(t => t.name.toLowerCase().includes(tableFilter.toLowerCase()))
                    : tables
                  return (
                    <div key={db.name}>
                      <div className="flex items-center group">
                        <button
                          onClick={() => toggleDb(db.name)}
                          className="p-0.5 hover:bg-surface-100 rounded"
                        >
                          {isOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                            : <ChevR className="w-3.5 h-3.5 text-surface-400" />}
                        </button>
                        <button
                          onClick={() => switchDb(db.name)}
                          className={`flex-1 flex items-center gap-1.5 px-1.5 py-1 text-xs rounded text-left ${
                            isCurrent ? 'text-primary-700 font-semibold' : 'text-surface-700 hover:bg-surface-100'
                          }`}
                          title="设为当前数据库"
                        >
                          <Database className={`w-3.5 h-3.5 ${isCurrent ? 'text-primary-500' : 'text-surface-400'}`} />
                          <span className="truncate">{db.name}</span>
                          {isCurrent && <span className="ml-auto badge-primary px-1 py-0 text-[10px]">当前</span>}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="ml-3 border-l border-surface-200 pl-1.5 space-y-0.5">
                          {filtered.length === 0 ? (
                            <p className="text-[11px] text-surface-400 py-1 pl-1">{tableFilter ? '无匹配表' : (infoLoading ? '加载中...' : '无表')}</p>
                          ) : filtered.map(t => {
                            const tKey = `${db.name}::${t.name}`
                            const tOpen = expandedTables.has(tKey)
                            return (
                              <div key={t.name}>
                                <div className="flex items-center group">
                                  <button
                                    onClick={() => toggleTable(db.name, t.name)}
                                    className="p-0.5 hover:bg-surface-100 rounded"
                                  >
                                    {tOpen
                                      ? <ChevronDown className="w-3 h-3 text-surface-400" />
                                      : <ChevR className="w-3 h-3 text-surface-400" />}
                                  </button>
                                  <button
                                    onClick={() => insertText(t.name)}
                                    onDoubleClick={() => !tOpen && toggleTable(db.name, t.name)}
                                    className="flex-1 flex items-center gap-1.5 px-1.5 py-1 text-xs text-surface-600 hover:bg-surface-100 rounded text-left"
                                    title="点击插入表名 · 双击展开字段"
                                  >
                                    <Table2 className="w-3 h-3 text-primary-400 shrink-0" />
                                    <span className="truncate">{t.name}</span>
                                    {t.rowCount != null && (
                                      <span className="ml-auto text-[10px] text-surface-400 shrink-0">{t.rowCount}</span>
                                    )}
                                  </button>
                                </div>
                                {tOpen && (
                                  <div className="ml-3 border-l border-surface-200 pl-1.5 space-y-0.5 py-0.5">
                                    {t.columns.length === 0 ? (
                                      <p className="text-[11px] text-surface-400 py-0.5 pl-1">无字段</p>
                                    ) : t.columns.map(c => (
                                      <button
                                        key={c.name}
                                        onClick={() => insertText(c.name, false)}
                                        className="w-full flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] text-surface-500 hover:bg-surface-100 rounded text-left"
                                        title={`${c.name} (${c.type || 'TEXT'})${c.primaryKey ? ' · PK' : ''}`}
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ background: columnIcon(c.type) }}
                                        />
                                        <span className="truncate">{c.name}</span>
                                        {c.primaryKey && <span className="text-[9px] text-amber-500 font-bold">PK</span>}
                                        <span className="ml-auto text-surface-400 shrink-0 text-[10px]">{(c.type || '').substring(0, 6)}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 历史记录 */}
        <div className="card shrink-0 flex flex-col" style={{ maxHeight: '30%' }}>
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> 历史</span>
          </div>
          <div className="p-2 overflow-auto">
            {history.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-2">暂无历史</p>
            ) : (
              <div className="space-y-1">
                {history.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1 group">
                    <button
                      onClick={() => setSqlDraft(item.sql)}
                      className="flex-1 text-left px-2 py-1 text-[11px] text-surface-600 hover:bg-surface-100 rounded truncate"
                      title={item.sql}
                    >
                      {item.sql}
                    </button>
                    <button
                      onClick={() => { const h = history.filter((_, i) => i !== idx); setHistory(h); saveHistory(h) }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-surface-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ 中间：编辑器（上）+ 结果（下） ============ */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">
        {/* SQL 编辑器 */}
        <div className="card flex flex-col min-h-0" style={{ flex: '1 1 42%' }}>
          <div className="card-header flex-wrap gap-2">
            <span className="card-title">SQL 编辑器</span>
            <span className="text-[11px] text-surface-400">Ctrl + Enter / F9 执行</span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="form-input w-40 py-1 text-xs"
                title="假设方案"
              >
                <option value="">不使用假设</option>
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={saveTemplate} className="btn-secondary py-1 text-xs">
                <Save className="w-3.5 h-3.5" /> 存模板
              </button>
              <label
                className="flex items-center gap-1.5 cursor-pointer select-none"
                title={splitResults ? '开启：多条 SQL 结果各自开启新 Sheet' : '关闭：多条 SQL 结果覆盖当前 Sheet'}
              >
                <span className="text-[10px] text-surface-400">分Sheet</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={splitResults}
                    onChange={(e) => setSplitResults(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-7 h-4 rounded-full transition-colors ${splitResults ? 'bg-primary-500' : 'bg-surface-300'}`} />
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${splitResults ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
              </label>
              <button
                onClick={() => handleExecute()}
                disabled={isExecuting}
                className="btn-primary py-1 text-xs"
                title="执行 (F9 / Ctrl+Enter)"
              >
                <Play className="w-3.5 h-3.5" />
                {isExecuting ? '执行中' : '执行 F9'}
              </button>
            </div>
          </div>
          <div className="flex-1 p-0 overflow-hidden min-h-[120px]">
            <CodeMirror
              ref={editorRef}
              value={sqlDraft}
              height="100%"
              theme={oneDark}
              extensions={editorExtensions}
              onChange={(value) => setSqlDraft(value)}
              className="h-full"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: false,
                indentWithTab: false
              }}
            />
          </div>
        </div>

        {/* 结果区：多 Sheet 标签页 */}
        <div className="card flex flex-col min-h-0 min-w-0" style={{ flex: '1 1 58%' }}>
          {/* Sheet 标签栏 */}
          <div className="flex items-center gap-1 px-2 pt-1.5 border-b border-surface-200 bg-surface-50 overflow-x-auto">
            {sheets.map(sheet => {
              const isActive = sheet.id === activeSheetId
              const isEditing = editingSheetId === sheet.id
              return (
                <div
                  key={sheet.id}
                  draggable={!isEditing}
                  onDragStart={() => onTabDragStart(sheet.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onTabDrop(sheet.id)}
                  onClick={() => setActiveSheet(sheet.id)}
                  className={`group flex items-center gap-1 pl-3 pr-1.5 py-1.5 text-xs rounded-t-md border-x border-t cursor-pointer whitespace-nowrap select-none ${
                    isActive
                      ? 'bg-white border-surface-200 text-primary-700 font-medium -mb-px'
                      : 'bg-surface-100 border-transparent text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(sheet.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(sheet.id)
                        if (e.key === 'Escape') setEditingSheetId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-24 px-1 py-0 text-xs border border-primary-400 rounded focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(sheet) }}
                      title="双击重命名 · 拖拽排序"
                    >
                      {sheet.name}
                      {sheet.result?.success && sheet.result?.columns ? ` (${sheet.result.rows?.length || 0})` : ''}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSheet(sheet.id) }}
                    className="p-0.5 rounded hover:bg-surface-300 text-surface-400 hover:text-red-600"
                    title="关闭"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
            <button
              onClick={() => addSheet()}
              className="p-1 mx-1 text-surface-500 hover:text-primary-600 hover:bg-surface-200 rounded"
              title="新建 Sheet"
            >
              <Plus className="w-4 h-4" />
            </button>

            <div className="ml-auto flex items-center gap-2 pr-1">
              <button
                onClick={handleExport}
                className="btn-secondary py-1 text-xs"
                title="将所有 Sheet 导出为一个 Excel 文件"
              >
                <Download className="w-3.5 h-3.5" /> 导出 Excel
              </button>
            </div>
          </div>

          {/* Sheet 内容 */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {!activeResult ? (
              <div className="flex items-center justify-center h-full text-surface-400 text-sm py-12">
                执行 SQL 后，结果将输出到当前 Sheet
              </div>
            ) : !activeResult.success ? (
              <div className="p-4 text-red-600 text-sm bg-red-50 m-3 rounded-lg">
                {activeResult.error || '执行失败'}
              </div>
            ) : activeResult.columns ? (
              <>
                <div className="flex-1 overflow-hidden min-h-0 min-w-0">
                  <LazyDataTable columns={activeResult.columns} rows={activeResult.rows} columnTypes={activeResult.columnTypes} />
                </div>
              </>
            ) : (
              <div className="p-4 text-sm text-surface-600">
                {activeResult.message || '执行成功'}
                {activeResult.changes !== undefined && `（影响 ${activeResult.changes} 行）`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ 右侧：SQL 模板 ============ */}
      <div className="w-56 shrink-0">
        <div className="card flex flex-col" style={{ maxHeight: '100%' }}>
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> SQL 模板</span>
          </div>
          <div className="p-2 overflow-auto">
            {templates.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-3">暂无模板<br />点击「存模板」保存当前 SQL</p>
            ) : (
              <div className="space-y-1">
                {templates.map((tpl, idx) => (
                  <div key={idx} className="flex items-center gap-1 group">
                    <button
                      onClick={() => loadTemplate(tpl)}
                      className="flex-1 text-left px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded truncate"
                      title={tpl.name}
                    >
                      {tpl.name}
                    </button>
                    <button
                      onClick={() => deleteTemplate(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 保存模板弹窗 */}
      {templateDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-surface-200 w-80 p-4">
            <h3 className="text-sm font-semibold text-surface-800 mb-3">保存 SQL 模板</h3>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSaveTemplate()
                if (e.key === 'Escape') setTemplateDialogOpen(false)
              }}
              placeholder="请输入模板名称"
              className="form-input w-full mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTemplateDialogOpen(false)}
                className="btn-secondary py-1.5 text-xs"
              >
                取消
              </button>
              <button
                onClick={confirmSaveTemplate}
                className="btn-primary py-1.5 text-xs"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

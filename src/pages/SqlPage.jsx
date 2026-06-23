import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete'
import { Prec } from '@codemirror/state'
import {
  Play, Save, FolderOpen, Trash2, BarChart3, Download,
  ChevronLeft, ChevronRight, History, Database, FileSpreadsheet
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

const MAX_HISTORY = 20
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

export default function SqlPage() {
  const { databases, currentDb, addToast } = useAppStore()
  const [sqlText, setSqlText] = useState('')
  const [scenarios, setScenarios] = useState([])
  const [selectedScenario, setSelectedScenario] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [history, setHistory] = useState([])
  const [templates, setTemplates] = useState([])
  const [chartConfig, setChartConfig] = useState({ type: 'bar', xColumn: '', yColumn: '' })
  const editorRef = useRef(null)
  const executeRef = useRef(() => {})

  const handleExecute = async (gotoPage = 1) => {
    // 优先执行选中的 SQL，无选中则执行全部
    const view = editorRef.current?.view
    const selection = view?.state.selection.main
    const selectedText = selection && !selection.empty ? view.state.doc.sliceString(selection.from, selection.to) : ''
    const sqlToRun = selectedText.trim() || sqlText.trim()
    if (!sqlToRun) {
      addToast('请输入 SQL 语句', 'warning')
      return
    }
    if (!currentDb) {
      addToast('请先选择一个数据库', 'warning')
      return
    }

    setIsExecuting(true)
    setPage(gotoPage)
    try {
      const result = await window.electronAPI.runQuery({
        sql: sqlToRun,
        dbName: currentDb,
        scenarioId: selectedScenario || undefined,
        page: gotoPage,
        pageSize
      })
      setQueryResult(result)
      setActiveResultIndex(0)

      // 保存历史
      const newHistory = [{ sql: sqlToRun, time: new Date().toISOString() }, ...history]
      const updatedHistory = newHistory.slice(0, MAX_HISTORY)
      setHistory(updatedHistory)
      saveHistory(updatedHistory)

      if (!result.success) {
        addToast('SQL 执行失败: ' + result.error, 'error')
      } else {
        addToast('SQL 执行成功', 'success')
      }
    } catch (error) {
      addToast('执行失败: ' + error.message, 'error')
    } finally {
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    executeRef.current = () => handleExecute(1)
  }, [handleExecute])

  const currentDbInfo = databases.find(db => db.name === currentDb)

  const editorExtensions = useMemo(() => {
    const schema = {}
    if (currentDbInfo) {
      for (const table of currentDbInfo.tables) {
        schema[table] = []
      }
    }
    return [
      sql({ schema }),
      autocompletion(),
      Prec.highest(keymap.of([
        {
          key: 'Tab',
          run: (view) => acceptCompletion(view) ? true : true
        }
      ])),
      keymap.of([
        {
          key: 'Ctrl-Enter',
          run: () => { executeRef.current(); return true }
        },
        {
          key: 'Cmd-Enter',
          run: () => { executeRef.current(); return true }
        }
      ])
    ]
  }, [currentDbInfo])

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

  const handleExport = async () => {
    if (!queryResult || !queryResult.success) {
      addToast('没有可导出的结果', 'warning')
      return
    }

    let results = []
    let exportConfig = {}
    if (queryResult.multi) {
      results = queryResult.results.filter(r => r.success)
      exportConfig = queryResult.exportConfig || {}
    } else {
      results = [queryResult]
      exportConfig = queryResult.exportConfig || {}
    }

    if (results.length === 0) {
      addToast('没有可导出的数据', 'warning')
      return
    }

    // 弹窗询问导出路径
    const defaultName = exportConfig.filename || (results.length > 1 ? 'export.xlsx' : `${results[0].sql?.slice(0, 20) || 'export'}.xlsx`)
    const savePath = await window.electronAPI.selectExportPath(defaultName)
    if (!savePath) {
      addToast('已取消导出', 'info')
      return
    }

    try {
      const result = await window.electronAPI.exportQueryResults({
        results,
        exportConfig: { ...exportConfig, savePath }
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

  const insertTableName = (tableName) => {
    const view = editorRef.current?.view
    if (view) {
      const { from, to } = view.state.selection.main
      const insertText = `"${tableName}"`
      view.dispatch({
        changes: { from, to, insert: insertText },
        selection: { anchor: from + insertText.length }
      })
      view.focus()
    } else {
      setSqlText(prev => prev ? `${prev}"${tableName}"` : `"${tableName}"`)
    }
  }

  const saveTemplate = () => {
    const name = prompt('请输入模板名称')
    if (!name) return
    const newTemplates = [{ name, sql: sqlText }, ...templates]
    setTemplates(newTemplates)
    saveTemplates(newTemplates)
    addToast('模板已保存', 'success')
  }

  const loadTemplate = (tpl) => {
    setSqlText(tpl.sql)
  }

  const deleteTemplate = (idx) => {
    const newTemplates = templates.filter((_, i) => i !== idx)
    setTemplates(newTemplates)
    saveTemplates(newTemplates)
  }

  const activeResult = queryResult?.multi
    ? queryResult.results[activeResultIndex]
    : queryResult

  const allTables = databases.flatMap(db => db.tables.map(t => ({ db: db.name, table: t })))

  const chartData = (() => {
    if (!activeResult || !activeResult.columns || !activeResult.rows) return null
    const { xColumn, yColumn, type } = chartConfig
    if (!xColumn || !yColumn) return null

    const labels = activeResult.rows.map(r => r[xColumn])
    const data = activeResult.rows.map(r => {
      const v = r[yColumn]
      return typeof v === 'number' ? v : parseFloat(v) || 0
    })

    return {
      labels,
      datasets: [{
        label: yColumn,
        data,
        backgroundColor: type === 'pie' || type === 'doughnut'
          ? labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
          : CHART_COLORS[0],
        borderColor: CHART_COLORS[0],
        borderWidth: 1
      }]
    }
  })()

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-800">SQL 查询</h1>
          <p className="text-sm text-surface-500 mt-0.5">编辑并执行 SQLite 查询，支持假设参数与多结果导出</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="form-input w-40"
          >
            <option value="">不使用假设方案</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button onClick={saveTemplate} className="btn-secondary">
            <Save className="w-4 h-4" />
            存模板
          </button>
          <button onClick={() => handleExecute(1)} disabled={isExecuting} className="btn-primary">
            <Play className="w-4 h-4" />
            {isExecuting ? '执行中' : '执行'}
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-1 min-h-0">
        {/* 左侧工具栏 */}
        <div className="xl:col-span-1 space-y-4 overflow-auto">
          <div className="card">
            <div className="card-header">
              <span className="card-title">数据表</span>
            </div>
            <div className="p-3 max-h-[200px] overflow-auto">
              {allTables.length === 0 ? (
                <p className="text-xs text-surface-500 text-center py-2">暂无数据表</p>
              ) : (
                <div className="space-y-1">
                  {allTables.map(({ db, table }) => (
                    <button
                      key={`${db}.${table}`}
                      onClick={() => insertTableName(table)}
                      className="w-full text-left px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-md flex items-center gap-1.5"
                    >
                      <Database className="w-3 h-3 text-primary-500" />
                      <span className="truncate">{table}</span>
                      <span className="text-surface-400 ml-auto shrink-0">{db}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> 历史记录</span>
            </div>
            <div className="p-3 max-h-[160px] overflow-auto">
              {history.length === 0 ? (
                <p className="text-xs text-surface-500 text-center py-2">暂无历史记录</p>
              ) : (
                <div className="space-y-1">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSqlText(item.sql)}
                      className="w-full text-left px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-md truncate"
                      title={item.sql}
                    >
                      {item.sql}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> SQL 模板</span>
            </div>
            <div className="p-3 max-h-[160px] overflow-auto">
              {templates.length === 0 ? (
                <p className="text-xs text-surface-500 text-center py-2">暂无模板</p>
              ) : (
                <div className="space-y-1">
                  {templates.map((tpl, idx) => (
                    <div key={idx} className="flex items-center gap-1 group">
                      <button
                        onClick={() => loadTemplate(tpl)}
                        className="flex-1 text-left px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-md truncate"
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

        {/* 右侧编辑器和结果 */}
        <div className="xl:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="card flex-1 flex flex-col min-h-[240px]">
            <div className="card-header">
              <span className="card-title">SQL 编辑器</span>
              <span className="text-xs text-surface-400">Ctrl + Enter 执行</span>
            </div>
            <div className="flex-1 p-0 overflow-hidden">
              <CodeMirror
                ref={editorRef}
                value={sqlText}
                height="100%"
                theme={oneDark}
                extensions={editorExtensions}
                onChange={(value) => setSqlText(value)}
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

          {/* 结果区 */}
          <div className="card flex-1 min-h-[280px] flex flex-col">
            <div className="card-header flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="card-title">查询结果</span>
                {queryResult?.multi && queryResult.results.length > 1 && (
                  <div className="flex items-center gap-1">
                    {queryResult.results.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveResultIndex(idx)}
                        className={`px-2 py-0.5 text-xs rounded-md ${activeResultIndex === idx ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
                      >
                        结果 {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

                {activeResult?.success && activeResult.columns && (
                  <div className="flex items-center gap-2 ml-auto">
                    <BarChart3 className="w-4 h-4 text-surface-400" />
                    <select
                      value={chartConfig.type}
                      onChange={(e) => setChartConfig({ ...chartConfig, type: e.target.value })}
                      className="form-input w-28"
                    >
                      <option value="bar">柱状图</option>
                      <option value="line">折线图</option>
                      <option value="pie">饼图</option>
                      <option value="doughnut">环形图</option>
                    </select>
                    <select
                      value={chartConfig.xColumn}
                      onChange={(e) => setChartConfig({ ...chartConfig, xColumn: e.target.value })}
                      className="form-input w-32"
                    >
                      <option value="">X 轴</option>
                      {activeResult.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                    <select
                      value={chartConfig.yColumn}
                      onChange={(e) => setChartConfig({ ...chartConfig, yColumn: e.target.value })}
                      className="form-input w-32"
                    >
                      <option value="">Y 轴</option>
                      {activeResult.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto p-0">
                {!activeResult ? (
                  <div className="flex items-center justify-center h-full text-surface-400 text-sm py-12">
                    执行 SQL 查询后，结果将在此处显示
                  </div>
                ) : !activeResult?.success ? (
                  <div className="p-4 text-red-600 text-sm bg-red-50">
                    {activeResult?.error || '执行失败'}
                  </div>
                ) : activeResult.columns ? (
                  <>
                    <div className="overflow-x-auto max-h-[280px]">
                      <table className="data-table">
                        <thead>
                          <tr>
                            {activeResult.columns.map(col => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.rows.map((row, idx) => (
                            <tr key={idx}>
                              {activeResult.columns.map(col => (
                                <td key={col}>{row[col] === null || row[col] === undefined ? '' : String(row[col])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 分页 */}
                    {!queryResult.multi && activeResult.totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t border-surface-200">
                        <span className="text-xs text-surface-500">
                          第 {activeResult.page} / {activeResult.totalPages} 页，共 {activeResult.totalRows} 行
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleExecute(activeResult.page - 1)}
                            disabled={activeResult.page <= 1}
                            className="btn-ghost p-1"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); handleExecute(1) }}
                            className="form-input w-20"
                          >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                          </select>
                          <button
                            onClick={() => handleExecute(activeResult.page + 1)}
                            disabled={activeResult.page >= activeResult.totalPages}
                            className="btn-ghost p-1"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 图表 */}
                    {chartData && (
                      <div className="p-4 border-t border-surface-200">
                        <div className="h-[260px]">
                          {chartConfig.type === 'bar' && <Bar data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
                          {chartConfig.type === 'line' && <Line data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
                          {chartConfig.type === 'pie' && <Pie data={chartData} options={{ maintainAspectRatio: false }} />}
                          {chartConfig.type === 'doughnut' && <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />}
                        </div>
                      </div>
                    )}
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
      </div>
    </div>
  )
}

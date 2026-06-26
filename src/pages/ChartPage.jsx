import { useState, useMemo, useEffect, useRef } from 'react'
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
import { BarChart3, Plus, Trash2, Table2, Download } from 'lucide-react'
import { useAppStore } from '../store/appStore'

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

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// 根据列数据构建图表
function buildChartData(result, config) {
  if (!result || !result.columns || !result.rows) return null
  const { xColumn, yColumn, type } = config
  if (!xColumn || !yColumn) return null

  const labels = result.rows.map(r => r[xColumn])
  const data = result.rows.map(r => {
    const v = r[yColumn]
    return typeof v === 'number' ? v : parseFloat(v) || 0
  })

  return {
    labels,
    datasets: [{
      label: yColumn,
      data,
      backgroundColor: (type === 'pie' || type === 'doughnut')
        ? labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
        : CHART_COLORS[0],
      borderColor: CHART_COLORS[0],
      borderWidth: 1
    }]
  }
}

// 自定义数据标签插件：在图表元素上直接绘制名称与数值
const dataLabelPlugin = {
  id: 'customDataLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart
    const dataset = data.datasets[0]
    if (!dataset) return
    const meta = chart.getDatasetMeta(0)
    if (meta.hidden) return

    ctx.save()
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#374151'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    const type = chart.config.type
    const labels = data.labels || []

    if (type === 'pie' || type === 'doughnut') {
      const total = dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0)
      meta.data.forEach((arc, i) => {
        const value = Number(dataset.data[i]) || 0
        const label = String(labels[i] ?? '')
        const pct = total ? ((value / total) * 100).toFixed(1) : '0.0'
        const { x, y } = arc.getCenterPoint(true)
        ctx.fillText(`${label}: ${value} (${pct}%)`, x, y)
      })
    } else if (type === 'line') {
      meta.data.forEach((pt, i) => {
        if (pt.skip) return
        const value = Number(dataset.data[i]) || 0
        const label = String(labels[i] ?? '')
        ctx.fillText(`${label}: ${value}`, pt.x, pt.y - 8)
      })
    } else {
      // 柱状图/条形图
      meta.data.forEach((bar, i) => {
        const value = Number(dataset.data[i]) || 0
        const label = String(labels[i] ?? '')
        ctx.fillText(`${label}: ${value}`, bar.x, bar.y - 4)
      })
    }

    ctx.restore()
  }
}

const CHART_TYPES = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'pie', label: '饼图' },
  { value: 'doughnut', label: '环形图' }
]

export default function ChartPage() {
  const { sheets, addToast } = useAppStore()

  // 只有含列的 sheet 可作为数据源
  const dataSheets = useMemo(
    () => sheets.filter(s => s.result?.success && s.result?.columns && s.result?.rows?.length > 0),
    [sheets]
  )

  const [selectedSheetId, setSelectedSheetId] = useState(null)
  const [config, setConfig] = useState({ type: 'bar', title: '', xColumn: '', yColumn: '' })
  const [savedCharts, setSavedCharts] = useState([])
  // 正在预览的已保存图表（从快照渲染，无需数据源）
  const [previewChart, setPreviewChart] = useState(null)
  const chartRef = useRef(null)

  // 选中第一个可用 sheet
  useEffect(() => {
    if (!selectedSheetId && dataSheets.length > 0) {
      setSelectedSheetId(dataSheets[0].id)
    }
    if (selectedSheetId && !dataSheets.find(s => s.id === selectedSheetId)) {
      setSelectedSheetId(dataSheets.length > 0 ? dataSheets[0].id : null)
    }
  }, [dataSheets, selectedSheetId])

  // 加载已保存图表
  useEffect(() => {
    try {
      const saved = localStorage.getItem('spark_nb_charts')
      if (saved) setSavedCharts(JSON.parse(saved))
    } catch (e) {}
  }, [])

  const persistCharts = (items) => {
    setSavedCharts(items)
    localStorage.setItem('spark_nb_charts', JSON.stringify(items))
  }

  const currentSheet = dataSheets.find(s => s.id === selectedSheetId)
  const columns = currentSheet?.result?.columns || []

  // 当切换数据源时重置列选择
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      xColumn: '',
      yColumn: '',
      title: prev.title || (currentSheet ? currentSheet.name : '')
    }))
  }, [selectedSheetId])

  // 正在编辑的图表数据：优先使用预览的已保存图表，否则用当前数据源
  const chartData = previewChart
    ? buildChartData(previewChart.snapshot, { xColumn: previewChart.xColumn, yColumn: previewChart.yColumn, type: previewChart.type })
    : (currentSheet ? buildChartData(currentSheet.result, config) : null)

  // 选择数据源时清除预览状态
  const selectSheet = (id) => {
    setPreviewChart(null)
    setSelectedSheetId(id)
  }

  // 修改配置时清除预览状态
  const updateConfig = (patch) => {
    setPreviewChart(null)
    setConfig(prev => ({ ...prev, ...patch }))
  }

  const handleSaveChart = () => {
    if (!currentSheet || !chartData) {
      addToast('请先选择数据源并配置 X/Y 轴', 'warning')
      return
    }
    const chart = {
      id: genId(),
      name: config.title || currentSheet.name,
      type: config.type,
      sheetName: currentSheet.name,
      xColumn: config.xColumn,
      yColumn: config.yColumn,
      // 快照数据，确保即使 sheet 改变图表仍可复现
      snapshot: {
        columns: currentSheet.result.columns,
        rows: currentSheet.result.rows
      }
    }
    persistCharts([chart, ...savedCharts])
    addToast('图表已保存到图表库', 'success')
  }

  const handleDeleteChart = (id) => {
    persistCharts(savedCharts.filter(c => c.id !== id))
  }

  const getChartOptions = (type, opts = {}) => {
    const base = {
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 16, left: 16, bottom: 16 } }
    }
    return {
      ...base,
      ...opts,
      plugins: { ...(base.plugins || {}), ...(opts.plugins || {}) }
    }
  }

  const renderChart = (data, type, opts = {}, forwardRef = null) => {
    if (!data) return null
    const commonProps = { data, plugins: [dataLabelPlugin], ref: forwardRef }
    switch (type) {
      case 'line': return <Line {...commonProps} options={getChartOptions(type, opts)} />
      case 'pie': return <Pie {...commonProps} options={getChartOptions(type, opts)} />
      case 'doughnut': return <Doughnut {...commonProps} options={getChartOptions(type, opts)} />
      default: return <Bar {...commonProps} options={getChartOptions(type, { ...opts, plugins: { legend: { display: false }, ...(opts.plugins || {}) } })} />
    }
  }

  const exportChartImage = async () => {
    const chart = chartRef.current
    if (!chart) {
      addToast('没有可导出的图表', 'warning')
      return
    }
    try {
      const dataUrl = chart.toBase64Image()
      const defaultName = `${previewChart?.name || config.title || currentSheet?.name || 'chart'}.png`
      const result = await window.electronAPI.saveChartImage(dataUrl, defaultName)
      if (result.success) {
        addToast(`图表已保存: ${result.filePath}`, 'success')
      } else if (!result.canceled) {
        addToast('保存失败: ' + result.error, 'error')
      }
    } catch (error) {
      addToast('导出失败: ' + error.message, 'error')
    }
  }

  return (
    <div className="h-full flex gap-3 min-h-0">
      {/* 左侧：数据源选择 */}
      <div className="w-64 shrink-0 flex flex-col min-h-0">
        <div className="card flex-1 flex flex-col min-h-0">
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5">
              <Table2 className="w-3.5 h-3.5" /> 数据源（结果 Sheet）
            </span>
          </div>
          <div className="p-2 overflow-auto flex-1">
            {dataSheets.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-6">
                暂无可用数据<br />请先在「SQL 查询」页执行查询，结果将作为图表数据源
              </p>
            ) : (
              <div className="space-y-1">
                {dataSheets.map(sheet => {
                  const isActive = sheet.id === selectedSheetId
                  return (
                    <button
                      key={sheet.id}
                      onClick={() => selectSheet(sheet.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 border border-primary-200'
                          : 'text-surface-600 hover:bg-surface-100 border border-transparent'
                      }`}
                    >
                      <div className="font-medium truncate flex items-center gap-1.5">
                        <Table2 className="w-3 h-3 shrink-0" />
                        {sheet.name}
                      </div>
                      <div className="text-[10px] text-surface-400 mt-0.5">
                        {sheet.result.columns.length} 列 · {sheet.result.rows.length} 行
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 图表库列表 */}
        <div className="card mt-3 shrink-0 flex flex-col" style={{ maxHeight: '40%' }}>
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> 图表库 ({savedCharts.length})
            </span>
          </div>
          <div className="p-2 overflow-auto">
            {savedCharts.length === 0 ? (
              <p className="text-xs text-surface-500 text-center py-3">尚未保存图表</p>
            ) : (
              <div className="space-y-1">
                {savedCharts.map(c => {
                  const typeLabel = CHART_TYPES.find(t => t.value === c.type)?.label || c.type
                  return (
                    <div key={c.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => {
                          setSelectedSheetId(null)
                          setPreviewChart(c)
                        }}
                        className="flex-1 text-left px-2 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded truncate"
                        title={`${c.name} (${typeLabel})`}
                      >
                        <span className="text-primary-500">[{typeLabel}]</span> {c.name}
                      </button>
                      <button
                        onClick={() => handleDeleteChart(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：配置 + 预览 */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="card shrink-0">
          <div className="card-header">
            <span className="card-title flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> 图表配置
            </span>
          </div>
          <div className="p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="form-label">图表标题</label>
              <input
                value={config.title}
                onChange={(e) => updateConfig({ title: e.target.value })}
                placeholder="输入标题"
                className="form-input w-48"
              />
            </div>
            <div>
              <label className="form-label">图表类型</label>
              <select
                value={config.type}
                onChange={(e) => updateConfig({ type: e.target.value })}
                className="form-input w-28"
              >
                {CHART_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">X 轴（分类）</label>
              <select
                value={config.xColumn}
                onChange={(e) => updateConfig({ xColumn: e.target.value })}
                className="form-input w-36"
                disabled={!currentSheet}
              >
                <option value="">选择列</option>
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Y 轴（数值）</label>
              <select
                value={config.yColumn}
                onChange={(e) => updateConfig({ yColumn: e.target.value })}
                className="form-input w-36"
                disabled={!currentSheet}
              >
                <option value="">选择列</option>
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={exportChartImage} className="btn-secondary" disabled={!chartData}>
                <Download className="w-4 h-4" /> 导出图片
              </button>
              <button onClick={handleSaveChart} className="btn-primary" disabled={!chartData}>
                <Plus className="w-4 h-4" /> 保存到图表库
              </button>
            </div>
          </div>
        </div>

        <div className="card flex-1 flex flex-col min-h-0">
          <div className="card-header">
            <span className="card-title">预览</span>
            {previewChart ? (
              <span className="text-xs text-surface-400">
                图表库: {previewChart.name} · {previewChart.xColumn} × {previewChart.yColumn}
              </span>
            ) : currentSheet ? (
              <span className="text-xs text-surface-400">
                数据源: {currentSheet.name}
                {config.xColumn && config.yColumn ? ` · ${config.xColumn} × ${config.yColumn}` : ''}
              </span>
            ) : null}
          </div>
          <div className="flex-1 p-4 min-h-0">
            {!chartData && !previewChart ? (
              <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                {!currentSheet ? '请先在左侧选择一个数据源' : '请选择 X 轴和 Y 轴列以生成图表'}
              </div>
            ) : (
              <div className="h-full">
                {(previewChart?.name || config.title) && (
                  <h3 className="text-center text-sm font-semibold text-surface-700 mb-3">
                    {previewChart?.name || config.title}
                  </h3>
                )}
                <div className="h-[calc(100%-2rem)]">
                  {renderChart(chartData, previewChart?.type || config.type, {
                    plugins: {
                      title: { display: !!(previewChart?.name || config.title), text: previewChart?.name || config.title },
                      legend: { display: (previewChart?.type || config.type) === 'pie' || (previewChart?.type || config.type) === 'doughnut' }
                    }
                  }, chartRef)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 图表库缩略图 */}
        {savedCharts.length > 0 && (
          <div className="card shrink-0">
            <div className="card-header">
              <span className="card-title">已保存图表</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-3">
                {savedCharts.map(c => {
                  const d = buildChartData(c.snapshot, { xColumn: c.xColumn, yColumn: c.yColumn, type: c.type })
                  return (
                    <div key={c.id} className="w-64 shrink-0 border border-surface-200 rounded-lg p-2 group relative">
                      <button
                        onClick={() => handleDeleteChart(c.id)}
                        className="absolute top-1 right-1 p-1 text-surface-400 hover:text-red-600 opacity-0 group-hover:opacity-100 z-10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-[11px] font-medium text-surface-600 mb-1 truncate">{c.name}</div>
                      <div className="h-32">
                        {d && renderChart(d, c.type, { plugins: { legend: { display: false } } })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

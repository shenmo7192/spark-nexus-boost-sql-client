import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, Save, BarChart3 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function HypothesisPage() {
  const { addToast, showConfirm } = useAppStore()
  const [scenarios, setScenarios] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [comparison, setComparison] = useState(null)

  useEffect(() => {
    loadScenarios()
  }, [])

  const loadScenarios = async () => {
    try {
      const list = await window.electronAPI.listScenarios()
      setScenarios(list)
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id)
      }
    } catch (error) {
      addToast('加载假设方案失败: ' + error.message, 'error')
    }
  }

  const selectedScenario = scenarios.find(s => s.id === selectedId)

  const handleCreate = async () => {
    try {
      const newScenario = await window.electronAPI.createScenario({
        name: '新方案',
        description: '',
        params: {}
      })
      await loadScenarios()
      setSelectedId(newScenario.id)
      addToast('已创建新方案', 'success')
    } catch (error) {
      addToast('创建失败: ' + error.message, 'error')
    }
  }

  const handleCopy = async () => {
    if (!selectedScenario) return
    try {
      const newScenario = await window.electronAPI.createScenario({
        name: `${selectedScenario.name} 副本`,
        description: selectedScenario.description,
        params: { ...selectedScenario.params }
      })
      await loadScenarios()
      setSelectedId(newScenario.id)
      addToast('已复制方案', 'success')
    } catch (error) {
      addToast('复制失败: ' + error.message, 'error')
    }
  }

  const handleDelete = () => {
    if (!selectedScenario) return
    showConfirm(`确定删除方案 "${selectedScenario.name}" 吗？此操作不可撤销。`, async () => {
      try {
        await window.electronAPI.deleteScenario(selectedScenario.id)
        await loadScenarios()
        setSelectedId(null)
        addToast('方案已删除', 'success')
      } catch (error) {
        addToast('删除失败: ' + error.message, 'error')
      }
    })
  }

  const handleSave = async () => {
    if (!selectedScenario) return
    try {
      await window.electronAPI.updateScenario(selectedScenario.id, {
        name: selectedScenario.name,
        description: selectedScenario.description,
        params: selectedScenario.params
      })
      await loadScenarios()
      addToast('方案已保存', 'success')
    } catch (error) {
      addToast('保存失败: ' + error.message, 'error')
    }
  }

  const updateSelected = (updates) => {
    setScenarios(prev => prev.map(s => s.id === selectedId ? { ...s, ...updates } : s))
  }

  const updateParam = (key, value) => {
    const numValue = value === '' ? '' : Number(value)
    updateSelected({
      params: { ...selectedScenario.params, [key]: numValue }
    })
  }

  const addParam = () => {
    const key = `param_${Object.keys(selectedScenario.params).length + 1}`
    updateSelected({
      params: { ...selectedScenario.params, [key]: 0 }
    })
  }

  const removeParam = (key) => {
    const newParams = { ...selectedScenario.params }
    delete newParams[key]
    updateSelected({ params: newParams })
  }

  const toggleCompare = (id) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCompare = async () => {
    if (compareIds.length < 2) {
      addToast('请至少选择两个方案进行对比', 'warning')
      return
    }
    try {
      const result = await window.electronAPI.compareScenarios(compareIds)
      setComparison(result)
    } catch (error) {
      addToast('对比失败: ' + error.message, 'error')
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-800">假设参数</h1>
          <p className="text-sm text-surface-500 mt-0.5">管理多套业务假设方案，在 SQL 中使用 {'{{参数名}}'} 引用</p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          新建方案
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* 方案列表 */}
        <div className="card flex flex-col">
          <div className="card-header">
            <span className="card-title">方案列表</span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {scenarios.map(s => (
              <div
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`
                  group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer mb-1
                  ${selectedId === s.id ? 'bg-primary-50 border border-primary-100' : 'hover:bg-surface-50 border border-transparent'}
                `}
              >
                <input
                  type="checkbox"
                  checked={compareIds.includes(s.id)}
                  onChange={(e) => { e.stopPropagation(); toggleCompare(s.id) }}
                  className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${selectedId === s.id ? 'text-primary-700' : 'text-surface-700'}`}>
                    {s.name}
                  </p>
                  <p className="text-xs text-surface-500 truncate">{s.description || '无描述'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-surface-200">
            <button
              onClick={handleCompare}
              disabled={compareIds.length < 2}
              className="w-full btn-secondary"
            >
              <BarChart3 className="w-4 h-4" />
              对比选中方案 ({compareIds.length})
            </button>
          </div>
        </div>

        {/* 方案编辑 */}
        <div className="card lg:col-span-2 flex flex-col">
          {selectedScenario ? (
            <>
              <div className="card-header">
                <span className="card-title">方案详情</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy} className="btn-secondary">
                    <Copy className="w-4 h-4" />
                    复制
                  </button>
                  <button onClick={handleSave} className="btn-primary">
                    <Save className="w-4 h-4" />
                    保存
                  </button>
                  <button onClick={handleDelete} className="btn-secondary text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">方案名称</label>
                    <input
                      type="text"
                      value={selectedScenario.name}
                      onChange={(e) => updateSelected({ name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">描述</label>
                    <input
                      type="text"
                      value={selectedScenario.description}
                      onChange={(e) => updateSelected({ description: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">参数列表</label>
                    <button onClick={addParam} className="btn-secondary text-xs py-1 px-2">
                      <Plus className="w-3 h-3" />
                      添加参数
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(selectedScenario.params).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newParams = {}
                            Object.entries(selectedScenario.params).forEach(([k, v]) => {
                              newParams[k === key ? e.target.value : k] = v
                            })
                            updateSelected({ params: newParams })
                          }}
                          className="form-input flex-1"
                          placeholder="参数名"
                        />
                        <input
                          type="number"
                          step="any"
                          value={value}
                          onChange={(e) => updateParam(key, e.target.value)}
                          className="form-input flex-1"
                          placeholder="参数值"
                        />
                        <button
                          onClick={() => removeParam(key)}
                          className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {Object.keys(selectedScenario.params).length === 0 && (
                      <p className="text-sm text-surface-500 py-2">暂无参数，点击添加</p>
                    )}
                  </div>
                </div>

                <div className="bg-surface-50 rounded-lg p-3 text-xs text-surface-500">
                  <p className="font-medium text-surface-700 mb-1">使用说明</p>
                  <p>在 SQL 中使用 <code className="bg-white px-1 py-0.5 rounded border">{'{{参数名}}'}</code> 引用参数，例如：</p>
                  <code className="block mt-1 bg-surface-100 p-2 rounded font-mono">
                    SELECT * FROM 销售数据 WHERE 税率 = {'{{tax_rate}}'}
                  </code>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-500">
              请选择一个方案或新建方案
            </div>
          )}
        </div>
      </div>

      {/* 对比结果 */}
      {comparison && (
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><BarChart3 className="w-4 h-4" /> 方案对比</span>
            <button onClick={() => { setComparison(null); setCompareIds([]) }} className="btn-ghost text-xs">关闭</button>
          </div>
          <div className="overflow-x-auto p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>参数</th>
                  {comparison.scenarios.map(s => (
                    <th key={s.id}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.comparison.map(row => (
                  <tr key={row.key}>
                    <td className="font-medium">{row.key}</td>
                    {row.values.map(v => (
                      <td key={v.scenarioId}>{v.value === undefined ? '-' : String(v.value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

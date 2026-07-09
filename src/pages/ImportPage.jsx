import { useState, useEffect, useCallback } from 'react'
import { Upload, Database, Trash2, FileSpreadsheet, Table2, RefreshCw, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { formatCellValue } from '../lib/format'

const statusMap = {
  queued: { label: '等待中', icon: Clock, className: 'bg-surface-100 text-surface-600' },
  processing: { label: '转换中', icon: Loader2, className: 'bg-primary-100 text-primary-600' },
  done: { label: '完成', icon: CheckCircle, className: 'bg-green-100 text-green-600' },
  error: { label: '失败', icon: XCircle, className: 'bg-red-100 text-red-600' }
}

export default function ImportPage() {
  const { databases, setDatabases, currentDb, setCurrentDb, addToast, dataDir } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDb, setSelectedDb] = useState(null)
  const [dbInfo, setDbInfo] = useState(null)
  const [previewTable, setPreviewTable] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importQueue, setImportQueue] = useState([])

  const loadDatabases = useCallback(async () => {
    try {
      const list = await window.electronAPI.listDatabases()
      setDatabases(list)
    } catch (error) {
      addToast('加载数据库列表失败: ' + error.message, 'error')
    }
  }, [setDatabases, addToast])

  useEffect(() => {
    loadDatabases()
  }, [loadDatabases])

  useEffect(() => {
    if (selectedDb) {
      loadDbInfo(selectedDb)
    } else {
      setDbInfo(null)
      setPreviewTable(null)
      setPreviewData(null)
    }
  }, [selectedDb])

  useEffect(() => {
    if (!window.electronAPI.onImportProgress) return

    const unsubscribe = window.electronAPI.onImportProgress((msg) => {
      setImportQueue(prev => {
        const idx = prev.findIndex(t => t.id === msg.taskId)
        const next = [...prev]
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            status: msg.status || next[idx].status,
            message: msg.message || next[idx].message,
            result: msg.result || next[idx].result,
            error: msg.error || next[idx].error
          }
        } else if (msg.type === 'queued') {
          next.push({
            id: msg.taskId,
            file: msg.file,
            dbName: msg.dbName,
            status: msg.status || 'queued',
            message: msg.message || '等待中',
            result: null,
            error: null
          })
        }
        return next
      })
    })

    return unsubscribe
  }, [])

  const loadDbInfo = async (dbName) => {
    try {
      const info = await window.electronAPI.getDatabaseInfo(dbName)
      setDbInfo(info)
      if (info.tables.length > 0 && !previewTable) {
        handlePreview(dbName, info.tables[0].name)
      }
    } catch (error) {
      addToast('加载数据库信息失败: ' + error.message, 'error')
    }
  }

  const handlePreview = async (dbName, tableName) => {
    try {
      setPreviewTable(tableName)
      const data = await window.electronAPI.getTablePreview(dbName, tableName)
      setPreviewData(data)
    } catch (error) {
      addToast('加载表预览失败: ' + error.message, 'error')
    }
  }

  const handleImport = async (filePaths) => {
    if (!filePaths || filePaths.length === 0) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.importExcelFiles(filePaths)
      let successCount = 0
      let errorMsg = ''
      let firstSuccessDbName = null

      for (const item of result.results) {
        if (item.success) {
          successCount++
          if (!firstSuccessDbName) {
            firstSuccessDbName = item.dbName
          }
        } else {
          errorMsg += `${item.file}: ${item.error}; `
        }
      }

      if (firstSuccessDbName) {
        setCurrentDb(firstSuccessDbName)
        await window.electronAPI.setCurrentDatabase(firstSuccessDbName)
      }

      await loadDatabases()

      if (successCount > 0) {
        addToast(`成功导入 ${successCount} 个文件`, 'success')
      }
      if (errorMsg) {
        addToast(`导入失败: ${errorMsg}`, 'error')
      }
    } catch (error) {
      addToast('导入失败: ' + error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectFiles = async () => {
    const filePaths = await window.electronAPI.selectExcelFiles()
    await handleImport(filePaths)
  }

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    await handleImport(filePaths)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDeleteDb = async (dbName, e) => {
    e.stopPropagation()
    if (!confirm(`确定删除数据库 "${dbName}" 吗？此操作不可恢复。`)) return
    try {
      await window.electronAPI.deleteDatabase(dbName)
      if (currentDb === dbName) {
        setCurrentDb(null)
        await window.electronAPI.setCurrentDatabase('')
      }
      if (selectedDb === dbName) {
        setSelectedDb(null)
      }
      await loadDatabases()
      addToast('数据库已删除', 'success')
    } catch (error) {
      addToast('删除失败: ' + error.message, 'error')
    }
  }

  const handleSelectDb = async (dbName) => {
    setSelectedDb(dbName)
    setCurrentDb(dbName)
    try {
      await window.electronAPI.setCurrentDatabase(dbName)
      addToast(`已切换当前数据库: ${dbName}`, 'info')
    } catch (error) {
      addToast('切换数据库失败: ' + error.message, 'error')
    }
  }

  const activeCount = importQueue.filter(t => t.status === 'queued' || t.status === 'processing').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-800">数据导入</h1>
          <p className="text-sm text-surface-500 mt-0.5">拖拽 Excel 文件或点击上传，自动转换为 SQLite 数据库</p>
        </div>
        <button onClick={loadDatabases} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 上传区 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Excel 导入</span>
          </div>
          <div className="p-5">
            <div
              onClick={handleSelectFiles}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-surface-300 bg-surface-50 hover:border-primary-400 hover:bg-surface-100'
                }
              `}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium text-surface-700">
                {isLoading ? `正在导入，还有 ${activeCount} 个文件在队列...` : '点击或拖拽 Excel / .db 文件到此处'}
              </p>
              <p className="text-xs text-surface-500 mt-1">支持 .xlsx / .xls / .xlsm / .db / .sqlite / .sqlite3</p>
            </div>

            <div className="mt-4 text-xs text-surface-500">
              <p>数据目录: <span className="font-mono text-surface-700">{dataDir}</span></p>
            </div>
          </div>
        </div>

        {/* 数据库列表 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">数据库管理</span>
            <span className="text-xs text-surface-500">{databases.length} 个数据库</span>
          </div>
          <div className="max-h-[320px] overflow-auto">
            {databases.length === 0 ? (
              <div className="p-8 text-center text-surface-500 text-sm">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
                暂无数据库，请先导入 Excel
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {databases.map(db => (
                  <div
                    key={db.name}
                    onClick={() => handleSelectDb(db.name)}
                    className={`
                      px-4 py-3 flex items-center justify-between cursor-pointer transition-colors
                      ${selectedDb === db.name ? 'bg-primary-50' : 'hover:bg-surface-50'}
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-800 truncate">{db.name}</p>
                        <p className="text-xs text-surface-500">{db.sizeDisplay} · {db.tables.length} 张表</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentDb === db.name && (
                        <span className="badge badge-primary text-[10px]">当前</span>
                      )}
                      <button
                        onClick={(e) => handleDeleteDb(db.name, e)}
                        className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 导入队列 */}
      {importQueue.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">导入队列</span>
            <span className="text-xs text-surface-500">
              {activeCount > 0 ? `还有 ${activeCount} 个文件在处理` : '全部处理完毕'}
            </span>
          </div>
          <div className="max-h-[240px] overflow-auto divide-y divide-surface-100">
            {importQueue.map(task => {
              const meta = statusMap[task.status] || statusMap.queued
              const Icon = meta.icon
              return (
                <div key={task.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.className}`}>
                      <Icon className={`w-4 h-4 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{task.file}</p>
                      <p className="text-xs text-surface-500 truncate">
                        {task.status === 'done' && task.result
                          ? `已生成 ${task.result.dbName}，共 ${task.result.tables.length} 张表`
                          : task.message}
                      </p>
                    </div>
                  </div>
                  <span className={`badge text-[10px] ${meta.className}`}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 表结构预览 */}
      {dbInfo && (
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <Table2 className="w-4 h-4" />
              {selectedDb} 表结构
            </span>
          </div>
          <div className="p-0">
            <div className="flex border-b border-surface-200 overflow-x-auto">
              {dbInfo.tables.map(table => (
                <button
                  key={table.name}
                  onClick={() => handlePreview(selectedDb, table.name)}
                  className={`
                    px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${previewTable === table.name
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-surface-600 hover:text-surface-800 hover:bg-surface-50'
                    }
                  `}
                >
                  {table.name}
                  <span className="ml-1.5 text-xs text-surface-400">({table.rowCount})</span>
                </button>
              ))}
            </div>

            {previewData && (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="data-table">
                  <thead>
                    <tr>
                      {previewData.columns.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, idx) => (
                      <tr key={idx}>
                        {previewData.columns.map((col, colIdx) => (
                          <td key={col}>{formatCellValue(row[col], previewData.columnTypes?.[colIdx])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.totalRows > previewData.limit && (
                  <div className="p-3 text-center text-xs text-surface-500">
                    仅显示前 {previewData.limit} 行，共 {previewData.totalRows} 行
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

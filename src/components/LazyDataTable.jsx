import { useState, useEffect, useRef, useMemo } from 'react'
import { formatCellValue } from '../lib/format'

const ROW_HEIGHT = 36
const BUFFER = 10
const MIN_COL_WIDTH = 80
const MAX_COL_WIDTH = 300

/**
 * 懒加载数据表格
 * 通过仅渲染可视区域行来优化大数据量下的性能，同时保留全部数据的滚动高度。
 */
export default function LazyDataTable({ columns, rows, columnTypes = [] }) {
  const bodyRef = useRef(null)
  const headerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [bodyHeight, setBodyHeight] = useState(0)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setBodyHeight(entries[0].contentRect.height)
    })
    ro.observe(el)
    setBodyHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // 同步表头与表体的横向滚动
  useEffect(() => {
    const body = bodyRef.current
    const header = headerRef.current
    if (!body || !header) return
    const sync = () => { header.scrollLeft = body.scrollLeft }
    body.addEventListener('scroll', sync)
    return () => body.removeEventListener('scroll', sync)
  }, [])

  const safeRows = rows || []
  const safeColumns = columns || []
  const totalHeight = Math.max(safeRows.length * ROW_HEIGHT, 0)
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER)
  const endIndex = Math.min(
    safeRows.length,
    Math.ceil((scrollTop + bodyHeight) / ROW_HEIGHT) + BUFFER
  )

  const visibleRows = useMemo(
    () => safeRows.slice(startIndex, endIndex),
    [safeRows, startIndex, endIndex]
  )
  const offsetY = startIndex * ROW_HEIGHT

  const handleScroll = (e) => setScrollTop(e.currentTarget.scrollTop)

  const rowNumWidth = useMemo(
    () => Math.max(48, String(safeRows.length).length * 10 + 24),
    [safeRows.length]
  )

  const colWidths = useMemo(() => {
    return safeColumns.map(col => {
      const base = Math.max(MIN_COL_WIDTH, col.length * 12 + 24)
      return Math.min(base, MAX_COL_WIDTH)
    })
  }, [safeColumns])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 固定表头 */}
      <div ref={headerRef} className="shrink-0 overflow-hidden border-b border-surface-200 pr-2">
        <table className="lazy-data-table">
          <colgroup>
            <col style={{ width: rowNumWidth }} />
            {colWidths.map((w, i) => (
              <col key={safeColumns[i]} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="text-center text-surface-400">#</th>
              {safeColumns.map(col => (
                <th key={col} title={col}>{col}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* 虚拟滚动表体 */}
      <div ref={bodyRef} onScroll={handleScroll} className="flex-1 overflow-auto min-h-0">
        <div style={{ height: totalHeight, position: 'relative', minWidth: '100%' }}>
          <table
            className="lazy-data-table absolute inset-x-0"
            style={{ top: offsetY, minWidth: '100%' }}
          >
            <colgroup>
              <col style={{ width: rowNumWidth }} />
              {colWidths.map((w, i) => (
                <col key={safeColumns[i]} style={{ width: w }} />
              ))}
            </colgroup>
            <tbody>
              {visibleRows.map((row, idx) => {
                const realIdx = startIndex + idx
                return (
                  <tr key={realIdx} style={{ height: ROW_HEIGHT }}>
                    <td className="text-center text-surface-400 text-xs">{realIdx + 1}</td>
                    {safeColumns.map((col, i) => {
                      const value = row[col]
                      const type = columnTypes[i] || ''
                      const text = formatCellValue(value, type)
                      return (
                        <td key={col} title={text}>
                          {text}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="shrink-0 px-3 py-2 border-t border-surface-200 bg-white text-xs text-surface-500">
        共 {safeRows.length} 行
      </div>
    </div>
  )
}

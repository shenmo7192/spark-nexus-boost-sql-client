function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * 将 Date 按列类型格式化为可读字符串
 * - DATE -> YYYY-MM-DD
 * - TIME -> HH:mm:ss
 * - DATETIME/TIMESTAMP/其他 -> YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(d, type = '') {
  const upper = (type || '').toUpperCase()
  const isTime = upper.includes('TIME') && !upper.includes('DATE') && !upper.includes('DATETIME') && !upper.includes('TIMESTAMP')
  const isDate = upper.includes('DATE') && !upper.includes('TIME') && !upper.includes('DATETIME') && !upper.includes('TIMESTAMP')

  const year = d.getFullYear()
  const month = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hour = pad2(d.getHours())
  const minute = pad2(d.getMinutes())
  const second = pad2(d.getSeconds())

  if (isTime) return `${hour}:${minute}:${second}`
  if (isDate) return `${year}-${month}-${day}`
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 根据列声明类型格式化单元格值
 * - Date 实例 -> 日期/时间字符串
 * - TIMESTAMP/DATETIME/DATE/TIME 类型的数字/数字字符串 -> 日期/时间字符串
 * - 其他 -> String(value)
 */
export function formatCellValue(value, type = '') {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return formatDateTime(value, type)

  const upper = (type || '').toUpperCase()
  const isDateLikeType = upper.includes('TIMESTAMP') || upper.includes('DATETIME') || upper.includes('DATE') || upper.includes('TIME')

  if (isDateLikeType) {
    if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
      const num = Number(value)
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        // 秒级时间戳 vs 毫秒级时间戳启发式判断
        const ms = Math.abs(num) > 1e12 ? num : num * 1000
        return formatDateTime(new Date(ms), type)
      }
    }
    if (typeof value === 'string' && value.trim()) {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return formatDateTime(d, type)
      }
    }
  }

  return String(value)
}

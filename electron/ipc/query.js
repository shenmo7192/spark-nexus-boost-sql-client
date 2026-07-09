const Database = require('better-sqlite3')
const fs = require('fs')

const { getDbPath } = require('../utils/paths')
const { appStore } = require('../utils/store')
const { getScenario } = require('./hypothesis')

const CURRENT_DB_KEY = 'currentDatabase'

/**
 * 替换 SQL 中的 {{参数名}}
 * 对字符串做简单的单引号转义
 */
function replaceParams(sql, params) {
  if (!params || Object.keys(params).length === 0) return sql

  return sql.replace(/\{\{\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*\}\}/g, (match, key) => {
    if (!(key in params)) return match
    const value = params[key]
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    // 字符串转义单引号
    return `'${String(value).replace(/'/g, "''")}'`
  })
}

/**
 * 解析 EXPORT 指令
 */
function parseExportStatements(statements) {
  const exportConfig = {
    filename: null,
    path: null,
    sheetNames: {}
  }
  const actualStatements = []
  let lastSqlIdx = -1

  for (const stmt of statements) {
    const trimmed = stmt.trim()
    if (trimmed.toUpperCase().startsWith('EXPORT ')) {
      const content = trimmed.substring(7).trim()
      const parts = content.split(/\s+/)
      if (parts.length >= 1) {
        exportConfig.filename = parts[0]
      }
      if (parts.length >= 2 && lastSqlIdx >= 0) {
        exportConfig.sheetNames[String(lastSqlIdx)] = parts[1]
      }
      if (parts.length >= 3) {
        exportConfig.path = parts.slice(2).join(' ')
      }
    } else {
      lastSqlIdx = actualStatements.length
      actualStatements.push(trimmed)
    }
  }

  return { actualStatements, exportConfig }
}

/**
 * 执行单条 SQL
 */
function executeSingle(dbPath, sql) {
  const db = new Database(dbPath, { readonly: true })
  try {
    const upper = sql.trim().toUpperCase()
    const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA')

    if (isSelect || upper.startsWith('PRAGMA')) {
      const stmt = db.prepare(sql)
      const colInfos = stmt.columns()
      const rows = stmt.all()
      const columns = colInfos.map(c => c.name)
      const columnTypes = colInfos.map(c => c.type || '')

      return {
        success: true,
        columns,
        columnTypes,
        rows,
        totalRows: rows.length,
        sql
      }
    } else {
      // 非 SELECT 使用读写模式
      const rwDb = new Database(dbPath)
      try {
        const info = rwDb.prepare(sql).run()
        return {
          success: true,
          message: `执行成功，影响 ${info.changes} 行`,
          changes: info.changes,
          lastInsertRowid: info.lastInsertRowid,
          sql
        }
      } finally {
        rwDb.close()
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      sql
    }
  } finally {
    db.close()
  }
}

/**
 * 执行 SQL 查询
 * options: { sql, dbName?, scenarioId? }
 */
function runQuery(options) {
  const { sql, scenarioId } = options
  let dbName = options.dbName

  if (!dbName) {
    dbName = appStore.get(CURRENT_DB_KEY, '')
  }

  if (!dbName) {
    return { success: false, error: '请先选择数据库' }
  }

  const dbPath = getDbPath(dbName)
  if (!fs.existsSync(dbPath)) {
    return { success: false, error: '数据库文件不存在' }
  }

  // 获取假设参数
  let params = null
  let scenarioName = null
  if (scenarioId) {
    const scenario = getScenario(scenarioId)
    if (scenario) {
      params = scenario.params || {}
      scenarioName = scenario.name
    }
  }

  // 拆分语句
  const rawStatements = sql.split(';').map(s => s.trim()).filter(Boolean)
  const { actualStatements, exportConfig } = parseExportStatements(rawStatements)

  if (actualStatements.length === 0) {
    return { success: false, error: '没有可执行的 SQL 语句' }
  }

  if (actualStatements.length === 1) {
    const finalSql = params ? replaceParams(actualStatements[0], params) : actualStatements[0]
    const result = executeSingle(dbPath, finalSql)
    if (scenarioName) result.scenarioName = scenarioName
    if (exportConfig.filename) {
      result.exportConfig = {
        ...exportConfig,
        sheetName: Object.values(exportConfig.sheetNames)[0] || undefined
      }
    }
    return result
  }

  // 多条语句
  const results = []
  let hasError = false
  for (let i = 0; i < actualStatements.length; i++) {
    const stmt = actualStatements[i]
    const finalSql = params ? replaceParams(stmt, params) : stmt
    const r = executeSingle(dbPath, finalSql)
    if (scenarioName) r.scenarioName = scenarioName
    r.sqlPreview = stmt.length > 80 ? stmt.substring(0, 80) + '...' : stmt
    results.push(r)
    if (!r.success) hasError = true
  }

  const resp = {
    success: !hasError,
    multi: true,
    results
  }
  if (exportConfig.filename) {
    resp.exportConfig = exportConfig
  }
  return resp
}

module.exports = { runQuery }

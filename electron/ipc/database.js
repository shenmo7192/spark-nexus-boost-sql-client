const Database = require('better-sqlite3')
const { join, basename } = require('path')
const fs = require('fs')

const { getDbPath, getDbDir, formatSize } = require('../utils/paths')
const { appStore } = require('../utils/store')
const { importQueue } = require('./importQueue')

const CURRENT_DB_KEY = 'currentDatabase'

/**
 * 列出所有数据库
 */
function listDatabases() {
  const dbDir = getDbDir()
  if (!fs.existsSync(dbDir)) return []

  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'))
  return files.map(f => {
    const dbPath = join(dbDir, f)
    const stat = fs.statSync(dbPath)
    let tables = []
    try {
      const db = new Database(dbPath, { readonly: true })
      tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name)
      db.close()
    } catch (e) {
      // ignore
    }
    return {
      name: f,
      size: stat.size,
      sizeDisplay: formatSize(stat.size),
      tables,
      updatedAt: stat.mtime.toISOString()
    }
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

/**
 * 获取数据库表信息
 */
function getDatabaseInfo(dbName) {
  const dbPath = getDbPath(dbName)
  if (!fs.existsSync(dbPath)) {
    throw new Error('数据库不存在')
  }

  const db = new Database(dbPath, { readonly: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name)
    const tableInfos = tables.map(tableName => {
      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all()
      const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get()
      return {
        name: tableName,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type || 'TEXT',
          notNull: !!c.notnull,
          defaultValue: c.dflt_value,
          primaryKey: !!c.pk
        })),
        rowCount: countRow.count
      }
    })
    return { dbName, tables: tableInfos }
  } finally {
    db.close()
  }
}

/**
 * 预览表数据
 */
function getTablePreview(dbName, tableName, limit = 20) {
  const dbPath = getDbPath(dbName)
  if (!fs.existsSync(dbPath)) {
    throw new Error('数据库不存在')
  }

  const db = new Database(dbPath, { readonly: true })
  try {
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name)
    const rows = db.prepare(`SELECT * FROM "${tableName}" LIMIT ${limit}`).all()
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get()
    return {
      dbName,
      tableName,
      columns,
      rows,
      totalRows: countRow.count,
      limit
    }
  } finally {
    db.close()
  }
}

/**
 * 删除数据库
 */
function deleteDatabase(dbName) {
  const dbPath = getDbPath(dbName)
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }
  if (appStore.get(CURRENT_DB_KEY) === dbName) {
    appStore.delete(CURRENT_DB_KEY)
  }
  return { success: true }
}

/**
 * 设置/获取当前数据库
 */
function setCurrentDatabase(dbName) {
  if (!dbName) {
    appStore.delete(CURRENT_DB_KEY)
    return { success: true }
  }
  const dbPath = getDbPath(dbName)
  if (!fs.existsSync(dbPath)) {
    throw new Error('数据库不存在')
  }
  appStore.set(CURRENT_DB_KEY, dbName)
  return { success: true, dbName }
}

function getCurrentDatabase() {
  const dbName = appStore.get(CURRENT_DB_KEY, '')
  if (dbName) {
    const dbPath = getDbPath(dbName)
    if (fs.existsSync(dbPath)) return { dbName }
    appStore.delete(CURRENT_DB_KEY)
  }
  return { dbName: '' }
}

/**
 * 导入数据文件到 SQLite（支持 Excel 与 .db）
 * 内部使用任务队列 + Worker 多线程并发处理
 */
async function importExcelFiles(filePaths) {
  const batchResults = await importQueue.add(filePaths)

  const results = batchResults.map(item => ({
    file: item.file,
    success: item.success,
    dbName: item.dbName,
    tables: item.tables,
    error: item.error
  }))

  // 如果只有一个成功，设为当前数据库
  const successResults = results.filter(r => r.success)
  if (successResults.length === 1) {
    setCurrentDatabase(successResults[0].dbName)
  }

  return { success: true, results }
}

module.exports = {
  listDatabases,
  getDatabaseInfo,
  getTablePreview,
  deleteDatabase,
  setCurrentDatabase,
  getCurrentDatabase,
  importExcelFiles
}

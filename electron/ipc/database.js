const Database = require('better-sqlite3')
const xlsx = require('xlsx')
const { join, basename, extname } = require('path')
const fs = require('fs')

const { getDbPath, getDbDir, getUploadDir, formatSize, sanitizeFilename } = require('../utils/paths')
const { appStore } = require('../utils/store')

const CURRENT_DB_KEY = 'currentDatabase'
const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm']

function isExcelFile(filename) {
  const ext = extname(filename).toLowerCase()
  return EXCEL_EXTENSIONS.includes(ext)
}

function cleanColumnName(name) {
  if (name === null || name === undefined) return 'column'
  let clean = String(name).trim()
    .replace(/\s+/g, '_')
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!clean) clean = 'column'
  // SQLite 列名不能以数字开头
  if (/^\d/.test(clean)) clean = '_' + clean
  return clean
}

function dedupeColumnNames(names) {
  const seen = new Map()
  return names.map(name => {
    const base = name
    let count = seen.get(base) || 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}_${count}`
  })
}

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
 * 导入 Excel 文件到 SQLite
 */
function importExcelFiles(filePaths) {
  const results = []
  for (const filePath of filePaths) {
    try {
      if (!isExcelFile(filePath)) {
        results.push({ file: basename(filePath), success: false, error: '不支持的文件格式' })
        continue
      }

      const originalName = basename(filePath)
      const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''))
      const uploadDir = getUploadDir()
      const uploadPath = join(uploadDir, `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${sanitizeFilename(originalName)}`)
      fs.copyFileSync(filePath, uploadPath)

      // 生成数据库文件名，处理重名
      let dbName = `${baseName}.db`
      let dbPath = join(getDbDir(), dbName)
      let counter = 1
      while (fs.existsSync(dbPath)) {
        dbName = `${baseName}_${counter}.db`
        dbPath = join(getDbDir(), dbName)
        counter++
      }

      // 读取 Excel
      const workbook = xlsx.readFile(filePath, { type: 'file' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null })

      if (rawData.length === 0) {
        results.push({ file: originalName, success: false, error: 'Excel 文件为空' })
        continue
      }

      // 清理列名
      const rawHeaders = rawData[0].map(h => cleanColumnName(h))
      const headers = dedupeColumnNames(rawHeaders)

      // 创建数据库和表
      const db = new Database(dbPath)
      try {
        db.pragma('journal_mode = WAL')

        const tableName = cleanColumnName(baseName)
        const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${headers.map(h => `"${h}" TEXT`).join(', ')})`
        db.exec(createSql)

        // 批量插入
        const placeholders = headers.map(() => '?').join(', ')
        const insertSql = `INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${placeholders})`
        const insertStmt = db.prepare(insertSql)

        const insertMany = db.transaction((rows) => {
          for (const row of rows) {
            insertStmt.run(row)
          }
        })

        const dataRows = []
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i]
          const values = headers.map((_, idx) => {
            const val = row[idx]
            return val === null || val === undefined ? '' : String(val)
          })
          dataRows.push(values)
        }

        insertMany(dataRows)

        const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get()
        const rowCount = countRow.count

        results.push({
          file: originalName,
          dbName,
          tableName,
          rowCount,
          columns: headers,
          success: true
        })
      } finally {
        db.close()
      }
    } catch (error) {
      results.push({ file: basename(filePath), success: false, error: error.message })
    }
  }

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

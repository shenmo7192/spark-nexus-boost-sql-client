const Database = require('better-sqlite3')
const xlsx = require('xlsx')
const { join, basename, extname } = require('path')
const fs = require('fs')

const { getDbPath, getDbDir, getUploadDir, formatSize, sanitizeFilename } = require('../utils/paths')
const { appStore } = require('../utils/store')

const CURRENT_DB_KEY = 'currentDatabase'
const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm']
const DB_EXTENSIONS = ['.db', '.sqlite', '.sqlite3']

function isExcelFile(filename) {
  const ext = extname(filename).toLowerCase()
  return EXCEL_EXTENSIONS.includes(ext)
}

function isDbFile(filename) {
  const ext = extname(filename).toLowerCase()
  return DB_EXTENSIONS.includes(ext)
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
 * 生成唯一的本地数据库文件名
 */
function generateDbPath(baseName) {
  let dbName = `${baseName}.db`
  let dbPath = join(getDbDir(), dbName)
  let counter = 1
  while (fs.existsSync(dbPath)) {
    dbName = `${baseName}_${counter}.db`
    dbPath = join(getDbDir(), dbName)
    counter++
  }
  return { dbName, dbPath }
}

/**
 * 备份原始文件到 uploads 目录
 */
function backupOriginal(filePath, originalName) {
  const uploadDir = getUploadDir()
  const uploadPath = join(uploadDir, `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${sanitizeFilename(originalName)}`)
  fs.copyFileSync(filePath, uploadPath)
  return uploadPath
}

/**
 * 导入单个 Excel 文件（每个 sheet 对应一张数据表）
 */
function importOneExcel(filePath) {
  const originalName = basename(filePath)
  const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''))
  backupOriginal(filePath, originalName)

  const { dbName, dbPath } = generateDbPath(baseName)

  const workbook = xlsx.readFile(filePath, { type: 'file' })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel 文件为空')
  }

  const db = new Database(dbPath)
  try {
    db.pragma('journal_mode = WAL')

    const importedTables = []
    const usedTableNames = new Set()

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null })

      if (!rawData || rawData.length === 0) continue

      const rawHeaders = rawData[0].map(h => cleanColumnName(h))
      const headers = dedupeColumnNames(rawHeaders)
      if (headers.length === 0) continue

      let tableName = cleanColumnName(sheetName)
      if (!tableName) tableName = 'Sheet1'
      let tCounter = 1
      let finalTableName = tableName
      while (usedTableNames.has(finalTableName)) {
        finalTableName = `${tableName}_${tCounter++}`
      }
      usedTableNames.add(finalTableName)

      const createSql = `CREATE TABLE IF NOT EXISTS "${finalTableName}" (${headers.map(h => `"${h}" TEXT`).join(', ')})`
      db.exec(createSql)

      const placeholders = headers.map(() => '?').join(', ')
      const insertSql = `INSERT INTO "${finalTableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${placeholders})`
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

      if (dataRows.length > 0) {
        insertMany(dataRows)
      }

      const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${finalTableName}"`).get()
      importedTables.push({
        tableName: finalTableName,
        rowCount: countRow.count,
        columns: headers
      })
    }

    if (importedTables.length === 0) {
      throw new Error('Excel 文件为空')
    }

    return {
      file: originalName,
      dbName,
      tables: importedTables,
      success: true
    }
  } finally {
    db.close()
  }
}

/**
 * 直接导入 SQLite 数据库文件
 */
function importOneDb(filePath) {
  const originalName = basename(filePath)
  const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''))
  backupOriginal(filePath, originalName)

  const { dbName, dbPath } = generateDbPath(baseName)
  fs.copyFileSync(filePath, dbPath)

  // 校验并读取表信息
  const db = new Database(dbPath, { readonly: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name)
    return {
      file: originalName,
      dbName,
      tables: tables.map(name => ({ tableName: name, rowCount: null, columns: [] })),
      success: true
    }
  } finally {
    db.close()
  }
}

/**
 * 导入数据文件到 SQLite（支持 Excel 与 .db）
 */
function importExcelFiles(filePaths) {
  const results = []
  for (const filePath of filePaths) {
    try {
      if (isExcelFile(filePath)) {
        results.push(importOneExcel(filePath))
      } else if (isDbFile(filePath)) {
        results.push(importOneDb(filePath))
      } else {
        results.push({ file: basename(filePath), success: false, error: '不支持的文件格式' })
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

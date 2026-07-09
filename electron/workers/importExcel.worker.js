const { parentPort, workerData } = require('worker_threads')
const xlsx = require('xlsx')
const Database = require('better-sqlite3')
const { basename, join } = require('path')
const fs = require('fs')

const { filePath, dbName, dbPath, dbDir } = workerData
const originalName = basename(filePath)

function sendProgress(status, detail = {}) {
  if (parentPort) {
    parentPort.postMessage({ type: 'progress', status, ...detail })
  }
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function cleanColumnName(name) {
  if (name === null || name === undefined) return 'column'
  let clean = String(name).trim()
    .replace(/\s+/g, '_')
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!clean) clean = 'column'
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

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateTime(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function excelValueToString(val) {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return formatDateTime(val)
  return String(val)
}

async function run() {
  try {
    sendProgress('reading', { message: '正在读取 Excel...' })

    const workbook = xlsx.readFile(filePath, { type: 'file' })
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel 文件为空')
    }

    sendProgress('converting', { message: '正在转换数据...' })

    fs.mkdirSync(dbDir, { recursive: true })
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
          const values = headers.map((_, idx) => excelValueToString(row[idx]))
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

      sendProgress('done', { message: '转换完成' })

      parentPort.postMessage({
        type: 'result',
        success: true,
        file: originalName,
        dbName,
        tables: importedTables
      })
    } finally {
      db.close()
    }
  } catch (error) {
    // 清理可能未完成的数据库文件
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
      }
    } catch {
      // ignore
    }

    parentPort.postMessage({
      type: 'result',
      success: false,
      file: originalName,
      error: error.message
    })
  }
}

run()

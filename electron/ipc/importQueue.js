const { EventEmitter } = require('events')
const { Worker } = require('worker_threads')
const { basename, extname, join } = require('path')
const fs = require('fs')
const os = require('os')
const Database = require('better-sqlite3')

const { getDbDir, generateDbPath, sanitizeFilename } = require('../utils/paths')

const MAX_CONCURRENCY = Math.min(4, os.cpus().length || 1)

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

function importOneDbTask(task) {
  fs.copyFileSync(task.filePath, task.dbPath)

  const db = new Database(task.dbPath, { readonly: true })
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name)
    return {
      file: task.file,
      dbName: task.dbName,
      tables: tables.map(name => ({ tableName: name, rowCount: null, columns: [] })),
      success: true
    }
  } finally {
    db.close()
  }
}

class ImportQueue extends EventEmitter {
  constructor() {
    super()
    this.tasks = []
    this.running = 0
    this.mainWindow = null
  }

  setMainWindow(win) {
    this.mainWindow = win
  }

  notify(payload) {
    this.emit('progress', payload)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('excel:importProgress', payload)
    }
  }

  /**
   * 向队列追加一批文件，返回 Promise，在所有新任务完成/失败后 resolve
   */
  add(filePaths) {
    const batchTasks = filePaths.map(filePath => {
      const originalName = basename(filePath)
      const baseName = sanitizeFilename(originalName.replace(/\.[^/.]+$/, ''))
      const { dbName, dbPath } = generateDbPath(baseName)
      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        filePath,
        file: originalName,
        dbName,
        dbPath,
        status: 'queued',
        message: '等待中',
        error: null,
        result: null
      }
    })

    this.tasks.push(...batchTasks)
    batchTasks.forEach(task => {
      this.notify({ type: 'queued', taskId: task.id, file: task.file, dbName: task.dbName, status: 'queued', message: '等待中' })
    })

    this._process()

    return new Promise((resolve) => {
      const check = () => {
        const allDone = batchTasks.every(t => t.status === 'done' || t.status === 'error')
        if (allDone) {
          this.off('progress', onProgress)
          resolve(batchTasks.map(task => {
            if (task.result) return task.result
            return { file: task.file, success: false, error: task.error || '未知错误' }
          }))
        }
      }
      const onProgress = () => check()
      this.on('progress', onProgress)
      check()
    })
  }

  _process() {
    while (this.running < MAX_CONCURRENCY) {
      const task = this.tasks.find(t => t.status === 'queued')
      if (!task) break
      this._run(task)
    }
  }

  async _run(task) {
    task.status = 'processing'
    task.message = '正在处理...'
    this.running++
    this.notify({ type: 'progress', taskId: task.id, file: task.file, status: 'processing', message: '正在处理...' })

    try {
      let result
      if (isExcelFile(task.filePath)) {
        result = await this._runExcelWorker(task)
      } else if (isDbFile(task.filePath)) {
        result = importOneDbTask(task)
      } else {
        throw new Error('不支持的文件格式')
      }

      task.result = result
      task.status = 'done'
      task.message = '完成'
      this.notify({ type: 'done', taskId: task.id, file: task.file, status: 'done', message: '完成', result })
    } catch (error) {
      task.error = error.message
      task.status = 'error'
      task.message = error.message
      this.notify({ type: 'error', taskId: task.id, file: task.file, status: 'error', message: error.message, error: error.message })
    } finally {
      this.running--
      this._process()
    }
  }

  _runExcelWorker(task) {
    return new Promise((resolve, reject) => {
      const workerPath = join(__dirname, '..', 'workers', 'importExcel.worker.js')
      let settled = false

      const worker = new Worker(workerPath, {
        workerData: {
          filePath: task.filePath,
          dbName: task.dbName,
          dbPath: task.dbPath,
          dbDir: getDbDir()
        }
      })

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          this.notify({
            type: 'progress',
            taskId: task.id,
            file: task.file,
            status: 'processing',
            message: msg.message || '正在转换...'
          })
        } else if (msg.type === 'result') {
          if (settled) return
          settled = true
          worker.terminate().catch(() => {})
          if (msg.success) {
            resolve(msg)
          } else {
            reject(new Error(msg.error || '转换失败'))
          }
        }
      })

      worker.on('error', (err) => {
        if (settled) return
        settled = true
        worker.terminate().catch(() => {})
        reject(err)
      })

      worker.on('exit', (code) => {
        if (settled) return
        settled = true
        if (code !== 0) {
          reject(new Error(`Worker 异常退出，代码 ${code}`))
        } else {
          reject(new Error('Worker 提前结束，未返回结果'))
        }
      })
    })
  }
}

module.exports = {
  importQueue: new ImportQueue(),
  isExcelFile,
  isDbFile
}

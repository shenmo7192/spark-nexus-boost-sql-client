const { app } = require('electron')
const { join } = require('path')
const fs = require('fs')
const appConfig = require('./config')

const DATA_DIR_KEY = 'dataDir'

/**
 * 获取用户数据目录
 * 默认使用 app.getPath('userData')/spark-nb-sql
 */
function getDataDir() {
  const configured = appConfig.get(DATA_DIR_KEY)
  if (configured && fs.existsSync(configured)) {
    return configured
  }
  return join(app.getPath('userData'), 'spark-nb-sql')
}

/**
 * 设置用户数据目录
 */
function setDataDir(dir) {
  appConfig.set(DATA_DIR_KEY, dir)
}

/**
 * 获取各子目录
 */
function getDbDir() {
  return join(getDataDir(), 'databases')
}

function getDbPath(dbName) {
  return join(getDbDir(), dbName)
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

function getConfigPath() {
  return join(getDataDir(), 'config_hypothesis.json')
}

/**
 * 确保所有子目录存在
 */
async function ensureDirs() {
  const dirs = [getDataDir(), getDbDir()]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

/**
 * 格式化文件大小
 */
function formatSize(sizeBytes) {
  if (sizeBytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (sizeBytes >= 1024 && i < units.length - 1) {
    sizeBytes /= 1024
    i++
  }
  return `${sizeBytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * 生成唯一 ID
 */
function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
}

/**
 * 安全文件名：替换非法字符
 */
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

module.exports = {
  getDataDir,
  setDataDir,
  getDbDir,
  getDbPath,
  generateDbPath,
  getConfigPath,
  ensureDirs,
  formatSize,
  generateId,
  sanitizeFilename
}

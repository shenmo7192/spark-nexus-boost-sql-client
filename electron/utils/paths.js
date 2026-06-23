import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import Store from 'electron-store'

const store = new Store({ name: 'spark-nb-sql-settings' })
const DATA_DIR_KEY = 'dataDir'

/**
 * 获取用户数据目录
 * 默认使用 app.getPath('userData')/spark-nb-sql
 */
export function getDataDir() {
  const configured = store.get(DATA_DIR_KEY)
  if (configured && fs.existsSync(configured)) {
    return configured
  }
  return join(app.getPath('userData'), 'spark-nb-sql')
}

/**
 * 设置用户数据目录
 */
export function setDataDir(dir) {
  store.set(DATA_DIR_KEY, dir)
}

/**
 * 获取各子目录
 */
export function getDbDir() {
  return join(getDataDir(), 'databases')
}

export function getUploadDir() {
  return join(getDataDir(), 'uploads')
}

export function getExportDir() {
  return join(getDataDir(), 'exports')
}

export function getConfigPath() {
  return join(getDataDir(), 'config_hypothesis.json')
}

/**
 * 确保所有子目录存在
 */
export async function ensureDirs() {
  const dirs = [getDataDir(), getDbDir(), getUploadDir(), getExportDir()]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

/**
 * 格式化文件大小
 */
export function formatSize(sizeBytes) {
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
export function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
}

/**
 * 安全文件名：替换非法字符
 */
export function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

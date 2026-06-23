const { app } = require('electron')
const { join } = require('path')
const fs = require('fs')

let configPath = null

function getConfigPath() {
  if (!configPath) {
    configPath = join(app.getPath('userData'), 'spark-nb-sql-config.json')
  }
  return configPath
}

function readConfig() {
  try {
    const path = getConfigPath()
    if (fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path, 'utf-8'))
    }
  } catch (e) {
    console.error('读取配置失败:', e)
  }
  return {}
}

function writeConfig(config) {
  try {
    const path = getConfigPath()
    const dir = require('path').dirname(path)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    console.error('写入配置失败:', e)
  }
}

function get(key, defaultValue) {
  const config = readConfig()
  return key in config ? config[key] : defaultValue
}

function set(key, value) {
  const config = readConfig()
  config[key] = value
  writeConfig(config)
}

function deleteKey(key) {
  const config = readConfig()
  delete config[key]
  writeConfig(config)
}

module.exports = {
  get,
  set,
  delete: deleteKey
}

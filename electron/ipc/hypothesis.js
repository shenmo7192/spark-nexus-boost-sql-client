import fs from 'fs'
import { getConfigPath } from '../utils/paths.js'
import { appStore } from '../utils/store.js'
import { generateId } from '../utils/paths.js'

const DEFAULT_SCENARIOS = [
  {
    id: 'baseline',
    name: '基准方案',
    description: '默认基准假设',
    params: {
      tax_rate: 0.13,
      growth_rate: 0.05,
      discount_rate: 0.08,
      cost_inflation: 0.03
    }
  },
  {
    id: 'scenario_1',
    name: '乐观方案',
    description: '增长较高、成本温和的假设',
    params: {
      tax_rate: 0.13,
      growth_rate: 0.12,
      discount_rate: 0.08,
      cost_inflation: 0.02
    }
  },
  {
    id: 'scenario_2',
    name: '悲观方案',
    description: '增长放缓、成本上升的假设',
    params: {
      tax_rate: 0.15,
      growth_rate: 0.02,
      discount_rate: 0.10,
      cost_inflation: 0.05
    }
  }
]

function loadConfig() {
  const configPath = getConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)
      if (config.scenarios && Array.isArray(config.scenarios) && config.scenarios.length > 0) {
        return config
      }
    } catch (e) {
      console.error('读取假设配置失败:', e)
    }
  }
  return { scenarios: JSON.parse(JSON.stringify(DEFAULT_SCENARIOS)) }
}

function saveConfig(config) {
  const configPath = getConfigPath()
  const dir = configPath.substring(0, configPath.lastIndexOf('/'))
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 导出 store 实例供其他模块使用
 */
export function getStore() {
  return appStore
}

/**
 * 列出所有方案
 */
export function listScenarios() {
  const config = loadConfig()
  return config.scenarios
}

/**
 * 获取单个方案
 */
export function getScenario(id) {
  const config = loadConfig()
  return config.scenarios.find(s => s.id === id) || null
}

/**
 * 创建方案
 */
export function createScenario(scenario) {
  const config = loadConfig()
  const newScenario = {
    id: scenario.id || generateId('scenario'),
    name: scenario.name || '新方案',
    description: scenario.description || '',
    params: scenario.params || {}
  }
  config.scenarios.push(newScenario)
  saveConfig(config)
  return newScenario
}

/**
 * 更新方案
 */
export function updateScenario(id, updates) {
  const config = loadConfig()
  const idx = config.scenarios.findIndex(s => s.id === id)
  if (idx === -1) return null

  config.scenarios[idx] = {
    ...config.scenarios[idx],
    name: updates.name ?? config.scenarios[idx].name,
    description: updates.description ?? config.scenarios[idx].description,
    params: updates.params ?? config.scenarios[idx].params
  }
  saveConfig(config)
  return config.scenarios[idx]
}

/**
 * 删除方案
 */
export function deleteScenario(id) {
  const config = loadConfig()
  config.scenarios = config.scenarios.filter(s => s.id !== id)
  saveConfig(config)
  return { success: true }
}

/**
 * 对比多套方案
 */
export function compareScenarios(ids) {
  const config = loadConfig()
  const selected = config.scenarios.filter(s => ids.includes(s.id))

  // 收集所有参数名
  const paramKeys = new Set()
  for (const s of selected) {
    Object.keys(s.params || {}).forEach(k => paramKeys.add(k))
  }

  return {
    scenarios: selected,
    paramKeys: Array.from(paramKeys),
    comparison: Array.from(paramKeys).map(key => ({
      key,
      values: selected.map(s => ({
        scenarioId: s.id,
        scenarioName: s.name,
        value: s.params?.[key]
      }))
    }))
  }
}

/**
 * 获取所有方案参数合并字典（用于 SQL 编辑器提示）
 */
export function getParamsDict() {
  const config = loadConfig()
  const dict = {}
  for (const s of config.scenarios) {
    for (const [key, value] of Object.entries(s.params || {})) {
      if (!(key in dict)) {
        dict[key] = { value, scenarios: [] }
      }
      dict[key].scenarios.push({ id: s.id, name: s.name })
    }
  }
  return dict
}

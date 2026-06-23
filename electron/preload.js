const { contextBridge, ipcRenderer } = require('electron')

// 暴露给渲染进程的受限 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getDataDir: () => ipcRenderer.invoke('app:getDataDir'),
  selectDataDir: () => ipcRenderer.invoke('app:selectDataDir'),

  // 数据库管理
  listDatabases: () => ipcRenderer.invoke('db:list'),
  getDatabaseInfo: (dbName) => ipcRenderer.invoke('db:info', dbName),
  getTablePreview: (dbName, tableName) => ipcRenderer.invoke('db:preview', dbName, tableName),
  deleteDatabase: (dbName) => ipcRenderer.invoke('db:delete', dbName),
  setCurrentDatabase: (dbName) => ipcRenderer.invoke('db:setCurrent', dbName),
  getCurrentDatabase: () => ipcRenderer.invoke('db:getCurrent'),

  // Excel 导入
  importExcelFiles: (filePaths) => ipcRenderer.invoke('excel:import', filePaths),
  selectExcelFiles: () => ipcRenderer.invoke('dialog:selectExcelFiles'),

  // SQL 查询
  runQuery: (options) => ipcRenderer.invoke('query:run', options),
  exportQueryResults: (options) => ipcRenderer.invoke('query:export', options),
  selectExportPath: (defaultName) => ipcRenderer.invoke('dialog:selectExportPath', defaultName),

  // 假设方案
  listScenarios: () => ipcRenderer.invoke('hypothesis:list'),
  getScenario: (id) => ipcRenderer.invoke('hypothesis:get', id),
  createScenario: (scenario) => ipcRenderer.invoke('hypothesis:create', scenario),
  updateScenario: (id, scenario) => ipcRenderer.invoke('hypothesis:update', id, scenario),
  deleteScenario: (id) => ipcRenderer.invoke('hypothesis:delete', id),
  compareScenarios: (ids) => ipcRenderer.invoke('hypothesis:compare', ids),
  getParamsDict: () => ipcRenderer.invoke('hypothesis:params'),

  // 文件导出目录
  openExportsDir: () => ipcRenderer.invoke('shell:openExportsDir'),

  // 监听主进程事件
  onMessage: (callback) => {
    const handler = (_event, message) => callback(message)
    ipcRenderer.on('app:message', handler)
    return () => ipcRenderer.removeListener('app:message', handler)
  }
})

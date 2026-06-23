const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { join } = require('path')
const fs = require('fs')

const appPath = app.getAppPath()

const database = require('./ipc/database')
const query = require('./ipc/query')
const hypothesis = require('./ipc/hypothesis')
const exportIpc = require('./ipc/export')
const { getDataDir, ensureDirs } = require('./utils/paths')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '星火汇速SQL客户端 - Spark NB SQL',
    webPreferences: {
      preload: join(appPath, 'dist-electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    },
    show: false,
    titleBarStyle: 'default'
  })

  // 加载前端页面
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(appPath, 'dist/index.html'))

  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 监听 preload 错误
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload script error:', preloadPath, error)
  })

  // 监听渲染进程控制台消息
  mainWindow.webContents.on('console-message', (event, level, message) => {
    const levels = ['verbose', 'info', 'warning', 'error']
    console.log(`[Renderer ${levels[level] || level}]:`, message)
  })
}

app.whenReady().then(async () => {
  await ensureDirs()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ========== IPC 处理器 ==========

// 应用信息
ipcMain.handle('app:getInfo', () => ({
  name: '星火汇速SQL客户端',
  nameEn: 'Spark NB SQL',
  fullNameEn: 'Spark Nexus Boost SQL',
  version: app.getVersion()
}))

ipcMain.handle('app:getDataDir', () => getDataDir())

ipcMain.handle('app:selectDataDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择数据目录'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const newDir = result.filePaths[0]
    const { setDataDir } = require('./utils/paths')
    setDataDir(newDir)
    await ensureDirs()
    return { success: true, dataDir: newDir }
  }
  return { success: false, dataDir: getDataDir() }
})

// 数据库管理
ipcMain.handle('db:list', () => database.listDatabases())
ipcMain.handle('db:info', (_event, dbName) => database.getDatabaseInfo(dbName))
ipcMain.handle('db:preview', (_event, dbName, tableName) => database.getTablePreview(dbName, tableName))
ipcMain.handle('db:delete', (_event, dbName) => database.deleteDatabase(dbName))
ipcMain.handle('db:setCurrent', (_event, dbName) => database.setCurrentDatabase(dbName))
ipcMain.handle('db:getCurrent', () => database.getCurrentDatabase())

// Excel 导入
ipcMain.handle('dialog:selectExcelFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: '选择 Excel 文件',
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx', 'xls', 'xlsm'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('excel:import', (_event, filePaths) => database.importExcelFiles(filePaths))

// SQL 查询
ipcMain.handle('query:run', (_event, options) => query.runQuery(options))
ipcMain.handle('query:export', (_event, options) => exportIpc.exportQueryResults(options))

ipcMain.handle('dialog:selectExportPath', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出 Excel',
    defaultPath: defaultName || 'export.xlsx',
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  })
  return result.canceled ? null : result.filePath
})

// 假设方案
ipcMain.handle('hypothesis:list', () => hypothesis.listScenarios())
ipcMain.handle('hypothesis:get', (_event, id) => hypothesis.getScenario(id))
ipcMain.handle('hypothesis:create', (_event, scenario) => hypothesis.createScenario(scenario))
ipcMain.handle('hypothesis:update', (_event, id, scenario) => hypothesis.updateScenario(id, scenario))
ipcMain.handle('hypothesis:delete', (_event, id) => hypothesis.deleteScenario(id))
ipcMain.handle('hypothesis:compare', (_event, ids) => hypothesis.compareScenarios(ids))
ipcMain.handle('hypothesis:params', () => hypothesis.getParamsDict())

// 打开导出目录
ipcMain.handle('shell:openExportsDir', () => {
  const { getExportDir } = require('./utils/paths')
  const exportsDir = getExportDir()
  if (fs.existsSync(exportsDir)) {
    shell.openPath(exportsDir)
  }
})

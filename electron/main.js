import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

import * as database from './ipc/database.js'
import * as query from './ipc/query.js'
import * as hypothesis from './ipc/hypothesis.js'
import * as exportIpc from './ipc/export.js'
import { getDataDir, setDataDir, ensureDirs } from './utils/paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '星火汇速SQL客户端 - Spark NB SQL',
    webPreferences: {
      preload: join(__dirname, '../dist-electron/preload/preload.js'),
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
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
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
    await setDataDir(newDir)
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
  const exportsDir = join(getDataDir(), 'exports')
  if (fs.existsSync(exportsDir)) {
    shell.openPath(exportsDir)
  }
})

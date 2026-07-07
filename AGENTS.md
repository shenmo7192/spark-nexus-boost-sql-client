# AGENTS.md — Spark Nexus Boost SQL Client

## 项目概述

**星火汇速 SQL 客户端 (Spark NB SQL)** 是一款基于 Electron 的本地离线 SQL 数据分析桌面应用。核心功能是将 Excel 文件导入为 SQLite 数据库，用户通过 SQL 编辑器进行查询分析，支持多方案假设参数、图表可视化与结果导出。完全不依赖外部网络，所有数据处理均在本地完成。

- **版本**: 1.2.1
- **许可证**: MIT
- **Node.js 要求**: >=18.0.0 <21.0.0
- **模块系统**: CommonJS

---

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 22 |
| 前端 UI | React 18 + Vite 5 |
| CSS | Tailwind CSS 3 |
| 状态管理 | Zustand |
| SQL 编辑器 | CodeMirror 6 (@uiw/react-codemirror) |
| 图表 | Chart.js 4 + react-chartjs-2 |
| 数据库引擎 | better-sqlite3 9.6.0（同步 API） |
| Excel 解析 | xlsx（Worker 线程中） |
| Excel 导出 | exceljs |
| 打包 | electron-builder |
| 图标 | Lucide React + sharp（图标生成） |

---

## 目录结构

```
├── electron/                     # Electron 主进程代码
│   ├── main.js                   # 应用入口，窗口创建，IPC 注册
│   ├── preload.js                # contextBridge 预加载脚本
│   ├── ipc/
│   │   ├── database.js           # 数据库生命周期管理
│   │   ├── query.js              # SQL 查询执行引擎
│   │   ├── hypothesis.js         # 假设方案 CRUD
│   │   ├── export.js             # 查询结果 Excel 导出
│   │   └── importQueue.js        # 多线程并发导入调度器
│   ├── workers/
│   │   └── importExcel.worker.js # Worker Thread — Excel 解析导入
│   └── utils/
│       ├── paths.js              # 路径管理、目录确保、辅助函数
│       ├── config.js             # JSON 文件持久化键值存储
│       └── store.js              # config 再导出
├── src/                          # 渲染进程（React 前端）
│   ├── main.jsx                  # React 挂载入口
│   ├── App.jsx                   # 根组件，页面路由
│   ├── index.css                 # Tailwind + 自定义样式
│   ├── store/
│   │   └── appStore.js           # Zustand 全局状态
│   ├── components/
│   │   ├── Layout.jsx            # 全局布局（Header + Sidebar + 内容区）
│   │   ├── Header.jsx            # 顶部栏
│   │   ├── Sidebar.jsx           # 左侧导航
│   │   ├── LazyDataTable.jsx     # 虚拟滚动数据表格
│   │   ├── ToastContainer.jsx    # 通知容器
│   │   └── ConfirmDialog.jsx     # 确认对话框
│   └── pages/
│       ├── ImportPage.jsx        # 数据导入页
│       ├── SqlPage.jsx           # SQL 查询页（核心，~780 行）
│       ├── ChartPage.jsx         # 图表分析页
│       ├── HypothesisPage.jsx    # 假设参数页
│       └── TutorialPage.jsx      # SQLite 教程页
├── scripts/                      # 构建脚本
│   ├── copy-electron.mjs         # 复制 electron/ → dist-electron/
│   ├── generate-icons.mjs        # 图标生成
│   ├── check-offline.mjs         # 离线检查
│   └── build-win.mjs             # Windows 构建
├── build/                        # electron-builder 构建资源（图标等）
├── .github/workflows/            # CI/CD
├── index.html                    # Vite 入口 HTML（含 CSP 安全策略）
├── vite.config.mjs               # Vite 配置
├── tailwind.config.js            # Tailwind 主题配置
├── postcss.config.js             # PostCSS 配置
└── package.json                  # 项目定义
```

---

## IPC 通信架构

所有渲染进程 → 主进程通信通过 `ipcRenderer.invoke`（双向），主进程 → 渲染进程通过 `window.webContents.send`（推送事件）。API 通过 `electron/preload.js` 中 `contextBridge.exposeInMainWorld` 白名单暴露为 `window.electronAPI`。

### 通道映射

| 前端调用 | IPC 通道 | 方向 | 说明 |
|---------|---------|------|------|
| `electronAPI.getAppInfo()` | `app:getInfo` | 双向 | 获取应用名称、版本 |
| `electronAPI.getDataDir()` | `app:getDataDir` | 双向 | 获取数据目录路径 |
| `electronAPI.selectDataDir()` | `app:selectDataDir` | 双向 | 选择/切换数据目录 |
| `electronAPI.listDatabases()` | `db:list` | 双向 | 列出所有数据库 |
| `electronAPI.getDatabaseInfo(dbName)` | `db:info` | 双向 | 获取数据库结构 |
| `electronAPI.getTablePreview(dbName, table)` | `db:preview` | 双向 | 预览表数据 |
| `electronAPI.deleteDatabase(dbName)` | `db:delete` | 双向 | 删除数据库 |
| `electronAPI.setCurrentDatabase(dbName)` | `db:setCurrent` | 双向 | 设置当前数据库 |
| `electronAPI.getCurrentDatabase()` | `db:getCurrent` | 双向 | 获取当前数据库 |
| `electronAPI.selectExcelFiles()` | `dialog:selectExcelFiles` | 双向 | 打开文件选择对话框 |
| `electronAPI.importExcelFiles(paths)` | `excel:import` | 双向 | 触发批量导入 |
| `electronAPI.runQuery(options)` | `query:run` | 双向 | 执行 SQL 查询 |
| `electronAPI.exportQueryResults(options)` | `query:export` | 双向 | 导出查询结果为 Excel |
| `electronAPI.selectExportPath(name)` | `dialog:selectExportPath` | 双向 | 选择导出保存路径 |
| `electronAPI.listScenarios()` | `hypothesis:list` | 双向 | 列出假设方案 |
| `electronAPI.getScenario(id)` | `hypothesis:get` | 双向 | 获取单个方案 |
| `electronAPI.createScenario(s)` | `hypothesis:create` | 双向 | 创建方案 |
| `electronAPI.updateScenario(id, s)` | `hypothesis:update` | 双向 | 更新方案 |
| `electronAPI.deleteScenario(id)` | `hypothesis:delete` | 双向 | 删除方案 |
| `electronAPI.compareScenarios(ids)` | `hypothesis:compare` | 双向 | 对比多方案 |
| `electronAPI.getParamsDict()` | `hypothesis:params` | 双向 | 获取参数字典 |
| `electronAPI.saveChartImage(dataUrl, name)` | `chart:saveImage` | 双向 | 图表导出 PNG |
| `electronAPI.onImportProgress(cb)` | `excel:importProgress` | 主→渲染 | 导入进度推送 |
| `electronAPI.onMessage(cb)` | `app:message` | 主→渲染 | 通用消息推送 |

---

## 数据存储

| 存储内容 | 位置 | 格式 |
|---------|------|------|
| 导入的数据库 | `{dataDir}/databases/*.db` | SQLite（better-sqlite3） |
| 应用配置 | `{userData}/spark-nb-sql-config.json` | JSON 键值对 |
| 假设方案 | `{dataDir}/config_hypothesis.json` | JSON 数组 |
| SQL 历史记录 | `localStorage: spark_nb_sql_history` | JSON（最多 20 条） |
| SQL 模板 | `localStorage: spark_nb_sql_templates` | JSON |
| 图表快照 | `localStorage: spark_nb_charts` | JSON |

---

## SQL 查询引擎特性

在 `electron/ipc/query.js` 中实现，关键特性：

- **多语句执行**：在单一 better-sqlite3 连接中顺序执行，保持会话状态（ATTACH、临时表、事务等）
- **参数模板**：`{{参数名}}` 语法自动替换为当前方案中的值
- **跨库查询**：`ATTACH DATABASE '数据库名' AS alias` 自动解析为实际路径
- **EXPORT 指令**：`EXPORT 文件名 sheet名 保存路径` 指定导出配置
- **查询识别**：`isQueryStatement()` 区分 SELECT/WITH 和有副作用的 DML/DDL

---

## 构建与开发

```bash
# 安装依赖
npm install

# 开发（Vite dev server，需另开终端启动 Electron）
npm run dev

# 构建生产版本
npm run build          # Vite 构建 + 复制 electron/ → dist-electron/

# 打包
npm run dist:linux           # Linux x64 (deb + AppImage)
npm run dist:linux:arm64     # Linux ARM64
npm run dist:win             # Windows x64 (nsis + portable)
```

**构建流程**：
1. `vite build` → 前端产物到 `dist/`
2. `scripts/copy-electron.mjs` → 复制 `electron/` 到 `dist-electron/`
3. electron-builder → 打包到 `release/`

`asarUnpack` 配置确保 `dist-electron/workers/**/*` 不被打包压缩（Worker Thread 需要独立文件）。

---

## 安全策略

- `contextIsolation: true`，`nodeIntegration: false`
- 所有系统能力通过 `contextBridge` 白名单暴露
- `index.html` 含严格的 CSP 策略（仅允许 `'self'`，script-src 不容许 `unsafe-inline`）
- preload.js 中仅暴露有限的、经过筛选的 IPC 方法

---

## 代码规范

- 主进程使用 **CommonJS** (`require`/`module.exports`)
- 渲染进程使用 **ES Modules** (import/export)，JSX 语法
- 路径别名 `@` → `src/`（仅在 Vite 构建中生效）
- React 组件文件使用 `.jsx` 扩展名
- 样式优先使用 Tailwind 类名，自定义样式写在 `src/index.css` 中
- 通知使用 `appStore.addToast()` 而非 `alert()`
- 图标统一使用 `lucide-react`

---

## 注意事项

- **better-sqlite3 是原生模块**，版本锁定 9.6.0，升级需重新编译（`electron-builder install-app-deps`）
- **Worker Thread**（`importExcel.worker.js`）中 required 的模块必须在 worker 环境中可用，`asarUnpack` 已为此配置
- 数据目录可通过 UI 切换，切换后需调用 `ensureDirs()` 确保子目录存在
- `src/store/appStore.js` 中的 Zustand store 是全局单一状态源，跨页面共享
- 前端使用自实现的页面切换（`activePage` 状态），而非 React Router（虽然 `react-router-dom` 已安装）
- 开发模式下 Electron 连接 Vite dev server (`VITE_DEV_SERVER_URL`)，生产模式下加载 `dist/index.html`

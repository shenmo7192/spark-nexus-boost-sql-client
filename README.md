<p align="center">
  <h1 align="center">星火汇速 SQL 客户端</h1>
  <p align="center"><strong>Spark Nexus Boost SQL</strong> — 本地离线 SQL 数据分析工具</p>
</p>

---

## 简介

**星火汇速 SQL 客户端** 是一款基于 Electron 的桌面端 SQL 数据分析工具。无需联网，无需安装数据库服务——直接将 Excel 文件导入为本地 SQLite 数据库，即可使用标准 SQL 进行查询分析。

### 核心功能

- **Excel 一键导入** — 拖拽或选择 `.xlsx` / `.xls` 文件，自动解析为 SQLite 数据库表，支持批量导入
- **SQL 编辑器** — 基于 CodeMirror 6，语法高亮、自动补全、暗色主题。`Ctrl+Enter` 执行
- **假设参数方案** — 定义多套业务假设参数（如税率、增长率），SQL 中使用 `{{参数名}}` 动态替换
- **图表可视化** — 柱状图、折线图、饼图、环形图，数据来自 SQL 查询结果，支持导出高清 PNG
- **数据表格** — 虚拟滚动渲染，轻松浏览大数据集
- **结果导出** — 查询结果导出为 Excel，支持多 Sheet
- **完全离线** — 不依赖任何外部服务或云 API，数据完全本地化

---

## 安装

### 下载预编译包

从 [Releases](https://github.com/spark-nexus-boost/sql-client/releases) 页面下载对应平台的安装包：

| 平台 | 格式 |
|------|------|
| Linux x64 | `.deb` / `.AppImage` |
| Linux ARM64 | `.deb` / `.AppImage` |
| Windows x64 | `.exe` (安装版 / 便携版) |

### 从源码构建

**前置要求**：Node.js >= 18.0.0 < 21.0.0

```bash
# 克隆仓库
git clone https://github.com/spark-nexus-boost/sql-client.git
cd sql-client

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 打包
npm run dist:linux       # Linux x64
npm run dist:linux:arm64 # Linux ARM64
npm run dist:win         # Windows x64
```

---

## 使用指南

### 1. 导入数据

- 打开应用，进入 **数据导入** 页面
- 点击上传区域或拖拽 Excel / SQLite 文件到窗口
- 导入完成后，数据库自动出现在左侧列表中
- 点击数据库切换当前库，下方可预览表结构和数据

### 2. 编写 SQL

- 切换到 **SQL 查询** 页面
- 左侧数据库树可展开表名/字段名，点击快速插入到编辑器
- 编写 SQL 后按 `Ctrl+Enter`（macOS: `Cmd+Enter`）或 `F9` 执行
- 支持多语句执行，结果可分到不同 Sheet 标签页
- 使用 `ATTACH DATABASE '数据库名' AS alias` 可跨库联表查询

### 3. 假设方案

- 在 **假设参数** 页面创建方案，添加参数键值对
- 回到 SQL 编辑器，切换顶部分方案下拉框
- SQL 中的 `{{参数名}}` 将在执行时自动替换为方案中的值
- 内置基准、乐观、悲观三套预设方案

### 4. 图表分析

- 先在 SQL 页面查询出数据
- 切换到 **图表分析** 页面，选择数据来源 Sheet
- 设置图表类型、X/Y 轴字段、聚合方式
- 可将图表保存到图表库，或导出为 PNG 图片

### 5. 导出结果

- SQL 执行结果可通过工具栏导出按钮导出为 Excel
- 所有 Sheet 结果将导出为一个多 Sheet 的 `.xlsx` 文件
- 也可使用 `EXPORT 文件名 sheet名 路径` 语法在 SQL 中指定导出

---

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 22 |
| 前端 | React 18 + Vite 5 + Tailwind CSS 3 |
| 状态管理 | Zustand |
| SQL 编辑器 | CodeMirror 6 |
| 图表 | Chart.js 4 |
| 数据库引擎 | better-sqlite3 |
| Excel 处理 | xlsx (解析) + exceljs (导出) |

---

## 项目结构

```
.
├── electron/          # Electron 主进程
│   ├── main.js        # 应用入口、窗口管理、IPC 注册
│   ├── preload.js     # 预加载脚本，暴露安全 API
│   ├── ipc/           # IPC 处理器（数据库、查询、方案、导出、导入队列）
│   ├── workers/       # Worker Thread（Excel 解析导入）
│   └── utils/         # 工具函数（路径、配置存储）
├── src/               # React 渲染进程
│   ├── components/    # 全局组件（布局、数据表格、通知等）
│   ├── pages/         # 功能页面（导入、SQL、图表、方案、教程）
│   └── store/         # Zustand 状态管理
├── scripts/           # 构建与辅助脚本
└── build/             # 打包资源（图标等）
```

---

## 开发

运行项目需要同时启动 Vite 开发服务器和 Electron 主进程。

贡献代码前请参考 [AGENTS.md](./AGENTS.md) 了解代码架构与规范。

---

## 许可证

[MIT](LICENSE) © Spark Nexus Boost

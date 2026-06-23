import { useEffect } from 'react'
import Layout from './components/Layout'
import ImportPage from './pages/ImportPage'
import SqlPage from './pages/SqlPage'
import ChartPage from './pages/ChartPage'
import HypothesisPage from './pages/HypothesisPage'
import TutorialPage from './pages/TutorialPage'
import { useAppStore } from './store/appStore'

const pages = {
  import: ImportPage,
  sql: SqlPage,
  chart: ChartPage,
  hypothesis: HypothesisPage,
  tutorial: TutorialPage
}

function App() {
  const { activePage, setAppInfo, setDataDir, setDatabases, setCurrentDb, addToast } = useAppStore()

  useEffect(() => {
    async function init() {
      try {
        const appInfo = await window.electronAPI.getAppInfo()
        setAppInfo(appInfo)

        const dataDir = await window.electronAPI.getDataDir()
        setDataDir(dataDir)

        const { dbName } = await window.electronAPI.getCurrentDatabase()
        if (dbName) setCurrentDb(dbName)

        const databases = await window.electronAPI.listDatabases()
        setDatabases(databases)
      } catch (error) {
        console.error('初始化失败:', error)
        addToast('应用初始化失败: ' + (error.message || '未知错误'), 'error')
      }
    }

    init()
  }, [setAppInfo, setDataDir, setDatabases, setCurrentDb, addToast])

  const ActivePage = pages[activePage] || ImportPage

  return (
    <Layout>
      <ActivePage />
    </Layout>
  )
}

export default App

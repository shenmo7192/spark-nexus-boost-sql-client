import Store from 'electron-store'

// 全局配置存储实例
export const appStore = new Store({
  name: 'spark-nb-sql-config',
  defaults: {
    currentDatabase: '',
    scenarios: []
  }
})

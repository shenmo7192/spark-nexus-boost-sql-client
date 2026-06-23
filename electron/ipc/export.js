const ExcelJS = require('exceljs')
const fs = require('fs')
const { join } = require('path')
const { getExportDir } = require('../utils/paths')

/**
 * 导出查询结果到 Excel
 * options: { results: [], exportConfig?: { filename, path, sheetNames } }
 */
async function exportQueryResults(options) {
  const { results, exportConfig = {} } = options

  if (!results || results.length === 0) {
    return { success: false, error: '没有可导出的数据' }
  }

  try {
    const workbook = new ExcelJS.Workbook()

    // 生成文件名
    let filename = exportConfig.filename
    if (filename) {
      if (!filename.toLowerCase().endsWith('.xlsx')) {
        filename += '.xlsx'
      }
    } else {
      filename = `export_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.xlsx`
    }
    // 过滤掉执行失败的结果集
    const validResults = results.filter(r => r.success && r.columns && r.rows)

    validResults.forEach((result, index) => {
      const defaultName = `结果${index + 1}`
      const sheetName = exportConfig.sheetNames?.[String(index)] || defaultName
      // Excel sheet 名长度限制 31 字符
      const safeSheetName = String(sheetName).substring(0, 31)
      const worksheet = workbook.addWorksheet(safeSheetName)

      // 表头
      worksheet.columns = result.columns.map(col => ({
        header: String(col),
        key: String(col),
        width: Math.max(10, String(col).length * 1.5)
      }))

      // 数据行
      for (const row of result.rows) {
        const rowData = {}
        for (const col of result.columns) {
          const val = row[col]
          rowData[col] = val === null || val === undefined ? '' : val
        }
        worksheet.addRow(rowData)
      }

      // 自动调整列宽
      worksheet.columns.forEach(column => {
        let maxLength = String(column.header).length
        for (const row of worksheet.getRows(2, worksheet.rowCount) || []) {
          const cellValue = row.getCell(column.key).value
          const cellLength = cellValue ? String(cellValue).length : 0
          if (cellLength > maxLength) maxLength = cellLength
        }
        column.width = Math.min(Math.max(maxLength + 2, 10), 50)
      })

      // 表头样式
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F0FE' }
      }
    })

    // 保存到指定路径，否则使用默认导出目录
    let downloadPath
    let savedPath = null
    if (exportConfig.savePath) {
      downloadPath = exportConfig.savePath
      savedPath = exportConfig.savePath
      filename = require('path').basename(downloadPath)
    } else {
      const exportDir = getExportDir()
      downloadPath = join(exportDir, filename)
    }
    await workbook.xlsx.writeFile(downloadPath)

    const resp = {
      success: true,
      filename,
      downloadPath
    }
    if (savedPath) resp.savedPath = savedPath
    return resp
  } catch (error) {
    return { success: false, error: error.message }
  }
}

module.exports = { exportQueryResults }

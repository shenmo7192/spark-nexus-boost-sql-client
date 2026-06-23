#!/usr/bin/env node
/**
 * 离线完整性检查
 * 扫描 dist 目录中的 HTML/JS/CSS，确保没有外部 CDN 链接
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const DIST_DIR = path.join(ROOT, 'dist')

const SUSPICIOUS_PATTERNS = [
  /https?:\/\/[^\s"'<>]+/,
  /cdn\.jsdelivr\.net/,
  /unpkg\.com/,
  /cdnjs\.cloudflare\.com/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/
]

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, callback)
    } else {
      callback(fullPath)
    }
  }
}

function checkFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!['.html', '.js', '.css', '.map'].includes(ext)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const issues = []
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`发现外部链接模式: ${pattern}`)
    }
  }
  return issues
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist 目录不存在，请先运行 npm run build')
    process.exit(1)
  }

  let totalIssues = 0
  walk(DIST_DIR, (filePath) => {
    const issues = checkFile(filePath)
    if (issues.length > 0) {
      totalIssues += issues.length
      console.log(`\n${path.relative(ROOT, filePath)}:`)
      for (const issue of issues) {
        console.log(`  - ${issue}`)
      }
    }
  })

  if (totalIssues > 0) {
    console.error(`\n发现 ${totalIssues} 个潜在的外部链接，请修复后重新构建`)
    process.exit(1)
  } else {
    console.log('\n离线检查通过：未发现外部 CDN/网络链接')
  }
}

main()

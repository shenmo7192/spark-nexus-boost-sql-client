#!/usr/bin/env node
/**
 * 离线完整性检查
 * 扫描 dist 目录中的 HTML/JS/CSS，确保没有外部 CDN 资源加载
 * 允许代码中存在的普通 URL 字符串（如命名空间、GitHub README 链接）
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const DIST_DIR = path.join(ROOT, 'dist')

// 真正危险的外部资源域名
const CDN_DOMAINS = [
  /cdn\.jsdelivr\.net/i,
  /unpkg\.com/i,
  /cdnjs\.cloudflare\.com/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /bootstrapcdn\.com/i,
  /jquery\.com/i
]

// 常见但无害的 URL 模式（命名空间、文档链接）
const SAFE_URL_PATTERNS = [
  /^https?:\/\/www\.w3\.org\//,
  /^https?:\/\/www\.chartjs\.org\//,
  /^https?:\/\/reactjs\.org\//,
  /^https?:\/\/github\.com\/.*#readme$/,
  /^https?:\/\/github\.com\/pmndrs\/?$/
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

function extractUrls(content) {
  const matches = content.match(/https?:\/\/[^\s"'<>]+/g) || []
  return matches
}

function isSuspiciousUrl(url) {
  // 忽略安全 URL
  if (SAFE_URL_PATTERNS.some(p => p.test(url))) return false
  // 检查是否是已知 CDN
  if (CDN_DOMAINS.some(d => d.test(url))) return true
  // 其他 URL 如果是资源加载相关（.js/.css/.woff/.ttf 等）也视为危险
  const resourceExt = /\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico)(\?.*)?$/i
  if (resourceExt.test(url)) return true
  return false
}

function checkFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (!['.html', '.js', '.css'].includes(ext)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const urls = extractUrls(content)
  const issues = urls.filter(isSuspiciousUrl).map(url => `潜在外部资源: ${url}`)
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
    console.error(`\n发现 ${totalIssues} 个潜在的外部资源链接，请修复后重新构建`)
    process.exit(1)
  } else {
    console.log('\n离线检查通过：未发现外部 CDN/资源加载链接')
  }
}

main()

#!/usr/bin/env node
/**
 * 复制 electron/ 目录到 dist-electron/，供 electron-builder 打包使用
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const SOURCE = path.join(ROOT, 'electron')
const TARGET = path.join(ROOT, 'dist-electron')

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// 清空并复制
if (fs.existsSync(TARGET)) {
  fs.rmSync(TARGET, { recursive: true, force: true })
}
copyDir(SOURCE, TARGET)
console.log(`Copied electron/ -> dist-electron/`)

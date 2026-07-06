#!/usr/bin/env node
/**
 * Windows 打包脚本
 * - 设置国内镜像环境变量，供 electron-builder 下载二进制资源
 * - 先执行前端 + Electron 代码构建，再调用 electron-builder --win
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(__dirname)
const isWin = process.platform === 'win32'

// 默认使用 npmmirror 国内镜像；外部已设置时保持外部值
process.env.ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'
process.env.ELECTRON_BUILDER_BINARIES_MIRROR = process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://npmmirror.com/mirrors/electron-builder-binaries/'

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    // Windows 下 npm/electron-builder 都有 .cmd 后缀；使用 shell 执行更稳
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: isWin,
      env: process.env
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`命令 "${cmd} ${args.join(' ')}" 退出码 ${code}`))
      }
    })
  })
}

async function main() {
  // 1. 构建前端与复制 Electron 主进程代码
  await run('npm', ['run', 'build'])

  // 2. 调用 electron-builder 打 Windows 包
  const builderBin = path.join(ROOT, 'node_modules', '.bin', 'electron-builder') + (isWin ? '.cmd' : '')
  await run(builderBin, ['--win'])
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

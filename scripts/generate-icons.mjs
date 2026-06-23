#!/usr/bin/env node
/**
 * 预生成应用图标
 * 从 public/这是迷人的Logo.png 生成各尺寸 PNG 和 Windows ICO
 * Linux 打包时直接使用这些预先生成的图标，避免 electron-builder 动态缩放
 * Windows ICO 使用系统已安装的 ImageMagick 生成
 */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { execSync } from 'child_process'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const SOURCE = path.join(ROOT, 'public', '这是迷人的Logo.png')
const ICONS_DIR = path.join(ROOT, 'build', 'icons')
const ICON_FILE = path.join(ROOT, 'build', 'icon.png')

// Linux 标准图标尺寸
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
// Windows ICO 所需尺寸
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`找不到 Logo 源文件: ${SOURCE}`)
    process.exit(1)
  }

  // 检查 ImageMagick
  try {
    execSync('convert --version', { stdio: 'pipe' })
  } catch (err) {
    console.error('未检测到 ImageMagick 的 convert 命令，无法生成 ICO 文件')
    console.error('请安装 ImageMagick: sudo apt-get install imagemagick')
    process.exit(1)
  }

  // 确保目录存在
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true })
  }

  // 读取源图
  const sourceBuffer = fs.readFileSync(SOURCE)
  const source = sharp(sourceBuffer).png()

  // 生成 Linux 各尺寸图标
  console.log('生成 Linux 图标...')
  for (const size of LINUX_SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon_${size}x${size}.png`)
    await source
      .clone()
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(outputPath)
    console.log(`  ${outputPath}`)
  }

  // 生成 ICO 需要的额外尺寸
  const extraSizes = ICO_SIZES.filter(s => !LINUX_SIZES.includes(s))
  if (extraSizes.length > 0) {
    console.log('生成 ICO 额外尺寸...')
    for (const size of extraSizes) {
      const outputPath = path.join(ICONS_DIR, `icon_${size}x${size}.png`)
      await source
        .clone()
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFile(outputPath)
      console.log(`  ${outputPath}`)
    }
  }

  // 生成默认大图标
  await source
    .clone()
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(ICON_FILE)
  console.log(`  ${ICON_FILE}`)

  // 使用 ImageMagick 生成 Windows ICO
  console.log('生成 Windows ICO...')
  const icoPath = path.join(ROOT, 'build', 'icon.ico')
  const inputFiles = ICO_SIZES
    .map(s => path.join(ICONS_DIR, `icon_${s}x${s}.png`))
    .join(' ')
  run(`convert ${inputFiles} "${icoPath}"`)

  console.log('\n图标生成完成')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

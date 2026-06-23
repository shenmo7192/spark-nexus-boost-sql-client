#!/usr/bin/env node
/**
 * 预生成应用图标
 * 从 public/这是迷人的Logo.png 生成各尺寸 PNG 和 Windows ICO
 * Linux 打包时直接使用这些预先生成的图标，避免 electron-builder 动态缩放
 */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const SOURCE = path.join(ROOT, 'public', '这是迷人的Logo.png')
const ICONS_DIR = path.join(ROOT, 'build', 'icons')
const ICON_FILE = path.join(ROOT, 'build', 'icon.png')

const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`找不到 Logo 源文件: ${SOURCE}`)
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

  // 生成默认大图标
  await source
    .clone()
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(ICON_FILE)
  console.log(`  ${ICON_FILE}`)

  // 生成 Windows ICO（如果 sharp 支持，否则提示用户）
  try {
    const icoPath = path.join(ROOT, 'build', 'icon.ico')
    // sharp 不原生支持 ICO，需要特殊处理
    // 这里生成一个 256x256 PNG 作为备选，提示用户用其他工具转 ICO
    await source
      .clone()
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(ROOT, 'build', 'icon_256x256.png'))
    console.log('已生成 256x256 PNG 图标用于 Windows ICO 制作')
    console.log('Windows ICO 需要额外工具转换，例如:')
    console.log('  npm install -g png-to-ico')
    console.log(`  png-to-ico ${ICO_SIZES.map(s => path.join(ROOT, 'build', 'icons', `icon_${s}x${s}.png`)).join(' ')} > ${icoPath}`)
  } catch (err) {
    console.error('生成 ICO 提示失败:', err)
  }

  console.log('\n图标生成完成')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

#!/bin/bash
# 离线资源下载脚本
# 在外网电脑运行此脚本，下载前端离线资源
# 下载后拷贝到 static/ 目录下

echo "下载前端离线资源..."

# 创建目录
mkdir -p static/css static/js static/lib

# Bootstrap 5
echo "下载 Bootstrap 5..."
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" -o static/css/bootstrap.min.css
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" -o static/js/bootstrap.bundle.min.js

# Bootstrap Icons
echo "下载 Bootstrap Icons..."
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" -o static/css/bootstrap-icons.css
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/fonts/bootstrap-icons.woff2" -o static/fonts/bootstrap-icons.woff2
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/fonts/bootstrap-icons.woff" -o static/fonts/bootstrap-icons.woff

# Chart.js
echo "下载 Chart.js..."
curl -sL "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" -o static/js/chart.min.js

# CodeMirror
echo "下载 CodeMirror..."
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.css" -o static/css/codemirror.css
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js" -o static/js/codemirror.min.js
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/sql/sql.min.js" -o static/js/sql.min.js
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/show-hint.css" -o static/css/show-hint.css
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/show-hint.min.js" -o static/js/show-hint.min.js
curl -sL "https://cdn.jsdelivr.net/npm/codemirror@5.65.16/addon/hint/sql-hint.min.js" -o static/js/sql-hint.min.js

echo ""
echo "下载完成！"
echo "将所有文件拷贝到内网电脑的 static/ 目录下"
echo "然后将 base.html 中的 CDN 链接替换为本地引用"
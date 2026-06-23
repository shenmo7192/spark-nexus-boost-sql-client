#!/bin/bash
# SQL_NB 一键启动脚本
# 用于银河麒麟/Linux/macOS 系统

echo "==================================="
echo "  SQL_NB - 本地SQLite数据分析工具"
echo "==================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python"
    exit 1
fi

echo "[信息] Python3: $(python3 --version)"

# 检查依赖
echo "[信息] 检查依赖..."
MISSING=""
python3 -c "import flask" 2>/dev/null || MISSING="$MISSING flask"
python3 -c "import pandas" 2>/dev/null || MISSING="$MISSING pandas"
python3 -c "import openpyxl" 2>/dev/null || MISSING="$MISSING openpyxl"
python3 -c "import xlsxwriter" 2>/dev/null || MISSING="$MISSING xlsxwriter"

if [ -n "$MISSING" ]; then
    echo "[信息] 安装缺失依赖: $MISSING"
    pip3 install -r requirements.txt --quiet
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败，请手动执行: pip3 install -r requirements.txt"
        exit 1
    fi
    echo "[信息] 依赖安装完成"
fi

echo ""
echo "[信息] 启动服务..."
echo "[信息] 访问地址: http://127.0.0.1:5000"
echo "[信息] 按 Ctrl+C 停止服务"
echo ""

# 启动 Flask 应用
python3 run_app.py
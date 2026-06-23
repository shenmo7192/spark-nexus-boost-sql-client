"""
Excel → SQLite DB 转换模块
功能：上传Excel文件，用pandas读取后写入SQLite数据库
"""

import os
import sqlite3
import pandas as pd
from flask import current_app


def allowed_file(filename):
    """检查文件是否为允许的Excel格式"""
    allowed_extensions = {'xlsx', 'xls', 'xlsm'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def excel_to_sqlite(file_path, db_path, table_name=None, sheet_name=0):
    """
    将Excel文件转换为SQLite数据库表
    :param file_path: Excel文件路径
    :param db_path: 目标SQLite数据库路径
    :param table_name: 表名（不传则用文件名）
    :param sheet_name: 工作表名或索引（默认第一个sheet）
    :return: (表名, 行数, 列名列表)
    """
    if table_name is None:
        table_name = os.path.splitext(os.path.basename(file_path))[0]
        # 清理表名，确保是合法的SQLite标识符
        table_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in table_name)
        if table_name[0].isdigit():
            table_name = 't_' + table_name

    try:
        # 读取Excel文件
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        if df.empty:
            raise ValueError(f"Excel文件 {file_path} 的sheet为空")

        # 清理列名（去掉特殊字符）
        df.columns = [str(col).strip().replace(' ', '_').replace('.', '_')
                      for col in df.columns]

        # 连接数据库并写入
        conn = sqlite3.connect(db_path)
        df.to_sql(table_name, conn, if_exists='replace', index=False)
        conn.close()

        row_count = len(df)
        columns = list(df.columns)
        return table_name, row_count, columns

    except Exception as e:
        raise Exception(f"Excel转换失败: {str(e)}")


def get_table_info(db_path):
    """
    获取数据库中的所有表信息
    :return: [(表名, 列数, 行数), ...]
    """
    if not os.path.exists(db_path):
        return []

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()

    result = []
    for (table_name,) in tables:
        cursor.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
        row_count = cursor.fetchone()[0]
        cursor.execute(f"PRAGMA table_info(\"{table_name}\")")
        columns = cursor.fetchall()
        result.append((table_name, len(columns), row_count))

    conn.close()
    return result


def get_table_schema(db_path, table_name):
    """获取指定表的字段信息"""
    if not os.path.exists(db_path):
        return []

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info(\"{table_name}\")")
    columns = cursor.fetchall()
    conn.close()
    return columns  # [(cid, name, type, notnull, dflt_value, pk), ...]


def list_tables(db_path):
    """列出数据库中所有表名"""
    if not os.path.exists(db_path):
        return []
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables
"""
SQLite 查询执行模块
功能：执行SQL查询、参数插值、返回结果
"""

import os
import re
import sqlite3
import pandas as pd


def execute_query(db_path, sql, params=None, page=1, page_size=100):
    """
    执行SQL查询并返回分页结果
    :param db_path: 数据库路径
    :param sql: SQL语句
    :param params: 参数插值字典 {参数名: 值}
    :param page: 页码（从1开始）
    :param page_size: 每页行数
    :return: {
        'columns': [...],
        'rows': [[...], ...],
        'total_rows': int,
        'page': int,
        'page_size': int,
        'total_pages': int,
        'success': bool,
        'error': str
    }
    """
    result = {
        'columns': [],
        'rows': [],
        'total_rows': 0,
        'page': page,
        'page_size': page_size,
        'total_pages': 0,
        'success': False,
        'error': ''
    }

    if not os.path.exists(db_path):
        result['error'] = '数据库文件不存在，请先上传Excel文件'
        return result

    if not sql or not sql.strip():
        result['error'] = 'SQL语句不能为空'
        return result

    # 参数插值替换
    if params:
        sql = replace_params(sql, params)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 执行查询
        cursor.execute(sql)

        # 检查是否是SELECT查询（有结果集）
        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            all_rows = cursor.fetchall()

            # 转为列表格式
            rows_data = [list(row) for row in all_rows]
            total_rows = len(rows_data)

            # 计算分页
            total_pages = max(1, (total_rows + page_size - 1) // page_size)
            start_idx = (page - 1) * page_size
            end_idx = min(start_idx + page_size, total_rows)
            page_rows = rows_data[start_idx:end_idx]

            result['columns'] = columns
            result['rows'] = page_rows
            result['total_rows'] = total_rows
            result['page'] = page
            result['page_size'] = page_size
            result['total_pages'] = total_pages
            result['success'] = True
        else:
            # 非查询语句（INSERT, UPDATE, DELETE等）
            conn.commit()
            result['columns'] = ['受影响行数']
            result['rows'] = [[cursor.rowcount]]
            result['total_rows'] = 1
            result['total_pages'] = 1
            result['success'] = True
            result['message'] = f'语句执行成功，影响 {cursor.rowcount} 行'

        conn.close()

    except sqlite3.Error as e:
        result['error'] = f'SQL执行错误: {str(e)}'
    except Exception as e:
        result['error'] = f'未知错误: {str(e)}'

    return result


def execute_multiple(db_path, sql_statements, params=None):
    """
    批量执行多条SQL语句（用分号分隔）
    只返回最后一条SELECT语句的结果
    """
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    final_result = None

    for stmt in statements:
        final_result = execute_query(db_path, stmt, params)

    return final_result


def replace_params(sql, params_dict):
    """将SQL中的 {{参数名}} 替换为实际值"""
    def replacer(match):
        param_name = match.group(1).strip()
        if param_name in params_dict:
            value = params_dict[param_name]
            if value is None:
                return 'NULL'
            if isinstance(value, (int, float)):
                return str(value)
            # 字符串类型：加引号并转义单引号
            escaped = str(value).replace("'", "''")
            return f"'{escaped}'"
        return match.group(0)  # 未找到的参数保持原样

    pattern = r'\{\{(.*?)\}\}'
    return re.sub(pattern, replacer, sql)


def get_sample_data(db_path, table_name, limit=20):
    """获取表的前N行示例数据"""
    sql = f'SELECT * FROM "{table_name}" LIMIT {limit}'
    return execute_query(db_path, sql, page=1, page_size=limit)
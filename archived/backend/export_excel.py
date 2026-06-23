"""
Excel 导出模块
功能：将查询结果导出到多Sheet Excel文件
"""

import os
import pandas as pd
from flask import current_app


def export_to_excel(results_list, output_path):
    """
    将多个查询结果导出到同一个Excel文件的不同Sheet
    :param results_list: [{'sheet_name': str, 'columns': [...], 'rows': [[...], ...]}, ...]
    :param output_path: 输出Excel文件路径
    :return: 输出文件路径
    """
    if not results_list:
        raise ValueError("没有可导出的数据")

    writer = pd.ExcelWriter(output_path, engine='xlsxwriter')

    for item in results_list:
        sheet_name = item.get('sheet_name', 'Sheet1')
        columns = item.get('columns', [])
        rows = item.get('rows', [])

        # 限制sheet名长度（Excel限制31字符）
        sheet_name = sheet_name[:31]

        if not columns:
            continue

        df = pd.DataFrame(rows, columns=columns)
        df.to_excel(writer, sheet_name=sheet_name, index=False)

        # 自动调整列宽
        worksheet = writer.sheets[sheet_name]
        for i, col in enumerate(columns):
            max_len = max(
                df[col].astype(str).map(len).max() if len(df) > 0 else 0,
                len(str(col))
            )
            # 设置列宽（限制最大宽度）
            worksheet.set_column(i, i, min(max_len + 2, 60))

    writer.close()
    return output_path


def export_single_result(sheet_name, columns, rows, output_path):
    """导出单次查询结果到Excel"""
    return export_to_excel([
        {'sheet_name': sheet_name, 'columns': columns, 'rows': rows}
    ], output_path)
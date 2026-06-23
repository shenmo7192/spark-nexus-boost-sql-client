"""
SQL_NB - 本地SQLite数据分析工具
基于Flask的本地Web应用，支持Excel上传、SQL查询、结果导出、假设参数管理
"""

import os
import uuid
import json
from flask import Flask, render_template, request, jsonify, send_file, session

from backend.excel_to_db import excel_to_sqlite, get_table_info, list_tables, allowed_file
from backend.db_query import execute_query, replace_params
from backend.export_excel import export_to_excel
from backend.hypothesis import (
    get_scenarios, get_scenario, add_scenario, update_scenario,
    delete_scenario, get_params_dict, load_config
)

app = Flask(__name__)
app.secret_key = 'sql_nb_secret_key_2024'

# 配置路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_DIR = os.path.join(DATA_DIR, 'databases')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')
CONFIG_PATH = os.path.join(DATA_DIR, 'config_hypothesis.json')

# 确保目录存在
for d in [DATA_DIR, DB_DIR, UPLOAD_DIR, EXPORT_DIR]:
    os.makedirs(d, exist_ok=True)


# ==================== 首页 ====================

@app.route('/')
def index():
    """首页 - 文件上传与数据库管理"""
    return render_template('index.html')


@app.route('/api/databases')
def list_databases():
    """获取所有数据库列表"""
    databases = []
    if os.path.exists(DB_DIR):
        for f in os.listdir(DB_DIR):
            if f.endswith('.db'):
                db_path = os.path.join(DB_DIR, f)
                size = os.path.getsize(db_path)
                tables = list_tables(db_path)
                databases.append({
                    'name': f,
                    'path': db_path,
                    'size': size,
                    'size_display': format_size(size),
                    'tables': tables
                })
    return jsonify({'databases': databases})


@app.route('/api/databases/current', methods=['GET', 'POST'])
def current_database():
    """获取/设置当前数据库"""
    if request.method == 'POST':
        data = request.json
        session['current_db'] = data.get('db_name', '')
        return jsonify({'success': True})
    db_name = session.get('current_db', '')
    if db_name and os.path.exists(os.path.join(DB_DIR, db_name)):
        return jsonify({'db_name': db_name})
    return jsonify({'db_name': ''})


# ==================== 文件上传 ====================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传Excel文件并转换为SQLite数据库"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'})

    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'success': False, 'error': '请上传有效的Excel文件 (.xlsx / .xls)'})

    try:
        # 保存上传的文件
        upload_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
        file.save(upload_path)

        # 生成数据库文件名
        db_name = os.path.splitext(file.filename)[0] + '.db'
        db_path = os.path.join(DB_DIR, db_name)

        # 处理同名数据库
        counter = 1
        while os.path.exists(db_path):
            db_name = f"{os.path.splitext(file.filename)[0]}_{counter}.db"
            db_path = os.path.join(DB_DIR, db_name)
            counter += 1

        # 用原始文件名作为表名
        table_name_orig = os.path.splitext(file.filename)[0]
        table_name, row_count, columns = excel_to_sqlite(upload_path, db_path, table_name=table_name_orig)

        # 设置为当前数据库
        session['current_db'] = db_name

        return jsonify({
            'success': True,
            'db_name': db_name,
            'table_name': table_name,
            'row_count': row_count,
            'columns': columns,
            'message': f'成功导入 {row_count} 行数据到表 "{table_name}"'
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/upload/multiple', methods=['POST'])
def upload_multiple():
    """上传多个Excel文件"""
    if 'files[]' not in request.files:
        return jsonify({'success': False, 'error': '没有上传文件'})

    files = request.files.getlist('files[]')
    results = []

    for file in files:
        if file.filename == '' or not allowed_file(file.filename):
            continue

        try:
            upload_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
            file.save(upload_path)

            db_name = os.path.splitext(file.filename)[0] + '.db'
            db_path = os.path.join(DB_DIR, db_name)

            # 用原始文件名作为表名
            table_name_orig = os.path.splitext(file.filename)[0]
            table_name, row_count, columns = excel_to_sqlite(upload_path, db_path, table_name=table_name_orig)

            results.append({
                'db_name': db_name,
                'table_name': table_name,
                'row_count': row_count,
                'success': True
            })
        except Exception as e:
            results.append({
                'db_name': file.filename,
                'success': False,
                'error': str(e)
            })

    return jsonify({'success': True, 'results': results})


# ==================== 数据库管理 ====================

@app.route('/api/databases/<db_name>/info')
def database_info(db_name):
    """获取数据库信息"""
    db_path = os.path.join(DB_DIR, db_name)
    if not os.path.exists(db_path):
        return jsonify({'error': '数据库不存在'}), 404

    tables = get_table_info(db_path)
    return jsonify({
        'db_name': db_name,
        'tables': tables
    })


@app.route('/api/databases/<db_name>/tables/<table_name>/preview')
def table_preview(db_name, table_name):
    """预览表数据"""
    db_path = os.path.join(DB_DIR, db_name)
    if not os.path.exists(db_path):
        return jsonify({'error': '数据库不存在'}), 404

    from backend.db_query import get_sample_data
    result = get_sample_data(db_path, table_name)
    return jsonify(result)


@app.route('/api/databases/<db_name>/delete', methods=['DELETE'])
def delete_database(db_name):
    """删除数据库"""
    db_path = os.path.join(DB_DIR, db_name)
    if os.path.exists(db_path):
        os.remove(db_path)
        if session.get('current_db') == db_name:
            session.pop('current_db')
        return jsonify({'success': True})
    return jsonify({'error': '数据库不存在'}), 404


# ==================== SQL查询 ====================

@app.route('/sql')
def sql_page():
    """SQL编辑器页面"""
    return render_template('sql_editor.html')


@app.route('/api/query', methods=['POST'])
def run_query():
    """执行SQL查询"""
    data = request.json
    sql = data.get('sql', '')
    db_name = data.get('db_name') or session.get('current_db', '')
    scenario_id = data.get('scenario_id')
    page = data.get('page', 1)
    page_size = data.get('page_size', 100)

    if not db_name:
        return jsonify({'success': False, 'error': '请先选择数据库'})

    db_path = os.path.join(DB_DIR, db_name)
    if not os.path.exists(db_path):
        return jsonify({'success': False, 'error': '数据库文件不存在'})

    # 如果指定了假设方案，获取参数并替换
    params = None
    scenario_name = None
    if scenario_id:
        scenario = get_scenario(scenario_id, CONFIG_PATH)
        if scenario:
            params = scenario.get('params', {})
            scenario_name = scenario.get('name')

    # 按分号拆分多条SQL语句，并解析 EXPORT 指令
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    export_config = {'filename': None, 'path': None, 'sheet_names': {}}
    actual_statements = []
    last_sql_idx = -1  # 最近一条SQL在 actual_statements 中的索引

    for stmt in statements:
        if stmt.upper().lstrip().startswith('EXPORT '):
            content = stmt[6:].strip()
            # 解析：EXPORT 文件名 [Sheet名 [路径]]
            parts = content.split(None, 2)
            if len(parts) >= 1:
                export_config['filename'] = parts[0]
            # Sheet 名应用到前一条 SQL
            if len(parts) >= 2 and last_sql_idx >= 0:
                export_config['sheet_names'][str(last_sql_idx)] = parts[1]
            if len(parts) >= 3:
                export_config['path'] = parts[2]
        else:
            idx = len(actual_statements)
            last_sql_idx = idx
            actual_statements.append(stmt)

    # 用 actual_statements 替代原来的 statements
    statements = actual_statements

    if len(statements) <= 1:
        # 单条语句
        result = execute_query(db_path, statements[0] if statements else sql, params, page, page_size)
        if scenario_name:
            result['scenario_name'] = scenario_name
        if export_config.get('filename'):
            result['export_config'] = export_config
        # 单条时 sheet_names 取第一个值作为 sheet_name
        if export_config.get('sheet_names'):
            result['export_config']['sheet_name'] = list(export_config['sheet_names'].values())[0]
        return jsonify(result)
    else:
        # 多条语句
        results = []
        has_error = False
        for i, stmt in enumerate(statements):
            r = execute_query(db_path, stmt, params, page=1, page_size=100000)
            if scenario_name:
                r['scenario_name'] = scenario_name
            r['sql_preview'] = stmt[:80] + ('...' if len(stmt) > 80 else '')
            results.append(r)
            if not r['success']:
                has_error = True

        resp = {
            'success': not has_error,
            'multi': True,
            'results': results
        }
        if export_config.get('filename'):
            resp['export_config'] = export_config
        return jsonify(resp)


@app.route('/api/query/export', methods=['POST'])
def export_query():
    """导出查询结果到Excel"""
    data = request.json
    results_list = data.get('results', [])
    export_config = data.get('export_config', {})

    if not results_list:
        return jsonify({'success': False, 'error': '没有可导出的数据'})

    try:
        # 生成文件名
        custom_filename = export_config.get('filename')
        if custom_filename:
            if not custom_filename.lower().endswith('.xlsx'):
                custom_filename += '.xlsx'
            filename = custom_filename
        else:
            filename = f"export_{uuid.uuid4().hex[:8]}.xlsx"

        # 先保存一份到 EXPORT_DIR（保证可下载）
        download_path = os.path.join(EXPORT_DIR, filename)
        export_to_excel(results_list, download_path)

        saved_path = None
        path_warning = None

        # 如果指定了自定义路径，尝试额外保存一份
        custom_path = export_config.get('path')
        if custom_path:
            try:
                os.makedirs(custom_path, exist_ok=True)
                output_path = os.path.join(custom_path, filename)
                import shutil
                shutil.copy2(download_path, output_path)
                saved_path = output_path
            except Exception as path_err:
                path_warning = str(path_err)

        resp = {
            'success': True,
            'filename': filename,
            'download_url': f'/api/download/{filename}',
        }
        if saved_path:
            resp['saved_path'] = saved_path
        if path_warning:
            resp['path_warning'] = f'文件已保存到默认目录，自定义路径写入失败: {path_warning}'

        return jsonify(resp)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/download/<filename>')
def download_file(filename):
    """下载文件"""
    file_path = os.path.join(EXPORT_DIR, filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return jsonify({'error': '文件不存在'}), 404


# ==================== 假设参数管理 ====================

@app.route('/hypothesis')
def hypothesis_page():
    """假设参数管理页面"""
    return render_template('hypothesis.html')


@app.route('/api/hypothesis/scenarios', methods=['GET'])
def list_scenarios():
    """获取所有假设方案"""
    scenarios = get_scenarios(CONFIG_PATH)
    return jsonify({'scenarios': scenarios})


@app.route('/api/hypothesis/scenarios/<scenario_id>', methods=['GET'])
def get_scenario_api(scenario_id):
    """获取单个假设方案"""
    scenario = get_scenario(scenario_id, CONFIG_PATH)
    if scenario:
        return jsonify(scenario)
    return jsonify({'error': '方案不存在'}), 404


@app.route('/api/hypothesis/scenarios', methods=['POST'])
def create_scenario():
    """创建假设方案"""
    data = request.json
    new_scenario = {
        'id': data.get('id', f"scenario_{uuid.uuid4().hex[:6]}"),
        'name': data.get('name', '新方案'),
        'description': data.get('description', ''),
        'params': data.get('params', {})
    }
    result = add_scenario(new_scenario, CONFIG_PATH)
    return jsonify({'success': True, 'scenario': result})


@app.route('/api/hypothesis/scenarios/<scenario_id>', methods=['PUT'])
def update_scenario_api(scenario_id):
    """更新假设方案"""
    updates = request.json
    result = update_scenario(scenario_id, updates, CONFIG_PATH)
    if result:
        return jsonify({'success': True, 'scenario': result})
    return jsonify({'error': '方案不存在'}), 404


@app.route('/api/hypothesis/scenarios/<scenario_id>', methods=['DELETE'])
def delete_scenario_api(scenario_id):
    """删除假设方案"""
    delete_scenario(scenario_id, CONFIG_PATH)
    return jsonify({'success': True})


@app.route('/api/hypothesis/compare', methods=['POST'])
def compare_scenarios():
    """对比多套方案"""
    data = request.json
    scenario_ids = data.get('scenario_ids', [])
    from backend.hypothesis import compare_scenarios
    comparison = compare_scenarios(scenario_ids, CONFIG_PATH)
    return jsonify({'comparison': comparison})


# ==================== 帮助/教程 ====================

@app.route('/tutorial')
def tutorial_page():
    """SQLite语法教程页面"""
    return render_template('tutorial.html')


# ==================== 工具函数 ====================

def format_size(size_bytes):
    """格式化文件大小显示"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


# ==================== 启动 ====================

if __name__ == '__main__':
    print("=" * 60)
    print("  SQL_NB - 本地SQLite数据分析工具")
    print("  ")
    print(f"  数据目录: {DATA_DIR}")
    print(f"  访问地址: http://127.0.0.1:5000")
    print("  ")
    print("  按 Ctrl+C 停止服务")
    print("=" * 60)
    app.run(host='127.0.0.1', port=5000, debug=True)
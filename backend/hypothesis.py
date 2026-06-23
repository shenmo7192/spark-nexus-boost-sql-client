"""
假设参数管理模块
功能：管理多套关键假设方案，支持参数插值
"""

import os
import json
from copy import deepcopy

# 默认配置文件路径
DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'config_hypothesis.json')

# 默认假设方案模板
DEFAULT_HYPOTHESIS = {
    "scenarios": [
        {
            "id": "baseline",
            "name": "基准方案",
            "description": "默认基准参数方案",
            "params": {
                "tax_rate": 0.25,
                "growth_rate": 0.05,
                "discount_rate": 0.08,
                "cost_inflation": 0.03
            }
        },
        {
            "id": "scenario_1",
            "name": "方案一",
            "description": "乐观方案",
            "params": {
                "tax_rate": 0.20,
                "growth_rate": 0.10,
                "discount_rate": 0.06,
                "cost_inflation": 0.02
            }
        },
        {
            "id": "scenario_2",
            "name": "方案二",
            "description": "保守方案",
            "params": {
                "tax_rate": 0.25,
                "growth_rate": 0.02,
                "discount_rate": 0.10,
                "cost_inflation": 0.05
            }
        }
    ]
}


def load_config(config_path=None):
    """加载假设参数配置文件"""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH

    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return deepcopy(DEFAULT_HYPOTHESIS)
    else:
        # 如果文件不存在，创建默认配置
        save_config(DEFAULT_HYPOTHESIS, config_path)
        return deepcopy(DEFAULT_HYPOTHESIS)


def save_config(config, config_path=None):
    """保存假设参数配置文件"""
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH

    # 确保目录存在
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_scenarios(config_path=None):
    """获取所有假设方案列表"""
    config = load_config(config_path)
    return config.get('scenarios', [])


def get_scenario(scenario_id, config_path=None):
    """获取指定假设方案"""
    scenarios = get_scenarios(config_path)
    for s in scenarios:
        if s['id'] == scenario_id:
            return s
    return None


def add_scenario(scenario, config_path=None):
    """添加新假设方案"""
    config = load_config(config_path)
    config['scenarios'].append(scenario)
    save_config(config, config_path)
    return scenario


def update_scenario(scenario_id, updates, config_path=None):
    """更新假设方案"""
    config = load_config(config_path)
    for s in config['scenarios']:
        if s['id'] == scenario_id:
            s.update(updates)
            save_config(config, config_path)
            return s
    return None


def delete_scenario(scenario_id, config_path=None):
    """删除假设方案"""
    config = load_config(config_path)
    config['scenarios'] = [s for s in config['scenarios'] if s['id'] != scenario_id]
    save_config(config, config_path)
    return True


def get_params_dict(scenario_id, config_path=None):
    """获取指定方案的参数键值对字典"""
    scenario = get_scenario(scenario_id, config_path)
    if scenario:
        return scenario.get('params', {})
    return {}


def get_param_value(scenario_id, param_name, config_path=None):
    """获取指定方案的某个参数值"""
    params = get_params_dict(scenario_id, config_path)
    return params.get(param_name)


def compare_scenarios(scenario_ids, config_path=None):
    """
    对比多套方案的参数差异
    :return: {param_name: {scenario_id: value, ...}, ...}
    """
    all_params = {}
    for sid in scenario_ids:
        scenario = get_scenario(sid, config_path)
        if scenario:
            for k, v in scenario.get('params', {}).items():
                if k not in all_params:
                    all_params[k] = {}
                all_params[k][sid] = v

    return all_params
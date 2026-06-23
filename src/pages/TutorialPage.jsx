import { BookOpen, Lightbulb } from 'lucide-react'

const sections = [
  {
    id: 'basic',
    title: '1. 基本查询',
    examples: [
      'SELECT * FROM 表名;',
      'SELECT 列1, 列2, 列3 FROM 表名;',
      'SELECT * FROM 表名 LIMIT 10;',
      'SELECT DISTINCT 列名 FROM 表名;',
      'SELECT 列名 AS 别名 FROM 表名 AS t;'
    ]
  },
  {
    id: 'where',
    title: '2. 条件过滤 (WHERE)',
    examples: [
      "SELECT * FROM 表名 WHERE 列名 > 100;\nSELECT * FROM 表名 WHERE 列名 = '特定值';\nSELECT * FROM 表名 WHERE 列名 BETWEEN 100 AND 200;",
      "SELECT * FROM 表名 WHERE 城市 IN ('北京', '上海', '广州');",
      "SELECT * FROM 表名 WHERE 姓名 LIKE '张%';  -- 以'张'开头\nSELECT * FROM 表名 WHERE 姓名 LIKE '%小明%';  -- 包含'小明'",
      "SELECT * FROM 表名 WHERE 年龄 > 30 AND 城市 = '北京';\nSELECT * FROM 表名 WHERE NOT 状态 = '已关闭';",
      'SELECT * FROM 表名 WHERE 列名 IS NULL;\nSELECT * FROM 表名 WHERE 列名 IS NOT NULL;'
    ]
  },
  {
    id: 'aggregate',
    title: '3. 聚合统计',
    examples: [
      'SELECT COUNT(*) FROM 表名;\nSELECT COUNT(DISTINCT 列名) FROM 表名;\nSELECT SUM(金额) FROM 表名;\nSELECT AVG(金额) FROM 表名;\nSELECT MAX(金额) FROM 表名;\nSELECT MIN(金额) FROM 表名;'
    ]
  },
  {
    id: 'join',
    title: '4. 多表连接 (JOIN)',
    examples: [
      'SELECT a.列1, a.列2, b.列3\nFROM 表A a\nINNER JOIN 表B b ON a.关联列 = b.关联列;',
      'SELECT a.*, b.列名\nFROM 表A a\nLEFT JOIN 表B b ON a.关联列 = b.关联列;',
      'SELECT *\nFROM 表A a\nLEFT JOIN 表B b ON a.id = b.a_id\nLEFT JOIN 表C c ON a.id = c.a_id;'
    ]
  },
  {
    id: 'order',
    title: '5. 排序与限制',
    examples: [
      'SELECT * FROM 表名 ORDER BY 列名 ASC;\nSELECT * FROM 表名 ORDER BY 列名 DESC;\nSELECT * FROM 表名 ORDER BY 列1 ASC, 列2 DESC;',
      'SELECT * FROM 表名 LIMIT 20 OFFSET 0;\nSELECT * FROM 表名 LIMIT 20 OFFSET 20;\nSELECT * FROM 表名 LIMIT 20 OFFSET 40;'
    ],
    note: '提示：在 SQL 查询页面中，工具会自动处理分页，无需手动写 LIMIT/OFFSET。'
  },
  {
    id: 'group',
    title: '6. 分组与 HAVING',
    examples: [
      'SELECT 城市, COUNT(*) AS 数量, SUM(金额) AS 总金额\nFROM 订单表\nGROUP BY 城市;',
      'SELECT 城市, COUNT(*) AS 数量, AVG(金额) AS 平均金额\nFROM 订单表\nGROUP BY 城市\nHAVING COUNT(*) > 10;'
    ],
    note: 'WHERE 过滤行，HAVING 过滤分组后的结果。'
  },
  {
    id: 'subquery',
    title: '7. 子查询',
    examples: [
      'SELECT * FROM 表名\nWHERE 金额 > (SELECT AVG(金额) FROM 表名);',
      'SELECT 城市, 平均金额\nFROM (\n    SELECT 城市, AVG(金额) AS 平均金额\n    FROM 订单表\n    GROUP BY 城市\n) AS sub\nWHERE 平均金额 > 1000;',
      'SELECT * FROM 表A a\nWHERE EXISTS (\n    SELECT 1 FROM 表B b\n    WHERE b.关联列 = a.关联列\n);'
    ]
  },
  {
    id: 'function',
    title: '8. 常用 SQLite 函数',
    examples: [
      'SELECT LENGTH(列名) FROM 表名;\nSELECT UPPER(列名) FROM 表名;\nSELECT LOWER(列名) FROM 表名;\nSELECT TRIM(列名) FROM 表名;\nSELECT SUBSTR(列名, 1, 3) FROM 表名;\nSELECT REPLACE(列名, \'旧值\', \'新值\');',
      'SELECT ROUND(列名, 2) FROM 表名;\nSELECT ABS(列名) FROM 表名;\nSELECT CAST(列名 AS INTEGER) FROM 表名;',
      'SELECT CAST(文本列 AS REAL) FROM 表名;\nSELECT CAST(数值列 AS TEXT) FROM 表名;'
    ]
  },
  {
    id: 'date',
    title: '9. 日期时间处理',
    examples: [
      "SELECT DATE('now');\nSELECT TIME('now');\nSELECT DATETIME('now');\nSELECT STRFTIME('%Y-%m', 日期列);",
      "SELECT DATE('now', '+1 month');\nSELECT DATE('now', '-7 day');\nSELECT DATE('now', 'start of year');",
      "SELECT STRFTIME('%Y-%m', 日期列) AS 年月,\n       COUNT(*) AS 数量,\n       SUM(金额) AS 总金额\nFROM 表名\nGROUP BY STRFTIME('%Y-%m', 日期列)\nORDER BY 年月;"
    ],
    note: 'SQLite 没有专用日期类型，日期以 TEXT、REAL 或 INTEGER 存储。'
  },
  {
    id: 'window',
    title: '10. 窗口函数',
    examples: [
      'SELECT *,\n       ROW_NUMBER() OVER (ORDER BY 金额 DESC) AS 排名\nFROM 表名;',
      'SELECT *,\n       ROW_NUMBER() OVER (PARTITION BY 城市 ORDER BY 金额 DESC) AS 城市内排名\nFROM 表名;',
      'SELECT 日期, 金额,\n       SUM(金额) OVER (ORDER BY 日期) AS 累计金额\nFROM 表名;',
      'SELECT 日期, 金额,\n       AVG(金额) OVER (ORDER BY 日期 ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS 3日移动平均\nFROM 表名;'
    ]
  },
  {
    id: 'case',
    title: '11. CASE 条件表达式',
    examples: [
      "SELECT *,\n    CASE\n        WHEN 金额 >= 10000 THEN '大单'\n        WHEN 金额 >= 5000 THEN '中单'\n        ELSE '小单'\n    END AS 订单等级\nFROM 表名;",
      "SELECT\n    SUM(CASE WHEN 状态 = '已完成' THEN 金额 ELSE 0 END) AS 已完成金额,\n    SUM(CASE WHEN 状态 = '进行中' THEN 金额 ELSE 0 END) AS 进行中金额\nFROM 表名;"
    ]
  },
  {
    id: 'param',
    title: '12. 参数插值（本工具特色功能）',
    examples: [
      "-- 假设方案中设置参数：tax_rate = 0.25\nSELECT *,\n       金额 * {{tax_rate}} AS 税额,\n       金额 * (1 - {{tax_rate}}) AS 税后金额\nFROM 收入表;",
      "-- 切换不同假设方案，查看不同税率下的结果\nSELECT *,\n       金额 * {{tax_rate}} AS 税额\nFROM 收入表\nWHERE 日期 >= '2024-01-01';"
    ],
    note: '在「假设参数」页中创建多套方案，在 SQL 查询页中切换方案并重新执行即可对比。'
  }
]

const tocItems = [
  { id: 'basic', label: '基本查询' },
  { id: 'where', label: '条件过滤' },
  { id: 'aggregate', label: '聚合统计' },
  { id: 'join', label: '多表连接' },
  { id: 'order', label: '排序与限制' },
  { id: 'group', label: '分组与Having' },
  { id: 'subquery', label: '子查询' },
  { id: 'function', label: '常用函数' },
  { id: 'date', label: '日期时间' },
  { id: 'window', label: '窗口函数' },
  { id: 'case', label: 'CASE条件' },
  { id: 'param', label: '参数插值' }
]

export default function TutorialPage() {
  const scrollToSection = (id) => {
    const el = document.getElementById(`sec-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-surface-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-600" />
          SQLite 语法教程
        </h1>
        <p className="text-sm text-surface-500 mt-0.5">本教程涵盖 SQLite 常用语法，所有语句可在「SQL 查询」页面中直接运行。</p>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">目录</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {tocItems.map(item => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-left text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1.5 rounded-md transition-colors"
            >
              {item.title || item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.id} id={`sec-${section.id}`} className="card scroll-mt-4">
            <div className="card-header">
              <span className="card-title">{section.title}</span>
            </div>
            <div className="p-5 space-y-3">
              {section.examples.map((example, idx) => (
                <pre
                  key={idx}
                  className="bg-surface-900 text-surface-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed"
                >
                  {example}
                </pre>
              ))}
              {section.note && (
                <p className="text-sm text-surface-500 flex items-start gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  {section.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-surface-500 py-4">
        提示：在 SQL 查询页面按 <kbd className="bg-surface-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> / <kbd className="bg-surface-200 px-1.5 py-0.5 rounded font-mono">Cmd+Enter</kbd> 快速执行 SQL
      </div>
    </div>
  )
}

-- 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
-- Cloudflare D1 / SQLite 三期统一数据库架构设计
-- 设计原则：仅存储学习规划、过关指标与结构化题库，严禁将学生真实姓名/学校上传 AI 模型

PRAGMA foreign_keys = ON;

-- 1. 系统全局配置表（红黄绿灯阈值、积分计费规则、版权防伪配置）
CREATE TABLE IF NOT EXISTS sys_config_thresholds (
  config_key TEXT PRIMARY KEY,
  red_error_rate REAL NOT NULL DEFAULT 0.40,
  yellow_error_rate REAL NOT NULL DEFAULT 0.15,
  red_consecutive_wrong INTEGER NOT NULL DEFAULT 2,
  watermark_text TEXT NOT NULL DEFAULT '许老师工作室 / 铭师学习规划原创 · 盗版必究',
  points_rules_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO sys_config_thresholds (config_key, points_rules_json)
VALUES (
  'default',
  '{"self_study":{"kb_doc":2,"question_pack":5,"plan_review":3},"qa_tutoring":{"base_package":30,"single_question":8,"grade_factor":{"junior":1.0,"senior":1.2}},"referral":{"register_bonus":20,"consume_rebate_rate":0.10},"withdrawal":{"min_points":200,"yuan_per_point":0.5}}'
);

-- 2. 学员建档与学习模式档案（支持毕业冲刺类 + 非毕业班同步成长类 + 四种服务模式）
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id TEXT PRIMARY KEY,
  display_alias TEXT NOT NULL,                  -- 前台脱敏代号（如：学员-WH2026-01），不送入AI
  access_role TEXT NOT NULL DEFAULT 'student',  -- student | parent | admin
  stage TEXT NOT NULL,                          -- junior | senior
  grade_label TEXT NOT NULL,                    -- 初一..初三 / 高一..高三
  enrollment_category TEXT NOT NULL,            -- graduation_sprint | sync_growth
  sprint_sub_type TEXT,                         -- zhongkao | gaokao_culture | gaokao_art
  growth_sub_type TEXT,                         -- advance | sync_boost | gap_diagnostic
  province TEXT NOT NULL,
  city TEXT,
  subject_track TEXT,                           -- 物理类 | 历史类 | 理科 | 文科 | 全科
  art_formula_preset TEXT,                      -- 50_50 | 60_40 | 40_60 | province_default | custom
  art_culture_weight REAL,
  art_major_weight REAL,
  art_major_score REAL,
  art_major_max REAL DEFAULT 300,
  target_school_name TEXT,
  target_cutoff_score REAL,                     -- 目标校近三年平均线（可手动修正）
  local_max_score REAL,                         -- 当地考试总满分（可手动修正）
  baseline_score REAL,
  required_culture_target REAL,                 -- 艺考自动倒推文化课最低目标分 / 冲刺目标分
  advance_span_weeks INTEGER DEFAULT 0,
  target_difficulty TEXT DEFAULT '中等',         -- 基础 | 中等 | 压轴 / 标准考试难度
  target_mastery_level TEXT DEFAULT '良好',      -- 合格 | 良好 | 优秀
  study_rhythm TEXT NOT NULL DEFAULT 'part_time', -- full_time(全脱产) | part_time(非脱产)
  custom_cycle_days INTEGER NOT NULL DEFAULT 7,
  available_hours_per_day REAL NOT NULL DEFAULT 2.5,
  service_mode TEXT NOT NULL DEFAULT 'self_study', -- self_study | qa_tutoring | periodic_eval | enrolled_course
  eval_frequency TEXT DEFAULT 'biweekly',       -- weekly | biweekly | monthly
  course_enabled INTEGER NOT NULL DEFAULT 0,    -- 报课模式开通标志（1=除答疑外全部畅享）
  points_balance INTEGER NOT NULL DEFAULT 100,
  invite_code TEXT UNIQUE,
  invited_by_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. 地区考试总分与目标校近三年录取线数据库（全国通用兜底 + 年度批量刷新）
CREATE TABLE IF NOT EXISTS region_cutoffs (
  cutoff_id TEXT PRIMARY KEY,
  exam_type TEXT NOT NULL,                      -- zhongkao | gaokao_culture | gaokao_art
  province TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  subject_track TEXT NOT NULL DEFAULT '全科',
  school_name TEXT NOT NULL,
  school_tier TEXT NOT NULL DEFAULT '重点线',    -- 985 | 211 | 一本 | 重点高中 | 艺术院校 | 自定义
  local_max_score REAL NOT NULL,
  cutoff_year_1 REAL,
  cutoff_year_2 REAL,
  cutoff_year_3 REAL,
  avg_cutoff_score REAL NOT NULL,
  art_formula_json TEXT,                        -- 省份艺考综合分折算规则
  source_type TEXT NOT NULL DEFAULT 'builtin',  -- builtin | ai_estimated | manual
  needs_manual_verify INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_region_cutoffs_lookup
  ON region_cutoffs(exam_type, province, city, subject_track);

-- 4. 考点过关手册目录树（来自 初中（内页）.pdf 与 高中内页)(1).pdf 完整解析）
CREATE TABLE IF NOT EXISTS manual_nodes (
  node_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,                          -- junior | senior
  subject_key TEXT NOT NULL,                    -- cn | math | en | phys | chem | politics | bio | hist | geo
  subject_label TEXT NOT NULL,
  parent_id TEXT,
  node_level INTEGER NOT NULL,                  -- 1:大类/章/专题 | 2:节/模块/题型组 | 3:最小过关知识点/题型
  sort_order INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  title TEXT NOT NULL,
  difficulty_tag TEXT DEFAULT '基础',            -- 基础 | 培优 | 扩展 | 中等 | 压轴
  default_planned_count INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_manual_nodes_subject
  ON manual_nodes(stage, subject_key, node_level, sort_order);

-- 5. 学员考点过关进度表（严格保留 5 项核心统计字段 + 自动红黄绿灯状态）
CREATE TABLE IF NOT EXISTS student_manual_progress (
  progress_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES manual_nodes(node_id) ON DELETE CASCADE,
  planned_count INTEGER NOT NULL DEFAULT 5,     -- 计划做题数
  completed_count INTEGER NOT NULL DEFAULT 0,   -- 已完成题数
  wrong_count INTEGER NOT NULL DEFAULT 0,       -- 不会/错误数
  explained_count INTEGER NOT NULL DEFAULT 0,   -- 讲解数
  is_passed INTEGER NOT NULL DEFAULT 0,         -- 是否过关 (0/1)
  consecutive_wrong INTEGER NOT NULL DEFAULT 0, -- 连续错误题数（>=2 触发红灯）
  error_rate REAL NOT NULL DEFAULT 0.0,         -- 错误率 = wrong_count / completed_count
  light_status TEXT NOT NULL DEFAULT 'unstarted', -- unstarted | red | yellow | green
  last_diagnosed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_light
  ON student_manual_progress(student_id, light_status);

-- 6. DeepTutor 闭环【专属消灯任务包】表
CREATE TABLE IF NOT EXISTS light_clear_packs (
  pack_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES manual_nodes(node_id) ON DELETE CASCADE,
  trigger_light TEXT NOT NULL DEFAULT 'red',
  diagnosis_reason TEXT NOT NULL,               -- 薄弱知识原因分析
  advice_text TEXT NOT NULL,                    -- 靶向解决建议
  knowledge_doc_ids_json TEXT NOT NULL DEFAULT '[]',
  practice_question_ids_json TEXT NOT NULL DEFAULT '[]',
  pack_payload_json TEXT NOT NULL,              -- 完整讲义+同题型练习包结构
  pack_status TEXT NOT NULL DEFAULT 'pending',  -- pending | practicing | completed
  post_retest_total INTEGER NOT NULL DEFAULT 0,
  post_retest_wrong INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- 7. 拍卷测漏记录表（仅存题干结构与人工勾选结果，绝不存学生答案/AI批改结果）
CREATE TABLE IF NOT EXISTS paper_upload_records (
  record_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  exam_title TEXT NOT NULL,
  ai_items_json TEXT NOT NULL,                  -- 仅含题号/科目/题型/难度/分值/建议手册标签
  needs_review INTEGER NOT NULL DEFAULT 1,      -- 强制 1（需人工复核）
  manual_marks_json TEXT NOT NULL DEFAULT '[]', -- 老师人工勾选的对错记录
  synced_to_manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. 家长录入学校阶段考试成绩与成长轨迹表
CREATE TABLE IF NOT EXISTS school_exam_scores (
  score_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,                      -- 月考 | 期中 | 期末 | 摸底 | 模拟考
  exam_name TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  subject_key TEXT NOT NULL DEFAULT 'total',
  score_obtained REAL NOT NULL,
  max_score REAL NOT NULL,
  target_score REAL,
  entered_by_role TEXT NOT NULL DEFAULT 'parent',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. 精装级定制规划计划书档案表（支持管理员人工润色二次生成）
CREATE TABLE IF NOT EXISTS planning_reports (
  report_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  report_title TEXT NOT NULL DEFAULT '许老师工作室 · 独家升学规划与过关诊断报告',
  radar_metrics_json TEXT NOT NULL,
  battle_summary_json TEXT NOT NULL,
  auto_commentary TEXT NOT NULL,
  admin_polished_commentary TEXT,
  seal_label TEXT NOT NULL DEFAULT '许老师工作室 / 铭师学习规划专用章',
  signature_teacher TEXT NOT NULL DEFAULT '许老师',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. 二期/三期：知识库表（基础必掌握类 / 总结归纳类）
CREATE TABLE IF NOT EXISTS knowledge_base_docs (
  doc_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  manual_node_id TEXT REFERENCES manual_nodes(node_id),
  kb_category TEXT NOT NULL,                    -- 基础必掌握类 | 总结归纳类
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  source_file_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. 二期/三期：智能题目库表（含难度分档与三级防重字段）
CREATE TABLE IF NOT EXISTS question_bank (
  q_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  manual_node_id TEXT REFERENCES manual_nodes(node_id),
  difficulty TEXT NOT NULL,                     -- 基础 | 中等 | 压轴
  question_type TEXT NOT NULL,                  -- 选择 | 填空 | 解答 | 实验 | 作文 | 其他
  stem_text TEXT NOT NULL,
  options_json TEXT DEFAULT '[]',
  answer_text TEXT NOT NULL,
  analysis_text TEXT NOT NULL,
  text_hash TEXT NOT NULL,                      -- 一级精准文本指纹去重
  semantic_sig TEXT NOT NULL,                   -- 二级 AI 语义相似度签名（>=85% 预警）
  is_variant INTEGER NOT NULL DEFAULT 0,        -- 1=变式训练题
  variant_of_id TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | discarded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_question_hash ON question_bank(text_hash);
CREATE INDEX IF NOT EXISTS idx_question_manual ON question_bank(stage, subject_key, manual_node_id, difficulty);

-- 12. 二期：智能组卷档案表
CREATE TABLE IF NOT EXISTS generated_exams (
  exam_id TEXT PRIMARY KEY,
  student_id TEXT,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,                           -- manual | ai_nl
  prompt_text TEXT,
  stage TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  question_ids_json TEXT NOT NULL,
  insufficient_warnings_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. 三期：积分流水、裂变邀请与现金提现申请表
CREATE TABLE IF NOT EXISTS points_ledger (
  ledger_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  action_type TEXT NOT NULL,                    -- recharge | self_study_deduct | qa_deduct | referral_bonus | withdraw_freeze | admin_adjust
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referral_records (
  ref_id TEXT PRIMARY KEY,
  inviter_student_id TEXT NOT NULL,
  invitee_student_id TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'registered',    -- registered | consumed | settled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  withdraw_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL,
  cash_yuan REAL NOT NULL,
  rules_accepted INTEGER NOT NULL DEFAULT 0,    -- 需勾选《积分与奖励规则》（含未成年人监护提示）
  guardian_confirmed INTEGER NOT NULL DEFAULT 0,
  audit_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

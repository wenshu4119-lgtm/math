import {DRAFT_EXPORTS} from './draft-export-registry.js';
// Every persisted business surface must have an entry and a visible action.
// Passwords, sessions, secrets and security tokens are deliberately never exportable.
// The teacher plan/feedback workspace reuses packs/pack/assignment and the five
// homework kinds below. Unsaved inputs and nonexistent lesson sessions are not records.
export const EXPORTS=Object.freeze({
  ...DRAFT_EXPORTS,
  'time-plan':{title:'学习时间计划',roles:['student','teacher','parent'],key:'id'},
  growth:{title:'学生成长档案',roles:['student','teacher','parent'],key:'studentId'},
  attempts:{title:'学习记录清单',roles:['student','teacher'],key:'studentId'},
  attempt:{title:'筛查 / 练习 / 复测报告与题目解析',roles:['student','teacher'],key:'id'},
  packs:{title:'通关包清单',roles:['student','teacher'],key:'studentId'},
  pack:{title:'今日通关包',roles:['student','teacher'],key:'id'},
  assignment:{title:'通关练习作业单',roles:['student','teacher'],key:'id'},
  homeworks:{title:'独立作业清单',roles:['student','teacher'],key:'studentId'},
  'homework-sheet':{title:'独立作业单（无答案）',roles:['student','teacher'],key:'id'},
  homework:{title:'独立作业保存记录',roles:['student','teacher'],key:'id'},
  'homework-feedback':{title:'独立作业人工批改反馈',roles:['student','teacher'],key:'id'},
  'homework-summaries':{title:'独立作业授权摘要',roles:['student','teacher','parent'],key:'studentId'},
  content:{title:'教师讲义与内容审核记录',roles:['teacher'],key:'id',optional:true},
  knowledge:{title:'知识点目录',roles:['student','teacher','parent'],key:'subject'},
  uploads:{title:'试卷核对记录清单',roles:['student','teacher'],key:'studentId'},
  upload:{title:'试卷图片与人工核对记录',roles:['student','teacher'],key:'id'},
  'ocr-runs':{title:'图片OCR识别记录清单',roles:['student','teacher'],key:'uploadId'},
  'ocr-run':{title:'OCR原文与教师核对记录',roles:['student','teacher'],key:'id'},
  roster:{title:'可访问学生清单',roles:['student','teacher','parent']},
  papers:{title:'人工阅卷记录清单',roles:['student','teacher'],key:'studentId'},
  paper:{title:'人工阅卷明细与核对记录',roles:['student','teacher'],key:'id'},
  'paper-report':{title:'已确认人工阅卷报告',roles:['student','teacher'],key:'id'},
  'paper-summaries':{title:'线下辅导已确认摘要',roles:['student','teacher','parent'],key:'studentId'},
  'admin-users':{title:'账号业务清单',roles:['admin']},
  'admin-relationships':{title:'师生与亲子授权关系',roles:['admin']},
  'admin-audit':{title:'管理操作审计报表',roles:['admin']}
});
export function exportUrl(kind,params={}) {
  const spec=EXPORTS[kind];if(!spec)throw new Error('未登记的导出类型');
  const query=new URLSearchParams({kind});
  if(spec.key&&params[spec.key])query.set(spec.key,params[spec.key]);
  return `/print.html?${query}`;
}

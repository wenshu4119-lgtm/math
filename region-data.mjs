// 许老师工作室 / 铭师学习规划管理平台 (mrxu.uk)
// 全国中高考地区分数线兜底数据库、艺考折算引擎、排课节奏生成器与名师诊断话术库

export const STUDIO_META = Object.freeze({
  name: '许老师工作室',
  brand: '铭师学习规划管理平台',
  domain: 'mrxu.uk',
  phone: '18986280310',
  wechat: '微信同号',
  address: '江岸区百步亭花园路现代城一区',
  watermarkText: '许老师工作室 / 铭师学习规划原创 · 盗版必究',
  sealText: '许老师工作室 · 铭师学习规划专用章',
  reportTitle: '许老师工作室 · 独家升学规划与过关诊断报告'
});

// ==================== 1. 全国中考分省分市参考总分与近三年录取线 ====================
export const ZHONGKAO_REGIONS = {
  '湖北省': {
    defaultMax: 680,
    cities: {
      '武汉市': {
        localMaxScore: 680,
        note: '武汉市现行中考满分 680 分，示范高中以中心城区统招线为参考。',
        schools: [
          { name: '华中师大一附中', tier: '省示范领军', y1: 632, y2: 634, y3: 636, avg: 634 },
          { name: '武汉市第二中学', tier: '省示范重点', y1: 621, y2: 624, y3: 624, avg: 623 },
          { name: '湖北省武昌实验中学', tier: '省示范重点', y1: 616, y2: 618, y3: 620, avg: 618 },
          { name: '武汉外国语学校', tier: '省示范特色', y1: 620, y2: 622, y3: 624, avg: 622 },
          { name: '武汉市第六中学 / 十一中', tier: '省示范重点', y1: 604, y2: 606, y3: 608, avg: 606 },
          { name: '中心城区省示范最低控制线', tier: '省级示范线', y1: 565, y2: 568, y3: 571, avg: 568 },
          { name: '中心城区普高最低控制线', tier: '普高线', y1: 448, y2: 452, y3: 456, avg: 452 }
        ]
      },
      '襄阳市': {
        localMaxScore: 660,
        note: '参考近年襄阳中考折算总分（按当地当年计分满分可随时手动微调）。',
        schools: [
          { name: '襄阳四中 / 襄阳五中（指标/统招参考）', tier: '省示范领军', y1: 615, y2: 618, y3: 621, avg: 618 },
          { name: '襄阳一中 / 三中', tier: '省示范重点', y1: 575, y2: 578, y3: 581, avg: 578 },
          { name: '市区普通高中控制线', tier: '普高线', y1: 430, y2: 435, y3: 440, avg: 435 }
        ]
      },
      '宜昌市': {
        localMaxScore: 660,
        note: '宜昌市重点高中统招参考线，支持结合当年中考满分手动修改。',
        schools: [
          { name: '宜昌市第一中学', tier: '省示范领军', y1: 608, y2: 611, y3: 614, avg: 611 },
          { name: '夷陵中学', tier: '省示范重点', y1: 602, y2: 605, y3: 608, avg: 605 },
          { name: '葛洲坝中学 / 市二中参考', tier: '省示范重点', y1: 556, y2: 560, y3: 564, avg: 560 }
        ]
      },
      '黄冈市': {
        localMaxScore: 730,
        note: '黄冈市含实验/体育等地市满分参考，建议以目标区县教育局当年公布为准。',
        schools: [
          { name: '黄冈中学（统招参考）', tier: '省示范领军', y1: 684, y2: 687, y3: 690, avg: 687 },
          { name: '黄州区重点高中参考', tier: '省示范重点', y1: 632, y2: 636, y3: 640, avg: 636 }
        ]
      },
      '荆州市': {
        localMaxScore: 670,
        note: '荆州市中心城区参考录取线。',
        schools: [
          { name: '荆州中学', tier: '省示范领军', y1: 622, y2: 625, y3: 628, avg: 625 },
          { name: '沙市中学', tier: '省示范重点', y1: 606, y2: 610, y3: 614, avg: 610 }
        ]
      },
      '孝感市': {
        localMaxScore: 690,
        note: '孝感市重点高中参考线，支持手动修正县市计分总分。',
        schools: [
          { name: '孝感高中', tier: '省示范领军', y1: 636, y2: 640, y3: 644, avg: 640 },
          { name: '汉川一中 / 孝感一中参考', tier: '省示范重点', y1: 590, y2: 595, y3: 600, avg: 595 }
        ]
      },
      '十堰市': {
        localMaxScore: 660,
        note: '十堰市主城区重点高中参考线。',
        schools: [
          { name: '十堰市第一中学 / 东风高级中学', tier: '省示范重点', y1: 604, y2: 608, y3: 612, avg: 608 },
          { name: '郧阳中学参考', tier: '省示范重点', y1: 596, y2: 600, y3: 604, avg: 600 }
        ]
      },
      '黄石市': {
        localMaxScore: 660,
        note: '黄石市重点高中参考线。',
        schools: [
          { name: '黄石二中', tier: '省示范领军', y1: 610, y2: 614, y3: 618, avg: 614 },
          { name: '黄石一中 / 有色一中', tier: '省示范重点', y1: 562, y2: 566, y3: 570, avg: 566 }
        ]
      }
    }
  },
  '北京市': {
    defaultMax: 510,
    cities: {
      '北京市（全城/海淀西城）': {
        localMaxScore: 510,
        note: '北京新中考满分 510 分（含体育 50 分，已计入 2025 改革后口径，支持手动改回 660/670 口径）。',
        schools: [
          { name: '人大附中 / 北京四中 / 十一学校参考', tier: '市示范领军', y1: 486, y2: 488, y3: 490, avg: 488 },
          { name: '市级示范高中重点参考线', tier: '市示范重点', y1: 462, y2: 465, y3: 468, avg: 465 }
        ]
      }
    }
  },
  '上海市': {
    defaultMax: 750,
    cities: {
      '上海市': {
        localMaxScore: 750,
        note: '上海中考总分 750 分（含道法/历史/理化实验/跨学科/体育）。',
        schools: [
          { name: '四校（上海中学/华二/复附/交附）', tier: '市示范领军', y1: 703, y2: 705, y3: 707, avg: 705 },
          { name: '市实验性示范性高中参考', tier: '市示范重点', y1: 658, y2: 662, y3: 666, avg: 662 }
        ]
      }
    }
  },
  '广东省': {
    defaultMax: 810,
    cities: {
      '广州市': {
        localMaxScore: 810,
        note: '广州中考总分 810 分。',
        schools: [
          { name: '华南师大附中 / 省实 / 广雅 / 执信', tier: '省一级示范', y1: 742, y2: 745, y3: 748, avg: 745 },
          { name: '第一梯度投档控制线参考', tier: '第一梯度', y1: 702, y2: 705, y3: 708, avg: 705 }
        ]
      },
      '深圳市': {
        localMaxScore: 610,
        note: '深圳中考总分 610 分。',
        schools: [
          { name: '深圳中学 / 深圳实验 / 深圳外国语', tier: '四大名校', y1: 572, y2: 574, y3: 576, avg: 574 },
          { name: '市属重点公办高中参考线', tier: '重点公办', y1: 538, y2: 541, y3: 544, avg: 541 }
        ]
      }
    }
  },
  '浙江省': {
    defaultMax: 650,
    cities: {
      '杭州市': {
        localMaxScore: 650,
        note: '浙江全省统一命题后杭州市中招满分 650 分。',
        schools: [
          { name: '杭州二中 / 学军中学 / 杭州高级中学', tier: '前三重高', y1: 616, y2: 618, y3: 620, avg: 618 },
          { name: '杭州市区优高重点参考线', tier: '重点高中', y1: 578, y2: 582, y3: 586, avg: 582 }
        ]
      },
      '宁波市': {
        localMaxScore: 660,
        note: '宁波中考总分 660 分参考。',
        schools: [
          { name: '镇海中学 / 效实中学', tier: '省一级重点', y1: 624, y2: 627, y3: 630, avg: 627 },
          { name: '城区省一级重点高中参考', tier: '重点高中', y1: 590, y2: 594, y3: 598, avg: 594 }
        ]
      }
    }
  },
  '江苏省': {
    defaultMax: 700,
    cities: {
      '南京市': {
        localMaxScore: 700,
        note: '南京中考满分 700 分。',
        schools: [
          { name: '南京外国语 / 南师附中 / 金陵中学', tier: '四星名校', y1: 644, y2: 647, y3: 650, avg: 647 },
          { name: '南京重点四星高中参考线', tier: '四星重点', y1: 612, y2: 615, y3: 618, avg: 615 }
        ]
      },
      '苏州市': {
        localMaxScore: 740,
        note: '苏州中考满分 740 分。',
        schools: [
          { name: '苏州中学 / 西交大苏州附中', tier: '四星领军', y1: 682, y2: 685, y3: 688, avg: 685 },
          { name: '市区重点四星高中参考', tier: '四星重点', y1: 646, y2: 650, y3: 654, avg: 650 }
        ]
      }
    }
  },
  '四川省': {
    defaultMax: 710,
    cities: {
      '成都市': {
        localMaxScore: 710,
        note: '成都中考满分 710 分。',
        schools: [
          { name: '成都七中 / 树德中学 / 石室中学', tier: '四七九领军', y1: 644, y2: 647, y3: 650, avg: 647 },
          { name: '成都市重点线（省重线）参考', tier: '省重线', y1: 552, y2: 555, y3: 558, avg: 555 }
        ]
      }
    }
  },
  '河南省': {
    defaultMax: 730,
    cities: {
      '郑州市': {
        localMaxScore: 730,
        note: '郑州中考（含体育/理化生实验）总分 730 分参考。',
        schools: [
          { name: '郑州外国语 / 省实验 / 郑州一中', tier: '大小三甲', y1: 662, y2: 665, y3: 668, avg: 665 },
          { name: '省级示范性高中第一批次', tier: '省示范', y1: 615, y2: 618, y3: 621, avg: 618 }
        ]
      }
    }
  },
  '湖南省': {
    defaultMax: 700,
    cities: {
      '长沙市': {
        localMaxScore: 700,
        note: '长沙中考满分 700 分。',
        schools: [
          { name: '长郡 / 雅礼 / 师大附中 / 长沙一中', tier: '四大名校', y1: 652, y2: 655, y3: 658, avg: 655 },
          { name: '市重点高中控制参考线', tier: '省示范', y1: 606, y2: 610, y3: 614, avg: 610 }
        ]
      }
    }
  },
  '安徽省': {
    defaultMax: 750,
    cities: {
      '合肥市': {
        localMaxScore: 750,
        note: '合肥中考满分 750 分。',
        schools: [
          { name: '合肥一中 / 六中 / 八中', tier: '三校联招', y1: 696, y2: 699, y3: 702, avg: 699 },
          { name: '合肥市区重点省示范高中参考', tier: '省示范', y1: 652, y2: 655, y3: 658, avg: 655 }
        ]
      }
    }
  },
  '福建省': {
    defaultMax: 800,
    cities: {
      '福州市': {
        localMaxScore: 800,
        note: '福建省级统考（福州/厦门等）总分 800 分。',
        schools: [
          { name: '福州一中 / 师大附中 / 福州三中', tier: '老八所前三', y1: 748, y2: 751, y3: 754, avg: 751 },
          { name: '一级达标重点高中参考线', tier: '一级达标', y1: 698, y2: 702, y3: 706, avg: 702 }
        ]
      }
    }
  },
  '陕西省': {
    defaultMax: 700,
    cities: {
      '西安市': {
        localMaxScore: 700,
        note: '西安中考总分 700 分（不含附加或含实验分请按当年微调）。',
        schools: [
          { name: '西工大附中 / 高新一中 / 铁一中', tier: '五大名校', y1: 658, y2: 661, y3: 664, avg: 661 },
          { name: '城六区省级示范高中参考线', tier: '省示范', y1: 598, y2: 602, y3: 606, avg: 602 }
        ]
      }
    }
  }
};

// ==================== 2. 全国高考省份 + 科类 + 985/211/重点一本参考线 ====================
export const GAOKAO_PROVINCES = {
  '湖北省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 0, '历史类': 0 }, controlLine: { '物理类': 525, '历史类': 530 } },
  '湖南省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -8, '历史类': -6 }, controlLine: { '物理类': 498, '历史类': 515 } },
  '广东省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -12, '历史类': -10 }, controlLine: { '物理类': 532, '历史类': 538 } },
  '江苏省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 8, '历史类': 6 }, controlLine: { '物理类': 516, '历史类': 528 } },
  '河北省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 6, '历史类': 8 }, controlLine: { '物理类': 485, '历史类': 506 } },
  '福建省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -5, '历史类': -4 }, controlLine: { '物理类': 538, '历史类': 530 } },
  '四川省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 5, '历史类': 2 }, controlLine: { '物理类': 535, '历史类': 530 } },
  '河南省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 10, '历史类': 6 }, controlLine: { '物理类': 511, '历史类': 521 } },
  '安徽省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': 2, '历史类': 0 }, controlLine: { '物理类': 514, '历史类': 512 } },
  '陕西省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -10, '历史类': -8 }, controlLine: { '物理类': 475, '历史类': 490 } },
  '重庆市': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -6, '历史类': -5 }, controlLine: { '物理类': 498, '历史类': 508 } },
  '北京市': { mode: '3+3', localMaxScore: 750, tracks: ['物理选考组', '人文历史组'], offset: { '物理选考组': -8, '人文历史组': -10 }, controlLine: { '物理选考组': 524, '人文历史组': 524 } },
  '浙江省': { mode: '3+3', localMaxScore: 750, tracks: ['物化理工组', '政史人文组'], offset: { '物化理工组': 12, '政史人文组': 10 }, controlLine: { '物化理工组': 595, '政史人文组': 595 } },
  '山东省': { mode: '3+3', localMaxScore: 750, tracks: ['物化理工组', '政史人文组'], offset: { '物化理工组': 4, '政史人文组': 0 }, controlLine: { '物化理工组': 520, '政史人文组': 520 } },
  '上海市': { mode: '3+3', localMaxScore: 660, tracks: ['物化理工组', '政史人文组'], offset: { '物化理工组': -95, '政史人文组': -98 }, controlLine: { '物化理工组': 503, '政史人文组': 503 } },
  '天津市': { mode: '3+3', localMaxScore: 750, tracks: ['物化理工组', '政史人文组'], offset: { '物化理工组': 2, '政史人文组': -2 }, controlLine: { '物化理工组': 563, '政史人文组': 563 } },
  '山西省': { mode: '新高考', localMaxScore: 750, tracks: ['物理类', '历史类', '理科', '文科'], offset: { '物理类': -10, '历史类': -10, '理科': -10, '文科': -10 }, controlLine: { '物理类': 506, '历史类': 516, '理科': 506, '文科': 516 } },
  '辽宁省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -8, '历史类': -8 }, controlLine: { '物理类': 510, '历史类': 512 } },
  '吉林省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -14, '历史类': -12 }, controlLine: { '物理类': 485, '历史类': 498 } },
  '黑龙江省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -16, '历史类': -14 }, controlLine: { '物理类': 480, '历史类': 495 } },
  '江西省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -4, '历史类': -2 }, controlLine: { '物理类': 520, '历史类': 532 } },
  '广西壮族自治区': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -18, '历史类': -15 }, controlLine: { '物理类': 488, '历史类': 502 } },
  '云南省': { mode: '新高考', localMaxScore: 750, tracks: ['物理类', '历史类', '理科', '文科'], offset: { '物理类': -15, '历史类': -12, '理科': -15, '文科': -12 }, controlLine: { '物理类': 505, '历史类': 550, '理科': 505, '文科': 550 } },
  '贵州省': { mode: '3+1+2', localMaxScore: 750, tracks: ['物理类', '历史类'], offset: { '物理类': -16, '历史类': -14 }, controlLine: { '物理类': 480, '历史类': 505 } }
};

const BASE_GAOKAO_UNIVERSITIES = [
  { name: '清华大学 / 北京大学（顶尖C2）', tier: '顶尖985', sciBase: 688, artBase: 662 },
  { name: '华东五校（复旦/上交/浙大/南大/中科大）', tier: '头部985', sciBase: 664, artBase: 642 },
  { name: '华中科技大学 / 武汉大学', tier: '985双一流', sciBase: 638, artBase: 622 },
  { name: '中山大学 / 厦门大学 / 四川大学', tier: '985名校', sciBase: 626, artBase: 612 },
  { name: '华中师范大学 / 中南财经政法大学 / 武汉理工大学', tier: '部属211', sciBase: 598, artBase: 592 },
  { name: '省属强势 211 / 双一流重点线', tier: '211重点', sciBase: 576, artBase: 572 },
  { name: '省属重点一本公办高校基准线', tier: '重点一本', sciBase: 542, artBase: 545 }
];

export function getGaokaoSchoolsFor(province, track) {
  const meta = GAOKAO_PROVINCES[province] || GAOKAO_PROVINCES['湖北省'];
  const isHumanities = /历史|文科|人文/.test(track || '');
  const off = (meta.offset && meta.offset[track]) ?? 0;
  const maxScore = meta.localMaxScore || 750;
  const scale = maxScore / 750;

  const list = BASE_GAOKAO_UNIVERSITIES.map(u => {
    const raw = isHumanities ? u.artBase : u.sciBase;
    const adj = Math.min(maxScore - 15, Math.round((raw + off) * scale));
    return {
      name: u.name,
      tier: u.tier,
      y1: adj - 3,
      y2: adj,
      y3: adj + 2,
      avg: adj
    };
  });

  const ctrl = (meta.controlLine && meta.controlLine[track]) || Math.round(520 * scale);
  list.push({
    name: `${province}（${track || '基准'}）特控线 / 重点一本参照线`,
    tier: '特控一本线',
    y1: ctrl - 3,
    y2: ctrl,
    y3: ctrl + 2,
    avg: ctrl
  });

  return {
    province,
    track,
    mode: meta.mode,
    localMaxScore: maxScore,
    schools: list
  };
}

// ==================== 3. 艺考分省综合分折算比例 + 目标校 + 倒推引擎 ====================
export const ART_PROVINCE_FORMULAS = {
  '湖北省': { label: '湖北艺考统考综合分公式（文化50% + 专业50% 折算至750制）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '广东省': { label: '广东美术/音乐统考参考（文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '浙江省': { label: '浙江艺术类综合分参考（文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '江苏省': { label: '江苏艺术类（文化折算 + 专业折算，常见50/50或40/60）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '湖南省': { label: '湖南艺考综合分参考（文化30%/50%按院校，默认50/50）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '山东省': { label: '山东艺术类综合分参考（文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '河南省': { label: '河南艺术类综合分（2024+新规文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '四川省': { label: '四川艺术类（常见文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '北京市': { label: '北京艺术统考综合分参考（文化50% + 专业50%）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 },
  '上海市': { label: '上海艺考综合分（文化满分660，常见50/50）', cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 660, majorMax: 300 }
};

export const ART_PRESET_RATIOS = {
  'province_default': { label: '按所选省份默认折算比例', wC: null, wM: null },
  '50_50': { label: '文化 50% + 专业 50%', wC: 0.50, wM: 0.50 },
  '60_40': { label: '文化 60% + 专业 40%（偏文化院校/编导播音）', wC: 0.60, wM: 0.40 },
  '40_60': { label: '文化 40% + 专业 60%（部分美院/音乐校考类）', wC: 0.40, wM: 0.60 },
  'custom': { label: '自定义文化/专业权重比例', wC: null, wM: null }
};

export const ART_SCHOOL_CUTOFFS = [
  { name: '中央美术学院 / 中国美术学院（综合分参照）', tier: '顶尖美院', avgCombined: 595, cultureFloor: 465 },
  { name: '中国传媒大学 / 北京电影学院（偏文化/综合）', tier: '顶尖传媒', avgCombined: 585, cultureFloor: 510 },
  { name: '湖北美术学院 / 四川美术学院（公办重点）', tier: '八大美院', avgCombined: 552, cultureFloor: 415 },
  { name: '武汉音乐学院 / 华师音乐美术类', tier: '重点艺术/211', avgCombined: 545, cultureFloor: 410 },
  { name: '省属公办一本大学艺术学院', tier: '公办一本艺术', avgCombined: 518, cultureFloor: 395 },
  { name: '省内艺术类本科统考投档基准线', tier: '艺术本科线', avgCombined: 475, cultureFloor: 365 }
];

export function calculateArtCultureTarget({
  province = '湖北省',
  preset = 'province_default',
  customCultureWeight = 0.5,
  customMajorWeight = 0.5,
  cultureMax = 750,
  majorMax = 300,
  majorScore = 240,
  targetCombinedScore = 540
}) {
  const provRule = ART_PROVINCE_FORMULAS[province] || { cultureWeight: 0.50, majorWeight: 0.50, cultureMax: 750, majorMax: 300 };
  const cMax = Number(cultureMax) || provRule.cultureMax || 750;
  const mMax = Number(majorMax) || provRule.majorMax || 300;
  const mScore = Math.max(0, Math.min(mMax, Number(majorScore) || 0));
  const combinedTarget = Math.max(0, Number(targetCombinedScore) || 520);

  let wC = provRule.cultureWeight;
  let wM = provRule.majorWeight;
  if (preset === '50_50') { wC = 0.50; wM = 0.50; }
  else if (preset === '60_40') { wC = 0.60; wM = 0.40; }
  else if (preset === '40_60') { wC = 0.40; wM = 0.60; }
  else if (preset === 'custom') {
    const rawC = Math.max(0.1, Number(customCultureWeight) || 0.5);
    const rawM = Math.max(0.1, Number(customMajorWeight) || 0.5);
    const sum = rawC + rawM;
    wC = Number((rawC / sum).toFixed(4));
    wM = Number((rawM / sum).toFixed(4));
  }

  // 标准折算公式：综合分 = 文化分 × wC + (专业分 / 专业满分 × 文化满分) × wM
  const majorConverted750 = (mScore / mMax) * cMax;
  const majorContribution = majorConverted750 * wM;
  const rawRequiredCulture = (combinedTarget - majorContribution) / wC;
  const requiredCultureTarget = Math.max(0, Math.min(cMax, Math.ceil(rawRequiredCulture)));
  const achievable = rawRequiredCulture <= cMax;

  return {
    cultureMax: cMax,
    majorMax: mMax,
    majorScore: mScore,
    cultureWeightPct: Math.round(wC * 100),
    majorWeightPct: Math.round(wM * 100),
    majorConvertedScore: Number(majorConverted750.toFixed(1)),
    majorContribution: Number(majorContribution.toFixed(1)),
    targetCombinedScore: combinedTarget,
    requiredCultureTarget,
    achievable,
    formulaDisplay: `文化最低目标分 = (${combinedTarget} - (${mScore} ÷ ${mMax} × ${cMax}) × ${(wM * 100).toFixed(0)}%) ÷ ${(wC * 100).toFixed(0)}% = ${requiredCultureTarget} 分`
  };
}

// ==================== 4. 建档倒推与全脱产/非脱产排课任务生成引擎 ====================
export function calculateEnrollmentPlan(profile) {
  const isFullTime = profile.studyRhythm === 'full_time';
  const cycleDays = isFullTime ? 1 : Math.max(2, Number(profile.customCycleDays) || 7);
  const hoursPerDay = Math.max(0.5, Number(profile.availableHoursPerDay) || (isFullTime ? 7.5 : 2.5));

  let targetScore = Number(profile.targetCutoffScore) || 0;
  const maxScore = Number(profile.localMaxScore) || (profile.stage === 'junior' ? 680 : 750);
  const baseline = Number(profile.baselineScore) || Math.round(maxScore * 0.65);
  let artCalculation = null;

  if (profile.enrollmentCategory === 'graduation_sprint' && profile.sprintSubType === 'gaokao_art') {
    artCalculation = calculateArtCultureTarget({
      province: profile.province,
      preset: profile.artFormulaPreset || 'province_default',
      customCultureWeight: profile.artCultureWeight,
      customMajorWeight: profile.artMajorWeight,
      cultureMax: maxScore,
      majorMax: profile.artMajorMax || 300,
      majorScore: profile.artMajorScore || 235,
      targetCombinedScore: targetScore || 540
    });
    targetScore = artCalculation.requiredCultureTarget;
  }

  const gap = Math.max(0, targetScore - baseline);
  const reminderMode = isFullTime
    ? '每日全脱产打卡模式：系统每天 08:30 自动推送今日过关任务，20:30 提醒复盘与消灯检测。'
    : `非脱产周期模式：按每 ${cycleDays} 天为一个过关周期动态排课，周末集中清红灯并更新学习趋势。`;

  let dailyTasks = [];
  if (profile.enrollmentCategory === 'graduation_sprint') {
    const sprintTag = profile.sprintSubType === 'zhongkao'
      ? '中考冲刺'
      : (profile.sprintSubType === 'gaokao_art' ? '艺考文化课抢分' : '高考冲刺');
    const dailyFocus = gap > 80
      ? `${sprintTag}高频基础+中档专题双倍清零（优先消灭核心红色考点）`
      : `${sprintTag}压轴微专题突破 + 套卷规范限训`;
    dailyTasks = [
      { id: 't1', title: `【核心消灯】${dailyFocus}`, duration: isFullTime ? '120 分钟' : '50 分钟', priority: '必做' },
      { id: 't2', title: '【手册过关】按 5 项统计字段推进 2 个重点题型，目标错误率压低至 15% 以下', duration: isFullTime ? '90 分钟' : '40 分钟', priority: '必做' },
      { id: 't3', title: '【拍卷测漏 / 错题复测】核验上次标记错题，杜绝同类考点连续错 2 题', duration: isFullTime ? '45 分钟' : '25 分钟', priority: '复盘' }
    ];
  } else {
    const modeLabel = profile.growthSubType === 'advance'
      ? `超前学习 ${profile.advanceSpanWeeks || 4} 周 · 目标难度【${profile.targetDifficulty || '中等'}】· 目标等级【${profile.targetMasteryLevel || '良好'}】`
      : (profile.growthSubType === 'sync_boost'
        ? `同步拔高训练（当前进度巩固 + 【${profile.targetDifficulty || '中等'}】提优题型）`
        : '摸底诊断与查漏补缺（先拍卷扫雷或做摸底测评，定位红黄灯题型）');
    dailyTasks = [
      { id: 't1', title: `【规划主线】${modeLabel}`, duration: isFullTime ? '90 分钟' : '45 分钟', priority: '必做' },
      { id: 't2', title: '【题型手册】完成本阶段对应目录 1~2 个知识点过关打卡', duration: isFullTime ? '60 分钟' : '35 分钟', priority: '必做' },
      { id: 't3', title: '【复盘档案】登记错题讲解次数并更新红黄绿灯状态', duration: '20 分钟', priority: '复盘' }
    ];
  }

  return {
    localMaxScore: maxScore,
    baselineScore: baseline,
    effectiveTargetScore: targetScore,
    scoreGap: gap,
    artCalculation,
    studyRhythm: profile.studyRhythm,
    cycleDays,
    hoursPerDay,
    reminderMode,
    dailyTasks,
    estimatedWeeksToTarget: Math.max(4, Math.min(36, Math.ceil((gap || 30) / (isFullTime ? 12 : 6))))
  };
}

// ==================== 5. 名师诊断话术库（用于精装规划书自动润色生成） ====================
export function generateMasterCommentary({ profile, stats, plan }) {
  const stageName = profile.stage === 'junior' ? '初中阶段' : '高中阶段';
  const targetLabel = profile.targetSchoolName || '目标重点学校';
  const gap = plan ? plan.scoreGap : 0;
  const redCount = stats?.redCount ?? 0;
  const yellowCount = stats?.yellowCount ?? 0;
  const greenCount = stats?.greenCount ?? 0;
  const passRate = stats?.passRatePct ?? 0;

  const urgency = redCount >= 5
    ? '当前红色预警考点偏多，建议立即暂停无差别刷套卷，集中 1~2 个周期优先完成【专属消灯任务包】。'
    : (redCount > 0
      ? '核心短板已精准锚定在少量红灯题型中，通过“讲义溯源 + 同题型变式 3 题”即可在短期内由红转黄乃至转绿。'
      : '基础与中档题型未触发红灯警报，下一阶段应重点推进黄灯巩固与压轴突破题型。');

  const gapAdvice = profile.enrollmentCategory === 'graduation_sprint'
    ? `结合 ${profile.province || ''}${profile.city || ''}地区参考满分 ${plan?.localMaxScore || '--'} 分及【${targetLabel}】近三年平均录取线口径，学员当前距目标文化课基准（${plan?.effectiveTargetScore || '--'} 分）尚有约 ${gap} 分提分空间。`
    : `学员当前处于${stageName}非毕业班同步成长阶段，建议以考点过关手册为锚点，保持稳步推进。`;

  const rhythmNote = profile.studyRhythm === 'full_time'
    ? '鉴于当前采用【全脱产节奏】，每日可固定 3 段高质量过关时段，务必坚持“当日红灯当日建包、次日复测消灯”。'
    : `鉴于当前采用【非脱产节奏（每 ${plan?.cycleDays || 7} 天周期）】，课余时间贵在精准，切忌盲目题海战术，请优先锁定拍卷测漏暴露的高频错因题型。`;

  return [
    `一、学情总评与目标定位：${gapAdvice}`,
    `二、考点红黄绿灯诊断：截至本报告生成时，在已建档核心模块中累计绿灯已过关 ${greenCount} 项、黄灯巩固中 ${yellowCount} 项、红灯未过关 ${redCount} 项（当前总体过关率 ${passRate}%）。${urgency}`,
    `三、铭师下阶段行动方案：${rhythmNote} 建议家长定期在平台录入月考/期中/期末成绩，配合本工作室《考点过关手册》持续追踪提分斜率。`
  ].join('\n\n');
}

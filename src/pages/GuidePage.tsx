// ============================================================
// 使用说明（/guide）：每个功能在哪里、能做什么、怎么用，每个都配一个例子
//   - 每一节可以展开 / 收起
//   - 每一节有「我测过了」，方便在电脑上逐个测试，进度存在手机（或电脑浏览器）里
//   - 以后加了新功能，在下面的 SECTIONS 里加一节就行
// ============================================================

// 引入 React 钩子
import { useState } from 'react'
// 引入路由
import { Link, useNavigate } from 'react-router-dom'
// 引入实时查询
import { useLiveQuery } from 'dexie-react-hooks'
// 引入数据库
import { db } from '../db/db'
// 引入图标
import { Icon, type IconName } from '../components/Icon'

// 一节说明
interface Section {
  // 唯一 ID（记录“测过了”用）
  id: string
  // 图标
  icon: IconName
  // 标题
  title: string
  // 一句话概括（收起时显示）
  summary: string
  // 在哪里打开
  where: string
  // 能做什么
  what: string[]
  // 怎么用（按步骤）
  steps: string[]
  // 分阶段的步骤（只有「完整例子」用；有它时不显示上面两项）
  phases?: Phase[]
  // 例子（一个具体的使用场景）
  example: string[]
  // 小提示（可选）
  tip?: string
  // 「去试试」跳转的页面（可选）
  link?: { to: string; label: string }
}

// 「完整例子」的一个阶段
interface Phase {
  // 阶段名称
  title: string
  // 什么时候做
  when: string
  // 这个阶段的步骤（可以带一个跳转按钮）
  steps: { text: string; link?: { to: string; label: string } }[]
}

// 完整例子：明年 4 月去意大利（米兰、佛罗伦萨、罗马），从一个想法到一本旅行手册和相册
const ITALY: Phase[] = [
  {
    title: '有了想法',
    when: '出发前 2–3 个月',
    steps: [
      {
        text: '新建旅行：「更多 → 我的旅行」（或点首页左上角的卡片）→「新建旅行」→ 名称填「Italia」，副标题「Printemps 2027」，出发日期先选「待定」→「新建并添加目的地」。App 会自动切换到这次旅行；圣诞旅行和它的照片都还在「我的旅行」里。',
        link: { to: '/trips', label: '我的旅行' },
      },
      { text: '加城市：「本次旅行」→「添加目的地」→ 搜索 Milano → 类型选「住宿城市」，住 3 晚 → 保存。再加 Firenze（3 晚）、Roma（4 晚）。顺序不对就用上移 / 下移。', link: { to: '/trip', label: '本次旅行' } },
      { text: '加机场：「添加目的地」→ 搜索 Amsterdam Schiphol → 类型选「只是路过」，用上移放到 Groningen 后面；回程也加一个，放在 Roma 后面。两地之间会自动出现交通。' },
      { text: '定日期：「本次旅行」最上面「基本信息」→ 出发日期选「已定」→ 选 2027 年 4 月 10 日。每个城市的日期、每一天的星期都会自动算好，改住几晚也会自动顺延。' },
      { text: '定预算：底部「预算」→ 右上角「设置预算」，例如 €1,200；再点各个分类填计划（交通、住宿、餐饮…）。', link: { to: '/budget', label: '预算' } },
    ],
  },
  {
    title: '订机票、火车和住宿',
    when: '出发前 1–2 个月',
    steps: [
      { text: '城市之间怎么走：在「本次旅行」里点 Milano → Firenze 之间的交通 →「Google Maps 查车次」看有哪些车；或者「自己添加方式」：运营商填 Trenitalia、时长「约 2 小时」、贴上订票链接。订好后点「选这个」，再把「是否已订票」切到「已订票」。' },
      { text: '录入机票：Amsterdam → Milano 那段交通上点「机票截图」→ 选航班确认邮件的截图 → 填航空公司、航班号、起飞和到达时间 → 勾选「同时把这段交通标记为已订」。机票会出现在「票夹」，检票时可以全屏显示。' },
      { text: '选住宿：在每个城市下面点「添加住宿」（或城市详情「酒店」→「自己添加」）→ 搜索青旅名字 → 先都当「候选」，在城市「地图」里比较位置 → 订好的那家改成「已预订」并上传订房截图 → 点「隐藏其余候选」。' },
      {
        text: '景点推荐，两种方式：① 自己找：城市详情「景点」→「自己添加」，或在「地图」里搜索（例如 Duomo di Milano、Galleria degli Uffizi、Colosseo）；② 找 Claude：把城市告诉 Claude，请它像圣诞行程一样调研门票、开放时间和节假日，写进推荐内容包。你下次打开 App，推荐会按位置自动出现在你的 Milano / Firenze / Roma 里，不会覆盖你自己加的。',
      },
    ],
  },
  {
    title: '安排每一天',
    when: '出发前 2 周',
    steps: [
      { text: '每天去哪：城市详情「日程」点某一天（或「今日旅程」→「后一天」切过去）→「从景点添加」选当天要去的地方 →「顺路排序」→ 填时间。每两站之间显示步行几分钟，远的还会显示坐哪路公交。' },
      { text: '想去的小店：「地图」里搜索店名 → 放图钉 → 拖动调整位置 →「存到日程」→ 选那一天 →「追加到后面」。', link: { to: '/map', label: '地图' } },
      { text: '市内交通：城市详情「交通」→「你可能感兴趣」点 Milano Malpensa，直接查到机场到住处的火车 →「添加到我的交通」；再查 住处 → Duomo 也加进来，按住六个点拖动排好顺序。下面「车票」写着单程、一日票多少钱、在哪里买。' },
    ],
  },
  {
    title: '出发前',
    when: '出发前一两天',
    steps: [
      { text: '生成旅行手册：「本次旅行」→「生成旅行手册」：路线、机票和交通、住宿、每日安排、景点、相册都在一页。检查机票和住宿是不是都显示「已订」，再「打印 / 存成 PDF」发给家人。', link: { to: '/carnet', label: '旅行手册' } },
      { text: '备份：「更多 → 备份与恢复 → 导出备份」，存到「文件」或发给自己。', link: { to: '/backup', label: '备份' } },
      { text: '看天气：每个城市的「天气」标签，住在那里的日期标着「在这里」，按天气准备衣服、调整哪天去室内景点。' },
      { text: '离线地图：在 Wi-Fi 下把每个城市住处附近、要去的景点附近放大看一遍，到了没网也能看。' },
    ],
  },
  {
    title: '旅途中',
    when: '每天',
    steps: [
      { text: '早上打开「今日旅程」：今天去哪、几点、怎么走 →「App 内导航」逐路口带路，或「Google Maps」。', link: { to: '/today', label: '今日旅程' } },
      { text: '上车 / 登机：「票夹」→ 点车票 →「全屏显示车票」。' },
      { text: '花了钱：「预算」→「记一笔」，币种默认是当地货币（意大利是欧元）。' },
    ],
  },
  {
    title: '回来以后',
    when: '旅行结束',
    steps: [
      { text: '上传照片：城市详情「相册」→「上传照片」→ 一次选这个城市拍的所有照片 →「自动整理」。带位置的照片会自动归到 Duomo、Uffizi 这些景点，其余按日期放进「Promenade（城市漫步）」，自动排成杂志一样的相册。' },
      { text: '整理：「整理」把没归类的照片归到景点；看大图时点「设为封面」；每一章「写一句话」，像杂志引言。' },
      { text: '以后回味：「城市」最下面「去过的城市」，或「我的旅行」里点回这次旅行，随时能看。', link: { to: '/cities', label: '城市' } },
    ],
  },
]

// 全部说明（按使用顺序排列）
const SECTIONS: Section[] = [
  // ---------- 0. 在电脑上测试 ----------
  {
    id: 'desktop',
    icon: 'gear',
    title: '在电脑上测试',
    summary: '鼠标怎么代替手指、怎么看手机效果',
    where: '电脑浏览器（推荐 Chrome 或 Edge）打开 https://frenkiewoo-dot.github.io/Travel/',
    what: [
      '电脑屏幕比较宽，App 会显示成屏幕中间一个手机宽度的窗口，看到的和手机上基本一样',
      '电脑上的数据存在这台电脑的浏览器里，和以后手机上的数据是分开的',
      '这份说明的每一节下面都有「我测过了」，可以一边测一边打勾',
    ],
    steps: [
      '「点」= 鼠标单击；「拖动」= 按住鼠标左键拖',
      '「长按地图」= 在地图上单击鼠标右键（放图钉用）',
      '旋转、倾斜地图：按住鼠标右键拖动，或按住 Ctrl 再用左键拖；缩放用滚轮',
      '定位：浏览器会问「是否允许使用你的位置」，点允许。电脑是按网络估算位置的，可能偏几百米，这是正常的',
      '想更像手机：Chrome 按 F12 → 点左上角的手机图标（设备模拟）→ 选 iPhone 14 Pro Max，鼠标就变成了“手指”',
      '测完想回到初始状态：浏览器设置 → 隐私 → 网站数据 → 删除这个网站的数据，再刷新（会回到初始示例数据）',
    ],
    example: [
      '测试票夹：电脑上随便找一张截图当作车票 → 底部「票夹」→「添加车票」→ 选这张图、关联「格罗宁根 → 阿姆斯特丹机场」→ 保存 → 打开它点「全屏显示车票」。',
      '测完点车票页底部的「删除」就行。',
    ],
    tip: '电脑上整理好的数据想带到手机上：电脑「导出备份」→ 把文件发到手机 → 手机上「从备份恢复」（见「备份与恢复」一节）。',
  },
  // ---------- 完整例子 ----------
  {
    id: 'example',
    icon: 'sparkle',
    title: '完整例子：明年 4 月去意大利',
    summary: '米兰 → 佛罗伦萨 → 罗马，从一个想法到旅行手册和相册',
    where: '整个 App。下面按时间分成 6 个阶段，每一步都写了点哪里',
    what: [],
    steps: [],
    phases: ITALY,
    example: [
      '最后你会得到：一本「旅行手册」——一页看完整个行程：每段机票和火车（航班号、时间、已订）、每个城市住哪、每天几点去哪、每个城市值得去的景点和节假日提醒；',
      '回来以后，每个城市还有一本按景点分章、自动排版的相册，在「城市」和「我的旅行」里随时能打开。',
    ],
    tip: '电脑上就可以把这个例子完整走一遍：建一个「Italia」旅行试试，试完在「我的旅行」里删掉就行，不影响圣诞旅行。',
    link: { to: '/trips', label: '从「我的旅行」开始' },
  },
  // ---------- 1. 首页 ----------
  {
    id: 'home',
    icon: 'trip',
    title: '首页（行程）',
    summary: '整条路线的大地图、每个目的地',
    where: '底部导航第一个「行程」',
    what: [
      '整屏真实地图：整条路线（火车 / 大巴是实线，飞机是点线）、每个城市、你的位置（蓝点）',
      '左上角：还有几天出发 / 今天是旅途第几天；点它打开「我的旅行」，可以切换或新建旅行',
      '右上角：「今日旅程」「未来旅程」两个按钮',
      '底部卡片：按顺序列出每个目的地（日期、住几晚、住宿状态），城市多的时候左右滑动（电脑上可以用鼠标拖、滚轮或点 ‹ ›），下面的小圆点表示看到第几个',
      '长按地图上的路线（飞机点线、火车实线）约半秒：手指下面的圆圈转满后，直接打开那段交通的机票 / 车票和详细信息',
      '右下角三个圆按钮：指南针（回到正北）、3D / 平面切换、回到我的位置',
    ],
    steps: [
      '点地图上的城市（或卡片里的城市）：地图飞过去，放大到街道，倾斜成 3D，景点建筑染成淡金色',
      '城市卡片里点景点名字：地图移到那个景点',
      '点「酒店 · 景点 · 日程」进入城市详情',
      '点「全览」回到整条路线',
      '点卡片顶部的小横条，可以收起 / 展开卡片，看到更多地图',
      '长按路线：按住哥本哈根到斯德哥尔摩之间的点线，圆圈转满就打开那段航班（电脑上按住鼠标左键）',
    ],
    example: [
      '想看新港周围长什么样：首页点「哥本哈根」→ 地图飞到市中心 → 卡片里点「Nyhavn」→ 地图移过去，周围建筑是 3D 的；按住右键拖动可以转一圈看。',
    ],
    link: { to: '/', label: '去首页' },
  },
  // ---------- 2. 今日旅程 / 每一天 ----------
  {
    id: 'day',
    icon: 'sun',
    title: '今日旅程 / 每一天的日程',
    summary: '当天去哪些地方、怎么走、要多久',
    where: '首页右上角「今日旅程」；或在「未来旅程」、城市详情「日程」里点某一天',
    what: [
      '当天的地点按顺序编号显示在地图上，沿真实街道画出步行路线',
      '每两站之间显示步行时间和距离；步行超过 15 分钟时，还会显示公交大概要多久、坐哪条线',
      '交通日会显示当天的航班 / 火车（是否已订、有没有车票）',
      '平安夜、圣诞节会有提醒（商店早关门、公交班次少）',
      '还没出发时，「今日旅程」先显示旅途第一天；出发后自动切换成当天',
    ],
    steps: [
      '「前一天」「后一天」切换日期',
      '点每一站左边的「时间」，填几点去',
      '用每站右边的 上移 / 下移 / × 调整顺序或删除',
      '「从景点添加」：从这个城市的景点清单里挑',
      '「在地图上编辑」：跳到地图，用搜索或图钉添加任何地方，改完点顶部的「完成」',
      '「顺路排序（第 1 站不动）」：自动排成走路最少的顺序',
      '出发：「App 内导航」（逐路口指引）或「Google Maps」（把所有站一次传过去）',
    ],
    example: [
      '安排 12/22（旅途第 3 天）在哥本哈根：进入那一天 →「从景点添加」依次点「Rosenborg Slot」「Rundetaarn」「Nyhavn」→ 点「顺路排序」→ 第一站时间填 10:00。',
      '这时能看到每段要走几分钟；如果某段超过 15 分钟，会多一行“公交约 … 分钟（线路）”。',
    ],
    link: { to: '/today', label: '去今日旅程' },
  },
  // ---------- 3. 未来旅程 ----------
  {
    id: 'upcoming',
    icon: 'arrowRight',
    title: '未来旅程',
    summary: '之后每一天在哪、做什么',
    where: '首页右上角「未来旅程」',
    what: ['小地图显示还没走的路线', '按天列出之后每一天：在哪个城市、当天的交通、安排了几个地点'],
    steps: ['点某一天：进入那天的日程', '点某段交通：进入交通详情（看可选方式、是否已订、车票）'],
    example: ['出发前一周打开看一眼：哪几天还写着「还没安排」，就知道还要计划哪几天。'],
    link: { to: '/upcoming', label: '去未来旅程' },
  },
  // ---------- 4. 本次旅行 ----------
  {
    id: 'trip',
    icon: 'plane',
    title: '本次旅行（目的地、住宿、机票）',
    summary: '按时间顺序排目的地，填住宿和机票',
    where: '首页底部卡片「本次旅行」；或「更多 → 本次旅行」',
    what: [
      '按时间顺序排目的地：出发 / 中转机场 / 住宿城市 / 回家',
      '每个住宿城市：住几晚、住在哪（可以附上订房截图）',
      '两个目的地之间的交通：航班号 / 车次、起飞和到达时间、机票截图',
      '把城市移出本次旅行（资料保留在「以后想去」），或者再加回来',
      '基本信息：旅行名称、出发日期、人数',
    ],
    steps: [
      '改住几晚：点城市右边的 − / +；后面所有日期和每天的日程会自动跟着挪',
      '调顺序：上移 / 下移',
      '添加目的地：「添加目的地」→ 搜索城市 → 选类型（住宿城市 / 只是路过 / 出发·回家 / 以后去）',
      '添加住宿：城市下面「添加住宿」→ 填名称、搜索地址（或在小地图上点）→ 状态选「已预订」→ 保存；然后可以上传订房截图',
      '填机票：两个城市之间的交通上点「机票截图」→ 上传截图，填航空公司、航班号、起飞 / 到达时间 → 勾选「同时把这段交通标记为已订」',
      '移出本次旅行：城市右边的 × → 它会移到页面下方「以后想去」；点「加入本次旅行」可以加回来',
    ],
    example: [
      '录入哥本哈根 → 斯德哥尔摩的航班：在两个城市之间的交通上点「机票截图」→ 选航班确认邮件的截图 → 航空公司填 SAS、航班号填你的真实航班号（格式像 SK1234）、填起飞和到达时间 → 保存。',
      '之后票夹、首页、那一天的日程都会显示这班飞机和截图。',
    ],
    tip: '航班号、订单号、住处这些个人信息只存在你自己的设备里，不会出现在代码仓库。',
    link: { to: '/trip', label: '去本次旅行' },
  },
  // ---------- 我的旅行 ----------
  {
    id: 'trips',
    icon: 'plane',
    title: '我的旅行（多次旅行）',
    summary: '新建、切换旅行；以前的旅行一直保留',
    where: '「更多 → 我的旅行」；首页左上角的卡片；「本次旅行」右上角「切换 / 新建旅行」',
    what: [
      '列出所有旅行：封面用那次旅行的照片，显示日期、城市、照片张数，以及「当前 / 还有几天 / 旅行中 / 已结束 / 日期待定」',
      '「当前旅行」决定首页、今日旅程、票夹、预算显示哪一次；城市页和相册可以打开任何一次旅行的城市',
      '新建旅行：只要名称，日期可以待定；出发和回家的城市沿用当前旅行的',
      '删除整次旅行：先确认一次，然后放进「更多 → 已删除的旅行」，里面的东西都还在，可以恢复',
    ],
    steps: [
      '新建：「新建旅行」→ 填名称、副标题、出发日期、人数 →「新建并添加目的地」→ 自动切换过去并打开「本次旅行」',
      '切换：点一次旅行的卡片（或「切换到这次」）→ 回到首页',
      '删除：卡片右下角「删除」，或「本次旅行 → 基本信息 → 删除这次旅行」→ 会问「你确定要删除此次旅行的全部内容吗？」→ 确定后放进「已删除的旅行」，还能恢复',
    ],
    example: ['圣诞旅行回来后开始计划意大利：「我的旅行」→「新建旅行」→ Italia。之后想看哥本哈根的照片：「城市」最下面「去过的城市」点哥本哈根，或者在「我的旅行」里点回圣诞旅行。'],
    link: { to: '/trips', label: '去我的旅行' },
  },
  // ---------- 已删除的旅行 ----------
  {
    id: 'trash',
    icon: 'trash',
    title: '已删除的旅行',
    summary: '删掉的旅行先放在这里，可以恢复',
    where: '「更多 → 已删除的旅行」；「我的旅行」最下面',
    what: [
      '删除旅行时先问一次「你确定要删除此次旅行的全部内容吗？」，防止误按',
      '删掉的旅行放在这里：城市、住宿、机票和车票文件、日程、花费、照片都还在',
      '点进去：最上面两个按钮「恢复」「彻底删除」，下面是当时保存的全部内容（和旅行手册一样）',
      '「彻底删除」会再确认一次，删了就找不回来',
    ],
    steps: ['在「我的旅行」或「本次旅行」里删除一次旅行 → 确定', '「更多 → 已删除的旅行」→ 点这次旅行', '看一下内容，点「恢复」回到「我的旅行」；确定不要了点「彻底删除」'],
    example: ['不小心删了圣诞旅行：「更多 → 已删除的旅行」→ 点「København & Stockholm」→「恢复」，车票和照片都还在。'],
    link: { to: '/trash', label: '去已删除的旅行' },
  },
  // ---------- 5. 城市 ----------
  {
    id: 'cities',
    icon: 'city',
    title: '城市',
    summary: '按国家列出所有城市',
    where: '底部导航「城市」',
    what: [
      '本次旅行的城市，按国家分组，带日期和住宿状态（未订 / 已选定 / 已订）',
      '「以后想去」的城市（例如柏林），资料都保留着',
      '有照片的城市左边显示相册封面小图；「去过的城市」列出以前旅行里拍过照片的城市',
    ],
    steps: ['点任何一个城市，进入城市详情（有照片的城市直接打开相册）'],
    example: ['想翻翻柏林的资料：「城市」最下面「以后想去」→ 点「柏林」→ 推荐青旅、圣诞市场、景点都还在，以后去的时候直接用。'],
    link: { to: '/cities', label: '去城市' },
  },
  // ---------- 6. 城市详情 ----------
  {
    id: 'city',
    icon: 'bed',
    title: '城市详情：酒店 / 景点 / 日程 / 交通 / 地图 / 相册 / 天气',
    summary: '一个城市的全部资料',
    where: '「城市」里点一个城市；或首页城市卡片里「酒店 · 景点 · 日程」',
    what: [
      '「酒店」：候选住宿，状态分 候选 / 已选定 / 已预订；选好以后可以一键隐藏或删除其余候选',
      '「景点」：景点、圣诞市场、购物街、车站；门票、开放时间、建议游玩时长；红色框是 12/24–26 的节日提醒',
      '「日程」：在这个城市的每一天安排了什么',
      '「交通」：节假日提醒、你可能感兴趣、查路线、我的交通（见「市内交通」一节）、机场和车站怎么进城、车票价格和在哪里买、推荐 App、小贴士、我的笔记',
      '「地图」：住宿和景点用不同图标，已选定的会高亮',
      '「相册」：这个城市的照片（见「相册」一节）',
      '「天气」：今天和未来天气（见「天气」一节）',
      '带虚线框「推荐 · 需核实」的是我调研填的；价格和开放时间出发前请点「官网」再确认',
    ],
    steps: [
      '点一张卡片展开：看详情、切换状态、看地图、导航、加入日程、编辑；底部有「官网」「信息来源」和删除',
      '自己添加：列表右上角「自己添加」→ 填名称 → 搜索地址或在小地图上点位置 → 填价格等 → 保存',
      '选定住宿：把住宿卡片的状态改成「已选定」或「已预订」→ 上面会出现「隐藏其余候选」「全部删除」',
      '景点卡片里「加入日程」→ 选哪一天',
      '「交通」标签最下面「我的笔记」可以随手记（例如买了什么票、住处最近的地铁站）',
    ],
    example: [
      '斯德哥尔摩 12/25 想去博物馆：「景点」标签里看红色提醒——瓦萨沉船博物馆 12/25 往年闭馆，北欧民俗博物馆（Nordiska museet）写着圣诞期间每天开放。',
      '展开「Nordiska museet」→「加入日程」→ 选 12/25 那天。',
    ],
    link: { to: '/city/stop-stockholm', label: '去斯德哥尔摩' },
  },
  // ---------- 相册 ----------
  {
    id: 'album',
    icon: 'camera',
    title: '相册',
    summary: '每个城市一本自动排版的相册',
    where: '城市详情的「相册」标签（「城市」里点有照片的城市会直接打开）',
    what: [
      '封面：一张大图 + 城市名，像杂志封面（可以自己选封面）',
      '按景点分章：照片带位置信息的，自动归到 300 米内最近的景点；其余按日期放进「Promenade（城市漫步）」',
      '每一章自动换版式，不是一排排的方格：单张大图、一大两小、错落的两张竖图、叠放的照片、四张大小交错的拼图、横滑轮播（像 Instagram 多图帖子）、拍立得、两列错落的照片堆',
      '每一章可以「写一句话」，像杂志引言一样显示在标题下面',
      '看大图：左右滑动（电脑上用 ← → 键或两边的箭头）、点一下放大、写说明、换景点、设为封面；右上角的 × 删除这张照片（会先确认），左上角「相册」返回',
      '「整理」：多选照片，一起归到某个景点、设封面或删除',
    ],
    steps: [
      '「上传照片」→ 从相册选照片（可以一次选很多张）',
      '选「放在哪里」：自动整理（推荐）/ 都是在同一个地方拍的（再选景点）/ 都放进城市漫步',
      '点「添加 N 张」，等它处理完（缩小照片、读拍摄时间和地点）',
      '往下滑欣赏；点任何一张看大图',
      '没归对的：看大图时点「换个景点」，或者用「整理」多选后「归到…」',
    ],
    example: [
      '从哥本哈根回来：「城市 → 哥本哈根 → 相册 → 上传照片」，一次选 30 张 →「自动整理」。',
      '在新港拍的 5 张成了一章「Nyhavn」（一张大图 + 四张拼图），Tivoli 的 7 张是一张大图加一个横滑轮播，没有位置信息的照片按日期成了「Promenade」的拍立得。再点最喜欢的一张「设为封面」。',
    ],
    tip: '照片缩小后保存（长边 2048 像素，看大图足够清楚），原图还在手机相册里，不会被改动。手机上传时如果去掉了位置信息，就用「整理」手动归类。电脑上测试可以用任何 JPG 照片。',
    link: { to: '/city/stop-copenhagen?tab=album', label: '去哥本哈根的相册' },
  },
  // ---------- 市内交通 ----------
  {
    id: 'citytransport',
    icon: 'bus',
    title: '市内交通：查路线、我的交通',
    summary: '机场进城、市内怎么坐车，存下来排好顺序',
    where: '城市详情的「交通」标签',
    what: [
      '你可能感兴趣：根据这次怎么来、怎么走自动推荐，例如坐飞机来 →「下飞机后：从机场到住处」，坐火车走 →「离开时：从住处去车站」；点机场或车站的名字就直接查好路线',
      '查路线：起点、终点可以搜索（只搜这个城市附近），也可以点住处、市中心、机场、车站；选日期和时间 →「搜索路线」，列出几种方案：几点出发、几点到、要多久、换乘几次、每一段坐什么线（例如 RE51 Trenord、地铁 M2）',
      '我的交通：喜欢的方案点「添加到我的交通」存下来；按住左边的六个点上下拖，调整先后顺序；× 删除；点开看每一段怎么坐',
      '车票：单程票、一日票 / 通票的价格和「在哪里买」（售票机、烟草店、官方 App、直接刷卡）；机场和车站怎么进城',
      '有整理好指南的城市：哥本哈根、斯德哥尔摩、柏林、米兰、佛罗伦萨、罗马（新建旅行里的这些城市也会自动用上）；其他城市会给出查票价的链接',
    ],
    steps: [
      '打开城市详情 →「交通」标签',
      '「你可能感兴趣」里点一个机场或车站，路线会自动查好；或者在「查路线」里自己选起点终点',
      '在结果里选一个方案 →「添加到我的交通」',
      '「我的交通」里按住六个点拖动，把先坐的放上面',
      '查不到时（太远、太晚、时刻表还没出）可以点「在 Google Maps 里查这段」',
    ],
    example: [
      '在「Italia」旅行里，米兰的到达方式是飞机：打开米兰 →「交通」→「你可能感兴趣：下飞机后，从机场到住处」→ 点 Milano Malpensa → 查到 Malpensa Express（RE51，约 1 小时，直达）→「添加到我的交通」。',
      '再在「查路线」里查 住处 → Duomo，也添加进来；按住六个点把它拖到第二个。往下看「车票」：单程 €2.20、24 小时票 €7.60，可以在地铁站售票机、烟草店或者直接刷银行卡。',
    ],
    tip: '公交时刻表一般只提前公布几个月，太远的日期可能查不到，可以先选一个最近的日期看大概的路线和用时。',
    link: { to: '/city/stop-copenhagen?tab=transport', label: '去哥本哈根的交通' },
  },
  // ---------- 天气 ----------
  {
    id: 'weather',
    icon: 'sun',
    title: '天气',
    summary: '今天和未来十几天的天气',
    where: '城市详情的「天气」标签（在「相册」旁边）',
    what: [
      '今天（按手机上的日期）：现在几度、体感、晴 / 多云 / 雨 / 雪、最高最低、降水概率、风、湿度、日出日落',
      '接下来 24 小时：每小时的天气和温度（左右滑动）',
      '未来天气：一直显示到有预报的最后一天（一般 16 天），每天的最低—最高温度条、降水概率；住在这个城市的那几天标着「在这里」；点一天看降水量、风速、日出日落',
      '这个国家的官方天气网站（例如丹麦 DMI、瑞典 SMHI、意大利 Aeronautica Militare），还有 Yr',
      '看过的天气会存在设备里，断网时也能看到上次的预报',
    ],
    steps: ['打开城市详情 →「天气」', '往下滑看未来天气；点某一天看详情', '想看更详细的：点官方天气网站', '要最新的：点最下面的「刷新」'],
    example: ['出发前一周：打开「斯德哥尔摩 → 天气」，看到 12/25 那行标着「在这里」，最高 -1°、有雪 → 记得带厚外套和防滑的鞋。'],
    link: { to: '/city/stop-copenhagen?tab=weather', label: '去哥本哈根的天气' },
  },
  // ---------- 7. 城际交通 ----------
  {
    id: 'segment',
    icon: 'train',
    title: '城际交通',
    summary: '两个城市之间怎么走、订了没有',
    where: '「本次旅行」里两个城市之间的交通；票夹的分组标题；日程里交通日的交通卡片',
    what: [
      '可选方式：运营商、路线、时长、价格、班次、订票链接、节日提醒、信息来源',
      '选定一种方式；标记「已订票」；添加车票',
      '自己添加方式；用 Google Maps 查车次',
      '「我的安排」：交通方式、出发时间、备注',
    ],
    steps: ['比较几种方式，点「订票 / 查询」去官网', '决定后点「选这个」', '订好后「是否已订票」切到「已订票」', '「添加车票」上传车票（会存进票夹）'],
    example: [
      '格罗宁根 → 阿姆斯特丹机场：看 NS 火车那一项 → 点「订票 / 查询」去 NS 买票 → 回来点「选这个」→「是否已订票」切到「已订票」→「添加车票」上传电子票。',
    ],
    link: { to: '/trip', label: '去本次旅行找交通' },
  },
  // ---------- 8. 地图 ----------
  {
    id: 'map',
    icon: 'map',
    title: '地图：搜索、图钉、路线',
    summary: '搜地方、放图钉、连成步行路线、存进日程',
    where: '底部导航「地图」',
    what: [
      '搜索店铺、景点、地址',
      '放任意多个图钉，自动按顺序连成步行路线（显示总时间和距离）',
      '图钉可以拖动、改名、排序、删除；一键顺路排序',
      '把图钉存成某一天的日程；直接开始导航',
    ],
    steps: [
      '搜索：顶部输入（例如 Fotografiska）→ 点结果 →「放图钉」。只搜地图当前看到的范围（至少方圆 15 公里），按距离排序，右边显示多远；不会冒出别的国家的同名店',
      '搜不到（有些小店地图数据里还没有）：点「在 Google Maps 里搜」找到它，再回来在那个位置长按放图钉；也可以「搜索全部地区」，或者直接输入坐标（例如 45.4642, 9.19）',
      '放图钉的其他方法：把右边写着「拖我」的图钉拖到地图上；长按地图（电脑上：右键单击）；点地图上的店铺名字 →「放图钉」；只点一下「拖我」= 在地图中心放一个',
      '调整：直接拖动地图上的图钉；点底部「列表」展开 → 改名 / 上移 / 下移 / 删除',
      '「顺路排序」：第 1 个不动，其余排成最顺路的顺序',
      '「存到日程」→ 选哪一天 →「追加到后面」或「替换原有安排」',
      '「开始导航」：进入导航页',
    ],
    example: [
      '在斯德哥尔摩逛动物园岛（Djurgården）：搜「Vasamuseet」放图钉 → 再搜「Nordiska museet」「ABBA The Museum」各放一个 →「顺路排序」→「存到日程」选 12/26 →「追加到后面」。',
    ],
    link: { to: '/map', label: '去地图' },
  },
  // ---------- 9. 导航 ----------
  {
    id: 'nav',
    icon: 'navigate',
    title: '导航（App 内 / Google Maps）',
    summary: '逐路口步行导航，带中文语音',
    where: '地图底部「开始导航」；或日程里「App 内导航」',
    what: [
      '顶部大字：下一个怎么拐、在前方第几个路口、进入哪条街；下面一行“然后…”',
      '底部：你现在在哪条街、到下一站还要多久、全程还剩多远',
      '地图跟着你走、朝向前进方向；偏离路线会自动重新规划；到站提示',
      '中文语音播报；导航时屏幕常亮',
      '「模拟行走」：不用出门，从第 1 个地点出发按 6 倍速走一遍，预览效果',
    ],
    steps: [
      '「从我的位置出发」：真实导航（需要定位，而且离第 1 个地点要在步行距离内）',
      '「模拟行走（从第 1 个地点出发，预览效果）」：电脑上测试用这个',
      '导航中：喇叭按钮开关语音；列表按钮看全部步骤；暂停 / 继续模拟；「结束」',
      '坐公交：「用 Google Maps 查公交」（会把所有地点传给 Google Maps）',
    ],
    example: [
      '在电脑上试：「地图」里放 3 个图钉 →「开始导航」→「模拟行走」→ 看顶部提示一步步变化，打开语音能听到“在前方第 2 个路口右转”这样的播报。',
    ],
    tip: '语音用的是设备自带的中文语音。电脑上如果没声音，检查系统音量，或者浏览器是否允许这个网站播放声音。',
    link: { to: '/map', label: '去地图放图钉' },
  },
  // ---------- 10. 票夹 ----------
  {
    id: 'tickets',
    icon: 'ticket',
    title: '票夹',
    summary: '车票、机票、订房截图，断网也能看',
    where: '底部导航「票夹」',
    what: [
      '按行程顺序分组：每段交通的车票、住宿凭证、其他（门票等）',
      '支持图片、截图、PDF（PDF 自动转成图片并裁掉白边）',
      '断网也能打开；检票时全屏白底显示二维码',
    ],
    steps: [
      '「添加车票」（或某段交通下面的「还没有车票，点这里添加」）',
      '上传文件（可以多张）→ 填关联的交通、运营商、出发 / 到达时间、车次 / 航班号、座位、订单号、备注',
      '勾选「同时把这段交通标记为已订」',
      '检票：打开车票 →「全屏显示车票」：白底、屏幕常亮、点图片放大，多张用「上一张 / 下一张」；底部大字显示订单号和座位',
    ],
    example: [
      '火车票是 PDF：「添加车票」→ 选 PDF → 自动变成图片 → 关联「格罗宁根 → 阿姆斯特丹机场」→ 保存。上车前打开它点「全屏显示车票」，把屏幕亮度调到最高。',
    ],
    tip: '车票文件只存在设备里。票夹页顶部会提醒你多久没备份了。',
    link: { to: '/tickets', label: '去票夹' },
  },
  // ---------- 11. 预算 ----------
  {
    id: 'budget',
    icon: 'wallet',
    title: '预算',
    summary: '记账、四种货币自动换算成欧元',
    where: '底部导航「预算」',
    what: [
      '已花（换算成欧元）和总预算对比，还剩多少',
      '六个分类（交通 / 住宿 / 餐饮 / 门票 / 购物 / 其他）的计划 vs 实际，超支会提醒',
      '记账可以用换算表里的任何货币，旅途中默认用当地货币',
      '汇率换算表：最上面的是基准（例如 1 欧元），下面每行显示 1 欧元等于多少人民币、港币、美元、丹麦克朗…；点货币代码换成别的货币（点最上面的就是换基准），× 删除，「添加货币」加新的；「更新汇率」获取欧洲央行最新的参考汇率；数字也可以手动改',
    ],
    steps: [
      '设总预算：右上角「设置预算」（可以不填、随时改、也能清除）',
      '设分类计划：点某个分类',
      '记一笔：右下角「记一笔」→ 金额、币种、分类、备注、日期 → 保存',
      '改 / 删：点那一笔',
      '汇率换算：页面下方「汇率换算」→「添加货币」选人民币、港币、美元 →「更新汇率」；想以人民币为基准，就点最上面的 EUR 换成 CNY',
    ],
    example: ['在哥本哈根吃了 DKK 85 的午饭：「记一笔」→ 金额 85 → 币种 DKK → 分类「餐饮」→ 备注「午饭」→ 保存。会显示约 €11.4，餐饮的进度条跟着变。'],
    link: { to: '/budget', label: '去预算' },
  },
  // ---------- 旅行手册 ----------
  {
    id: 'carnet',
    icon: 'book',
    title: '旅行手册',
    summary: '整个行程一页看完，可以打印或存成 PDF',
    where: '「本次旅行」→「生成旅行手册」；或「更多 → 旅行手册」',
    what: [
      'I 路线：每个目的地、日期、住几晚',
      'II 机票和交通：航班号 / 车次、时间、是否已订，点开就是车票',
      'III 住宿：每个城市住哪、地址、入住和退房时间，还没订的会标出来',
      'IV 每日安排：每天在哪、几点去哪里、当天的交通、节假日提醒',
      'V 景点：每个城市已选定的景点和推荐，带门票和节假日提醒',
      'VI 相册：每个城市的封面照片',
    ],
    steps: ['打开后往下看；任何一项点进去都能修改', '「打印 / 存成 PDF」：电脑上会打开打印窗口，选「另存为 PDF」；按钮和底部导航不会被打印'],
    example: ['出发前一天：打开旅行手册，检查「机票和交通」每段都是「已订」、「住宿」每个城市都有地方住，再「打印 / 存成 PDF」发给家人。'],
    link: { to: '/carnet', label: '去旅行手册' },
  },
  // ---------- 12. 常用链接 ----------
  {
    id: 'links',
    icon: 'link',
    title: '常用链接',
    summary: '交通、订房、旅游网站的快捷入口',
    where: '「更多 → 常用链接」',
    what: ['内置：交通（NS、SAS、DSB、SJ…）、市内交通、地图、订房、城市旅游、汇率、天气', '「我的链接」：自己添加'],
    steps: ['点链接在新页面打开', '「添加链接」→ 名称 + 网址 → 保存', '点链接右边的 × 删除'],
    example: ['把订房确认页存进来：「添加链接」→ 名称填「青旅预订确认」→ 粘贴确认页网址 → 保存。'],
    link: { to: '/links', label: '去常用链接' },
  },
  // ---------- 13. 备份与恢复 ----------
  {
    id: 'backup',
    icon: 'download',
    title: '备份与恢复',
    summary: '导出全部数据（含车票文件）',
    where: '「更多 → 备份与恢复」',
    what: [
      '导出一个文件：全部旅行、地点、日程、车票图片和 PDF、花费记录、相册照片',
      '照片多时文件会很大，可以取消勾选「包含相册照片」；这种备份恢复时，设备里现有的照片保持不动',
      '从备份恢复（会替换现在的全部数据，恢复前会让你确认）',
    ],
    steps: [
      '「导出备份」：手机上会弹出分享面板，选「存储到文件」或发给自己；电脑上直接下载',
      '「从备份恢复」：选之前导出的文件 → 确认',
    ],
    example: [
      '把电脑上测试整理好的数据搬到手机：电脑「导出备份」→ 把文件发到手机（例如用邮件或 AirDrop）→ 手机打开 App →「从备份恢复」选这个文件。',
    ],
    link: { to: '/backup', label: '去备份与恢复' },
  },
  // ---------- 14. 外观、离线、数据 ----------
  {
    id: 'settings',
    icon: 'moon',
    title: '外观、离线和数据',
    summary: '深色模式、断网能用什么、数据存在哪',
    where: '底部导航「更多」',
    what: [
      '外观：跟随系统 / 浅色 / 深色',
      '离线：App 本身、看过的地图区域、车票都缓存在设备里，断网也能打开；搜索、路线规划、公交时间需要联网（没网时步行路线先用直线估算）',
      '数据：全部只存在这台设备的浏览器里，不上传；代码仓库里没有任何个人数据',
      '推荐内容更新：我以后更新推荐信息，你下次打开 App 会自动合并，不会覆盖你自己改过的内容，你删掉的推荐也不会再出现',
    ],
    steps: ['「外观」里点一个选项，马上生效', '「数据存储」显示是否已开启持久存储（系统不会自动清理）'],
    example: ['出发前在 Wi-Fi 下把每个城市的地图放大看一遍（尤其是住处和常去的地方附近），到了当地没网也能看这些区域的地图。'],
    link: { to: '/more', label: '去更多' },
  },
  // ---------- 15. 以后装到手机上 ----------
  {
    id: 'install',
    icon: 'upload',
    title: '以后装到手机上（测试完再看）',
    summary: '决定用了再装，不急',
    where: '手机浏览器打开同一个网址',
    what: ['装到主屏幕后像普通 App 一样全屏打开，也更不容易被系统清理数据', '手机上的数据和电脑上是分开的；想用电脑上整理好的数据，先备份再恢复'],
    steps: [
      'iPhone：用 Safari 打开网址 → 底部的分享按钮 →「添加到主屏幕」→ 以后从主屏幕图标打开',
      'Android：用 Chrome 打开网址 → 右上角菜单 →「安装应用」或「添加到主屏幕」',
    ],
    example: ['测完觉得没问题：电脑「导出备份」→ 发到 iPhone → Safari 打开网址并添加到主屏幕 → 从主屏幕打开 →「更多 → 备份与恢复 → 从备份恢复」。'],
  },
]

// 记录“已测过”的设置名
const TESTED_KEY = 'guideTested'

// 页面组件
export default function GuidePage() {
  // 页面跳转
  const navigate = useNavigate()
  // 已测过的节（存在数据库设置表里）
  const tested = (useLiveQuery(() => db.settings.get(TESTED_KEY))?.value as string[] | undefined) ?? []
  // 展开的节（默认展开第一节）
  const [open, setOpen] = useState<Set<string>>(() => new Set(['desktop']))
  // 是否全部展开
  const allOpen = open.size === SECTIONS.length

  // 展开 / 收起某一节
  const toggle = (id: string) =>
    setOpen((prev) => {
      // 复制一份再改
      const next = new Set(prev)
      // 有就删，没有就加
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // 返回新的
      return next
    })

  // 从目录跳到某一节：展开并滚动过去
  const jump = (id: string) => {
    // 展开
    setOpen((prev) => new Set(prev).add(id))
    // 等展开后再滚动
    requestAnimationFrame(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // 标记 / 取消“测过了”
  const markTested = (id: string) => {
    // 新的列表
    const next = tested.includes(id) ? tested.filter((x) => x !== id) : [...tested, id]
    // 保存
    db.settings.put({ key: TESTED_KEY, value: next })
  }

  // 已测过的数量（只算现在还存在的节）
  const testedCount = SECTIONS.filter((s) => tested.includes(s.id)).length

  // 页面内容
  return (
    <div className="h-full overflow-y-auto bg-paper px-5 pt-[max(env(safe-area-inset-top),12px)] pb-12">
      {/* 返回 */}
      <button aria-label="返回" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/more'))} className="-ml-3 flex h-11 w-11 items-center justify-center">
        <Icon name="back" size={22} />
      </button>
      {/* 标题 */}
      <div className="font-serif text-[16px] italic text-muted">Mode d’emploi</div>
      <h1 className="text-[28px] font-semibold">使用说明</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">每个功能在哪里、能做什么、怎么用，都配了一个例子。点标题展开；测完一节点「我测过了」。</p>

      {/* 测试进度 */}
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-muted">测试进度</span>
          <span className="text-[13px]">
            <b className="text-[20px] font-semibold">{testedCount}</b>
            <span className="text-muted"> / {SECTIONS.length} 节</span>
          </span>
        </div>
        {/* 进度条：轨道是浅色，已完成部分深色；全部测完变绿 */}
        <div
          role="progressbar"
          aria-label="测试进度"
          aria-valuemin={0}
          aria-valuemax={SECTIONS.length}
          aria-valuenow={testedCount}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-oat"
        >
          <div className={`h-full rounded-full ${testedCount === SECTIONS.length ? 'bg-sage' : 'bg-ink'}`} style={{ width: `${(testedCount / SECTIONS.length) * 100}%` }} />
        </div>
        {testedCount === SECTIONS.length && <p className="mt-2 text-[12px] text-sage">全部测完了！确定要用的话，看最后一节「以后装到手机上」。</p>}
      </div>

      {/* 目录 */}
      <nav aria-label="目录" className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-muted">目录</h2>
          <button onClick={() => setOpen(allOpen ? new Set() : new Set(SECTIONS.map((s) => s.id)))} className="h-9 text-[12px] text-muted underline underline-offset-2">
            {allOpen ? '全部收起' : '全部展开'}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className={`flex h-9 items-center gap-1 rounded-full px-3 text-[12px] ${tested.includes(s.id) ? 'bg-sage-soft text-sage' : 'bg-oat text-ink'}`}
            >
              <span className="text-muted">{i}</span>
              {/* 目录里只显示标题括号前面的部分 */}
              {s.title.split('（')[0].split('：')[0]}
            </button>
          ))}
        </div>
      </nav>

      {/* 每一节 */}
      <div className="mt-5 flex flex-col gap-3">
        {SECTIONS.map((s, i) => (
          <SectionCard key={s.id} index={i} section={s} open={open.has(s.id)} tested={tested.includes(s.id)} onToggle={() => toggle(s.id)} onTested={() => markTested(s.id)} />
        ))}
      </div>
    </div>
  )
}

// 一节说明的卡片
function SectionCard({
  index,
  section: s,
  open,
  tested,
  onToggle,
  onTested,
}: {
  // 序号
  index: number
  // 内容
  section: Section
  // 是否展开
  open: boolean
  // 是否测过
  tested: boolean
  // 展开 / 收起
  onToggle: () => void
  // 标记测过
  onTested: () => void
}) {
  // 返回卡片
  return (
    <section id={`guide-${s.id}`} className="scroll-mt-4 rounded-2xl border border-line bg-card">
      {/* 标题行（点它展开 / 收起） */}
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        {/* 图标 */}
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tested ? 'bg-sage-soft text-sage' : 'bg-oat'}`}>
          <Icon name={s.icon} size={19} />
        </span>
        {/* 标题和概括 */}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug font-semibold">
            {/* 序号（用无衬线数字，衬线斜体的 0 看起来像字母 o） */}
            <span className="mr-1.5 text-[13px] font-normal text-muted tabular-nums">{index}</span>
            {s.title}
          </span>
          <span className="mt-0.5 block text-[12px] text-muted">
            {s.summary}
            {tested && <span className="text-sage"> · 已测</span>}
          </span>
        </span>
        {/* 展开箭头 */}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="shrink-0 text-muted" />
      </button>

      {/* 展开后的内容 */}
      {open && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          {/* 在哪里 */}
          <p className="flex items-start gap-1.5 text-[13px] leading-relaxed">
            <Icon name="pin" size={14} className="mt-[3px] shrink-0 text-muted" />
            <span>
              <span className="text-muted">在哪里：</span>
              {s.where}
            </span>
          </p>

          {s.phases ? (
            // 完整例子：按阶段列出步骤，全程编号
            <Phases phases={s.phases} />
          ) : (
            <>
              {/* 能做什么 */}
              <h3 className="mt-4 text-[13px] font-semibold">能做什么</h3>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {s.what.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] leading-relaxed">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>

              {/* 怎么用 */}
              <h3 className="mt-4 text-[13px] font-semibold">怎么用</h3>
              <ol className="mt-1.5 flex flex-col gap-2">
                {s.steps.map((st, i) => (
                  <li key={st} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-oat text-[11px] font-semibold">{i + 1}</span>
                    <span>{st}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {/* 例子 */}
          <div className="mt-4 rounded-xl bg-oat px-3.5 py-3">
            <div className="font-serif text-[14px] italic text-muted">Exemple · 例子</div>
            {s.example.map((e) => (
              <p key={e} className="mt-1.5 text-[13px] leading-relaxed">
                {e}
              </p>
            ))}
          </div>

          {/* 小提示 */}
          {s.tip && (
            <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
              <Icon name="sparkle" size={13} className="mt-[3px] shrink-0" />
              {s.tip}
            </p>
          )}

          {/* 底部：去试试 + 我测过了 */}
          <div className="mt-4 flex gap-2">
            {s.link && (
              <Link to={s.link.to} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink text-[14px] text-paper">
                {s.link.label}
                <Icon name="chevronRight" size={15} />
              </Link>
            )}
            <button
              onClick={onTested}
              aria-pressed={tested}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[14px] ${tested ? 'border-sage bg-sage-soft text-sage' : 'border-line-strong'}`}
            >
              {tested ? '✓ 测过了' : '我测过了'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// 完整例子的各个阶段：阶段标题 + 什么时候 + 步骤（全程连续编号，有的带跳转按钮）
function Phases({ phases }: { phases: Phase[] }) {
  // 全程编号的起点
  let n = 0
  // 返回
  return (
    <div className="mt-2">
      {phases.map((ph, pi) => (
        <div key={ph.title} className="mt-4">
          {/* 阶段标题 */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[16px] italic text-accent">{pi + 1}</span>
            <h3 className="text-[14px] font-semibold">{ph.title}</h3>
            <span className="text-[12px] text-muted">· {ph.when}</span>
          </div>
          {/* 步骤：左边一条竖线把同一阶段连起来 */}
          <ol className="mt-2 ml-2 flex flex-col gap-2.5 border-l border-line-strong pl-3.5">
            {ph.steps.map((st) => {
              // 全程第几步
              n += 1
              // 一步
              return (
                <li key={st.text} className="text-[13px] leading-relaxed">
                  <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-oat px-1 text-[11px] font-semibold">{n}</span>
                  {st.text}
                  {st.link && (
                    <Link to={st.link.to} className="ml-1.5 inline-flex items-center gap-0.5 text-[12px] whitespace-nowrap text-accent underline underline-offset-2">
                      {st.link.label}
                      <Icon name="chevronRight" size={11} />
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 数据结构定义（所有存在手机里的数据长什么样）
// 以后加功能要改这里时：
//   1. 把 SCHEMA_VERSION 加 1
//   2. 在 db.ts 里加一个新的 version(...)，写好迁移逻辑
// ============================================================

// 当前数据结构的版本号（导出备份时也会写进文件，导入时用来判断要不要迁移）
// 版本历史：1 = 初版；2 = 加入票夹（tickets、ticketFiles 两张表）；3 = 加入预算（expenses 表）
export const SCHEMA_VERSION = 3

// 所有记录的 ID 都是字符串
export type ID = string

// ---------- 旅行 ----------

// 一次旅行（App 从一开始就支持多次旅行）
export interface Trip {
  // 唯一 ID
  id: ID
  // 旅行名称，例如 “Berlin & København”
  name: string
  // 副标题，例如 “Noël 2026”
  subtitle?: string
  // 出行人数（现在 1 人，保留多人）
  travelers: number
  // 旅途第一天的日期，格式 'YYYY-MM-DD'；null 表示还没定
  startDate: string | null
  // 日期没定时的提示文字，例如 “12/20–12/23 之间”
  startDateHint?: string
  // 统一显示用的货币（预算换算成这个）
  baseCurrency: 'EUR'
  // 预算（欧元）：总额和每个分类的计划，都可以不填、随时改
  budget?: { total?: number; byCategory?: Partial<Record<ExpenseCategory, number>> }
  // 创建时间（毫秒时间戳）
  createdAt: number
  // 最后修改时间
  updatedAt: number
}

// ---------- 行程中的地点（城市 / 中转 / 家） ----------

// 地点类型：home = 出发地/回家，stay = 住宿城市，transit = 只是路过（例如机场）
// saved = 以后想去的城市：不在本次路线里，但它的酒店景点等资料都保留（例如柏林）
export type StopKind = 'home' | 'stay' | 'transit' | 'saved'

// 行程里按顺序排列的一个地点
export interface Stop {
  // 唯一 ID
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 在行程中的顺序（0、1、2……）
  order: number
  // 地点类型
  kind: StopKind
  // 当地原文名，例如 “København”
  name: string
  // 中文名，例如 “哥本哈根”
  nameZh: string
  // 国家代码：NL / DE / DK
  country: string
  // 纬度
  lat: number
  // 经度
  lng: number
  // 住几晚（home 和 transit 是 0）
  nights: number
  // 市内交通指南（推荐内容，见 src/data/content.ts）
  guide?: CityGuide
  // 我自己记的市内交通笔记
  transportNote?: string
}

// ---------- 市内交通指南 ----------

// 一个城市的交通指南（票种、App、车站机场怎么进城、节日提醒）
export interface CityGuide {
  // 票种和价格
  tickets: { name: string; price: string; note?: string }[]
  // 推荐 App
  apps: { name: string; use: string; url?: string }[]
  // 到达的地方（车站、机场、大巴站）以及怎么进城
  arrivals: { name: string; nameZh: string; lat: number; lng: number; how: string }[]
  // 小贴士
  tips: string[]
  // 节日提醒（12/24–26）
  holidayNotes: string[]
  // 信息来源
  sources: { label: string; url: string }[]
  // 调研时间，例如 “2026 年 11 月”
  updated: string
}

// ---------- 城际交通段 ----------

// 交通方式：tbd = 还没决定
export type TransportMode = 'train' | 'bus' | 'flight' | 'ferry' | 'car' | 'tbd'

// 一种可选的交通方式（例如“FlixBus 直达大巴”）
export interface TransportOption {
  // 唯一 ID
  id: string
  // 交通方式
  mode: TransportMode
  // 运营商，例如 “FlixBus”、“DB / DSB”
  provider: string
  // 路线说明，例如 “Groningen → Berlin ZOB 直达”
  title: string
  // 大致时长，例如 “约 7.5–8 小时”
  duration?: string
  // 价格区间，例如 “约 €13–65”
  price?: string
  // 班次，例如 “每天多班”
  frequency?: string
  // 预订链接
  url?: string
  // 备注
  note?: string
  // 节日提醒
  holidayNote?: string
  // 信息来源
  sourceUrl?: string
  // 来源：recommended = 推荐 · 需核实；user = 自己添加
  source: 'recommended' | 'user'
}

// 两个地点之间的一段交通
export interface Segment {
  // 唯一 ID
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 从哪个地点出发
  fromStopId: ID
  // 到哪个地点
  toStopId: ID
  // 计划用的交通方式
  mode: TransportMode
  // 大概什么时段走，例如 “上午”
  timeOfDay?: string
  // 是否已经订票
  booked: boolean
  // 备注
  note?: string
  // 可选的交通方式
  options?: TransportOption[]
  // 选定的方式（options 里的 ID）
  chosenOptionId?: string
}

// ---------- 地点（酒店、景点等） ----------

// 地点分类
export type PlaceCategory = 'hotel' | 'attraction' | 'market' | 'food' | 'shop' | 'station' | 'other'
// 状态：候选 / 已选定 / 已预订
export type PlaceStatus = 'candidate' | 'selected' | 'booked'
// 来源：recommended = 我（Claude）推荐的，需核实；user = 你自己添加的
export type PlaceSource = 'recommended' | 'user'

// 一个具体地点
export interface Place {
  // 唯一 ID
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 属于哪个城市
  stopId: ID
  // 分类
  category: PlaceCategory
  // 名称（当地原文）
  name: string
  // 中文说明（可选）
  nameZh?: string
  // 地址
  address?: string
  // 纬度
  lat: number
  // 经度
  lng: number
  // 状态
  status: PlaceStatus
  // 来源
  source: PlaceSource
  // 官网或预订链接
  url?: string
  // 价格说明，例如 “约 €30/晚”
  priceNote?: string
  // 门票（景点用），例如 “€15，学生 €8”
  ticket?: string
  // 开放时间（景点用）
  openingHours?: string
  // 建议游玩时长（景点用），例如 “1.5 小时”
  duration?: string
  // 节日提醒，例如 “12/24 下午关门”
  holidayNote?: string
  // 信息来源链接（推荐项目用，方便核实）
  sourceUrl?: string
  // 备注
  note?: string
  // 是否隐藏（选定酒店后隐藏其余候选）
  hidden?: boolean
  // 创建时间（排序用；旧数据没有这个字段）
  createdAt?: number
}

// ---------- 每天的日程 ----------

// 日程里的一站
export interface DayPlanItem {
  // 唯一 ID
  id: ID
  // 关联的地点 ID（从景点列表加入时有；临时图钉没有）
  placeId?: ID
  // 显示的名字
  name: string
  // 纬度
  lat: number
  // 经度
  lng: number
  // 计划时间，例如 “10:00”
  time?: string
  // 备注
  note?: string
  // 名字是不是根据坐标自动取的（自动取的名字在拖动图钉后会重新取）
  autoName?: boolean
}

// 某一天的日程
export interface DayPlan {
  // ID 固定为 “旅行ID:第几天”，方便直接查
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 旅途第几天（从 1 开始）
  dayIndex: number
  // 当天要去的地点，按顺序排列（第一个是起点）
  items: DayPlanItem[]
  // 是否是示例数据（示例会显示“示例”标签）
  isSample?: boolean
}

// ---------- 票夹 ----------

// 一张车票（或门票、登机牌）
export interface Ticket {
  // 唯一 ID
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 关联的城际交通段（门票等可以不关联）
  segmentId?: ID
  // 关联的住宿（酒店预订截图用；有这个就是住宿凭证）
  placeId?: ID
  // 标题，例如 “Groningen → Berlin”
  title: string
  // 类型（火车 / 大巴 / 飞机 / 其他）
  mode: TransportMode
  // 运营商，例如 “FlixBus”
  provider?: string
  // 出发时间，格式 'YYYY-MM-DDTHH:mm'（当地时间）
  departAt?: string
  // 到达时间，格式同上
  arriveAt?: string
  // 车次 / 航班号
  number?: string
  // 座位
  seat?: string
  // 订单号 / 预订码
  orderNo?: string
  // 备注
  note?: string
  // 创建时间
  createdAt: number
}

// 车票的文件（图片，或 PDF 原件和它转成的图片）
export interface TicketFile {
  // 唯一 ID
  id: ID
  // 属于哪张车票
  ticketId: ID
  // 文件名
  name: string
  // 文件类型，例如 image/png、application/pdf
  mime: string
  // 文件内容
  blob: Blob
  // 如果是 PDF 转出来的图片：原 PDF 文件的 ID 和第几页
  pdfId?: ID
  page?: number
  // 顺序
  order: number
}

// ---------- 预算 ----------

// 支持的货币
export type Currency = 'EUR' | 'DKK' | 'SEK' | 'NOK'

// 花费分类：交通 / 住宿 / 餐饮 / 门票 / 购物 / 其他
export type ExpenseCategory = 'transport' | 'lodging' | 'food' | 'tickets' | 'shopping' | 'other'

// 一笔花费
export interface Expense {
  // 唯一 ID
  id: ID
  // 属于哪次旅行
  tripId: ID
  // 分类
  category: ExpenseCategory
  // 金额（原币种）
  amount: number
  // 币种
  currency: Currency
  // 日期 'YYYY-MM-DD'
  date: string
  // 备注，例如 “Tivoli 门票”
  note?: string
  // 创建时间
  createdAt: number
}

// ---------- 路线缓存 ----------

// 联网算好的步行路线存下来，断网时也能看
export interface RouteCache {
  // 由所有途经点坐标拼成的字符串
  key: string
  // 路线坐标串 [经度, 纬度][]
  coords: [number, number][]
  // 每两站之间的距离（米）
  legDistances: number[]
  // 每两站之间的步行时间（秒）
  legDurations: number[]
  // 公交路线的简要说明，例如 “U5 → S3”（只有公交缓存才有）
  summary?: string
  // 保存时间
  savedAt: number
}

// ---------- 设置 ----------

// 通用的键值设置（例如当前查看哪次旅行）
export interface Setting {
  // 设置名
  key: string
  // 设置值
  value: unknown
}

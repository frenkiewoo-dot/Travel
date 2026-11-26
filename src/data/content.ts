// ============================================================
// 推荐内容包：我（Claude）调研整理的公开信息（交通方式、市内交通指南）
//   - 只有公开信息，没有任何个人数据
//   - 价格和时间都是“约”，标了“需核实”的请在订票前确认
//   - App 启动时会把这里的内容合并进手机里的数据（见 db/content.ts）
//   - 更新内容后把 CONTENT_VERSION 加 1，手机下次打开就会拿到新内容
// 调研时间：2026 年 11 月
// ============================================================

// 引入数据结构
import type { CityGuide, Stop, TransportMode, TransportOption } from '../db/schema'

// 内容版本号（改了下面的内容就加 1）
// 1 = 第 4 步：城际交通方式、柏林 / 哥本哈根 / 阿姆斯特丹机场指南
// 2 = 行程变更：改成 哥本哈根 4 晚 + 斯德哥尔摩 4 晚，柏林移到“以后想去”；加斯德哥尔摩、奥斯陆、去程机场指南
export const CONTENT_VERSION = 2

// 初始行程的 ID（推荐内容只合并到这个行程里）
export const NOEL_TRIP_ID = 'trip-noel-2026'

// ---------- 新的行程结构（第 2 版内容） ----------
// 只有城市顺序、住几晚、出发日期这些初始行程信息；航班号、时间、住哪家都不放在这里（由你在 App 里填，只存在手机上）
export const NEW_PLAN = {
  // 旅途第一天
  startDate: '2026-12-20',
  // 旅行名称
  name: 'København & Stockholm',
  // 路线（按顺序），最后的柏林是“以后想去”
  stops: [
    { id: 'stop-gro-start', kind: 'home', name: 'Groningen', nameZh: '格罗宁根', country: 'NL', lat: 53.2194, lng: 6.5665, nights: 0 },
    { id: 'stop-ams-out', kind: 'transit', name: 'Amsterdam Schiphol', nameZh: '阿姆斯特丹机场', country: 'NL', lat: 52.3105, lng: 4.7683, nights: 0 },
    { id: 'stop-copenhagen', kind: 'stay', name: 'København', nameZh: '哥本哈根', country: 'DK', lat: 55.6761, lng: 12.5683, nights: 4 },
    { id: 'stop-stockholm', kind: 'stay', name: 'Stockholm', nameZh: '斯德哥尔摩', country: 'SE', lat: 59.3293, lng: 18.0686, nights: 4 },
    { id: 'stop-osl', kind: 'transit', name: 'Oslo Gardermoen', nameZh: '奥斯陆机场', country: 'NO', lat: 60.1939, lng: 11.1004, nights: 0 },
    { id: 'stop-ams', kind: 'transit', name: 'Amsterdam Schiphol', nameZh: '阿姆斯特丹机场', country: 'NL', lat: 52.3105, lng: 4.7683, nights: 0 },
    { id: 'stop-gro-end', kind: 'home', name: 'Groningen', nameZh: '格罗宁根', country: 'NL', lat: 53.2194, lng: 6.5665, nights: 0 },
    { id: 'stop-berlin', kind: 'saved', name: 'Berlin', nameZh: '柏林', country: 'DE', lat: 52.52, lng: 13.405, nights: 2 },
  ] as Omit<Stop, 'tripId' | 'order'>[],
  // 每段交通的方式（键是 “出发ID>到达ID”）
  modes: {
    'stop-gro-start>stop-ams-out': 'train',
    'stop-ams-out>stop-copenhagen': 'flight',
    'stop-copenhagen>stop-stockholm': 'flight',
    'stop-stockholm>stop-osl': 'flight',
    'stop-osl>stop-ams': 'flight',
    'stop-ams>stop-gro-end': 'train',
  } as Record<string, TransportMode>,
}

// ---------- 城际交通：每段的可选方式 ----------
// 键是 “出发城市ID>到达城市ID”（用城市 ID 配对，即使交通段重新生成也能对上）
export const SEGMENT_OPTIONS: Record<string, TransportOption[]> = {
  // ===== 格罗宁根 → 柏林 =====
  'stop-gro-start>stop-berlin': [
    {
      id: 'rec-gro-ber-flixbus',
      mode: 'bus',
      provider: 'FlixBus',
      title: 'Groningen 中央车站 → Berlin ZOB（中央大巴站）',
      duration: '约 7.5–8 小时',
      price: '约 €13–65，越早订越便宜',
      frequency: '每天多班，部分直达',
      url: 'https://www.flixbus.com/bus-routes/bus-groningen-berlin',
      note: '通常最便宜。到达的 ZOB 在柏林西边，进城还要坐约 30–40 分钟 S-Bahn / U-Bahn。',
      sourceUrl: 'https://www.flixbus.com/bus-routes/bus-groningen-berlin',
      source: 'recommended',
    },
    {
      id: 'rec-gro-ber-train-ns',
      mode: 'train',
      provider: 'NS International / DB',
      title: 'Groningen → 荷兰境内换乘 → ICE → Berlin Hbf',
      duration: '最快约 5 小时 40 分（1 次换乘），常见 6–7 小时',
      price: '最低约 €38 起，越早订越便宜（临近出发可能 €95 以上）',
      frequency: '每天多班',
      url: 'https://www.nsinternational.com/nl/trein/groningen-berlijn',
      note: '最快。阿姆斯特丹—柏林线从 2025 年秋天起由 ICE 运营，换乘站以订票页显示为准。到达柏林中央车站，进城很方便。',
      sourceUrl: 'https://www.nsinternational.com/nl/treinen/ice-naar-berlijn',
      source: 'recommended',
    },
    {
      id: 'rec-gro-ber-train-leer',
      mode: 'train',
      provider: 'Arriva / DB（Wunderline 新线）',
      title: 'Groningen → Leer → Bremen → Berlin（多次换乘）',
      duration: '约 6.5–7.5 小时（需核实）',
      price: '可买 DB 特价票（Sparpreis），价格需核实',
      url: 'https://www.bahn.de',
      note: 'Groningen—Leer 这段铁路 2026 年 10 月刚恢复通车。报道说平日只开到 Winschoten，周末才直通 Groningen，请在订票页确认当天能不能走。',
      sourceUrl: 'https://www.dutchnews.nl/2026/10/international-train-connection-from-groningen-to-leer-returns/',
      source: 'recommended',
    },
  ],

  // ===== 柏林 → 哥本哈根（12/25 上午） =====
  'stop-berlin>stop-copenhagen': [
    {
      id: 'rec-ber-cph-train-direct',
      mode: 'train',
      provider: 'DB / DSB',
      title: 'Berlin Hbf → København H 直达火车（经 Hamburg）',
      duration: '约 7 小时',
      price: '约 €40–150，提前订特价票更便宜（需核实）',
      frequency: '2026 年起每天约 2 班直达（需核实）',
      url: 'https://www.bahn.de/reisen/view/verbindung/berlin/kopenhagen.shtml',
      note: '不用换车最省心。直达车 2026 年 5 月才恢复，班次少，没有直达时可以在 Hamburg 换一次车。',
      holidayNote: '12/25 圣诞节：长途火车照常开，但圣诞期间车票很抢手，建议尽早订票并订座（需核实当天时刻）。',
      sourceUrl: 'https://www.berliner-kurier.de/berlin/berlinkopenhagen-zug-faehrt-wieder-aber-langsamer-als-frueher-li.10030034',
      source: 'recommended',
    },
    {
      id: 'rec-ber-cph-train-hamburg',
      mode: 'train',
      provider: 'DB / DSB',
      title: 'Berlin Hbf → Hamburg Hbf（ICE）→ København H',
      duration: '约 7–8 小时，1 次换乘',
      price: '约 €40–150（需核实）',
      frequency: '比直达车多',
      url: 'https://www.bahn.de/reisen/view/verbindung/berlin/kopenhagen.shtml',
      note: '直达车时间不合适时的备选。',
      holidayNote: '12/25 圣诞节班次可能比平时少，需核实。',
      sourceUrl: 'https://www.bahn.de/reisen/view/verbindung/berlin/kopenhagen.shtml',
      source: 'recommended',
    },
    {
      id: 'rec-ber-cph-flixbus',
      mode: 'bus',
      provider: 'FlixBus',
      title: 'Berlin（ZOB / Alexanderplatz）→ København 大巴站',
      duration: '约 8–9 小时（部分班次坐 Rostock—Gedser 渡轮过海）',
      price: '约 €25–70（需核实）',
      frequency: '每天几班',
      url: 'https://www.flixbus.com/bus/copenhagen',
      note: '通常最便宜。哥本哈根的到达站在 Carsten Niebuhrs Gade 30（Dybbølsbro 桥下），离中央车站步行约 10 分钟。',
      holidayNote: '12/25 圣诞节当天班次可能减少，需核实。',
      sourceUrl: 'https://www.rome2rio.com/s/Copenhagen-Bus-Terminal/Berlin',
      source: 'recommended',
    },
    {
      id: 'rec-ber-cph-flight',
      mode: 'flight',
      provider: 'easyJet / Norwegian / SAS',
      title: 'BER 机场 → CPH 机场 直飞',
      duration: '飞行约 1 小时 05 分；算上去机场和安检约 3.5–4 小时',
      price: '约 €40–120，托运行李另算（需核实）',
      url: 'https://www.google.com/travel/flights?q=Flights%20from%20BER%20to%20CPH',
      note: '总时间最短，但要先去 BER 机场（市区坐 FEX 机场快线约 30 分钟，需要 ABC 区票）。',
      holidayNote: '12/25 航班比平时少，需核实。',
      sourceUrl: 'https://www.flightconnections.com/flights-from-ber-to-cph',
      source: 'recommended',
    },
  ],

  // ===== 哥本哈根 → 阿姆斯特丹（飞机，下午） =====
  'stop-copenhagen>stop-ams': [
    {
      id: 'rec-cph-ams-easyjet',
      mode: 'flight',
      provider: 'easyJet',
      title: 'CPH → AMS（Schiphol）直飞',
      duration: '飞行约 1 小时 25 分',
      price: '通常最便宜，约 €50–120；托运行李另付（需核实）',
      url: 'https://www.easyjet.com/en/cheap-flights/copenhagen/amsterdam',
      note: '廉航：注意随身行李尺寸，托运要另外买。',
      sourceUrl: 'https://www.trip.com/flights/copenhagen-to-amsterdam/airfares-cph-ams/',
      source: 'recommended',
    },
    {
      id: 'rec-cph-ams-klm',
      mode: 'flight',
      provider: 'KLM / SAS',
      title: 'CPH → AMS（Schiphol）直飞',
      duration: '飞行约 1 小时 25 分',
      price: '约 €80–200（需核实）',
      url: 'https://www.google.com/travel/flights?q=Flights%20from%20CPH%20to%20AMS',
      note: '全服务航司，班次多。',
      sourceUrl: 'https://www.kayak.com/flight-routes/Kastrup-Copenhagen-CPH/Amsterdam-Schiphol-AMS',
      source: 'recommended',
    },
    {
      id: 'rec-cph-ams-norwegian',
      mode: 'flight',
      provider: 'Norwegian',
      title: 'CPH → AMS（Schiphol）直飞',
      duration: '飞行约 1 小时 25 分',
      price: '约 €50–150（需核实）',
      url: 'https://www.norwegian.com',
      note: '廉航，可以和 easyJet 比价。',
      sourceUrl: 'https://www.trip.com/flights/copenhagen-to-amsterdam/airfares-cph-ams/',
      source: 'recommended',
    },
  ],

  // ===== 格罗宁根 → 阿姆斯特丹机场（火车，去程） =====
  'stop-gro-start>stop-ams-out': [
    {
      id: 'rec-gro-ams-ns',
      mode: 'train',
      provider: 'NS',
      title: 'Groningen → Schiphol Airport 站（部分直达）',
      duration: '约 2 小时 10–25 分',
      price: '全价约 €30 左右（需核实）',
      frequency: '每小时多班',
      url: 'https://www.ns.nl/en',
      note: '不用提前订票，用 OV-chipkaart 或银行卡（OVpay）刷卡进站。欧洲航班建议起飞前 2 小时到机场，所以要预留 4 个多小时；节前人多，最好再早一班。',
      sourceUrl: 'https://www.thetrainline.com/train-times/amsterdam-schiphol-airport-to-groningen',
      source: 'recommended',
    },
  ],

  // ===== 阿姆斯特丹机场 → 格罗宁根（火车） =====
  'stop-ams>stop-gro-end': [
    {
      id: 'rec-ams-gro-ns',
      mode: 'train',
      provider: 'NS',
      title: 'Schiphol Airport 站 → Groningen（部分直达）',
      duration: '约 2 小时 10–25 分',
      price: '全价约 €30 左右（需核实）',
      frequency: '每小时多班',
      url: 'https://www.ns.nl/en',
      note: '不用提前订票：机场地下就是火车站，用 OV-chipkaart 或银行卡（OVpay）刷卡进站即可。',
      sourceUrl: 'https://www.thetrainline.com/train-times/amsterdam-schiphol-airport-to-groningen',
      source: 'recommended',
    },
  ],
}

// ---------- 市内交通指南 ----------
// 键是城市 ID
export const CITY_GUIDES: Record<string, CityGuide> = {
  // ===== 柏林 =====
  'stop-berlin': {
    tickets: [
      { name: '单程票 AB 区', price: '€4.00', note: '2 小时内有效，同一方向可以换乘；市区都在 AB 区' },
      { name: '24 小时票 AB 区', price: '€11.20', note: '一天坐 3 次以上就划算' },
      { name: '24 小时票 ABC 区', price: '€12.90', note: '要去 BER 机场时用（机场在 C 区）' },
      { name: 'Deutschlandticket', price: '€63 / 月', note: '按月订阅，只玩几天不划算' },
    ],
    apps: [
      { name: 'BVG Fahrinfo / BVG Tickets', use: '查公交路线、买柏林市内车票（官方）', url: 'https://www.bvg.de/de/touristen/fahrscheine' },
      { name: 'DB Navigator', use: '查和买长途火车票，也能买柏林市内票', url: 'https://www.bahn.de' },
      { name: 'FlixBus', use: '大巴车票、查看上车点', url: 'https://www.flixbus.com' },
    ],
    arrivals: [
      {
        name: 'Berlin Hauptbahnhof',
        nameZh: '柏林中央火车站',
        lat: 52.5251,
        lng: 13.3694,
        how: '坐火车到这里。往东坐 S-Bahn（S3 / S5 / S7 / S9）约 6–10 分钟到 Alexanderplatz；或者坐 U5 到 Museumsinsel、Unter den Linden 一带。',
      },
      {
        name: 'Berlin ZOB',
        nameZh: '柏林中央大巴站',
        lat: 52.5076,
        lng: 13.2795,
        how: '坐 FlixBus 到这里，在城西 Messe 旁边。步行约 5 分钟到 S Messe Nord/ZOB 站坐 S-Bahn，或到 U Kaiserdamm 坐 U2；进市中心约 30–40 分钟。',
      },
      {
        name: 'Flughafen BER',
        nameZh: '柏林机场',
        lat: 52.3667,
        lng: 13.5033,
        how: '坐飞机才会用到。FEX 机场快线或 S9 进城约 30–45 分钟，要买 ABC 区车票。',
      },
    ],
    tips: [
      '柏林地铁站没有闸机，上车前先在 App 或站台的机器买票；纸质票买完要在站台的小机器上打卡才生效。',
      '查票是随机的，没票会被罚款。',
      '中央车站到市中心的大部分景点，坐 S-Bahn 一两站就到，很多地方也可以步行。',
    ],
    holidayNotes: [
      '12/24 平安夜：公交按周六时刻表运行；大部分商店下午就关门。',
      '12/25、12/26 圣诞节：公交按周日时刻表运行，班次比平时少；商店基本都关门。',
      '出发前在 BVG App 里查当天实际班次。',
    ],
    sources: [
      { label: 'VBB：2026 年 1 月 1 日起的新票价', url: 'https://www.vbb.de/news/neue-fahrpreise-im-vbb-zum-1-januar-2026/' },
      { label: '柏林 2026 年票价（Berliner Kurier）', url: 'https://www.berliner-kurier.de/berlin/ab-1-januar-werden-die-oeffis-teurer-was-fuer-berliner-und-brandenburger-wichtig-ist-li.10008978' },
      { label: 'Deutschlandticket 2026 年 €63（ZDF）', url: 'https://www.zdfheute.de/politik/deutschlandticket-dticket-verkehr-nahverkehr-preis-erhoehung-100.html' },
      { label: 'BVG 圣诞节期间时刻表', url: 'https://www.bvg.de/de/unternehmen/medienportal/pressemitteilungen/alle-jahre-wieder' },
      { label: '柏林中央车站（berlin.de）', url: 'https://www.berlin.de/en/airports-and-stations/1833747-2932875-gare-centrale-de-berlin-hauptbahnhof.en.html' },
    ],
    updated: '2026 年 11 月',
  },

  // ===== 哥本哈根 =====
  'stop-copenhagen': {
    tickets: [
      { name: '单程票 2 区', price: '约 DKK 24–30（需核实）', note: '市中心大部分地方在 2 区以内' },
      { name: '单程票 3 区', price: '约 DKK 36（需核实）', note: '机场 ↔ 市中心需要 3 区' },
      { name: 'City Pass（24 / 72 小时）', price: '价格需在 DOT App 里确认', note: '时间内不限次数坐公交、地铁、火车，含机场；住 3 晚可以考虑 72 小时版' },
      { name: 'Copenhagen Card', price: '较贵', note: '含交通和很多景点门票，景点去得多才划算' },
    ],
    apps: [
      { name: 'DOT Tickets', use: '买哥本哈根的公交、地铁、火车票（官方）', url: 'https://dinoffentligetransport.dk/citypass' },
      { name: 'Rejseplanen', use: '丹麦官方查路线 App，能看实时班次', url: 'https://www.rejseplanen.dk' },
    ],
    arrivals: [
      {
        name: 'København H',
        nameZh: '哥本哈根中央车站',
        lat: 55.6727,
        lng: 12.5643,
        how: '坐火车到这里，就在市中心，步行可到 Tivoli 和市政厅广场。',
      },
      {
        name: 'Copenhagen Bus Terminal',
        nameZh: '哥本哈根大巴站',
        lat: 55.6655,
        lng: 12.5601,
        how: '坐 FlixBus 到这里（Carsten Niebuhrs Gade 30，Dybbølsbro 桥下）。步行约 10 分钟到中央车站，或者从 Dybbølsbro 站坐 S-tog 一站到中央车站。',
      },
      {
        name: 'Københavns Lufthavn',
        nameZh: '哥本哈根机场',
        lat: 55.6302,
        lng: 12.6497,
        how: '地铁 M2 到 Kongens Nytorv / Nørreport 约 15 分钟；或者坐火车到中央车站约 15 分钟。要买 3 区车票。',
      },
    ],
    tips: [
      '去机场：地铁 M2 到 Lufthavnen 站约 15 分钟，要买 3 区票；欧洲航班建议起飞前 2 小时到。',
      '地铁 24 小时运行、无人驾驶，没有闸机，上车前先在 App 里买好票。',
      '2026 年 1 月起票价平均上调约 1%，以 DOT App 显示的价格为准。',
    ],
    holidayNotes: [
      '12/24 平安夜：丹麦人下午就回家过节，商店下午早早关门，晚上公交班次少（需核实）。',
      '12/25、12/26：按节假日班次运行；地铁照常 24 小时运行，但间隔可能变长。',
      '出发前用 Rejseplanen 查当天实际班次。',
    ],
    sources: [
      { label: 'Visit Copenhagen：车票和价格', url: 'https://www.visitcopenhagen.com/copenhagen/planning/tickets-prices' },
      { label: 'Visit Copenhagen：机场到市中心', url: 'https://www.visitcopenhagen.com/copenhagen/planning/transportation/copenhagen-airport-to-city-center-all-your-options' },
      { label: '哥本哈根地铁：游客交通指南', url: 'https://m.dk/en/travel-with-the-metro/copenhagen-public-transport-a-complete-guide-for-visitors/' },
      { label: 'DOT 2026 年 1 月调价', url: 'https://www.nordiskbil.com/dot-fares-to-rise-by-1-from-january/' },
      { label: 'DOT City Pass', url: 'https://dinoffentligetransport.dk/citypass' },
      { label: '地铁运行时间', url: 'https://intl.m.dk/travel-information/the-timetable' },
    ],
    updated: '2026 年 11 月',
  },

  // ===== 阿姆斯特丹机场（中转） =====
  'stop-ams': {
    tickets: [{ name: 'NS 火车', price: '全价约 €30（Schiphol → Groningen，需核实）', note: '用 OV-chipkaart 或银行卡（OVpay）刷卡进出站' }],
    apps: [{ name: 'NS', use: '查荷兰火车班次和站台', url: 'https://www.ns.nl/en' }],
    arrivals: [
      {
        name: 'Schiphol Airport',
        nameZh: '阿姆斯特丹史基浦机场',
        lat: 52.3091,
        lng: 4.7623,
        how: '下飞机后跟着 “Trains” 标志走，火车站就在机场大厅下面。',
      },
    ],
    tips: ['到达大厅里就有 NS 售票机和服务台。'],
    holidayNotes: [],
    sources: [{ label: 'Schiphol → Groningen 火车（Trainline）', url: 'https://www.thetrainline.com/train-times/amsterdam-schiphol-airport-to-groningen' }],
    updated: '2026 年 11 月',
  },

  // ===== 阿姆斯特丹机场（去程） =====
  'stop-ams-out': {
    tickets: [{ name: 'NS 火车 Groningen → Schiphol', price: '全价约 €30（需核实）', note: '用 OV-chipkaart 或银行卡（OVpay）刷卡进出站，不用提前买票' }],
    apps: [
      { name: 'NS', use: '查荷兰火车班次和站台', url: 'https://www.ns.nl/en' },
      { name: 'Schiphol', use: '查航班状态、值机柜台和登机口', url: 'https://www.schiphol.nl/en/' },
    ],
    arrivals: [
      {
        name: 'Schiphol Airport',
        nameZh: '阿姆斯特丹史基浦机场',
        lat: 52.3091,
        lng: 4.7623,
        how: '火车站就在机场大厅（Schiphol Plaza）下面，坐扶梯上去就是值机和安检。欧洲航班建议起飞前 2 小时到。',
      },
    ],
    tips: ['去哥本哈根是申根区内的航班，不用过护照检查，但要带护照或身份证件。', '节前机场人多，安检可能排长队。'],
    holidayNotes: [],
    sources: [{ label: 'Schiphol → Groningen 火车（Trainline）', url: 'https://www.thetrainline.com/train-times/amsterdam-schiphol-airport-to-groningen' }],
    updated: '2026 年 11 月',
  },

  // ===== 斯德哥尔摩 =====
  'stop-stockholm': {
    tickets: [
      { name: '单程票', price: '约 SEK 43', note: '75 分钟内可以随意换乘地铁、公交、轻轨、渡轮' },
      { name: '24 小时票', price: '约 SEK 180' },
      { name: '72 小时票', price: '约 SEK 360', note: '住 4 晚的话，72 小时票加几张单程票通常最划算' },
      { name: '7 天票', price: '约 SEK 470' },
      { name: '直接刷银行卡', price: '按单程票计价', note: '地铁闸机可以直接刷 Visa / Mastercard（需核实）' },
    ],
    apps: [
      { name: 'SL', use: '斯德哥尔摩官方交通 App：买票、查路线', url: 'https://sl.se/en' },
      { name: 'Arlanda Express', use: '机场快线车票', url: 'https://www.arlandaexpress.com/tickets-prices' },
      { name: 'Flygbussarna', use: '机场大巴车票', url: 'https://www.flygbussarna.se/en' },
    ],
    arrivals: [
      {
        name: 'Stockholm Arlanda',
        nameZh: '斯德哥尔摩阿兰达机场',
        lat: 59.6498,
        lng: 17.9238,
        how: '进城三种方式：① Arlanda Express 机场快线到中央车站约 18–20 分钟，单程约 SEK 340（最快但最贵）；② SL 通勤火车（pendeltåg）从 Arlanda C 到 Stockholm City 约 38 分钟，SL 票加机场站附加费，合计约 SEK 120–130；③ Flygbussarna 机场大巴约 45 分钟，约 SEK 100–130。',
      },
      {
        name: 'Stockholm Centralstation / T-Centralen',
        nameZh: '斯德哥尔摩中央车站',
        lat: 59.3303,
        lng: 18.0586,
        how: '市中心的交通枢纽，三条地铁线都经过地下的 T-Centralen，从这里换地铁去住处最方便。',
      },
    ],
    tips: [
      '地铁站有闸机：用 SL App 里的电子票扫码，或者直接刷银行卡进站。',
      '冬天下午 3 点左右天就黑了，白天的景点尽量安排在上午和中午。',
    ],
    holidayNotes: [
      '12/24 平安夜（julafton）是瑞典最重要的节日：下午起几乎所有商店关门，很多餐厅不营业，公交班次减少。如果 24 日下午才到，建议提前买好晚饭和第二天的食物（青旅一般有公共厨房）。',
      '12/25 圣诞节（juldagen）是法定假日，几乎所有商店关门，公交按节假日班次。',
      '12/26（annandag jul）也是法定假日，但很多商店会开门并开始圣诞后打折（需核实）。',
      '很多博物馆 24–25 日关门；Skansen 露天博物馆圣诞期间开放（需核实当天时间）。',
    ],
    sources: [
      { label: 'Visit Stockholm：公共交通', url: 'https://www.visitstockholm.com/travel-info/public-transportation-in-stockholm/' },
      { label: 'SL 票价（2025 年新闻稿）', url: 'https://www.mynewsdesk.com/se/sl/news/nya-priser-paa-vissa-sl-biljetter-aar-2025-491294' },
      { label: '斯德哥尔摩交通指南（Nomado）', url: 'https://www.nomadotravel.app/en/guides/getting-around-stockholm' },
      { label: 'SL：直接刷卡乘车', url: 'https://sl.se/en/fares-and-tickets/contactless-pay-as-you-go/how-to-pay-as-you-go' },
      { label: 'Arlanda Express 票价', url: 'https://www.arlandaexpress.com/tickets-prices' },
      { label: '阿兰达机场进城方式比较', url: 'https://www.stockholm-spirit.com/guides/arlanda-airport-to-city-options/' },
      { label: '瑞典圣诞期间营业情况（The Local）', url: 'https://www.thelocal.se/20241213/whats-open-and-what-closes-in-sweden-during-the-christmas-holidays' },
    ],
    updated: '2026 年 11 月',
  },

  // ===== 奥斯陆机场（转机） =====
  'stop-osl': {
    tickets: [],
    apps: [{ name: 'SAS', use: '查航班状态、登机口，改签', url: 'https://www.flysas.com' }],
    arrivals: [
      {
        name: 'Oslo Gardermoen',
        nameZh: '奥斯陆加勒穆恩机场',
        lat: 60.1939,
        lng: 11.1004,
        how: '斯德哥尔摩 → 奥斯陆 → 阿姆斯特丹都在申根区内，转机不用过护照检查，也不用重新安检。下飞机后看屏幕找下一班的登机口就行。',
      },
    ],
    tips: [
      '1 小时 30 分的转机时间比较充裕。SAS 说欧洲内转机一般 30 分钟就够。',
      '同一张 SAS 订单里的联程航班，如果第一班延误导致赶不上第二班，SAS 会负责安排（需核实你的订单）。',
    ],
    holidayNotes: [],
    sources: [
      { label: 'SAS：转机和转机时间', url: 'https://www.flysas.com/en/travel-info/at-the-airport/connecting-flights' },
      { label: '奥斯陆机场转机指南（Layover Index）', url: 'https://layoverindex.com/osl/layover/' },
    ],
    updated: '2026 年 11 月',
  },
}

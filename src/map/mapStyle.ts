// ============================================================
// 地图样式：下载 OpenFreeMap 的 “Liberty” 样式，再改造成法式奶油风
//   - 统一配色（浅色 / 深色两套）
//   - 地名改成当地原文
//   - 3D 建筑：按真实高度和分段立起来，按高度渐变着色，加光照
// ============================================================

// 引入地图样式的类型定义
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'

// OpenFreeMap 的样式地址（免费、不需要 key）
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// 一套地图配色
interface MapPalette {
  // 底色
  bg: string
  // 水
  water: string
  // 水上文字
  waterText: string
  // 公园、草地
  park: string
  // 树林
  wood: string
  // 居住区
  residential: string
  // 其他用地（学校、医院等）
  landuse: string
  // 沙地
  sand: string
  // 小路
  roadMinor: string
  // 主干道
  roadMajor: string
  // 高速公路
  motorway: string
  // 道路描边
  casing: string
  // 高速描边
  motorwayCasing: string
  // 人行道
  path: string
  // 铁路
  rail: string
  // 平面建筑
  building: string
  // 建筑描边
  buildingLine: string
  // 3D 建筑：矮楼 → 高楼的四档颜色
  ext: [string, string, string, string]
  // 国界
  boundary: string
  // 普通文字
  text: string
  // 重要文字（城市名）
  textStrong: string
  // 店铺景点文字
  poiText: string
  // 文字描边（让字在地图上看得清）
  halo: string
  // 天空颜色（倾斜视角时远处的天）
  sky: string
  // 地平线颜色
  horizon: string
  // 光照强度
  lightIntensity: number
  // 光的颜色
  lightColor: string
  // 地形阴影的透明度
  reliefOpacity: number
  // 地形阴影最亮程度（0~1）
  reliefBrightness: number
}

// 浅色配色：奶油、燕麦、雾蓝的水
const LIGHT: MapPalette = {
  bg: '#F3EDE3',
  water: '#CFDCDC',
  waterText: '#5D7878',
  park: '#DFE4CF',
  wood: '#D8DFC6',
  residential: '#EFE8DD',
  landuse: '#EAE2D5',
  sand: '#EDE3CF',
  roadMinor: '#FFFDF9',
  roadMajor: '#FCF7EE',
  motorway: '#F0DFC2',
  casing: '#DFD3C1',
  motorwayCasing: '#D4BF9C',
  path: '#C9B9A2',
  rail: '#CBC1B2',
  building: '#E6DCCD',
  buildingLine: '#D6C9B5',
  ext: ['#F1EADF', '#E9DFD0', '#DDD0BC', '#CFBFA6'],
  boundary: '#B09C83',
  text: '#5E5145',
  textStrong: '#2E2823',
  poiText: '#6B6157',
  halo: '#F6F1E9',
  sky: '#E8EDEC',
  horizon: '#F6F1E9',
  lightIntensity: 0.38,
  lightColor: '#FFF3E0',
  reliefOpacity: 0.32,
  reliefBrightness: 1,
}

// 深色配色：咖啡、深灰褐
const DARK: MapPalette = {
  bg: '#1F1A16',
  water: '#16201F',
  waterText: '#7E9A98',
  park: '#232A1F',
  wood: '#222A1E',
  residential: '#231E1A',
  landuse: '#26211C',
  sand: '#2A251E',
  roadMinor: '#3A3129',
  roadMajor: '#433930',
  motorway: '#544433',
  casing: '#2B241E',
  motorwayCasing: '#3A2F24',
  path: '#5A4D41',
  rail: '#4A4036',
  building: '#2E2722',
  buildingLine: '#3A312A',
  ext: ['#342C26', '#3C332C', '#463C33', '#52463B'],
  boundary: '#7A6C5C',
  text: '#CFC3B1',
  textStrong: '#EFE7DA',
  poiText: '#B3A795',
  halo: '#1E1915',
  sky: '#1A1E22',
  horizon: '#2A231E',
  lightIntensity: 0.22,
  lightColor: '#FFE9CC',
  reliefOpacity: 0.12,
  reliefBrightness: 0.35,
}

// 原始样式只下载一次，之后复用（promise 缓存）
let rawStylePromise: Promise<StyleSpecification> | null = null

// 下载原始样式
function loadRawStyle(): Promise<StyleSpecification> {
  // 还没下载过就发请求
  if (!rawStylePromise) {
    // 请求样式 JSON
    rawStylePromise = fetch(STYLE_URL)
      // 检查状态并解析
      .then((r) => {
        // 失败就抛错
        if (!r.ok) throw new Error(`地图样式加载失败：${r.status}`)
        // 成功就解析 JSON
        return r.json() as Promise<StyleSpecification>
      })
      // 出错时清掉缓存，下次还能重试
      .catch((e) => {
        rawStylePromise = null
        throw e
      })
  }
  // 返回 promise
  return rawStylePromise
}

// 地名用当地原文（例如 København，而不是英文 Copenhagen）
const LOCAL_NAME: ExpressionSpecification = ['coalesce', ['get', 'name'], ['get', 'name:latin'], ['get', 'name_en']]

// 3D 建筑的图层（单独导出 ID，景点高亮时要用）
export const BUILDING_3D_LAYER = 'building-3d'
// 矢量数据源的名字
export const VECTOR_SOURCE = 'openmaptiles'

// 生成奶油风地图样式
export async function buildMapStyle(theme: 'light' | 'dark'): Promise<StyleSpecification> {
  // 选配色
  const p = theme === 'dark' ? DARK : LIGHT
  // 下载原始样式
  const raw = await loadRawStyle()
  // 深拷贝一份，避免改坏缓存里的原始样式
  const style: StyleSpecification = structuredClone(raw)
  // 逐个图层改造
  style.layers = style.layers.map((layer) => restyleLayer(layer, p))
  // 加光照：光从西南方向斜上方照过来，让 3D 楼的不同侧面有明暗
  style.light = {
    // 光源跟着地图走（旋转地图时阴影方向会变，更真实）
    anchor: 'map',
    // 暖白色的光
    color: p.lightColor,
    // 光照强度
    intensity: p.lightIntensity,
    // [距离, 方位角, 高度角]
    position: [1.5, 215, 38],
  }
  // 加天空：倾斜视角时远处显示柔和的天色
  style.sky = {
    // 天空颜色
    'sky-color': p.sky,
    // 地平线颜色
    'horizon-color': p.horizon,
    // 天空和地平线的过渡
    'sky-horizon-blend': 0.6,
    // 不要大气层效果（地球仪模式才用）
    'atmosphere-blend': 0,
  }
  // 返回改造后的样式
  return style
}

// 没网又没缓存时用的极简样式：只有底色，路线和标记照样能显示
export function offlineFallbackStyle(theme: 'light' | 'dark'): StyleSpecification {
  // 选配色
  const p = theme === 'dark' ? DARK : LIGHT
  // 返回只有底色的样式
  return {
    // 样式规范版本
    version: 8,
    // 没有数据源
    sources: {},
    // 只有一个底色图层
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': p.bg } }],
  }
}

// 改造单个图层
function restyleLayer(layer: LayerSpecification, p: MapPalette): LayerSpecification {
  // 图层 ID
  const id = layer.id
  // 复制一份图层（下面会改它的 paint 和 layout）
  const l = { ...layer, paint: { ...(('paint' in layer && layer.paint) || {}) } } as LayerSpecification & {
    paint: Record<string, unknown>
    layout?: Record<string, unknown>
  }

  // ----- 底色 -----
  if (l.type === 'background') {
    // 奶油底色
    l.paint['background-color'] = p.bg
    return l
  }

  // ----- 低缩放时的地形阴影图（卫星感的山地起伏） -----
  if (l.type === 'raster') {
    // 去掉颜色，只留明暗
    l.paint['raster-saturation'] = -0.85
    // 透明度随缩放减弱
    l.paint['raster-opacity'] = ['interpolate', ['linear'], ['zoom'], 0, p.reliefOpacity, 6, 0.04]
    // 最亮不超过多少（深色模式压暗，避免发灰）
    l.paint['raster-brightness-max'] = p.reliefBrightness
    return l
  }

  // ----- 面状图层（水、公园、用地、建筑） -----
  if (l.type === 'fill') {
    // 水面
    if (id === 'water') l.paint['fill-color'] = p.water
    // 公园
    else if (id === 'park') {
      // 公园颜色
      l.paint['fill-color'] = p.park
      // 公园边线和填充同色（原样式是很亮的绿线）
      l.paint['fill-outline-color'] = p.park
    }
    // 树林、草地、湿地
    else if (id === 'landcover_wood' || id === 'landcover_grass' || id === 'landcover_wetland') l.paint['fill-color'] = p.wood
    // 冰川
    else if (id === 'landcover_ice') l.paint['fill-color'] = p.bg
    // 沙地
    else if (id === 'landcover_sand') l.paint['fill-color'] = p.sand
    // 居住区
    else if (id === 'landuse_residential') l.paint['fill-color'] = p.residential
    // 其他用地、机场
    else if (id.startsWith('landuse_') || id === 'aeroway_fill') l.paint['fill-color'] = p.landuse
    // 平面建筑（缩放 13~14 时显示）
    else if (id === 'building') {
      // 建筑颜色
      l.paint['fill-color'] = p.building
      // 建筑描边
      l.paint['fill-outline-color'] = p.buildingLine
    }
    // 道路面（步行广场的花纹）：调淡
    else if (id === 'road_area_pattern') l.paint['fill-opacity'] = 0.25
    return l
  }

  // ----- 3D 建筑：重点改造 -----
  if (l.type === 'fill-extrusion') {
    // 建筑高度（数据里没有就当 0）
    const h: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 0]
    // 建筑底部高度（楼体分段，例如塔楼从 30 米开始）
    const base: ExpressionSpecification = ['coalesce', ['get', 'render_min_height'], 0]
    // 颜色：被标记为“景点”的楼显示淡金色，其余按高度从浅到深渐变
    l.paint['fill-extrusion-color'] = [
      'case',
      // 景点高亮（由程序给特定建筑打上 landmark 标记）
      ['boolean', ['feature-state', 'landmark'], false],
      '#D8BC86',
      // 普通建筑：按高度插值四档颜色
      ['interpolate', ['linear'], h, 0, p.ext[0], 12, p.ext[1], 35, p.ext[2], 90, p.ext[3]],
    ]
    // 高度：缩放 14 时从 0 开始，到 15 时长到真实高度（放大时有“楼慢慢升起来”的效果）
    l.paint['fill-extrusion-height'] = ['interpolate', ['linear'], ['zoom'], 14, 0, 15, h]
    // 底部高度同样处理
    l.paint['fill-extrusion-base'] = ['interpolate', ['linear'], ['zoom'], 14, 0, 15, base]
    // 几乎不透明，楼的轮廓更清晰
    l.paint['fill-extrusion-opacity'] = 0.94
    // 竖向渐变：楼底略暗、楼顶略亮，更有立体感
    l.paint['fill-extrusion-vertical-gradient'] = true
    return l
  }

  // ----- 线状图层（道路、水系、铁路、国界） -----
  if (l.type === 'line') {
    // 公园轮廓线（原样式是亮绿色虚线）：改成和树林同色、半透明
    if (id === 'park_outline') {
      // 颜色
      l.paint['line-color'] = p.wood
      // 半透明
      l.paint['line-opacity'] = 0.5
    }
    // 河流、运河
    else if (id.startsWith('waterway')) l.paint['line-color'] = p.water
    // 国界、行政边界
    else if (id.startsWith('boundary')) l.paint['line-color'] = p.boundary
    // 跑道、滑行道
    else if (id.startsWith('aeroway')) l.paint['line-color'] = p.roadMajor
    // 铁路（包括铁轨的“枕木”花纹）
    else if (id.includes('rail')) l.paint['line-color'] = p.rail
    // 高速公路的描边
    else if (id.includes('motorway') && id.includes('casing')) l.paint['line-color'] = p.motorwayCasing
    // 其他道路描边
    else if (id.includes('casing')) l.paint['line-color'] = p.casing
    // 高速公路
    else if (id.includes('motorway')) l.paint['line-color'] = p.motorway
    // 人行道、步行街
    else if (id.includes('path_pedestrian')) l.paint['line-color'] = p.path
    // 主干道
    else if (id.includes('trunk_primary') || id.includes('secondary_tertiary')) l.paint['line-color'] = p.roadMajor
    // 小路、支路、服务道路
    else if (id.includes('minor') || id.includes('street') || id.includes('link') || id.includes('service_track')) l.paint['line-color'] = p.roadMinor
    // 隧道里的路：半透明
    if (id.startsWith('tunnel')) l.paint['line-opacity'] = 0.5
    return l
  }

  // ----- 文字和图标图层 -----
  if (l.type === 'symbol') {
    // 复制 layout
    l.layout = { ...(l.layout || {}) }
    // 原来显示名字的图层，统一改成当地原文
    const tf = JSON.stringify(l.layout['text-field'] ?? '')
    // 判断原来是不是显示名字（包含 name）
    if (tf.includes('name')) l.layout['text-field'] = LOCAL_NAME
    // 文字颜色：城市和国家名用深色
    if (id.startsWith('label_city') || id.startsWith('label_country') || id === 'label_town') l.paint['text-color'] = p.textStrong
    // 水上的名字：雾蓝色
    else if (id.startsWith('water')) l.paint['text-color'] = p.waterText
    // 店铺景点：灰褐色
    else if (id.startsWith('poi') || id === 'airport') l.paint['text-color'] = p.poiText
    // 其他文字
    else l.paint['text-color'] = p.text
    // 文字描边颜色（和底色一致）
    l.paint['text-halo-color'] = p.halo
    // 描边宽度
    l.paint['text-halo-width'] = 1.4
    // 描边不模糊，更干净
    l.paint['text-halo-blur'] = 0
    return l
  }

  // 其他类型的图层保持原样
  return l
}

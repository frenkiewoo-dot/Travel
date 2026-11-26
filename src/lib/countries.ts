// ============================================================
// 国家代码 → 国名（当地语言 + 中文）
// 新的国家在这里加一行就行
// ============================================================

// 国名表
export const COUNTRY_NAME: Record<string, [string, string]> = {
  NL: ['Nederland', '荷兰'],
  DE: ['Deutschland', '德国'],
  DK: ['Danmark', '丹麦'],
  SE: ['Sverige', '瑞典'],
  NO: ['Norge', '挪威'],
  FI: ['Suomi', '芬兰'],
  BE: ['België', '比利时'],
  FR: ['France', '法国'],
  AT: ['Österreich', '奥地利'],
  CZ: ['Česko', '捷克'],
  PL: ['Polska', '波兰'],
  CH: ['Schweiz', '瑞士'],
  IT: ['Italia', '意大利'],
  ES: ['España', '西班牙'],
  GB: ['United Kingdom', '英国'],
}

// 当地语言的国名（大写），没有就返回国家代码
export function countryLocalUpper(code: string): string {
  // 查表
  return COUNTRY_NAME[code]?.[0].toUpperCase() ?? code
}

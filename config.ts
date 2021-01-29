

const fundCode:string = process.env.code!

export enum FundCodeName {
  '富国天惠' = 161005,
  '景顺鼎益' = 162605,
  '兴全模式' = 163415,
  '万家优选' = 161903,
  '兴全合宜' = 163417,
  '兴全和润' = 163406,
  '白酒基金' = 161725,
}

export const fundCodeList:string[] = fundCode ? [fundCode] : Object.values(FundCodeName).filter(item => !isNaN(item as any)) as string[]
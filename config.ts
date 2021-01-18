

const fundCode:string = process.env.code!

export enum FundCodeName {
  '富国天惠' = 161005,
  '景顺鼎益' = 162605,
  '兴全模式' = 163415,
  '万家优选' = 161903,
  '兴全合宜' = 163417,
}

export const fundCodeList = fundCode ? [fundCode] : [
  '161005',
  '162605',
  // '163402',
  '163415',
  '161903',
  // '162703',
  '163417',
]
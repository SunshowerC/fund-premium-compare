import FundPredictEntity from "./src/entities/fund.entity";
/**
 * 富国天惠成长混合   161005
 * 景顺长城鼎益混合   162605
 * 兴全趋势投资混合   163402
 * 兴全商业模式混合   163415
 * 万家行业优选混合   161903
 * 广发小盘成长混合   162703
 * 兴全合宜混合(LOF) 163417
 */

import { compareFundPremium, DISCOUNT_COST_RATE, FundData, PREMIUM_COST_RATE } from "./src/fund-data-fetch";
import { save } from "./src/orm";


const fundCode:string = process.env.code!
const MAX_NUM = process.env.max ?? 3

const echoReport = (reportList: FundData[][])=>{
  reportList.forEach(dataList => {
    console.log('\n\n')
    console.log(dataList[0].date,dataList[0].fundName,dataList[0].fundCode )

    // 如果最终涨幅与最终溢价率出来了
    if(dataList[0].finalIncrease && dataList[0].finalPremium) {
      const saveList: Omit<FundPredictEntity, 'id'>[] = dataList.map((item: any) => {
        let success = 0

        if(item.premiumProfit![0] === '溢价' && 
          item.finalPremium - PREMIUM_COST_RATE > 0) {
          success = 1
        } else if(item.premiumProfit![0] === '折价' && 
          - item.finalPremium - DISCOUNT_COST_RATE > 0) {
          success = 1
        } else if(
          item.premiumProfit![0] === '无' &&
          (item.finalPremium - PREMIUM_COST_RATE < 0 || - item.finalPremium - DISCOUNT_COST_RATE < 0)
        ){
          success = 1
        } 

        return {
          fundName: item.fundName,
          fundCode: item.fundCode,
          predictDate: item.date,
          predictCompany: item.from,
          predictIncrease: item.estimatedIncreaseRate,
          finalIncrease: item.finalIncrease,
          predictPremium: item.estimatedPremium,
          finalPremium: item.finalPremium,
          error: item.error,
          success,
        }
      })

      save(saveList)
    }
    
    dataList.unshift({
      from: '来源',
      error: '误差' as any,
      estimatedVal: '估值' as any,
      estimatedPremium: '估值溢价率' as any,
      estimatedIncreaseRate: '估算涨幅' as any,
      finalIncrease: '实际涨幅' as any,
      finalPremium: '最终溢价率' as any,
      premiumProfit: `套利建议` as any
    })
    
    console.table(dataList, [
      'from',
      `estimatedIncreaseRate`,
      `finalIncrease`,
      `premiumProfit`,
      'estimatedPremium',
      'finalPremium',
      'error',
    ])
  })
}

async function main() {
  const fundCodeList = fundCode ? [fundCode] : [
    '161005',
    '162605',
    // '163402',
    '163415',
    '161903',
    // '162703',
    '163417',
  ]

  const allFundReport = fundCodeList.map(compareFundPremium)

  const allReportList = await Promise.all(allFundReport)

  const shouldDoReport = allReportList.filter(dataList => {
    const avaiableCount = dataList.filter(item => item.premiumProfit![0] !== '无').length
    // 适合操作的报告大于 n 时，认为适合操作
    return avaiableCount >= MAX_NUM
  })
  

  if(shouldDoReport.length === 0) {
    echoReport(allReportList)
    console.log('\n-------无操作建议-------\n')
    console.log('\n-------无操作建议-------\n')
    console.log('\n-------无操作建议-------\n')
  } else {
    echoReport(shouldDoReport)

    console.log('\n-------以上为本日操作建议-------\n')
  }


}



main()
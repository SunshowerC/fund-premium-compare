import colors from 'colors/safe'
import { fundCodeList } from './config';
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
import { AggrResult, findFundData, SucRateResult, save } from "./src/services";
import { numPadEnd, toFixed } from "./src/utils";

const DIVISION = `--------------------------------------` 

const MAX_NUM = process.env.max ?? 3

const shouldSave = ()=>{
  const now = new Date()
  const day = now.getDay()
   
  // 如果是周末
  if([0,6].includes(day)) {
    return false
  } 
  return true
}

/**
 * 格式化数据并保存到数据库
 */
const saveData = (dataList: FundData[])=>{
  // 如果最终涨幅或者最终溢价率出来了
  if(dataList[0].finalVal && shouldSave()) {
    const saveList: Omit<FundPredictEntity, 'id'|'createDate'|'updateDate'>[] = dataList.map((item: any) => {
      let success = 0

      // if(item.fundName === '景顺长城鼎益混合(LOF)' && item.from === '好买基金网') {
      //   console.log('debug')
      // }

      if(item.premiumProfit![0] === '溢' && 
        item.finalPremium - PREMIUM_COST_RATE > 0) {
        success = 1
      } else if(item.premiumProfit![0] === '折' && 
        - item.finalPremium - DISCOUNT_COST_RATE > 0) {
        success = 1
      } else if(
        // 如果无操作正确，那么最终溢价率应该在 -0.51 - 0.1 ~ 0.16 + 0.1 之间
        // 无操作也可能是因为溢价太小，套利风险大，所以只有一丢溢价执行 无操作也视为正确
        item.premiumProfit![0] === '无' &&
        (item.finalPremium  <  PREMIUM_COST_RATE+0.1 && item.finalPremium   > -DISCOUNT_COST_RATE-0.1)
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
}

/**
 * 计算当天套利可信度
 */
const calcReliability = (dataList: FundData[])=>{
  const result = dataList.reduce((result, cur)=>{
    const suggest = cur.premiumProfit?.[0]
    if(suggest) {
      result[suggest] = result[suggest] + ((cur as any).predictSucRate || 0)
    }
    return result
  }, {
    '折':0,
    无:0,
    溢:0,
  })

  let total = 0
  const maxNumKey = Object.entries(result).reduce((maxNumKey, [key, val])=>{
    total += val
    if(result[maxNumKey] < val) {
      maxNumKey = key
    }
    return maxNumKey
  }, '折')

  const  rate = toFixed(result[maxNumKey] / total * 100, 2) 
  return [maxNumKey, rate + '%']
}

// 打印出成功率相关数据
const echoRate = (map: SucRateResult, preMsg: string)=>{
  const {total, sucRate, premiumTotal, premiumSucRate, discountTotal, discountSucRate, noneTotal, noneSucRate, realPremiumCount, realDiscountCount, realNoneCount} = map
  if(!realPremiumCount) {
    console.log('暂无数据')
    return false
  }
  console.log(`${preMsg},基金总套利 ${total}次，${colors.magenta(`成功率: ${toFixed(sucRate*100)}%`)}`)

  console.log(`其${colors.green(`溢价`)}套利 ${premiumTotal}次(占比${colors.red(toFixed(premiumTotal/total*100).toString())}%) ，${colors.magenta(`成功率: ${toFixed(premiumSucRate*100)}%`)}, 真实溢价${realPremiumCount.count}次，平均套利收益:${toFixed(realPremiumCount.avg)}%`)

  console.log(`其${colors.green(`折价`)}套利 ${discountTotal}次(占比${colors.blue(toFixed(discountTotal/total*100).toString())}%)，${colors.magenta(`成功率: ${toFixed(discountSucRate*100)}%`)}, 真实折价${realDiscountCount.count}次，平均套利收益:${toFixed(realDiscountCount.avg)}%`)

  console.log(`无套利操作 ${noneTotal}次(占比${toFixed(noneTotal/total*100)}%)，${colors.magenta(`成功率: ${toFixed(noneSucRate*100)}%`)}, 真实无套利${realNoneCount}次`)

  console.log(DIVISION)
}

const echoReport = async (reportList: FundData[][])=>{
  const list = await findFundData()
  const aggr = new AggrResult(list)

  const currentDays = 14

  // 新加进来的基金，可能 avgError[新基金] === undefined 
  const avgError = aggr.getAvgError(currentDays)
  const rateResult = aggr.getPredictSuccessRate(new Date(), currentDays)
  // const premiumRateMap30 = aggr.premiumSuccessRate(30)
  const premiumRateMap14 = aggr.premiumSuccessRate(currentDays)

  reportList.forEach(dataList => {
    console.log('\n\n')
    console.log(dataList[0].date,dataList[0].fundName,dataList[0].fundCode )
    if(!avgError[dataList[0].fundName!]) {
      console.warn(dataList[0].fundName, '暂无无统计数据', )
    }
    const {positive, negative, times} = avgError[dataList[0].fundName!] ?? {}
    // 最近 30 天的
    // const operateSuc30 = premiumRateMap30[dataList[0].fundName!] ?? {}

    const operateSuc14 = premiumRateMap14[dataList[0].fundName!] ?? {}
    




    dataList.forEach(item => {
      const {positive: innerPositive, negative: innerNegative, times: innerTimes} = avgError[`${item.from},${item.fundName}`] ?? {};
      const predictSucRate = rateResult[`${item.from},${item.fundName}`] ?? {};

      (item as any).avgError = `${innerTimes?.[0]}负:${numPadEnd(innerNegative, 6) } ${innerTimes?.[1]}正:${numPadEnd(innerPositive, 5)}`;
      (item as any).predictSucRate = predictSucRate
    })

    const reliability = calcReliability(dataList)

    

    console.log(`基金平均负值误差(${times?.[0]}次)为：${negative}`)
    console.log(`基金平均正值误差(${times?.[1]}次)为：${positive}`)
    console.log(DIVISION)
    // echoRate(operateSuc30, '最近30天')
    echoRate(operateSuc14, `最近${currentDays}天`)
    


    console.log(colors.red(`本次套利可信度: ${reliability}`))
    saveData(dataList)

    dataList.unshift({
      from: '来源',
      error: '误差' as any,
      estimatedVal: '估值' as any,
      estimatedPremium: '估值溢价率' as any,
      estimatedIncreaseRate: '估算涨幅' as any,
      finalIncrease: '实际涨幅' as any,
      finalPremium: '最终溢价率' as any,
      premiumProfit: `套利建议` as any,
      avgError: `平均溢价误差` as any,
      predictSucRate: `预测成功率` as any,
    } as any)
    
    console.table(dataList, [
      'from',
      `estimatedIncreaseRate`,
      'avgError',
      `predictSucRate`,
      `premiumProfit`,
      // `finalIncrease`,
      'estimatedPremium',
      'finalPremium',
      // 'error',
    ])


    

  })
}

async function main() {
   

  const allFundReport = fundCodeList.map(compareFundPremium)

  const allReportList = await Promise.all(allFundReport)

  const shouldDoReport = allReportList.filter(dataList => {
    const avaiableCount = dataList.filter(item => item.premiumProfit![0] !== '无').length
    // 适合操作的报告大于 n 时，认为适合操作
    return avaiableCount >= MAX_NUM
  })
  

  if(shouldDoReport.length === 0) {
    await echoReport(allReportList)
    console.log('\n-------无操作建议-------\n')
    console.log('\n-------无操作建议-------\n')
    console.log('\n-------无操作建议-------\n')
  } else {
    await echoReport(shouldDoReport)

    console.log('\n-------以上为本日操作建议-------\n')
  }

  setTimeout(process.exit, 5000)

}


// analyse()
console.log('\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n开始计算...')
main()



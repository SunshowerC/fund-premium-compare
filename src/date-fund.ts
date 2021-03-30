import { result } from "lodash"
import { Repository } from "typeorm"
import { fundCodeList, FundCodeName } from "../config"
/**
 * 每天的分时数据
 */

import { getCurrConnection } from "../ormconfig"
import DateFundEntity from "./entities/date-fund.entity"
import { getCurDateFund } from "./fund-data-fetch"
import { dateFormat, getFundDate, sleep } from "./utils"
import { calcMACD, IndexData, roundToFix } from "./utils/macd"


// 红柱持续时长
const LAST_COUNT = 1
// 百分位
const POSITION = 0.2 

// 可交易的时间
const TXN_TIME_RANGE = ['14:30', '15:30']

// 固定时间卖出，如果没有设置，即按 macd 判断卖出
const FIX_SELL_POINT = null // '14:50'

interface JsonData {
  preClose: number
  data: [string,string][]  // [time, val]
}

let curRepo: Repository<DateFundEntity>

const getCurRepo = async()=>{
  const connection = await getCurrConnection()
  if(!curRepo) {
    curRepo = connection.getRepository(DateFundEntity)
  }
  return curRepo
}

/**
 * 每天的基金数据
 */
export class DateFund {
  constructor() {
      
  }

  async init() {
    if(!curRepo) {
      await getCurRepo()
    }
  }
  
  /**
   * 保存单个基金的数据
   */
  async saveData(fundCode: string|number) {
    await this.init()
    const {name, date, ...result} = await  getCurDateFund(fundCode)

    const saveResult = await curRepo.save([{
        fundName: name,
        fundDate: date,
        fundCode: fundCode.toString(),
        jsonData: JSON.stringify(result)
    }]).catch(e => {
      if(e.code === 'ER_DUP_ENTRY') {
        setTimeout(process.exit, 5000)
        return 'ignore duplicated'
      } else {
        throw new Error(e)
      }
    })
    console.log(`save ${name}(${fundCode}) success`)
    return saveResult
  }

  /**
   * 列表数据转 map
   * @param result 
   */
  private getDataMap(result: DateFundEntity) {
    const {jsonData, fundDate} = result
    const json: JsonData = JSON.parse(jsonData)

    const preClose = json.preClose

    const dataMap = json.data.reduce<Record<string, IndexData>>((map, item)=>{
      const curData = `${fundDate} ${item[0]}`
      map[curData] = {
        val: Number(item[1]),
        date: curData,
        increase: roundToFix((Number(item[1]) - preClose) / preClose * 100, 3) 
      } as any
      return map
    }, {})

    return dataMap
  }

  /**
   * 获取当天 macd 值，分位
   * @param fundCode 
   * @param date 
   */
  async getData(fundCode: string|number, date:string) {
    await this.init()
    const result = await curRepo.findOne({
      fundCode: fundCode.toString(),
      fundDate: date
    })
    if(!result) {
      return null
    }
    if(!result?.jsonData) {
      throw new Error('json data null')
    }

    const map = this.getDataMap(result)

    const resultMap = calcMACD(map)


    return resultMap
  }


  /**
   * 获取可用的交易日
   */
  async getValidDates(): Promise<string[]> {
    await this.init()
    const list = await curRepo.manager.query(`
    select fund_date from date_fund_tab GROUP BY fund_date;
    `)
    

    const result = list.map(item => dateFormat(item.fund_date, 'yyyy-MM-dd'))
    
    return result
  }

  /**
   * 计算连续红柱/绿柱 的次数
   */
  private countSameSideInterval(dataMap: Record<string, IndexData>, datetime: string):number {
    const list = Object.values(dataMap)
    const point = dataMap[datetime]
    const signal = point.macd

    const idx = list.findIndex(item => item.date === datetime)
    let count = 1
    let idx1 = idx
    let idx2 = idx

    while(true) {
      idx1--
      // 如果是同一边的
      if(list[idx1]?.macd * signal > 0) {
        count++
      } else {
        break
      }
    }

    while(true) {
      idx2++
      // 如果是同一边的
      if(list[idx2]?.macd * signal > 0) {
        count++
      } else {
        break
      }
    }

    return count

  }

  /**
   * 指定时间卖出
   */
  calcSellPointByTime(map: Record<string, IndexData>, time: string) {
    const list = Object.values(map)
    const sellPoint = list.find(item => {
      return item.date === time
    })
    return [sellPoint, list[list.length - 1]]
    
  }

  /**
   * 在某个时间段内的合理卖点
   */
  calcSellPointByMACD(map: Record<string, IndexData>, range: [string, string], sellPosition: number) {
    const list = Object.values(map)
    const filteredList = list.filter(item => {
      return item.date > range[0] && item.date < range[1]
    })

    // 是否预备卖出
    let prepareToSell = false
    let sellPoint: IndexData|undefined

    for(let item of filteredList) {
      // 一开始一直 红柱，
      if(item.macd > 0 ) {
        const count = this.countSameSideInterval(map, item.date)
        // 如果红柱持续了10分钟左右
        if(count >= LAST_COUNT) {
          prepareToSell = true
        }

        // 死叉快要出现 即可提前预判卖出
        if(prepareToSell && item.macdPosition < sellPosition) {
          sellPoint = item
          break
        }
      } else {
        // 出现绿柱，即死叉出现
        if(prepareToSell) {
          sellPoint = item
          break
        }
      }
    }

    return [sellPoint, list[list.length - 1]]
 

  }

  /**
   * 交易
   */
  async txnFund(fundCode: string, date:string) {
    const map = await this.getData(fundCode, date)
    if(!map) {
      return undefined
    }

    const [sellPoint, latestPoint] = FIX_SELL_POINT ? this.calcSellPointByTime(map , `${date} ${FIX_SELL_POINT}`) : this.calcSellPointByMACD(map, [`${date} ${TXN_TIME_RANGE[0]}`, `${date} ${TXN_TIME_RANGE[1]}`], POSITION)

    if(!sellPoint) {
      return null
    }

    return {
      fundCode,
      sellPoint,
      latestPoint: latestPoint!,
      tIncrease: roundToFix(sellPoint.increase - latestPoint!.increase - 0.01, 3) 
    }

    // if(sellPoint) {
    //   const tIncrease = roundToFix(sellPoint.increase - latestPoint!.increase - 0.01, 3) 
    //   console.log(`${FundCodeName[fundCode]} 卖点: ${sellPoint.date}, 涨幅：${sellPoint.increase}%， 收盘涨幅：${latestPoint!.increase}%, T：${tIncrease}%`)
    // } else {
    //   console.log(FundCodeName[fundCode],'无最佳卖点')
    // }

  }


  /**
   * 保存多个基金的数据
   */
  async multipleSave(fundCodes: (number|string)[]) {
    const allProm = fundCodes.map(async (item)=>{
      return this.saveData(item)
    })

    return  Promise.all(allProm)
  }



  async calcAvgTVal(codeList: string[]) {
    const tValMap: Record<string, TVal> = {
      // `code`: { totalT, avgT }
    }
    
  
    const dates = await this.getValidDates();
    
    const allProm = codeList.map(async code => {
  
      const originDaysTxnResult = await Promise.all(dates.map(dateItem => {
        return this.txnFund(code.toString(), dateItem)
      }))
  
      const daysTxnResult = originDaysTxnResult.filter(Boolean) as {
        fundCode: string;
        sellPoint: IndexData;
        latestPoint: IndexData;
        tIncrease: number;
      }[]
  
  
      const totalT = daysTxnResult.reduce<number>((result, cur) => result + cur.tIncrease, 0)
      const avgT = roundToFix(totalT / daysTxnResult.length) 
      
      tValMap[code] = {
        totalT: roundToFix(totalT),
        avgT,
        len: daysTxnResult.length
      }

      // if(typeof txnResult === 'undefined') {
      //   console.error('not a transaction day', FundCodeName[item])
      //   return 
      // }
  
      // if(txnResult) {
      //   const {fundCode, tIncrease, sellPoint, latestPoint} = txnResult
      //   console.log(`${FundCodeName[fundCode]} 卖点: ${sellPoint.date}, 涨幅：${sellPoint.increase}%， 收盘涨幅：${latestPoint!.increase}%, T：${tIncrease}%`)
      // } else {
      //   console.log(FundCodeName[item],'无最佳卖点')
      // }
  
    })

    await Promise.all(allProm)

    return tValMap
  }
}


interface TVal {
  totalT: number, 
  avgT : number
  len: number
}


async function main() {

  
  const tValMap = await (new DateFund().calcAvgTVal(fundCodeList))



  Object.entries(tValMap).forEach(([fundCode, v])=>{
    console.log(`${FundCodeName[fundCode]} 累计做T ${v.len} 次， 总 T 收益：${v.totalT}%, 平均 T 收益：${v.avgT}%`)
  })


  await sleep(5000)
  process.exit(0)
}




main()







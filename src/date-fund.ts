import { result } from "lodash"
import { Repository } from "typeorm"
import { fundCodeList, FundCodeName } from "../config"
/**
 * 每天的分时数据
 */

import { getCurrConnection } from "../ormconfig"
import DateFundEntity from "./entities/date-fund.entity"
import { getCurDateFund } from "./fund-data-fetch"
import { dateFormat } from "./utils"
import { calcMACD, IndexData, roundToFix } from "./utils/macd"


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
    if(!result?.jsonData) {
      throw new Error('json data null')
    }

    const map = this.getDataMap(result)

    const resultMap = calcMACD(map)


    return resultMap
  }

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
   * 在某个时间段内的合理卖点
   */
  calcSellPoint(map: Record<string, IndexData>, range: [string, string], sellPosition: number) {
    const list = Object.values(map)
    const filteredList = list.filter(item => {
      return item.date > range[0] && item.date < range[1]
    })

    // 是否预备卖出
    let prepareToSell = false
    let sellPoint: IndexData|undefined

    for(let item of filteredList) {
      if(item.macd > 0 ) {
        const count = this.countSameSideInterval(map, item.date)
        // 如果红柱持续了10分钟左右
        if(count >= 10) {
          prepareToSell = true
        }

        // 死叉快要出现
        if(prepareToSell && item.macdPosition < sellPosition) {
          sellPoint = item
          break
        }
      } else {
        // 死叉出现
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
    const [sellPoint, latestPoint] = this.calcSellPoint(map, [`${date} 14:30`, `${date} 15:30`], 0.3)

    if(sellPoint) {
      const tIncrease = roundToFix(sellPoint.increase - latestPoint!.increase - 0.01, 3) 
      console.log(`${FundCodeName[fundCode]} 卖点: ${sellPoint.date}, 涨幅：${sellPoint.increase}%， 收盘涨幅：${latestPoint!.increase}%, T：${tIncrease}%`)
    } else {
      console.log(FundCodeName[fundCode],'无最佳卖点')
    }

  }



  async multipleSave(fundCodes: (number|string)[]) {
    const allProm = fundCodes.map(async (item)=>{
      return this.saveData(item)
    })

    return  Promise.all(allProm)
  }
}


const df = new DateFund()
df.multipleSave(fundCodeList)
.then(()=>{
  fundCodeList.forEach(item => {
    df.txnFund(item, dateFormat(Date.now(), `yyyy-MM-dd`))
    // df.txnFund(item, `2021-01-20`)
  })
})



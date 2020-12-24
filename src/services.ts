import { Entity, Column, Index, ConnectionOptions, PrimaryColumn, createConnection, Connection, Repository } from 'typeorm'
import path from 'path'
import FundPredictEntity, { PredictStatus } from './entities/fund.entity'
import { result, sum } from 'lodash'
import { toFixed } from './utils'
import { DISCOUNT_COST_RATE, ERROR_GAP, PREMIUM_COST_RATE } from './fund-data-fetch'
const ormconfig: ConnectionOptions = {
  type: 'mysql',
  entities: [path.join(__dirname, 'entities/*.entity{.ts,.js}')],
  synchronize: false,
  port: 3306,
  username: 'root',
  // host: 'localhost',
  // password: '12345678',
  // database: 'fund_tab',

  host: '34.97.207.239',  
  password: 'MDbai1@3',
  database: 'fund',
}


let connection:Connection
let fundPredictRepo: Repository<FundPredictEntity>


const getCurrConnection = async()=>{
  if(!connection) {
    connection = await createConnection(ormconfig)
  }
  return connection
}

const getCurRepo = async()=>{
  const connection = await getCurrConnection()
  if(!fundPredictRepo) {
    fundPredictRepo = connection.getRepository(FundPredictEntity)
  }
  return fundPredictRepo
}

export const save = async(list: Omit<FundPredictEntity, 'id'|'createDate'|'updateDate'>[])=>{
  const repo = await getCurRepo()
  const normalList = list.filter(item => {
    if(isNaN(item.predictPremium)) {
      console.log('数据异常', item)   
      return false   
    } else {
      return true
    }

  })
  const result = await repo.save(normalList).catch(e => {
    if(e.code === 'ER_DUP_ENTRY') {
      setTimeout(process.exit, 5000)
      return 'ignore duplicated'
    } else {
      throw new Error(e)
    }
  })
  
  console.log('save result', result?.[0])

  return result
}


/**
 * 查找所有数据
 */
export const findFundData = async (entity?: FundPredictEntity)=>{
  const repo = await getCurRepo()
  const [list, ] = await repo.findAndCount(entity)


  return list
}

export interface SucRateResult  {
  success:number, 
  total: number, 
  sucRate: number,

  premiumSucCount:number, 
  premiumTotal: number, 
  premiumSucRate: number,

  discountSucCount:number, 
  discountTotal: number, 
  discountSucRate: number,

  noneSucCount:number, 
  noneTotal: number, 
  noneSucRate: number,
}

export class AggrResult {
  public fundNames: string[] = []
  public companies: string[] = []
  public groupDataMap: Record<string, FundPredictEntity[]> = {}
  /** 
   * 基金-日期 为 key 分组
   * */
  public groupFundDateMap: Record<string, FundPredictEntity[]> = {}
  private now = new Date()

  constructor(public data: FundPredictEntity[]) { 


    const map = data.reduce((result, cur)=>{
      // 源-基金 为 key 分组
      if(!this.groupDataMap[`${cur.predictCompany},${cur.fundName}`]) {
        this.groupDataMap[`${cur.predictCompany},${cur.fundName}`] = []
      }  
      this.groupDataMap[`${cur.predictCompany},${cur.fundName}`].push(cur)


      // 基金-日期 为 key 分组
      if(!this.groupFundDateMap[`${cur.fundName},${cur.predictDate}`]) {
        this.groupFundDateMap[`${cur.fundName},${cur.predictDate}`] = []
      }  
      this.groupFundDateMap[`${cur.fundName},${cur.predictDate}`].push(cur)

      // 基金 为 key 分组
      if(!this.groupDataMap[`${cur.fundName}`]) {
        this.groupDataMap[`${cur.fundName}`] = []
      }  
      this.groupDataMap[`${cur.fundName}`].push(cur)


      // 预测源 为 key 分组
      if(!this.groupDataMap[`${cur.predictCompany}`]) {
        this.groupDataMap[`${cur.predictCompany}`] = []
      }  
      this.groupDataMap[`${cur.predictCompany}`].push(cur)

      if(!result.companies.has(cur.predictCompany)) {
        result.companies.set(cur.predictCompany, 1)
      } 

      if(!result.fundNames.has(cur.fundName)) {
        result.fundNames.set(cur.fundName, 1)
      } 
      return result
    }, {
      fundNames: new Map(),
      companies: new Map()
    })

    this.companies = Array.from(map.companies.keys())
    this.fundNames = Array.from(map.fundNames.keys())

    this.calcPredict()
  }

  private dateDiff(a, b) {
    const firstDate = new Date(a)
    const secondDate = new Date(b)
    const oneDayMs = 24 * 60 * 60 * 1000
    return (secondDate.getTime() - firstDate.getTime()) / oneDayMs
  }


  /**
   * 获取每一个源对每一个基金的平均误差统计
   * 2. 预测源+基金 近期【最近14天，30天，60天，90天】平均低估（error<0）
   * 3. 预测源+基金 近期【最近14天，30天，60天，90天】平均高估（error>0）
   */
  getAvgError(durationDays?: number) {
    interface AvgData {
      positive: number[]
      negative: number[]
    }
    interface AvgResult {
      positive: number
      negative: number
      times: [number, number] // [negativeTimes, positiveTimes]
    }

    //  误差源数据
    const originAvgData = Object.entries(this.groupDataMap).reduce((result, [curCompanyAndFund, curList])=>{
      result[curCompanyAndFund] = result[curCompanyAndFund] || {
        positive: [],
        negative: []
      }

      curList.forEach((item) => {
        // 只统计最近 durationDays 天的数据， 如果超过了，那就算了
        if(durationDays && this.dateDiff(item.createDate, this.now) > durationDays) {
          return 
        }

        if(item.error > 0) {
          result[curCompanyAndFund].positive.push(item.error)
        } else {
          result[curCompanyAndFund].negative.push(item.error)
        }
      })


      return result
    }, {
    } as Record<string, AvgData>)

    // 平均误差结果
    const avgResult = Object.entries(originAvgData).reduce((result, [curKey, curData])=>{
      result[curKey] = {
        negative: curData.negative.length > 0 ? toFixed(sum(curData.negative) / curData.negative.length)  : 0,
        positive: curData.positive.length > 0 ? toFixed(sum(curData.positive) / curData.positive.length)  : 0,
        times: [curData.negative.length, curData.positive.length]
      } 
      // result[curKey].negative = sum(curData.negative) / curData.negative.length
      // result[curKey].positive = sum(curData.positive) / curData.positive.length

      return result
    }, {} as Record<string, AvgResult>)
    
    return avgResult
  }

  /**
   * 每个源-基金的预测成功率
   * 1. 每个 预测源+基金【最近14天，30天，60天，90天】的成功率
   */
  getPredictSuccessRate(durationDays?: number) {
    const rateResult = Object.entries(this.groupDataMap).reduce((result, [curCompanyAndFund, curList])=>{
      const list = curList.filter(item => {
        if(!durationDays){
          return true
        } else {
          return this.dateDiff(item.createDate, this.now) < durationDays
        }
      })

      result[curCompanyAndFund] = toFixed(list.filter(item => item.success === 1).length / list.length) 
 
      return result
    }, {
    } as Record<string, number>)

    return rateResult
  }

  /**
   * 计算每一个数据源每天的预测操作
   */
  private calcPredict() {
    Object.entries(this.groupFundDateMap)
    .forEach(([curKey,curList]) => {
      // const [fundName] = curKey.split(',')
      // 预测操作，不一定和实际结果一样
      curList.forEach(item => {
        if(item.predictPremium - PREMIUM_COST_RATE - ERROR_GAP > 0) {
          Object.assign(item, {
            shouldDo: '溢'
          })
        } else if(  - item.predictPremium - DISCOUNT_COST_RATE - ERROR_GAP > 0) {
          Object.assign(item, {
            shouldDo: '折'
          })
        } else {
          Object.assign(item, {
            shouldDo: '无'
          })
        }
      })
    })
  }

  /**
   * 计算当天应该进行的操作
   */
  private curDatePredictOperation = (dataList: FundPredictEntity[], rateResult: Record<string, number>)=>{
    const result = dataList.reduce((result, cur)=>{
      const suggest = cur.shouldDo!
      if(suggest) {
        const predictSucRate = rateResult[`${cur.predictCompany},${cur.fundName}`]
        result[suggest] = result[suggest] + (predictSucRate || 0)
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

  /**
   * 基金被套利成功概率 = 当天有 4 个源以上预测 溢价/折价 ，且最终结果符合的次数，除以 当天有 4 个源以上预测 溢价/折价的总次数
   */
  premiumSuccessRate(durationDays: number) {
    const predictSuccessRate = this.getPredictSuccessRate(durationDays)
    
    
    const fundSucMap: Record<string, SucRateResult> = {}

    Object.entries(this.groupFundDateMap)
    .filter(([curKey,curDateList]) => {
      // 过滤出 日期区间内的数据

      const [, date] = curKey.split(',')
      if(!durationDays){
        return true
      } else {
        return this.dateDiff(date, this.now) < durationDays
      }
    })
    .forEach(([curKey,curDateList]) => {
      // curDateList 是 当天的数据

      const [fundName] = curKey.split(',')
      

      fundSucMap[fundName] = fundSucMap[fundName] || {
        success: 0,
        total: 0,
        
        premiumSucCount: 0,
        premiumTotal: 0,

        discountSucCount: 0,
        discountTotal: 0,

        noneSucCount: 0,
        noneTotal: 0,
      }

      // 折价套利胜率
      // 溢价套利胜率
      // 逻辑：算出当天应该折价还是溢价套利，结果是否溢价【>0.16】还是折价[<-0.51]
      // 算出所有天数的 discountSuc / doDiscountTotal， 和 premiumSuc / doPremiumTotal
      // 当天应该操作什么
      const [shouldDo] = this.curDatePredictOperation(curDateList, predictSuccessRate)

      // 根据各个源的预测，是否操作成功【有 4 个源的都预测成功，认为当天操作成功】
      // 注意：此处不区分到底是 折价操作成功，还是溢价操作成功，还是 无操作成功
      // 当天是否操作成功
      let operateSuc = 0, premiumSuc = 0, discountSuc = 0, nonSuc = 0

      switch(shouldDo) {
        case '溢':
          fundSucMap[fundName].premiumTotal++
          if(curDateList[0].finalPremium - PREMIUM_COST_RATE > 0) {
            premiumSuc = 1
            fundSucMap[fundName].premiumSucCount++
          }
          break

        case '折':
          fundSucMap[fundName].discountTotal++
          if(- curDateList[0].finalPremium - DISCOUNT_COST_RATE > 0) {
            discountSuc = 1
            fundSucMap[fundName].discountSucCount++
          }
          break


        case '无':
          fundSucMap[fundName].noneTotal++
          if(curDateList[0].finalPremium  <  PREMIUM_COST_RATE+0.1 && curDateList[0].finalPremium   > -DISCOUNT_COST_RATE-0.1) {
            nonSuc = 1
            fundSucMap[fundName].noneSucCount++
          }
          break
      }
      fundSucMap[fundName].total++

      
      if(premiumSuc || discountSuc || nonSuc) {
        fundSucMap[fundName].success++  
        operateSuc = 1
      }


      
    })

    Object.entries(fundSucMap).forEach(([fundName, val]) => {
      fundSucMap[fundName].sucRate = toFixed(val.success / val.total) 
      fundSucMap[fundName].premiumSucRate = toFixed(val.premiumSucCount / val.premiumTotal) 
      fundSucMap[fundName].discountSucRate = toFixed(val.discountSucCount / val.discountTotal) 
      fundSucMap[fundName].noneSucRate = toFixed(val.noneSucCount / val.noneTotal) 
    })
    
    return fundSucMap
    
  }

}





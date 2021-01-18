/**
 * 指数数据
 */
export interface IndexData {
  date: string
  val: number
  increase: number
  
  ema12: number
  ema26: number
  diff: number
  // ema9: number 
  dea: number // dea = ema(diff, 9)
  macd: number

  macdPosition: number // 当前 macd 百分位
  
  
  
}

/**
 * 数字四舍五入同时保留几位小数
 * @param num 数字
 * @param fractionDigits 保留几位小数
 */
export const roundToFix = (num: number|string, fractionDigits: number = 2):number=>{
  const powNum = Math.pow(10, fractionDigits)
  return Number((Math.round(Number(num) * powNum) / powNum).toFixed(fractionDigits))
}



const EMA = (close: number, days: number, opt: {
  previousDate?: string,
  curDate: string,
  data: Record<string, IndexData>
}): number => {

  const { previousDate, curDate } = opt
  // 如果是首日上市价，那么初始 ema 为首日收盘价
  if (!previousDate) {
    return opt.data[curDate].val
  }
  const field = days === 9 ? `dea` : `ema${days}`
  const previousEMA = Number(opt.data[previousDate][field])

  return (2 * close + (days - 1) * previousEMA) / (days + 1)
}

/**
 * 计算 macd 百分位
 * @param indexData - 指数数据 
 */
const calcMacdPosition = (indexData: IndexData[])=>{
  let indexDataGroups: IndexData[][] = []
  // 按照绿柱还是红柱进行分组
  indexDataGroups = indexData.reduce((result ,cur, idx) => {
    if(!indexData[idx-1]) {
      result.push([cur])
    } else {
      if(indexData[idx-1].macd * cur.macd >= 0) {
        result[result.length - 1].push(cur)
      } else {
        result.push([cur])
      }
    }
  
    return result 
  }, [] as IndexData[][])

  
  // 第一天的 macd 是 0
  indexData[0].macdPosition = 0

  indexDataGroups.forEach((curIndexGroup)=>{
    // const maxMacd = Math.max(...curIndexGroup.map(item => Math.abs(item.macd)))
    curIndexGroup.forEach((item,idx) => {
      const prevTimeList = curIndexGroup.slice(0, idx+1)
      const maxMacd = Math.max(...prevTimeList.map(item => Math.abs(item.macd)))
      const position = maxMacd === 0 ? 0 : Math.abs(item.macd) / maxMacd
      item.macdPosition = roundToFix(position, 8)
    })
  })
}



/**
 * 计算 macd 值
 * @param indexDataMap 源数据 map 值
 */
export const calcMACD = (indexDataMap: Record<string, IndexData>) => {
  const indexList = Object.values(indexDataMap)

  indexList.forEach((item, index) => {
    const curObj = item
    if (curObj.ema12 || curObj.ema12 === 0) {
      return
    }
    const previousDate = indexList[index - 1]?.date  
    
    curObj.ema12 = EMA(curObj.val, 12, {
      previousDate,
      curDate: curObj.date,
      data: indexDataMap
    })
    curObj.ema26 = EMA(curObj.val, 26, {
      previousDate,
      curDate: curObj.date,
      data: indexDataMap
    })

    curObj.diff = curObj.ema12 - curObj.ema26
    curObj.dea = previousDate ? EMA(curObj.diff, 9, {
      previousDate,
      curDate: curObj.date,
      data: indexDataMap
    }) : 0
    curObj.macd = 2 * (curObj.diff - curObj.dea)
  })

  calcMacdPosition(indexList)

  return indexDataMap
}
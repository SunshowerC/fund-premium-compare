

export const dateFormat = (dateInput, format = 'yyyy-MM-dd HH:mm:ss') => {
  const dateObj = new Date(dateInput)

  if (!dateObj.getFullYear()) {
    console.error(dateInput, dateObj)
    return dateInput
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
  const [year, month, date, hour, minute, second] = [
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    dateObj.getHours(),
    dateObj.getMinutes(),
    dateObj.getSeconds()
  ]

  const dateMap = {
    yyyy: year, // 年份

    eM: months[month], // 英语月份
    MM: (month + 1 + '').padStart(2, '0'), // 月份，两位数加0
    M: month + 1, // 月份，不加0

    dd: (date + '').padStart(2, '0'), // 日期，两位数加0
    d: date, // 日期，不加0

    HH: (hour + '').padStart(2, '0'), // 24小时进制，两位数加0
    H: hour,
    hh: (hour % 12 + '').padStart(2, '0'), // 12小时进制
    h: hour % 12,
    mer: hour > 12 ? 'pm' : 'am', // 上午还是下午

    mm: (minute + '').padStart(2, '0'), // 分钟
    m: minute,

    ss: (second + '').padStart(2, '0'), // 秒
    s: second
  }

  const reg = /eM|mer|yyyy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s/g

  return format.replace(reg, (match) => dateMap[match])
}


export const toFixed = (num: number, len: number = 3):number=>{
  // const pow = Math.pow(10, len)

  // return Number((Math.round(num * pow)/pow).toFixed(len))

  return Number((num.toFixed(len)))
}


export const numPadEnd = (input:any, len: number, str='0')=>{
  if(!input) {
    return input
  }
  const result:string = input.toString()
  return result.padEnd(len, str)
}


export const sleep = async(delay:number):Promise<undefined>=>{
  return new Promise((resolve)=>{
      setTimeout(resolve, delay)
  })
}

/**
 * 如果超过 timeout 时间，返回 null
 */
export const race = <T>(prom: Promise<T>, timeout: number = 10000):Promise<T|undefined>=>{
  return Promise.race([
    prom,
    sleep(timeout)
  ])
}

/**
 * 获取基金层面上的交易日
 */
export const getFundDate = ()=>{
  const now = Date.now()
  let curDate = dateFormat(now, `yyyy-MM-dd`)
  const  hour = Number(dateFormat(now, `H`))

  // 这是昨天的数据
  if(hour >= 0 && hour <= 9) {
    curDate = dateFormat(new Date(now - 24 * 60 * 60 * 1000), `yyyy-MM-dd`)
  }
  return curDate
}

/**
 * 是否是指数基金
 * @param fundCode 
 */
export const isIndex = (fundCode:string|number) => {
  const idxCodeList  =  ['161725']
  return idxCodeList.includes(fundCode.toString())
}
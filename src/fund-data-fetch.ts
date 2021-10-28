import axios from 'axios'
import fetch from 'node-fetch'
import {JSDOM} from 'jsdom'
import { dateFormat, getFundDate, isIndex, race } from './utils'


export interface FundData {
  // 来源
  from: string
  fundName?: string 
  fundCode?: string
  date?: string 

  // 单位净值，开盘价, 不会变
  unitVal?: number 

  // 场内实时价格， 所有基金数据源的同一时间 不会变
  realTimeVal?: number

  // 收盘净值, 只有收盘时间才有，场外申购的净值，到晚上才会公布
  finalVal?: number

  

  // 最终溢价率
  finalPremium?: number

  // 以下数据，不同平台数据不一样
  // 盘中估值，估算净值
  estimatedVal: number
  // 估算涨幅
  estimatedIncreaseRate?: number

  // 结果出来后的涨幅
  finalIncrease?: number

  // 误差
  error?: number 

  // 估算溢价
  estimatedPremium?: number

  // 溢价套利
  premiumProfit?: [string, number]
}

type ConstFund = Required<Pick<FundData, 'fundCode'|'fundName'|'date'|'unitVal'|'realTimeVal'|'finalVal'|'finalIncrease'>>

export const PREMIUM_COST_RATE = 0.16 // 卖出+申购成本：0.16
export const DISCOUNT_COST_RATE = 0.51 // 买入+赎回成本：0.51

// 误差区间，一般认为误差不会超过 0.1，溢价超过 COST_RATE + ERROR_GAP 即有价值套利
export const ERROR_GAP = 0.1 

// 天天基金网
export const getEastmoneyFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`http://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${dateTime}`)
  // data: jsonpgz({"fundcode":"162605","name":"景顺长城鼎益混合(LOF)","jzrq":"2020-09-14","dwjz":"2.7330","gsz":"2.7536","gszzl":"0.75","gztime":"2020-09-15 15:00"});
  let obj: Record<string, string>
  try {
    obj = JSON.parse( data.slice(8,-2))
  } catch (e) {
    console.log('data', data)
    throw new Error('getEastmoneyFund json 解析错误')
  }
   

  const fundData:FundData = {
    from: '天天基金',
    fundName: obj.name,
    fundCode: obj.fundcode,
    unitVal: Number(obj.dwjz),
    estimatedVal: Number(obj.gsz),
  }


  return fundData
}


// 集思录
export const getJisiluFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  // 是否是指数
  const fundType =  isIndex(fundCode) ? 'index' : 'stock' 
  const {data} =  await axios(`https://www.jisilu.cn/data/lof/detail_fund/?___jsl=LST___t=${dateTime}`, {
    "headers": {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,zh-TW;q=0.7,ja;q=0.6,ru;q=0.5",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
      "cookie": "kbz_newcookie=1; kbzw__Session=itei2rkuk8vre7q89l4d2qu165; Hm_lvt_164fe01b1433a19b507595a43bf58262=1600096188,1600184288,1600184550,1600184633; Hm_lpvt_164fe01b1433a19b507595a43bf58262=1600188222",
      "referrer": "https://www.jisilu.cn/data/lof/detail/162605",
    },
    data: `is_search=1&fund_id=${fundCode}&fund_type=${fundType}&rp=50&page=1`, 
    "method": "POST",
  })

  if(data.rows.length === 0) {
    return null
  }
  let obj: Record<string, any> = data.rows[0].cell
  if(!obj) {
    console.log(obj)
    throw new Error('集思录 json 数据为空')
  }
  
  let curDate = getFundDate()
  
  const fundData:FundData = {
    from: '集思录网',
    date: curDate,
    fundName: obj.fund_nm,
    fundCode: obj.fund_id,
    // unitVal: Number(obj.dwjz),
    // TODO: 集思录 obj.price 是否有可能不准？
    realTimeVal: Number(obj.price),

    estimatedVal: Number(obj.estimate_value),
    
    // 最终净值， TODO: 可能有问题？
    finalVal: (obj.nav_dt === curDate ) ?   Number(obj.fund_nav) : undefined
  }


  return fundData
}



// 好买基金网
export const getHowBuyFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`https://www.howbuy.com/fund/ajax/gmfund/valuation/valuationnav.htm?jjdm=${fundCode}`)
  const dom = new JSDOM(data)
  
  

  if(!dom) {
    throw new Error('好买基金网数据解析错误')
  } 

  const valDom = dom.window.document.querySelector(`.con_value`)

  const {data: domData} =  await axios.get(`https://www.howbuy.com/fund/${fundCode}/`)
  // 净值 dom
  const finalValDom = new JSDOM(domData)

  if(!finalValDom) {
    throw new Error('好买基金网数据解析错误')
  } 
  const estimatedVal = valDom ? valDom.textContent : '暂无估值'
  
  const finalVal = finalValDom.window.document.querySelector("body  div.shouyi-b.shouyi-l.b1 .dRate")?.textContent

  let curDate = getFundDate()
  const monthDate = dateFormat(curDate, 'MM-dd')

  // 基金净值价格
  const fundFinalValDate = finalValDom.window.document.querySelector("body   div.shouyi-b.shouyi-l.b1 > div.b-0")?.textContent?.match(/\d+-\d+/)?.[0]
  

  const fundData:FundData = {
    from: '好买基金',
    date: curDate,
    // 妈的，好买基金网有时候不准，是昨天的数据
    finalVal: (fundFinalValDate === monthDate ) ?   Number(finalVal) : undefined,
    estimatedVal: Number(estimatedVal)
  }

  return fundData
}


// 爱基金
export const getIFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`http://gz-fund.10jqka.com.cn/?module=api&controller=index&action=chart&info=vm_fd_${fundCode}&start=0930&_=${dateTime}`)
  const obj = data.split(';').pop().split(',')

  if(!obj) {
    throw new Error('同花顺网爱基金数据解析错误')
  } 

   

  const fundData:FundData = {
    from: '同花顺网',
    estimatedVal: Number(obj[1])
  }
  return fundData
}



// 基金买卖网
export const getJJMMFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`http://www.jjmmw.com/fund/ajax/jjgz_timechart/?fund_id=${fundCode}&detail=1&t=`)
  const obj = data.latest

  if(!obj) {
    throw new Error('基金买卖网数据解析错误')
  } 

   

  const fundData:FundData = {
    from: '基金买卖',
    estimatedVal: Number(obj.estnav)
  }

  return fundData
}


/**
 * 
 */
// 新浪财经： http://finance.sina.com.cn/fund/quotes/161005/bc.shtml
export const getSinaFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`https://app.xincai.com/fund/api/jsonp.json/varabc=/XinCaiFundService.getFundYuCeNav?symbol=${fundCode}&___qn=3`)
  
  let estimatedVal 
  try {
    estimatedVal = JSON.parse(data.slice(8,-2)).detail.split(',').pop()
  } catch(e) {
    throw new Error('新浪财经数据解析错误')
  }
   
  const fundData:FundData = {
    from: '新浪财经',
    estimatedVal: Number(estimatedVal)
  }

  return fundData
}


// 获取不变的基金数据
export const getConstFundData = (fundData: FundData[]):ConstFund =>{
  return fundData.reduce((result, cur)=>{
    let finalIncrease = result.finalIncrease ? Number(result.finalIncrease.toFixed(3)) : undefined
    if(result.finalVal && result.unitVal && !finalIncrease) {
      finalIncrease = (result.finalVal - result.unitVal)/result.unitVal * 100
    }
    

    return {
      fundName: result.fundName || cur.fundName,
      fundCode: result.fundCode ||  cur.fundCode,
      date: result.date ||  cur.date,
      unitVal: result.unitVal ||  cur.unitVal,
      finalVal: result.finalVal ||  cur.finalVal,
      finalIncrease,
      realTimeVal: result.realTimeVal ||  cur.realTimeVal,
    } as ConstFund
  }, {} as ConstFund) as any
}

/**
 * 计算每个网站的估值溢价率
 * @param fundData 
 * @param constFund 
 */
export const calcPremium = (fundData: FundData[], constFund: ConstFund)=>{
  fundData.forEach(item => {
    Object.assign(item, constFund)
    item.estimatedPremium = Number(((constFund.realTimeVal - item.estimatedVal) / constFund.realTimeVal * 100).toFixed(3))

    if(item.estimatedPremium - PREMIUM_COST_RATE - ERROR_GAP > 0) {
      item.premiumProfit = [
        `溢`,
        Number((item.estimatedPremium - PREMIUM_COST_RATE).toFixed(3))
      ]
    } else if(  - item.estimatedPremium - DISCOUNT_COST_RATE - ERROR_GAP > 0) {
      item.premiumProfit = [
        `折`,
        Number((- item.estimatedPremium - DISCOUNT_COST_RATE ).toFixed(3))
      ]
    } else {
      item.premiumProfit = [
        `无`,
        NaN
      ]
    }

    

    item.estimatedIncreaseRate = Number(((item.estimatedVal - constFund.unitVal) / constFund.unitVal * 100).toFixed(3))
    
    if(constFund.finalVal) {
      item.finalPremium = Number(((constFund.realTimeVal - constFund.finalVal) / constFund.realTimeVal* 100).toFixed(3))

      item.error = Number((item.finalPremium - item.estimatedPremium).toFixed(3))
    }
  })
}






export const compareFundPremium = async (fundCode: string)=>{
  const fnList = [
    getHowBuyFund,
    getEastmoneyFund,
    getJisiluFund,
    getJJMMFund,
    getIFund,
    getSinaFund
  ]

  const fnName = [
    'getHowBuyFund',
    'getEastmoneyFund',
    'getJisiluFund',
    'getJJMMFund',
    'getIFund',
    'getSinaFund'
  ]

  let dataListWithNull = await Promise.all(
    fnList.map(fn => race(fn(fundCode), 30000))
  )  

  
  const dataList:FundData[] = dataListWithNull.filter((item, idx)=>{
    if(item) {
      return true 
    } else {
      console.error(`拉取数据超时或无该基金数据, ${fnName[idx]}(${fundCode}) `)
      return false
    }
  }) as  FundData[]
  
  
  const constFund = getConstFundData(dataList)
  calcPremium(dataList, constFund)

  return dataList

   

}




/**
 * 拉取当天的基金分时数据
 * @param fundCode 
 * @param dateTime 
 */
export const getCurDateFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data: res} =  await axios.get(`http://push2.eastmoney.com/api/qt/stock/trends2/get?secid=0.${fundCode}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6%2Cf7%2Cf8%2Cf9%2Cf10%2Cf11%2Cf12%2Cf13&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58&iscr=0&ndays=1&_=${dateTime}`, {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,zh-TW;q=0.7,ja;q=0.6,ru;q=0.5",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "cookie": "em_hq_fls=js; intellpositionL=1536px; intellpositionT=455px; HAList=f-0-000001-%u4E0A%u8BC1%u6307%u6570%2Cf-0-399997-%u4E2D%u8BC1%u767D%u9152; AUTH_FUND.EASTMONEY.COM_GSJZ=AUTH*TTJJ*TOKEN; st_si=32836753597000; EMFUND1=null; EMFUND2=null; EMFUND3=null; EMFUND4=null; EMFUND5=null; EMFUND6=null; qgqp_b_id=5383d5b2c937a6f5a648895c7c0312ba; EMFUND0=null; EMFUND7=01-16%2022%3A59%3A50@%23%24%u5357%u65B9%u4E2D%u8BC1%u94F6%u884CETF@%23%24512700; st_asi=delete; EMFUND9=01-16%2023%3A30%3A22@%23%24%u5BCC%u56FD%u5929%u60E0%u6210%u957F%u6DF7%u5408A/B%28LOF%29@%23%24161005; EMFUND8=01-17 23:47:19@#$%u666F%u987A%u957F%u57CE%u9F0E%u76CA%u6DF7%u5408%28LOF%29@%23%24162605; st_pvi=62789366621137; st_sp=2019-03-07%2000%3A52%3A33; st_inirUrl=http%3A%2F%2Ffund.eastmoney.com%2F519019.html; st_sn=58; st_psi=2021011723471963-0-9009330829"
    },
  })
  // data: jsonpgz({"fundcode":"162605","name":"景顺长城鼎益混合(LOF)","jzrq":"2020-09-14","dwjz":"2.7330","gsz":"2.7536","gszzl":"0.75","gztime":"2020-09-15 15:00"});
  const list = res.data.trends
  const preClose = res.data.preClose
  const date: string = dateFormat( res.data.time * 1000, 'yyyy-MM-dd')
  const name = res.data.name

  const data = list.map(item => {
    const [datetime, , val] = item.split(',')
    const [,time] = datetime.split(' ')
    return [time, val]
  })

  return {
    name,
    date,
    preClose, 
    data
  }
}
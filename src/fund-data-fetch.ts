import axios from 'axios'
import fetch from 'node-fetch'
import {JSDOM} from 'jsdom'


interface FundData {
  // 来源
  from: string
  fundName?: string 
  fundCode?: string
  date?: string 

  // 单位净值，开盘价, 不会变
  unitVal?: number 

  // 场内实时价格， 不会变
  realTimeVal?: number

  // 收盘净值, 只有收盘时间才有
  finalVal?: number
  // 最终溢价率
  finalPremium?: number

  // 以下数据，不同平台数据不一样
  // 盘中估值，估算净值
  estimatedVal: number
  // 估算涨幅
  estimatedIncreaseRate?: number
  // 误差
  error?: number 

  // 估算溢价
  estimatedPremium?: number

  
}

type ConstFund = Required<Pick<FundData, 'fundCode'|'fundName'|'date'|'unitVal'|'realTimeVal'|'finalVal'>>

const COST_RATE = 0.16

// 天天基金网
export const getEastmoneyFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`http://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${dateTime}`)
  // data: jsonpgz({"fundcode":"162605","name":"景顺长城鼎益混合(LOF)","jzrq":"2020-09-14","dwjz":"2.7330","gsz":"2.7536","gszzl":"0.75","gztime":"2020-09-15 15:00"});
  let obj: Record<string, string>
  try {
    obj = JSON.parse( data.slice(8,-2))
  } catch (e) {
    throw new Error('getEastmoneyFund json 解析错误')
  }
   

  const fundData:FundData = {
    from: '天天基金网',
    fundName: obj.name,
    fundCode: obj.fundcode,
    unitVal: Number(obj.dwjz),
    estimatedVal: Number(obj.gsz),
  }


  return fundData
}


// 集思录
export const getJisiluFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
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
    data: `is_search=1&fund_id=${fundCode}&fund_type=stock&rp=50&page=1`, 
    "method": "POST",
  })

   
  let obj: Record<string, any> = data.rows[0].cell
  if(!obj) {
    console.log(obj)
    throw new Error('集思录 json 数据为空')
  }
    
  const fundData:FundData = {
    from: '集思录',
    date: obj.nav_dt,
    fundName: obj.fund_nm,
    fundCode: obj.fund_id,
    // unitVal: Number(obj.dwjz),
    realTimeVal: Number(obj.price),

    estimatedVal: Number(obj.estimate_value),
     
    finalVal: Number(obj.fund_nav)
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
  const estimatedVal = dom.window.document.querySelector(`.con_value_up`)!.textContent

   

  const fundData:FundData = {
    from: '好买基金网',
    estimatedVal: Number(estimatedVal)
  }


  return fundData
}


// 爱基金
export const getIFund = async (fundCode: string|number, dateTime: number = Date.now())=>{
  const {data} =  await axios.get(`http://gz-fund.10jqka.com.cn/?module=api&controller=index&action=chart&info=vm_fd_${fundCode}&start=0930&_=${dateTime}`)
  const obj = data.split(';').pop().split(',')

  if(!obj) {
    throw new Error('爱基金数据解析错误')
  } 

   

  const fundData:FundData = {
    from: '同花顺爱基金',
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
    from: '基金买卖网',
    estimatedVal: Number(obj.estnav)
  }

  return fundData
}





export const getConstFundData = (fundData: FundData[]):ConstFund =>{
  return fundData.reduce((result, cur)=>{
    return {
      fundName: result.fundName || cur.fundName,
      fundCode: result.fundCode ||  cur.fundCode,
      date: result.date ||  cur.date,
      unitVal: result.unitVal ||  cur.unitVal,
      finalVal: result.finalVal ||  cur.finalVal,
      realTimeVal: result.realTimeVal ||  cur.realTimeVal,
    }
  }, {} as any) as any
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

    item.estimatedIncreaseRate = Number(((item.estimatedVal - constFund.unitVal) / constFund.unitVal * 100).toFixed(3))
    
    if(constFund.finalVal) {
      item.finalPremium = Number(((constFund.realTimeVal - constFund.finalVal) / constFund.realTimeVal* 100).toFixed(3))

      item.error = item.finalPremium - item.estimatedPremium
    }
  })
}






(async ()=>{
  const fnList = [
    getJisiluFund,
    getHowBuyFund,
    getEastmoneyFund,
    getJJMMFund,
    getIFund,
  ]
  const dataList = await Promise.all(
    fnList.map(fn => fn(162605))
  )  
  
  
  const constFund = getConstFundData(dataList)
  calcPremium(dataList, constFund)
  // console.log('res', dataList)
  console.log(dataList[0].date,dataList[0].fundName,dataList[0].fundCode )
  
  dataList.unshift({
    from: '来源',
    error: '误差' as any,
    estimatedVal: '估值' as any,
    estimatedPremium: '估值溢价率' as any,
    estimatedIncreaseRate: '估算涨幅' as any,
    finalPremium: '最终溢价率' as any,
  })

  console.table(dataList, [
    'from',
    'finalPremium',
    `estimatedIncreaseRate`,
    'estimatedPremium',
    'error'
  ])

  // const formatList = dataList.map(item => {
  //   return {
  //   '------来源------': item.from,
  //   '--误差--': item.error,
  //   '--估值--': item.estimatedVal,
  //   '--估值溢价率--': item.estimatedPremium,
  //   '估算涨幅': item.estimatedIncreaseRate,
  //   '最终溢价率': item.finalPremium,
  // }
  // })

  // console.table(formatList)

})()



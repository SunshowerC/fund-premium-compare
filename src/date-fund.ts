import { result } from "lodash"
import { Repository } from "typeorm"
import { fundCodeList } from "../config"
/**
 * 每天的分时数据
 */

import { getCurrConnection } from "../ormconfig"
import DateFundEntity from "./entities/date-fund.entity"
import { getCurDateFund } from "./fund-data-fetch"
import { save } from "./services"


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


  async multipleSave(fundCodes: (number|string)[]) {
    const allProm = fundCodes.map(async (item)=>{
      return this.saveData(item)
    })

    return  Promise.all(allProm)
  }
}


new DateFund().multipleSave(fundCodeList)

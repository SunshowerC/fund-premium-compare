import { Entity, Column, Index, ConnectionOptions, PrimaryColumn, createConnection, Connection, Repository } from 'typeorm'
import path from 'path'
import FundPredictEntity from './entities/fund.entity'

const ormconfig: ConnectionOptions = {
  type: 'mysql',
  entities: [path.join(__dirname, 'entities/*.entity{.ts,.js}')],
  synchronize: false,
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: '12345678',
  database: 'fund_tab',

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

export const save = async(list: Omit<FundPredictEntity, 'id'>[])=>{
  const repo = await getCurRepo()
  
  const result = await repo.save(list).catch(e => {
    console.log('ignore duplicated')
  })
  
  // console.log('save result', result)

  return result
}


/**
 * TODO: 
 * 1. 每个 预测源+基金【最近14天，30天，60天，90天】的成功率
 * 2. 预测源+基金 近期【最近14天，30天，60天，90天】平均低估（error<0）
 * 3. 预测源+基金 近期【最近14天，30天，60天，90天】平均高估（error>0）
 * 4. 基金被套利成功概率 = 当天有 4 个源以上预测 溢价/折价 ，且最终结果符合的次数，除以 当天有 4 个源以上预测 溢价/折价的总次数
 */
export const find = async ()=>{
  const repo = await getCurRepo()
  const result = await repo.findAndCount()

  console.log('find result', result)
  return result
}


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

export const save = async()=>{
  const repo = await getCurRepo()
  
  const result = await repo.save({
    fundName: '万家行业优选混合',
    fundCode: '161903',
    predictDate: '2020-12-03',
    predictCompany: '好买基金网',
    predictIncrease: 0.343,
    finalIncrease: -0.2,
    predictPremium: -0.31,
    finalPremium: 0.41,
    error: 0.72,
    success: 1,
  })
  
  console.log('save result', result)
}

export const find = async ()=>{
  const repo = await getCurRepo()
  const result = await repo.findAndCount()

  console.log('find result', result)
}

find()

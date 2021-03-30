import path from 'path'
import { Connection, ConnectionOptions, createConnection } from 'typeorm'

export const ormconfig: ConnectionOptions = {
  type: 'mysql',
  entities: [path.join(__dirname, 'src/entities/*.entity{.ts,.js}')],
  synchronize: false,
  port: 9906,
  username: 'root',
  // host: 'localhost',
  // password: '12345678',
  // database: 'fund_tab',

  host: '34.97.246.194',  
  password: 'MDbai1@3',
  database: 'fund',
}


let connection:Connection



export const getCurrConnection = async()=>{
  if(!connection) {
    connection = await createConnection(ormconfig)
  }
  return connection
}
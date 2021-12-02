import path from 'path'
import { Connection, ConnectionOptions, createConnection } from 'typeorm'

export const ormconfig: ConnectionOptions = {
  type: 'mysql',
  entities: [path.join(__dirname, 'src/entities/*.entity{.ts,.js}')],
  synchronize: false,
  
  username: 'root',
  
  // host: 'localhost',
  // password: '12345678',

  // host: '34.97.46.180',  
  host: '34.97.27.183',  
  port: 3306,
  password: 'bai1@3',

  database: 'fund',
}


let connection:Connection



export const getCurrConnection = async()=>{
  if(!connection) {
    connection = await createConnection(ormconfig)
  }
  return connection
}
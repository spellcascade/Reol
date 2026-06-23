import { DataSource } from 'typeorm';
import { SongRequest } from './entities/SongRequest';
import { paths } from '../constants/paths';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: paths.sqliteDB,
  entities: [SongRequest],
  synchronize: false,
  migrations: [__dirname + '/migrations/**/*.{ts,js}'],
});

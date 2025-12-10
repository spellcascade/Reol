import { DataSource } from 'typeorm';
import { SongRequest } from './entities/SongRequest';
import { BannedArtist } from './entities/BannedArtist';
import { paths } from '../constants/paths';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: paths.sqliteDB,
  entities: [SongRequest, BannedArtist],
  synchronize: false,
  migrations: [__dirname + '/migrations/**/*.{ts,js}'],
});

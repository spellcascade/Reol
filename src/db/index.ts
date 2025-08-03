import { DataSource } from 'typeorm';
import { SongRequest } from './entities/SongRequest';
import { BannedArtist } from './entities/BannedArtist';
import appRootPath from 'app-root-path';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: `${appRootPath}/src/db/db.sqlite`,
  entities: [SongRequest, BannedArtist],
  synchronize: false,
  migrations: [__dirname + '/migrations/**/*.{ts,js}'],
});

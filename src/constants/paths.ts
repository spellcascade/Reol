import path from 'path';
import appRootPath from 'app-root-path';

export const paths = {
  cookies: path.join(appRootPath.path, 'cookies.txt'),
  sqliteDB: path.join(appRootPath.path, 'src/db/db.sqlite'),
};

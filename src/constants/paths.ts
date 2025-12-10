import path from 'path';
import appRootPath from 'app-root-path';
import fs from 'fs';

export const paths = {
  cookies: path.join(appRootPath.path, 'cookies.txt'),
  sqliteDB: path.join(appRootPath.path, 'src/db/db.sqlite'),
  dirs: {
    cache: path.join(appRootPath.path, 'cache'),
  },
};

Object.values(paths.dirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

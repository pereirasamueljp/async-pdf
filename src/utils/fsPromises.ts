
import * as fs from 'fs';
import * as util from 'util';

export const mkdirPromise = util.promisify(fs.mkdir);
export const unlinkPromise = util.promisify(fs.unlink);
export const openPromise = util.promisify(fs.open);
export const writeFilePromise = util.promisify(fs.writeFile);
export const readFilePromise = util.promisify(fs.readFile);
export const appendFilePromise = util.promisify(fs.appendFile);

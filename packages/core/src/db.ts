//TODO: Move DB into correct folder
import Database from 'better-sqlite3';
// const db = require('better-sqlite3')('foobar.db', options);
const dbOptions = {
  verbose: console.log
}
const db = new Database('spawncamper.db', dbOptions);

export const testDBConnection = () => {
    console.log(db);
}

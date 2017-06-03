const fs = require('fs');
const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');

class lowdbAPI {
  constructor(dirName = './tokensDataBase') {
    this.path = dirName;
  }

  connect() {
    this.DB = startLowDB(this.path);
  }

  write(dataObj) {
    this.DB
      .get('tokens')
      .push(dataObj)
      .write();
  }

  remove(key, value) {
    this.DB
      .get('tokens')
      .remove({
        [key]: value
      })
      .write();
  }

  find(key, value) {
    return this.DB
      .get('tokens')
      .find({
        [key]: value
      })
      .value();
  }

}

module.exports = lowdbAPI;

function startLowDB(baseDir) {
  add_dirs_and_htaccess_mod755(baseDir);
  const tokensData = low(baseDir + '/session.json', { storage: fileAsyncStorage });
  tokensData
    .defaults({ tokens: [] })
    .write();
  return tokensData;
}

function add_dirs_and_htaccess_mod755(dirName) {
  if(!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
  fs.writeFileSync(dirName + '/.htaccess', 'Order allow,deny\nDeny from all', { mode: 755 });
}

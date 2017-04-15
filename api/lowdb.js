const fs = require('fs');
const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');

class lowdbAPI {
    static connect(dirName) {
        return new lowdbAPI(dirName);
    }
    constructor(dirName) {
        this.DB = this._startLowDB(dirName);
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
    _startLowDB(baseDir = './secretLocalDataBase/') {
        this._add_dirs_and_htaccess_mod755(baseDir);
        const tokensData = low(baseDir + 'session.json', {
            storage: fileAsyncStorage
        });
        tokensData
            .defaults({
                tokens: []
            })
            .write();
        return tokensData;
    }
    _add_dirs_and_htaccess_mod755(dirName) {
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }
        fs.writeFileSync(dirName + '.htaccess', 'Order allow,deny\nDeny from all', {
            mode: 755
        });
    }
}

module.exports = lowdbAPI;

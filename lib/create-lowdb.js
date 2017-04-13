const fs = require('fs');
const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');
const hasRec_prototype_in_lowdb = require('./extend-lowdb.js');

module.exports = startLowDB;

function startLowDB(baseDir = './secretLocalDataBase/') {
    add_dirs_and_htaccess_mod755(baseDir);
    const tokensData = low(baseDir + 'session.json', {
        storage: fileAsyncStorage
    });
    hasRec_prototype_in_lowdb(tokensData);
    tokensData
        .defaults({
            tokens: []
        })
        .write();
    return tokensData;
};

function add_dirs_and_htaccess_mod755(dirName) {
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName);
    }
    fs.writeFileSync(dirName + '.htaccess', 'Order allow,deny\nDeny from all', {
        mode: 755
    });
}

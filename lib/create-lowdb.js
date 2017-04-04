const fs = require('fs');
const baseDir = './secretLocalDataBase/';

add_htaccess_mod755();

const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');
const tokensData = low(baseDir + 'session.json', {
    storage: fileAsyncStorage
});

require('./extend-lowdb.js')(tokensData);

tokensData.set('tokens', []).write();

module.exports = tokensData;

function add_htaccess_mod755() {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir);
    }
    fs.writeFileSync(baseDir + '.htaccess', 'Order allow,deny\nDeny from all', {
        mode: 755
    });
}

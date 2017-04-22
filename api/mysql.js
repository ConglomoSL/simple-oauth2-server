const mysql = require('mysql');

module.exports = class mysqlAPI {
    constructor(options) {
        this.config = options;
    }
    connect() {
        this.connection = mysql.createConnection(this.config);
    }
    write(dataObj) {
        const keys = Object.keys(dataObj);
        const values = keys.map(key => dataObj[key]);
        const queryString = "INSERT INTO `tokens` (`" + keys.join('`, `') + "`) VALUES ('" + values.join("', '") + "')";
        this.connection.query(queryString);
    }
    remove(key, value) {
        this.connection.query("DELETE FROM `tokens` WHERE `" + key + "` LIKE '" + value + "'");
    }
    find(key, value) {
        const queryString = "SELECT * FROM `tokens` WHERE `" + key + "` LIKE '" + value + "'";
        return new Promise((resolve, reject) => {
                this.connection.query(queryString, (err, row) => {
                    if(!err && row[0]) {
                        resolve(row[0]);
                    }
                    reject();
                });
            })
            .catch(() => false);
    }
}

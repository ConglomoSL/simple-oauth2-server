const fs = require('fs');
const baseDir = './secretLocalDataBase/';

add_htaccess_mod755();

const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');

const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');
const tokensData = low(baseDir + 'session.json', {
    storage: fileAsyncStorage
});
const secretData = low(baseDir + 'secret-data.json', {
    storage: fileAsyncStorage
});

extendPrototypeLowDB(tokensData, usersData, secretData);

tokensData.set('tokens', []).write();

usersData.defaults({
    users: [{
        "username": "justerest",
        "password": "asdasd"
    }]
}).write();

secretData.defaults({
    documentLevel1: {
        "information": "qwerty"
    },
    documentLevel2: {
        "information": "12345"
    }
}).write();


class OAuth2SimpleServer {
    constructor(app) {
        this.server = app;
        this.init();
    }
    init() {
        const routing = this.server;

        appSettings(routing);

        routing.get('/secret-data', (req, res, next) => {
            const problem = this.checkBearerAccessToken(req.get('Authorization'));
            if (!problem) {
                return next();
            }
            return res.status(401).send({
                "message": problem
            });
        });

        routing.post('/tokenRevocation', (req, res) => {
            const {
                token_type_hint,
                token
            } = req.body;

            tokensData.get('tokens').remove({
                [token_type_hint]: token
            }).write();

            res.send();
        });

        routing.post('/token', (req, res) => {
            const {
                username,
                password,
                refresh_token
            } = req.body;

            if (this.checkUserPass(username, password) || this.checkRefreshToken(refresh_token)) {
                const lifeTime = 15; //seconds
                const token = {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: lifeTime,
                    expires_at: moment()
                };

                tokensData.get('tokens').push(token).write();

                return res.send(token);
            }
            return res.status(401).send({
                "message": "error!"
            });
        });

        routing.get('/secret-data', (req, res) => {
            res.send(secretData.get('documentLevel1').value());
        });
    }
    checkBearerAccessToken(authorization) {
        if (authorization) {
            const access_token = authorization.replace('Bearer ', '');
            const token = tokensData.get('tokens').find({
                access_token: access_token
            }).value();
            return token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment() ? null : 'Токен просрочен!';
        }
        return 'Попытка несанкционированного доступа!';
    }
    checkUserPass(username, password) {
        if (username && password) {
            return usersData.get('users').hasRec({
                username: username,
                password: password
            });
        }
        return false;
    }
    checkRefreshToken(refresh_token) {
        if (refresh_token) {
            tokensData.get('tokens').remove({
                refresh_token: refresh_token
            }).write();
            return true;
        }
        return false;
    }
}

function add_htaccess_mod755() {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir);
    }
    fs.writeFileSync(baseDir + '.htaccess', 'Order allow,deny\nDeny from all', {
        mode: 755
    });
}

function extendPrototypeLowDB() {
    for (let i = 0; i < arguments.length; i++) {
        arguments[i]._.prototype.hasRec = function(key, value) {
            const filter = typeof key === 'object' ? key : {
                [key]: value
            };
            return this.find(filter).value() ? true : false;
        }
    }
}

module.exports = OAuth2SimpleServer;

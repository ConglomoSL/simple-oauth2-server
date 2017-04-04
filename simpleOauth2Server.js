const fs = require('fs');
const baseDir = __dirname + '/localDataBase/';

add_htaccess_mod755();

// LOCAL DB
const low = require('lowdb');
const fileAsyncStorage = require('lowdb/lib/storages/file-async');
const tokensData = low(baseDir + 'session.json', {
    storage: fileAsyncStorage
});
const usersData = low(baseDir + 'users.json', {
    storage: fileAsyncStorage
});
const secretData = low(baseDir + 'secret-data.json', {
    storage: fileAsyncStorage
});
const uuid = require('uuid');
const moment = require('moment');
//расширяем прототип для проверки записи на существование
extendProto(tokensData, usersData, secretData);
//load default models
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

// OPTIONS INCLUDES
const appSettings = require('./lib/app-settings.js');

class OAuth2SimpleServer {
    constructor(app) {
        this.server = app;
    }
}

module.exports = OAuth2SimpleServer;

// ROUTING
app.get('/secret-data', (req, res, next) => {
    const problem = checkBearerAccessToken(req.get('Authorization'));
    if (!problem) {
        return next();
    }
    return res.status(401).send({
        "message": problem
    });
});

app.post('/tokenRevocation', (req, res) => {
    const {
        token_type_hint,
        token
    } = req.body;

    tokensData.get('tokens').remove({
        [token_type_hint]: token
    }).write();

    res.send();
});

app.post('/token', (req, res) => {
    const {
        username,
        password,
        refresh_token
    } = req.body;

    if (checkUserPass(username, password) || checkRefreshToken(refresh_token)) {
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

app.get('/secret-data', (req, res) => {
    res.send(secretData.get('documentLevel1').value());
});

// FUNCTIONS
function add_htaccess_mod755() {
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir);
    }
    fs.writeFileSync(baseDir + '.htaccess', 'Order allow,deny\nDeny from all', {
        mode: 755
    });
}

function extendProto() {
    for (let i = 0; i < arguments.length; i++) {
        arguments[i]._.prototype.hasRec = function(key, value) {
            const filter = typeof key === 'object' ? key : {
                [key]: value
            };
            return this.find(filter).value() ? true : false;
        }
    }
}

function checkBearerAccessToken(authorization) {
    if (authorization) {
        const access_token = authorization.replace('Bearer ', '');
        const token = tokensData.get('tokens').find({
            access_token: access_token
        }).value();
        return token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment() ? null : 'Токен просрочен!';
    }
    return 'Попытка несанкционированного доступа!';
}

function checkUserPass(username, password) {
    if (username && password) {
        return usersData.get('users').hasRec({
            username: username,
            password: password
        });
    }
    return false;
}

function checkRefreshToken(refresh_token) {
    if (refresh_token) {
        tokensData.get('tokens').remove({
            refresh_token: refresh_token
        }).write();
        return true;
    }
    return false;
}

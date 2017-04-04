const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class OAuth2SimpleServer {
    constructor(app) {
        this.server = app;
        this.tokenGetPath = '/token';
        this.tokenRevocationPath = '/tokenRevocation';
        this.tokenLifeTime = 15;
        this.securityRoutes = ['/**', '!/' + this.tokenGetPath, '!/' + this.tokenRevocationPath];
        this.init();
    }
    set securityRoutes(arr) {
        return arr.push('!/' + this.tokenGetPath, '!/' + this.tokenRevocationPath);
    }
    init() {
        const routing = this.server;
        appSettings(routing);

        routing.get(this.securityRoutes, (req, res, next) => {
            const problem = this.checkBearerAccessToken(req.get('Authorization'));
            if (!problem) {
                return next();
            }
            return res.status(401).send({
                "message": problem
            });
        });

        routing.post(this.tokenGetPath, (req, res) => {
            const {
                username,
                password,
                refresh_token
            } = req.body;
            if (this.checkUserPass(username, password) || this.checkRefreshToken(refresh_token)) {
                const token = {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: this.tokenLifeTime,
                    expires_at: moment()
                };
                tokensDB.get('tokens').push(token).write();
                return res.send(token);
            }
            return res.status(401).send({
                "message": "error!"
            });
        });

        routing.post(this.tokenRevocationPath, (req, res) => {
            const {
                token_type_hint,
                token
            } = req.body;
            tokensDB.get('tokens').remove({
                [token_type_hint]: token
            }).write();
            res.send();
        });
    }
    checkBearerAccessToken(authorization) {
        if (authorization) {
            const access_token = authorization.replace('Bearer ', '');
            const token = tokensDB.get('tokens').find({
                access_token: access_token
            }).value();
            return token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment() ? null : 'Токен просрочен!';
        }
        return 'Попытка несанкционированного доступа!';
    }
    checkUserPass(username, password) {
        return typeof this.checkPassword === 'function' ? this.checkPassword(username, password) : noCheckFunction();

        function noCheckFunction() {
            console.log('Не задана функция проверки пары пользователь/пароль!');
            return false;
        };
    }
    checkRefreshToken(refresh_token) {
        if (refresh_token && tokensDB.get('tokens').hasRec('refresh_token', refresh_token)) {
            tokensDB.get('tokens').remove({
                refresh_token: refresh_token
            }).write();
            return true;
        }
        return false;
    }
}

module.exports = OAuth2SimpleServer;

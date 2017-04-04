const express = require('express');
const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class OAuth2SimpleServer {
    constructor(options) {
        const defaultOptions = {
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation',
            tokenLifeTime: 15,
            securityRoutes: ['/secret*'],
            controllMethods: ['get', 'post', 'delete', 'put'],
        }
        this.options = Object.assign(defaultOptions, options);
        if (typeof this.options.checkPassword !== 'function') {
            throw Error('Не задана функция проверки пары пользователь/пароль!');
        }
    }
    init() {
        const router = express.Router();
        const {
            controllMethods
        } = this.options;
        router.use(appSettings);
        router.use(this._getTokenRoute);
        router.use(this._revocationTokensRoute);
        // all - не работает
        controllMethods.forEach((method) => {
            router[method](this.options.securityRoutes, this.protect);
        });
        return router;
    }
    protect(req, res, next) {
        if (req.get('Authorization')) {
            const access_token = req.get('Authorization').replace('Bearer ', '');
            const token = tokensDB.get('tokens').find({
                access_token: access_token
            }).value();
            if (token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment()) {
                return next();
            }
        }
        return res.status(401).send({
            "message": 'Попытка несанкционированного доступа!'
        });
    }
    _checkRefreshToken(refresh_token) {
        if (refresh_token && tokensDB.get('tokens').hasRec('refresh_token', refresh_token)) {
            tokensDB.get('tokens').remove({
                refresh_token: refresh_token
            }).write();
            return true;
        }
        return false;
    }
    get _getTokenRoute() {
        const router = express.Router();
        router.post(this.options.tokenGetPath, (req, res) => {
            const {
                refresh_token
            } = req.body;
            if (this.options.checkPassword(req) || this._checkRefreshToken(refresh_token)) {
                const token = {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: this.options.tokenLifeTime,
                    expires_at: moment()
                };
                tokensDB.get('tokens').push(token).write();
                return res.send(token);
            }
            return res.status(401).send({
                "message": "error!"
            });
        });
        return router;
    }
    get _revocationTokensRoute() {
        const router = express.Router();
        router.post(this.options.tokenRevocationPath, (req, res) => {
            const {
                token_type_hint,
                token
            } = req.body;
            tokensDB.get('tokens').remove({
                [token_type_hint]: token
            }).write();
            res.send();
        });
        return router;
    }
}

module.exports = OAuth2SimpleServer;

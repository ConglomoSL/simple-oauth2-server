const express = require('express');
const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class SimpleOAuth2Server {
    configuring(config) {
        const defaultOptions = {
            checkPassword: false, // your function for authentication
            routes: ['/secret/*'], // protect routes
            methods: ['get', 'post', 'delete', 'put'], //methods for protect routes
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation',
            tokenExpired: 24 * 60 * 60, // one day
        }
        this.__proto__ = Object.assign(this.__proto__, defaultOptions, config);
        if (typeof this.checkPassword !== 'function') {
            throw Error('Не задана функция проверки аутентификации пользователь/пароль!');
            exit();
        }
    }
    init(options) {
        this.configuring(options);
        const router = express.Router();
        const {
            methods
        } = this;
        router.use(appSettings);
        router.use(this._getTokenRoute);
        router.use(this._revocationTokensRoute);
        methods.forEach((method) => {
            router[method](this.routes, this.protect);
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
        router.post(this.tokenGetPath, (req, res) => {
            const {
                refresh_token
            } = req.body;
            if (this.checkPassword(req) || this._checkRefreshToken(refresh_token)) {
                const token = {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: this.tokenExpired,
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
        router.post(this.tokenRevocationPath, (req, res) => {
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

module.exports = new SimpleOAuth2Server;

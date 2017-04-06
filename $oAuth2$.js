const express = require('express');
const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class SimpleOAuth2Server {
    constructor() {
        this.protect = [this._defaultProtect.bind(this)];
    }
    configuring(config) {
        const defaultOptions = {
            checkPassword: false, // your function for authentication
            routes: [], // protect routes
            methods: [], //methods for protect routes ['get', 'post', 'delete', 'put']
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation',
            tokenExpired: 24 * 60 * 60, // one day
        }
        this.__proto__ = Object.assign(this.__proto__, defaultOptions, config);
    }
    init(app, options) {
        if (!app) {
            throw Error('Where is express application?');
            exit();
        }
        this.configuring(options);
        if (typeof this.checkPassword !== 'function') {
            throw Error('Function for checking user/password is undefined!');
            exit();
        }
        app.use(appSettings);
        app.use(this._getTokenRoute);
        app.use(this._revocationTokensRoute);
        app.use(this._loadRoutes);
    }
    extend(app, options) {
        this.configuring(options);
        app.use(this._loadRoutes);
    }
    authorizationHeader(request) {
        return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
    }
    addProtect(aFunction) {
        const newProtect = this;
        newProtect.protect.push(aFunction);
        return newProtect;
    }
    get _loadRoutes() {
        const router = express.Router();
        const {
            methods
        } = this;
        methods.forEach((method) => {
            router[method](this.routes, this.protect);
        });
        return router;
    }
    get _getTokenRoute() {
        return express.Router().post(this.tokenGetPath, authentication.bind(this));

        function authentication(req, res) {
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
                "message": "Ошибка аутентификации!"
            });
        }
    }
    get _revocationTokensRoute() {
        return express.Router().post(this.tokenRevocationPath, deleteTokens);

        function deleteTokens(req, res) {
            const {
                token_type_hint,
                token
            } = req.body;
            tokensDB.get('tokens').remove({
                [token_type_hint]: token
            }).write();
            res.send();
        }
    }
    _defaultProtect(req, res, next) {
        const access_token = this.authorizationHeader(req);
        if (access_token) {
            const token = tokensDB.get('tokens').find({
                access_token: access_token
            }).value();
            if (validateToken(token)) {
                req.token = token;
                return next();
            }
        }
        return res.status(401).send({
            "message": 'Попытка несанкционированного доступа!'
        });

        function validateToken(token) {
            return token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment();
        }
    }
    _checkRefreshToken(refresh_token) {
        if (isTokenInDB(refresh_token)) {
            tokensDB.get('tokens').remove({
                refresh_token: refresh_token
            }).write();
            return true;
        }
        return false;

        function isTokenInDB(refresh_token) {
            return refresh_token && tokensDB.get('tokens').hasRec('refresh_token', refresh_token);
        }
    }
}

module.exports = new SimpleOAuth2Server;

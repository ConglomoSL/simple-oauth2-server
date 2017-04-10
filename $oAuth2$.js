const express = require('express');
const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class SimpleOAuth2Server {
    constructor() {
        this.protect = this.reset().protect;
    }
    configuring(config) {
        const defaultOptions = {
            routes: [], // protect routes
            methods: [], // methods for protect routes ['get', 'post', 'delete', 'put']
            tokenExpired: 24 * 60 * 60, // one day
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation'
        }
        if (config.route) config.routes = config.route;
        if (config.method) config.methods = config.method;
        if (typeof config.methods === 'string') {
            config.methods = config.methods.split(',');
        }
        this.__proto__ = Object.assign(this.__proto__, defaultOptions, config);
    }
    init(app, options) {
        if (!app) {
            throw Error('Where is express application?');
            exit();
        }
        this.configuring(options);
        if (!this.checkPassword) {
            throw Error('Function for checking user/password is undefined!');
            exit();
        }
        app.use(appSettings);
        app.use(this._getTokenRoute);
        app.use(this._revocationTokensRoute);
        app.use(this._loadRoutes);
        this.expressApp = app;
        return this;
    }
    defend(options) {
        this.configuring(options);
        this.expressApp.use(this._loadRoutes);
        return this;
    }
    authorizationHeader(request) {
        return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
    }
    add(aFunction) {
        const self = this;
        self.protect.push(aFunction);
        return self;
    }
    reset() {
        const self = this;
        self.protect = [this._defaultProtect.bind(this)];
        return self;
    }
    get _loadRoutes() {
        const router = express.Router();
        this.methods.forEach((method) => {
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
                const token = Object.assign(this.tokenExtend ? this.tokenExtend(req) : {}, {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: this.tokenExpired,
                    expires_at: moment()
                });
                tokensDB.get('tokens').push(token).write();
                return res.send(token);
            }
            return res.status(401).send({
                // Message for russian hackers!
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

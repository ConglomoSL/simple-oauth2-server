require("babel-polyfill");
const express = require('express');
const uuid = require('uuid');
const moment = require('moment');
const appSettings = require('./lib/app-settings.js');
const tokensDB = require('./lib/create-lowdb.js');

class SimpleOAuth2Server {
    get defaultOptions() {
        return {
            routes: [], // protect routes
            methods: [], // methods for protect routes ['get', 'post', 'delete', 'put']
            tokenExpired: 24 * 60 * 60, // one day
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation'
        }
    }
    init(app, options) {
        this._configuring(options);
        this._fatalErrors(app);
        app.use(appSettings);
        app.use(this._getTokenRoute);
        app.use(this._revocationTokensRoute);
        this.expressApp = app;
        return this;
    }
    defend(options) {
        this._configuring(options, {
            routes: ['**'],
            methods: ['get', 'post', 'delete', 'put', 'patch']
        });
        this.expressApp.use(this._loadRoutes.call(this));
        return this;
    }
    layer(level, ...aFunctions) {
        const self = this;
        if (!self.protect[level]) {
            self.protect[level] = [];
        }
        aFunctions.forEach(aFunction => {
            if (typeof aFunction !== 'function') {
                return self.protect[level].push(self._checkEvery(aFunction));
            }
            return self.protect[level].push(aFunction);
        });
        return self;
    }
    clearLayers() {
        const self = this;
        self.protect = [
            [this._defaultProtect.bind(this)]
        ];
        return self;
    }
    authorizationHeader(request) {
        return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
    }
    _configuring(config = {}, defaultOptions = this.defaultOptions) {
        if (config.route) {
            config.routes = config.route;
        }
        if (config.method) {
            config.methods = config.method;
        }
        if (typeof config.methods === 'string') {
            config.methods = config.methods.replace(/\s/g, '').split(',');
        }
        this.__proto__ = Object.assign(this.__proto__, defaultOptions, config);
    }
    _loadRoutes() {
        const router = express.Router();
        this.methods.forEach(method => router[method](this.routes, this._protectLayers.call(this)));
        return router;
    }
    _protectLayers() {
        const layers = this.protect;
        return async(req, res, next) => {
            console.log(layers);
            const thisLayers = layers.filter(emptyElement => emptyElement !== undefined).map((layer, i, arr) => {
                const aFunctions = layer.map(aFunction => {
                    return this._promiseThanCatch(req, aFunction);
                });
                return Promise.race(aFunctions);
            });
            const protections = await Promise.all(thisLayers);
            const everyAllow = protections.every(protection => protection === true);
            if (everyAllow) {
                next();
            } else {
                res.status(401).send({
                    // Message for russian hackers!
                    message: typeof protections === 'string' ? protections : "Ошибка авторизации!"
                });
            }
        }
    }
    _promise(req, aFunction) {
        return new Promise((resolve, reject) => {
            aFunction(req, resolve, reject)
        });
    }
    _promiseThanCatch(req, aFunction) {
        return this._promiseResult(this._promise(req, aFunction));
    }
    _promiseResult(promise) {
        return promise
            .then((r) => {
                return true;
            })
            .catch(message => message && message !== true ? message : false);
    }
    get _getTokenRoute() {
        return express.Router().post(this.tokenGetPath, authentication.bind(this));

        async function authentication(req, res) {
            const {
                refresh_token
            } = req.body;
            const authResult = await this._promiseThanCatch(req, this.checkPassword);
            if (this._checkRefreshToken(refresh_token) || authResult === true) {
                const token = Object.assign(this.tokenExtend ?
                    this.tokenExtend(req) : {}, {
                        access_token: uuid(),
                        refresh_token: uuid(),
                        expires_in: this.tokenExpired,
                        expires_at: moment()
                    });
                tokensDB.get('tokens').push(token).write();
                res.send(token);
            } else res.status(401).send({
                // Message for russian hackers!
                "message": typeof authResult === 'string' ? authResult : "Ошибка аутентификации!"
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
    _defaultProtect(req, next, cancel) {
        const access_token = this.authorizationHeader(req);
        if (access_token) {
            const token = tokensDB.get('tokens').find({
                access_token: access_token
            }).value();
            if (validateToken(token)) {
                req.token = token;
                next();
            }
        } else {
            cancel('Попытка несанкционированного доступа!');
        }

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
    _checkEvery(param) {
        return (req, next, cancel) => {
            if (isTrue()) {
                next();
            } else {
                cancel();
            }

            function isTrue() {
                param = typeof param === 'string' ? param.replace(/\s/g, '').split(',') : param;
                return req.params[param[0]] === req.token[param[0]] || req.token[param[0]] === param[1];
            }
        }
    }
    _fatalErrors(app) {
        if (!app) {
            throw Error('Where is express application?');
            exit();
        }
        if (!this.checkPassword) {
            throw Error('Function for checking user/password is undefined!');
            exit();
        }
    }
    constructor() {
        this.protect = this.clearLayers().protect;
    }
}

module.exports = new SimpleOAuth2Server;

require("babel-polyfill");
Promise.any = require('promise-any');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
const lowdbAPI = require('./api/lowdb');

class SimpleOAuth2Server {
    constructor() {
        this.protect = this.clean().protect;
        this.defaultOptions = {
            routes: [], // protect routes
            methods: [], // methods for protect routes ['get', 'post', 'delete', 'put']
            tokenExpired: 24 * 60 * 60, // one day
            tokenGetPath: '/token',
            tokenRevocationPath: '/tokenRevocation',
            tokensDB: lowdbAPI
        };
    }
    init(app, options) {
        this._configuring(options);
        this._fatalErrors(app);
        this.tokensDB.connect();
        app.use(this.appSettings);
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
        this.expressApp.use(this._loadRoutes);
        return this;
    }
    newLayer() {
        const level = this.protect.length;
        return this._layer(level, ...arguments);
    }
    or() {
        const level = --this.protect.length;
        return this._layer(level, ...arguments);
    }
    clean() {
        this.protect = [
            ['defaultProtection']
        ];
        return this;
    }
    authorizationHeader(request) {
        return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
    }
    get appSettings() {
        return express.Router()
            .use(bodyParser.urlencoded({
                extended: false
            }))
            .use((req, res, next) => {
                // Website you wish to allow to connect
                res.setHeader('Access-Control-Allow-Origin', '*');
                // Request methods you wish to allow
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
                // Request headers you wish to allow
                res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
                // Set to true if you need the website to include cookies in the requests sent
                // to the API (e.g. in case you use sessions)
                res.setHeader('Access-Control-Allow-Credentials', true);
                // Pass to next layer of middleware
                next();
            });
    }
    tokenExtend() {
        return {};
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
    get _getTokenRoute() {
        return express.Router().post(this.tokenGetPath, authentication.bind(this));

        async function authentication(request, response) {
            const {
                refresh_token
            } = request.body;
            const authResult = refresh_token ?
                await this._checkRefreshToken.call(this, refresh_token) :
                await this._promiseThanCatch(request, this.checkPassword);
            if (refresh_token ? authResult : authResult === 'success') {
                const defaultToken = {
                    access_token: uuid(),
                    refresh_token: uuid(),
                    expires_in: this.tokenExpired,
                    expires_at: moment().format('MMDDHHmmss')
                };
                const token = Object.assign(refresh_token ? authResult : this.tokenExtend(request), defaultToken);
                this.tokensDB.write(token);
                response.send(token);
            } else {
                // Message for russian hackers!
                response.status(401).send({
                    "message": typeof authResult === 'string' ? authResult : "Ошибка аутентификации!"
                });
            }
        }
    }
    get _revocationTokensRoute() {
        return express.Router().post(this.tokenRevocationPath, deleteTokens.bind(this));

        function deleteTokens(req, res) {
            const {
                token_type_hint,
                token
            } = req.body;
            this.tokensDB.remove(token_type_hint, token);
            res.send();
        }
    }
    get _loadRoutes() {
        const router = express.Router();
        this.methods.forEach(method => router[method](this.routes, this._protectLayers.call(this)));
        return router;
    }
    _protectLayers() {
        const layers = this.protect.filter(cleanEmpty);
        return async(req, res, next) => {
            await this._promise(req, this._defaultProtect.bind(this))
                .then(() => layers[0][0] = Promise.resolve())
                .catch((message) => layers[0][0] = Promise.reject(message));
            const thisLayers = layers.map((layer, i) => {
                const promises = layer.map((aFunction, j) => {
                    if (i + j) {
                        return this._promise(req, aFunction)
                    } else {
                        return aFunction;
                    }
                });
                return Promise.any(promises);
            });
            const protections = await this._promiseResult(Promise.all(thisLayers));
            if (protections === 'success') {
                next();
            } else {
                // Message for russian hackers!
                res.status(401).send({
                    message: typeof protections[0] === 'string' ? protections[0] : "Ошибка авторизации!"
                });
            }
        };

        function cleanEmpty(element) {
            return element !== undefined;
        }
    }
    _layer(level, ...aFunctions) {
        if (!this.protect[level]) {
            this.protect[level] = [];
        }
        aFunctions.forEach(aFunction => {
            if (typeof aFunction !== 'function') {
                this.protect[level].push(this._shortFunc(aFunction));
            } else {
                this.protect[level].push(aFunction);
            }
        });
        return this;
    }
    async _defaultProtect(req, next, cancel) {
        const access_token = this.authorizationHeader(req);
        if (access_token) {
            const token = await this.tokensDB.find('access_token', access_token);
            if (token) req.token = token;
            if (validateToken(token)) {
                next();
            } else {
                this.tokensDB.remove('access_token', access_token);
            }
        }
        cancel('Попытка несанкционированного доступа!');

        function validateToken(token) {
            return token && moment(token.expires_at, 'MMDDHHmmss').add(token.expires_in, 'seconds') >= moment();
        }
    }
    async _checkRefreshToken(refresh_token) {
        const token = await this.tokensDB.find('refresh_token', refresh_token);
        if (refresh_token && token && token.access_token.length) {
            this.tokensDB.remove('refresh_token', refresh_token);
            return token;
        }
        return false;
    }
    _promise(req, aFunction) {
        return new Promise((resolve, reject) => {
            aFunction(req, resolve, reject)
        });
    }
    _promiseResult(promise) {
        return promise
            .then(() => 'success')
            .catch(message => message !== 'success' ? message : false);
    }
    _promiseThanCatch(req, aFunction) {
        return this._promiseResult(this._promise(req, aFunction));
    }
    _shortFunc(param) {
        return (req, next, cancel) => {
            param = typeof param === 'string' ? param.replace(/\s/g, '').split(',') : param;
            if (req.params[param[0]] === req.token[param[0]] || req.token[param[0]] === param[1]) {
                next();
            }
            cancel();
        }
    }
}

module.exports = new SimpleOAuth2Server;

 // require("babel-polyfill");
 const express = require('express');
 const bodyParser = require('body-parser');
 const uuid = require('uuid');
 const moment = require('moment');
 const createDB = require('./lib/create-lowdb.js');

 class SimpleOAuth2Server {
     constructor() {
         this.protect = this.clean().protect;
         this.defaultOptions = {
             routes: [], // protect routes
             methods: [], // methods for protect routes ['get', 'post', 'delete', 'put']
             tokenExpired: 24 * 60 * 60, // one day
             tokenGetPath: '/token',
             tokenRevocationPath: '/tokenRevocation'
         };
     }
     init(app, options) {
         this._configuring(options);
         this._fatalErrors(app);
         this.tokensDB = createDB();
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
         const level = this.protect.length - 1;
         return this._layer(level, ...arguments);
     }
     _layer(level, ...aFunctions) {
         if (!this.protect[level]) {
             this.protect[level] = [];
         }
         aFunctions.forEach(aFunction => {
             if (typeof aFunction !== 'function') {
                 this.protect[level].push(this._shortFunc(aFunction));
             } else this.protect[level].push(aFunction);
         });
         return this;
     }
     clean() {
         this.protect = [
             [this._defaultProtect.bind(this)]
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

         async function authentication(req, res) {
             const {
                 refresh_token
             } = req.body;
             const authResult = this._promiseThanCatch(req, this.checkPassword);
             if (this._checkRefreshToken(refresh_token) || await authResult === 'success') {
                 const defaultToken = {
                     access_token: uuid(),
                     refresh_token: uuid(),
                     expires_in: this.tokenExpired,
                     expires_at: moment()
                 };
                 const token = Object.assign(this.tokenExtend(req), defaultToken);
                 this.tokensDB
                     .get('tokens')
                     .push(token)
                     .write();
                 res.send(token);
             } else res.status(401).send({
                 // Message for russian hackers!
                 "message": typeof authResult === 'string' ? authResult : "Ошибка аутентификации!"
             });
         }
     }
     get _revocationTokensRoute() {
         return express.Router().post(this.tokenRevocationPath, deleteTokens.bind(this));

         function deleteTokens(req, res) {
             const {
                 token_type_hint,
                 token
             } = req.body;
             this.tokensDB.get('tokens')
                 .remove({
                     [token_type_hint]: token
                 })
                 .write();
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
             const thisLayers = layers.map(layer => {
                 const aFunctions = layer.map(aFunction => this._promise(req, aFunction));
                 return Promise.race(aFunctions);
             });
             const protections = await this._promiseResult(Promise.all(thisLayers));
             if (protections === 'success') {
                 next();
             } else res.status(401).send({
                 // Message for russian hackers!
                 message: typeof protections === 'string' ? protections : "Ошибка авторизации!"
             });
         };

         function cleanEmpty(element) {
             return element !== undefined;
         }
     }
     _defaultProtect(req, next, cancel) {
         const access_token = this.authorizationHeader(req);
         if (access_token) {
             const token = this.tokensDB
                 .get('tokens')
                 .find({
                     access_token: access_token
                 })
                 .value();
             if (validateToken(token)) {
                 req.token = token;
                 next();
             }
         }
         cancel('Попытка несанкционированного доступа!');

         function validateToken(token) {
             return token && moment(token.expires_at).add(token.expires_in, 'seconds') >= moment();
         }
     }
     _checkRefreshToken(refresh_token) {
         if (isTokenInDB(refresh_token)) {
             this.tokensDB.get('tokens')
                 .remove({
                     refresh_token: refresh_token
                 })
                 .write();
             return true;
         }
         return false;

         function isTokenInDB(refresh_token) {
             return refresh_token && this.tokensDB.get('tokens').hasRec('refresh_token', refresh_token);
         }
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

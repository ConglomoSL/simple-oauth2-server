require("babel-polyfill");
Promise.any = require('promise-any');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
const lowdbAPI = require('./api/lowdb');

class SimpleOAuth2Server {
  constructor() {
    this.clean();
    this.defaultOptions = {
      expiredToken: 24 * 60 * 60,
      createTokenPath: '/token',
      revocationPath: '/tokenRevocation',
      tokensDB: new lowdbAPI
    };
  }
  init(options) {
    this._configuring(options);
    this._fatalErrors();
    this.tokensDB.connect();
    this.expressApp
      .use(this.appSettings)
      .use(this._getTokenRoute)
      .use(this._revocationTokensRoute);
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
  and() {
    const level = this.protection.length;
    return this._layer(level, ...arguments);
  }
  add() {
    return this.and(...arguments);
  }
  or() {
    const level = this.protection.length - 1;
    return this._layer(level, ...arguments);
  }
  clean() {
    this.protection = [];
    this.protection.push(['default']);
    return this;
  }
  get layersProtect() {
    const _layers = copyArray(this.protection);
    return async(request, response, next) => {
      const defCheckMsg = await promiseResult(promiseMiddleware(request, this._defaultProtect.bind(this)));
      _layers[0][0] = defCheckMsg === 'success' ?
        Promise.resolve() :
        Promise.reject(defCheckMsg);
      const thisLayers = _layers.map((layer, i) => {
        const promises = layer.map((aFunction, j) => i + j ?
          promiseMiddleware(request, aFunction) :
          aFunction
        );
        return Promise.any(promises);
      });
      const mainCheckMsg = await promiseResult(Promise.all(thisLayers));
      mainCheckMsg === 'success' ?
        next() :
        response.status(401).send({
          message: typeof mainCheckMsg[0] === 'string' ? mainCheckMsg[0] : "Ошибка авторизации!"
        });
    };
  }
  authorizationHeader(request) {
    return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
  }
  get appSettings() {
    return express.Router()
      .use(bodyParser.urlencoded({ extended: false }))
      .use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');
        next();
      });
  }
  _configuring(config = {}, defaultOptions = this.defaultOptions) {
    if(config.route) {
      config.routes = config.route;
    }
    if(config.method) {
      config.methods = config.method;
    }
    if(typeof config.methods === 'string') {
      config.methods = config.methods.replace(/\s/g, '').split(',');
    }
    Object.assign(this, defaultOptions, config);
  }
  _fatalErrors() {
    if(!this.expressApp) {
      throw new Error('Where is express application?');
      exit();
    }
    if(!this.checkPassword) {
      throw new Error('Function for checking user/password is undefined!');
      exit();
    }
  }
  get _getTokenRoute() {
    return express.Router().post(this.createTokenPath, this._authentication.bind(this));
  }
  async _authentication(request, response) {
    const defaultToken = {
      access_token: uuid(),
      refresh_token: uuid(),
      expires_in: this.expiredToken,
      expires_at: moment().format('YYMMDDHHmmss')
    };
    const { refresh_token } = request.body;
    const authResult = refresh_token ?
      await this._checkRefreshToken.call(this, refresh_token) :
      await promiseResult(promiseMiddleware(request, this.checkPassword));
    if(refresh_token && authResult || authResult === 'success') {
      const token = Object.assign(refresh_token ? authResult : this.tokenExtend(request), defaultToken);
      this.tokensDB.write(token);
      return response.send(token);
    }
    response.status(401).send({
      "message": typeof authResult === 'string' ? authResult : "Ошибка аутентификации!"
    });
  }
  get _revocationTokensRoute() {
    return express.Router().post(this.revocationPath, this._deleteTokens.bind(this));
  }
  _deleteTokens(req, res) {
    const { token_type_hint, token } = req.body;
    this.tokensDB.remove(token_type_hint, token);
    res.send();
  }
  get _loadRoutes() {
    const router = express.Router();
    this.methods.forEach(method => {
      router[method](this.routes, this.layersProtect);
    });
    return router;
  }
  _layer(level, ...aFunctions) {
    const newObject = this._copyObject;
    if(!Array.isArray(newObject.protection[level])) {
      newObject.protection[level] = [];
    }
    aFunctions.forEach(aFunction => {
      newObject.protection[level]
        .push(typeof aFunction === 'function' ? aFunction : shortFunction(aFunction));
    });
    return newObject;
  }
  get _copyObject() {
    const newObject = Object.create(this);
    newObject.protection = copyArray(this.protection);
    return newObject;
  }
  async _defaultProtect(req, next, cancel) {
    const access_token = this.authorizationHeader(req);
    if(access_token) {
      const token = await this.tokensDB.find('access_token', access_token);
      req.token = token;
      validateToken(token) ?
        next() :
        this.tokensDB.remove('access_token', access_token);
    }
    cancel('Попытка несанкционированного доступа!');
  }
  async _checkRefreshToken(refresh_token) {
    const token = await this.tokensDB.find('refresh_token', refresh_token);
    if(refresh_token && token && token.access_token.length) {
      this.tokensDB.remove('refresh_token', refresh_token);
      return token;
    }
    return false;
  }
  tokenExtend() {
    return {};
  }
}

module.exports = SimpleOAuth2Server;

function promiseMiddleware(req, aFunction) {
  return new Promise((resolve, reject) => {
    aFunction(req, resolve, reject);
  });
}

function promiseResult(promise) {
  return promise
    .then(() => 'success')
    .catch(message => message !== 'success' ? message : false);
}

function copyArray(array) {
  return array.map(subArray => subArray.slice());
}

function shortFunction(param) {
  return(req, next, cancel) => {
    if(typeof param === 'string') {
      param = param.replace(/\s/g, '').split(',');
    }
    req.params[param[0]] === req.token[param[0]] || req.token[param[0]] === param[1] ?
      next() :
      cancel();
  }
}

function validateToken(token) {
  return token && moment(token.expires_at, 'YYMMDDHHmmss').add(token.expires_in, 'seconds') >= moment();
}

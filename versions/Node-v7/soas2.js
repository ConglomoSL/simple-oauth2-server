if(!process.env.v7) require("babel-polyfill");

const path = require('path');
Promise.any = require('promise-any');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
const lowdbAPI = require(path.join(__dirname, '../../', 'api/lowdb'));

class SimpleOAuth2Server {
  constructor() {
    this.protection = [
      ['default']
    ];
    this.defaultOptions = {
      expiredToken: 15 * 60,
      createTokenPath: '/token',
      revocationPath: '/tokenRevocation',
      tokensDB: new lowdbAPI
    };
  }
  init(options, oldFormat) {
    if(oldFormat && !options.expressApp) {
      oldFormat.expressApp = options;
      options = oldFormat;
    }
    this.__configuring(options);
    this.__fatalErrors();
    this.tokensDB.connect();
    this.expressApp
      .use(this.appSettings)
      .use(this.__getTokenRoute)
      .use(this.__revocationTokensRoute);
    return this;
  }
  defend(options) {
    this.__configuring(options, {
      routes: ['**'],
      methods: ['get', 'post', 'delete', 'put', 'patch']
    });
    this.expressApp.use(this.__loadRoutes);
    return this;
  }
  layerAnd() {
    const level = this.protection.length;
    return this.__layer(level, ...arguments);
  }
  layerOr() {
    const level = this.protection.length - 1;
    return this.__layer(level, ...arguments);
  }
  get protectiveLayers() {
    const __layers = copyArray(this.protection);
    return async(request, response, next) => {
      const defCheckMsg = await promiseResult(
        promiseMiddleware(request, this.__defaultProtect.bind(this))
      );
      __layers[0][0] = defCheckMsg === 'success' ?
        Promise.resolve() :
        Promise.reject(defCheckMsg);
      const thisLayers = __layers.map((layer, i) => {
        const promises = layer.map((aFunction, j) => i + j ?
          promiseMiddleware(request, aFunction) :
          aFunction
        );
        return Promise.any(promises);
      });
      const mainCheckMsg = await promiseResult(Promise.all(thisLayers));
      mainCheckMsg === 'success' ?
        next() :
        response401(response, mainCheckMsg[0]);
    };
  }
  authorizationHeader(request) {
    return request.get('Authorization') ?
      request.get('Authorization').replace('Bearer ', '') :
      false;
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
  __configuring(config = {}, defaultOptions = this.defaultOptions) {
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
  __fatalErrors() {
    if(!this.expressApp) {
      throw new Error('Where is express application?');
      exit();
    }
    if(!this.checkPassword) {
      throw new Error('Function for checking user/password is undefined!');
      exit();
    }
  }
  get __getTokenRoute() {
    return express.Router().post(this.createTokenPath, this.__authentication.bind(this));
  }
  async __authentication(request, response) {
    const defaultToken = {
      access_token: uuid(),
      refresh_token: uuid(),
      expires_in: this.expiredToken,
      expires_at: moment().format('YYMMDDHHmmss')
    };
    const { refresh_token } = request.body;
    const authResult = refresh_token ?
      await this.__checkRefreshToken.call(this, refresh_token) :
      await promiseResult(promiseMiddleware(request, this.checkPassword));
    if(refresh_token && authResult || authResult === 'success') {
      const token = Object.assign(
        refresh_token ?
        authResult :
        this.tokenExtend(request), defaultToken
      );
      this.tokensDB.write(token);
      return response.send(token);
    }
    response401(response, authResult, 'Ошибка аутентификации!');
  }
  get __revocationTokensRoute() {
    return express.Router().post(this.revocationPath, this.__deleteTokens.bind(this));
  }
  __deleteTokens(req, res) {
    const { token_type_hint, token } = req.body;
    this.tokensDB.remove(token_type_hint, token);
    res.send();
  }
  get __loadRoutes() {
    const router = express.Router();
    this.methods.forEach(method => router[method](this.routes, this.protectiveLayers));
    return router;
  }
  __layer(level, ...functions) {
    const newObject = this.copyObject;
    if(!Array.isArray(newObject.protection[level])) {
      newObject.protection[level] = [];
    }
    functions.forEach(aFunction => {
      newObject.protection[level].push(
        typeof aFunction === 'function' ?
        aFunction :
        shortFunction(aFunction)
      );
    });
    return newObject;
  }
  get copyObject() {
    const newObject = Object.create(this);
    newObject.protection = copyArray(this.protection);
    return newObject;
  }
  async __defaultProtect(req, next, cancel) {
    if(req.token) next();
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
  async __checkRefreshToken(refresh_token) {
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

module.exports = new SimpleOAuth2Server;

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
  return token &&
    moment(token.expires_at, 'YYMMDDHHmmss').add(token.expires_in, 'seconds') >= moment();
}

function response401(res, errMsg, altMsg = 'Ошибка авторизации!') {
  res.status(401).send({
    'message': typeof errMsg === 'string' ? errMsg : altMsg
  });
}

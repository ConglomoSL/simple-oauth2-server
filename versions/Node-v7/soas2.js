if(!process.env.v7) require("babel-polyfill");

const path = require('path');
Promise.any = require('promise-any');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const moment = require('moment');
const lowdbAPI = require(path.join(__dirname, '../../', 'api/lowdb'));

const DATE_FORMAT = 'YYMMDDHHmmss';

class SimpleOAuth2Server {

  constructor() {
    this.__protection = [
      ['default']
    ];
    this.defaultOptions = {
      expiredToken: 15 * 60,
      createTokenPath: '/token',
      revocationPath: '/tokenRevocation',
      tokensDB: new lowdbAPI,
      tokenType: 'Bearer'
    };
  }

  init(options, oldFormat) {
    if(oldFormat && !options.expressApp) {
      oldFormat.expressApp = options;
      options = oldFormat;
    }
    this.__configuring(options);
    this.__isFatalErrors();
    this.tokensDB.connect();
    this.expressApp
      .use(this.__appSettings)
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
    const level = this.__protection.length;
    return this.__makeLayer(level, ...arguments);
  }

  layerOr() {
    const level = this.__protection.length - 1;
    return this.__makeLayer(level, ...arguments);
  }

  tokenExtend() {
    return {};
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

  __isFatalErrors() {
    if(!this.expressApp) {
      throw new Error('Where is express application?');
      exit();
    }
    if(!this.authentication) {
      throw new Error('Function for authentication is undefined!');
      exit();
    }
  }

  async __authentication(request, response) {
    const defaultToken = {
      access_token: uuid(),
      refresh_token: uuid(),
      expires_in: this.expiredToken,
      expires_at: moment().format(DATE_FORMAT)
    };
    const { refresh_token } = request.body;
    const authResult =
      refresh_token ?
      await this.__checkRefreshToken.call(this, refresh_token) :
      await promiseResult(promiseMiddleware(request, this.authentication));
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

  __deleteTokens(request, response) {
    const { token_type_hint, token } = request.body;
    this.tokensDB.remove(token_type_hint, token);
    response.send();
  }

  __makeLayer(level, ...functions) {
    const newObject = this.__copyObject;
    if(!Array.isArray(newObject.__protection[level])) {
      newObject.__protection[level] = [];
    }
    functions.forEach(aFunction => newObject.__protection[level].push(aFunction));
    return newObject;
  }

  async __defaultProtect(request, next, cancel) {
    if(request.token) return next();
    const access_token =
      request.get('Authorization') ?
      request.get('Authorization').replace(this.tokenType + ' ', '') :
      false;
    if(access_token) {
      const token = await this.tokensDB.find('access_token', access_token);
      if(token) {
        if(validateToken(token)) {
          request.token = token;
          return next();
        }
        this.tokensDB.remove('access_token', access_token);
      }
    }
    cancel('Попытка несанкционированного доступа!');
  }

  async __checkRefreshToken(refresh_token) {
    const token = await this.tokensDB.find('refresh_token', refresh_token);
    if(token) {
      this.tokensDB.remove('refresh_token', refresh_token);
      return moment(token.expires_at, DATE_FORMAT).add(1, 'week') > moment() ?
        token :
        false;
    }
  }

  get __layers() {
    const __thisLayers = copyArray(this.__protection);
    return async(request, response, next) => {
      const checkToken = await promiseResult(
        promiseMiddleware(request, this.__defaultProtect.bind(this))
      );
      __thisLayers[0][0] =
        checkToken === 'success' ?
        Promise.resolve() :
        Promise.reject(checkToken);
      const thisLayers = __thisLayers.map((layer, i) =>
        Promise.any(layer.map((aFunction, j) =>
          i + j ?
          promiseMiddleware(request, aFunction) :
          aFunction
        ))
      );
      const checkAll = await promiseResult(Promise.all(thisLayers));
      checkAll === 'success' ?
        next() :
        response401(response, checkAll[0]);
    }
  }

  get __revocationTokensRoute() {
    return express
      .Router()
      .post(this.revocationPath, this.__deleteTokens.bind(this));
  }

  get __getTokenRoute() {
    return express
      .Router()
      .post(this.createTokenPath, this.__authentication.bind(this));
  }

  get __appSettings() {
    return express
      .Router()
      .use(bodyParser.urlencoded({ extended: false }))
      .use((request, response, next) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH'
        );
        response.setHeader(
          'Access-Control-Allow-Headers',
          'X-Requested-With, content-type, Authorization'
        );
        next();
      });
  }

  get __loadRoutes() {
    const router = express.Router();
    this.methods.forEach(method => router[method](this.routes, this.__layers));
    return router;
  }

  get __copyObject() {
    const newObject = Object.create(this);
    newObject.__protection = copyArray(this.__protection);
    return newObject;
  }

}

module.exports = new SimpleOAuth2Server;

function promiseMiddleware(request, aFunction) {
  return new Promise((resolve, reject) => {
    aFunction(request, resolve, reject);
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

function validateToken(token) {
  const { expires_at, expires_in } = token;
  const expired = moment(expires_at, DATE_FORMAT).add(expires_in, 'seconds');
  return expired > moment();
}

function response401(response, errMsg, altMsg = 'Ошибка авторизации!') {
  response.status(401).send({
    'message': typeof errMsg === 'string' ? errMsg : altMsg
  });
}

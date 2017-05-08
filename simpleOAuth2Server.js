// Библиотека, позволяющая запускать модуль на старых версиях Node.js;
// require("babel-polyfill");
// Расширим стандартный языковой объект для построения гибких логических условий в уровнях защиты
Promise.any = require('promise-any');
// Фреймворк для развёртывания http-сервера
const express = require('express');
// Извлечение информации из запроса
const bodyParser = require('body-parser');
// Модуль для генерации токенов
const uuid = require('uuid');
// Модуль для работы со временем
const moment = require('moment');
// База данных, хранящая токены на жёстком диске в json-формате
const lowdbAPI = require('./api/lowdb');

// Объявление класса
class SimpleOAuth2Server {
  // Метод, срабатывающий при инициализации объекта класса
  constructor() {
    // Обнуление слоёв защиты
    this.clean();
    // Параметры по-умолчанию
    this.defaultOptions = {
      // Время жизни access token
      expiredToken: 24 * 60 * 60, // one day
      // Маршрут, на котором происходит выдача токенов
      createTokenPath: '/token',
      // Маршрут, куда следует посылать запрос об ликвидировании токена
      revocationPath: '/tokenRevocation',
      // API для работы с БД
      tokensDB: new lowdbAPI
    };
  }
  // Метод связывания модуля с экземпляром приложения Express,
  // установка глобальных параметров
  init(options) {
    // Применение параметров
    this._configuring(options);
    // Проверка на отсутствие глобальных ошибок при инициализации модуля
    this._fatalErrors();
    // Запуск соединения с БД, где будут храниться токены
    this.tokensDB.connect();
    // Применение необходимых настроек для экземпляра приложения Express
    this.expressApp
      .use(this.appSettings)
      .use(this._getTokenRoute)
      .use(this._revocationTokensRoute);
    // Добавим возможность использования метода в цепочке
    return this;
  }
  // Основной метод, устанавливающий слои защиты на маршруты
  defend(options) {
    this._configuring(options, {
      routes: ['**'],
      methods: ['get', 'post', 'delete', 'put', 'patch']
    });
    this.expressApp.use(this._loadRoutes);
    return this;
  }
  // Метод, добавляющий слой защиты
  and() {
    const level = this.protection.length;
    return this._layer(level, ...arguments);
  }
  add() {
    return this.and(...arguments);
  }
  // Метод, расширяющий слой защиты
  or() {
    const level = this.protection.length - 1;
    return this._layer(level, ...arguments);
  }
  // Обнуление слоёв защиты
  clean() {
    this.protection = [];
    this.protection.push(['default']);
    return this;
  }
  // Генерация функции, которая будет защищать маршрут
  get layersProtect() {
    // Копируем заявленные слои защиты
    const _layers = copyArray(this.protection);
    return async(request, response, next) => {
      // Проверка токена
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
        // Message for russian hackers!
        response.status(401).send({
          message: typeof mainCheckMsg[0] === 'string' ? mainCheckMsg[0] : "Ошибка авторизации!"
        });
    };
  }
  // Метод, извлекающий токен из заголовка запроса
  authorizationHeader(request) {
    return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
  }
  // Необходимые настройки экземпляра приложения
  get appSettings() {
    return express.Router()
      .use(bodyParser.urlencoded({ extended: false }))
      .use((req, res, next) => {
        // Разрешённые домены для запроса
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Разрешённые методы запроса
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
        // Разрешённые заголовки
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');
        next();
      });
  }
  // Установка параметров заданных пользователем
  // и параметров по-умолчанию
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
  // Проверка критически важных параметров
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
  // Установление функции обработки маршрута выдачи токенов
  get _getTokenRoute() {
    return express.Router().post(this.createTokenPath, this._authentication.bind(this));
  }
  // Выдача токенов
  async _authentication(request, response) {
    // Стандартный формат токена, хранящийся в БД
    const defaultToken = {
      access_token: uuid(),
      refresh_token: uuid(),
      expires_in: this.expiredToken,
      expires_at: moment().format('MMDDHHmmss')
    };
    // Пытаемся извлечь токен обновления
    const { refresh_token } = request.body;
    // Ветвление, в зависимости от присутствия refresh_token в запросе
    const authResult = refresh_token ?
      // Функция обновления токенов (возвращает старый токен в случае успеха)
      await this._checkRefreshToken.call(this, refresh_token) :
      // Функция выдачи токенов по паролю
      await promiseResult(promiseMiddleware(request, this.checkPassword));
    // Проверка запроса функцией checkPassword или _checkRefreshToken
    if(refresh_token && authResult || authResult === 'success') {
      // Если проверки прошли успешно, создаём токен
      const token = Object.assign(refresh_token ? authResult : this.tokenExtend(request), defaultToken);
      // Записываем его в БД (асинхронно)
      this.tokensDB.write(token);
      // Отправляем копию клиенту
      return response.send(token);
    }
    // В случае провала
    // Message for russian hackers!
    response.status(401).send({
      "message": typeof authResult === 'string' ? authResult : "Ошибка аутентификации!"
    });
  }
  // Установка маршрута отзыва токенов
  get _revocationTokensRoute() {
    return express.Router().post(this.revocationPath, this._deleteTokens.bind(this));
  }
  // Функция удаления токенов, работающая на маршруте отзыва токенов
  _deleteTokens(req, res) {
    const { token_type_hint, token } = req.body;
    this.tokensDB.remove(token_type_hint, token);
    res.send();
  }
  // Вспомогательный метод для установки функций на маршруты
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
  // Функция, проверяющая корректность предоставленного access_token
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
  // Функция, проверяющая корректность предоставленного refresh_token
  async _checkRefreshToken(refresh_token) {
    const token = await this.tokensDB.find('refresh_token', refresh_token);
    if(refresh_token && token && token.access_token.length) {
      this.tokensDB.remove('refresh_token', refresh_token);
      return token;
    }
    return false;
  }
  // Стандартный метод расширения формата токена
  tokenExtend() {
    return {};
  }
}

module.exports = SimpleOAuth2Server;

// Создание промиса из middleware функции
function promiseMiddleware(req, aFunction) {
  return new Promise((resolve, reject) => {
    aFunction(req, resolve, reject)
  });
}
// Необходимые колбэки для промисов
function promiseResult(promise) {
  return promise
    .then(() => 'success')
    .catch(message => message !== 'success' ? message : false);
}
// Копирование массива (избегаем копирования указателя на массив)
function copyArray(array) {
  return array.map(subArray => subArray.slice());
}
// Вспомогательные функции, которые генерируются по строке или паре строк в массиве
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
// Проверка срока хранения токена
function validateToken(token) {
  return token && moment(token.expires_at, 'MMDDHHmmss').add(token.expires_in, 'seconds') >= moment();
}

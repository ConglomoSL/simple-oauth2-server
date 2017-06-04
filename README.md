[![npm version](https://badge.fury.io/js/simple-oauth2-server.svg)](http://badge.fury.io/js/simple-oauth2-server)

# simple-oauth2-server
## Introdution
Simple authorization OAuth2 module.

It uses <a href="https://github.com/typicode/lowdb">`lowdb`</a> for saving tokens in session by default. And you can start developing now without creating data base. If you have DB and want to saving tokens in it you can write simple API for this module like:
- <a href="https://github.com/justerest/simple-oauth2-server/blob/master/api/lowdb.js">lowdb</a> (default)
- <a href="https://github.com/justerest/simple-oauth2-server/blob/master/api/mysql.js">mySQL</a>


## Basic usage
```
npm i --save simple-oauth2-server
```
```javascript
const app = require('express')();
const soas2 = require('simple-oauth2-server');

const users = ['Администратор', 'Сотрудник', 'Administrator', 'Collaborator'];

soas2.init({
    expressApp: app,
    authentication(request, next, cancel) {
      users.includes(request.body.username) ?
        next() :
        cancel('Authentication is fail!');
    },
    tokenExtend(request) {
      return { role: request.body.username };
    },
    expiredToken: 15
  })
  .defend({
      routes: ['/secret-one', '/secret-two/**'], // routes which you want to protect
      methods: ['get', 'post', 'delete', 'put', 'patch'] // methods which you want to protect
  });
```
Your protection is enabled! And server sends tokens on requests on `createTokenPath` (by default '/token').

## More detailed usage
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js

## Demo
https://kscript.ru/auth/

## Methods
### init(`options`)
Options (type: `object`):
```javascript
{
  expressApp: /* required declare! Your express application object */,
  authentication: /* required declare! Function for authentication */,
  expiredToken: 15 * 60, // token lifetime
  createTokenPath: '/token', // route where server gives tokens
  revocationPath: '/tokenRevocation', // route where server revokes tokens
  tokensDB: lowdbAPI, // API for working with DB
  tokenType: 'Bearer', // Configured for Bearer tokens by default
  // Function for configuring token format if it`s needed (argument is request)
  tokenExtend: function(request) {
    return { username: request.body.username };
  }
}
```

### defend(`options`)
It establishes protection on routes.

Options:
- routes:
  - type: `array`
  - default: `['**']`
- methods:
  - type: `array`
  - default: `['get', 'post', 'delete', 'put', 'patch']`

### layerAnd(`function(request, next, cancel)`, `...functions`)
Add new protective layer.

### layerOr(`function(request, next, cancel)`, `...functions`)
Add new protective function in current layer.


## Token info
On protected routes you can get token info from `request.token`
```javascript
app.get('/secret-data', (request, response) => {
    console.log(request.token);
    response.send('secret data');
});
```

### Default information in token (can not be re-written)
```javascript
{
    access_token: uuid(),
    refresh_token: uuid(),
    expires_in: this.expiredToken,
    expires_at: moment()
}

```

## Have questions or problems?
You can send me message on justerest@yandex.ru or create an issue.
I will be very glad to listen any questions, criticism and suggestions.
It's need for my diplom project.

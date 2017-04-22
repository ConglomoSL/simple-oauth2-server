[![npm version](https://badge.fury.io/js/simple-oauth2-server.svg)](http://badge.fury.io/js/simple-oauth2-server)

# simple-oauth2-server
## Introdution
Simple module for deploying oAuth2 server and enstablish several levels of protection on Express application.
May be it help you to fast develope application.

It use <a href="https://github.com/typicode/lowdb">`lowdb`</a> for saving tokens in session by default. And you can start developing now without creating data base. If you have DB and want to saving tokens in it you can write simple API for this module like:
- <a href="https://github.com/justerest/simple-oauth2-server/blob/master/api/lowdb.js">lowdb</a> (default)
- <a href="https://github.com/justerest/simple-oauth2-server/blob/master/api/mysql.js">mySQL</a>


## Basic usage
```
npm i --save simple-oauth2-server
```
```javascript
const express = require('express');
const app = express();
const soAs2 = require('simple-oauth2-server');

soAs2.init(app, {
        // your function for authentication
        checkPassword: (req, next, cancel) => {
            const { username, password } = req.body;
            if(username === 'login' && password === 'pass') {
                console.log('Authentication is success!');
                next();
            } else {
                console.log('Wrong password!');
                cancel('Authentication is fail!');
            }
        }
    })
    .defend({
        routes: ['/secret'], // routes which you want to protect
        methods: ['get', 'post', 'delete', 'put'] // methods which you want to protect
    });
```
Your protection is enabled! And server send tokens on requests on `tokenGetPath` (by default '/token').

## More detailed usage
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js
```javascript
simpleOAuth2Server.defend({ // Enable protection on routes (access only for authenticated users)
        routes: ['/secret-data'], // routes which you want to protect
        methods: ['get', 'post', 'put', 'delete', 'patch'] // methods for routes protection
    })
    .and(A) // Add new protective layer (A = function(req, next, cancel) {...})
    .and(B)
    .defend({ // Enable protection for some routes with two layers
        routes: ['/a/b'], // Access will be present if (authenticated && A && B)
        methods: ['get', 'post', 'put', 'delete', 'patch']
    })
    .defend({ // Defend may be called again and protect another routes with another methods
        routes: ['/a/b/2'],
        methods: 'get,post,put,delete,patch'
    })
    .clean() // Remove all previous levels of protection in chain
    .and(B, C) // Add new protective layer for some routes with several protective functions
    .or(D, A) // Add protective function in previous layer
    .defend({ // Access will be present if (authenticated && (B || C || D || A))
        route: ['/bcda/'],
        method: 'get,post,put,delete,patch'
    })
    .and(E)
    .defend({ // Access will be present if (authenticated && (B || C || D || A) && E)
        routes: ['/bcda/e'],
        methods: 'get,post,put,delete,patch'
    })
    .clean()
    .or(A, B)
    .defend({ // Access will be present if (authenticated || A || B)
        routes: ['/auth_a_b'],
        methods: 'get,post,put,delete,patch'
    });

const customLayer = simpleOAuth2Server.and(A, B).and(C).or(D).layersProtect;
app.post('/custom_protection', customLayer, (req, res) => {
    res.send('OK!');
});
```

## Methods
### init(app, options)
It start session.
Params:
- app (your express application object)
- options (type: `object`):
```javascript
{
  checkPassword: /* required declare! Function for authentication */,
  tokenExpired: 24 * 60 * 60, // token lifetime
  tokenGetPath: '/token', // route where server gives tokens
  tokenRevocationPath: '/tokenRevocation', // route where server revokes tokens
  tokensDB: lowdb // class for working with DB
  // Function for configuring token format if it`s needed (argument is request)
  tokenExtend: function(request) {
    return {
      username: request.body.username
    };
  }

  // Function for extraction access token from headers (must return value of access token)
  // Configured for Bearer tokens by default
  authorizationHeader: function(request) {
      return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
  }
}
```

### defend(options)
It establishes protection on routes.
Options:
- routes:
  - type: `array`
  - default: `['**']`
- methods:
  - type: `array`
  - default: `['get', 'post', 'delete', 'put', 'patch']`

### and(function(req, next, cancel), ...functions)
Add new protective layer.

### or(function(req, next, cancel), ...functions)
Add new protective function in current layer.

### clean()
Removes middleware functions which was added.

## Token info
On protected routes you can get token info from `req.token`
```javascript
app.get('/secret-data', (req, res) => {
    console.log(req.token);
    res.send('secret data');
});
```

### Default information in token (can not be re-written)
```javascript
{
    access_token: uuid(),
    refresh_token: uuid(),
    expires_in: this.tokenExpired,
    expires_at: moment()
}

```

## Have questions or problems?
You can send me message on justerest@yandex.ru or create an issue.
I will be very glad to listen any questions, criticism and suggestions.
It's need for my diplom project.

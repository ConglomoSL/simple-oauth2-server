[![npm version](https://badge.fury.io/js/simple-oauth2-server.svg)](http://badge.fury.io/js/simple-oauth2-server)

# simple-oauth2-server
## Introdution
Simple module for deploying oAuth2 server with several levels of protection.
Perfect work with <a href="https://github.com/simplabs/ember-simple-auth">`ember-simple-auth`</a>

It use <a href="https://github.com/typicode/lowdb">`lowdb`</a> for saving tokens in session.


## Basic usage
```
npm i --save simple-oauth2-server
```
```javascript
const express = require('express');
const app = express();
const simpleOAuth2Server = require('simple-oauth2-server');

simpleOAuth2Server.init(app, {
    // your function for authentication
    checkPassword: function(request, next, cancel) {
        const {
            username,
            password
        } = request.body;
        if (username === 'user' && password === 'pass') {
            next();
        }
        cancel();
    }
});
simpleOAuth2Server.defend({
    routes: ['/secret'], // routes which you want to protect
    methods: ['get', 'post', 'delete', 'put'] // methods for protective routes
});
```
Your protection is enabled! And server send tokens on requests on `tokenGetPath` (by default '/token').


## More detailed usage
```javascript
simpleOAuth2Server // Let's start session
    .init(app, { // Start DB in /secretLocalDataBase
        checkPassword: (req, next, cancel) => { // Your function for issuing tokens (required)
            if (req.body.username === 'login' && req.body.password === 'pass') {
                console.log('Authentication is success!');
                next();
            } else cancel('Authentication is fail!');
        }
    })
    .defend({ // Enable protection on routes (access only for authenticated users)
        routes: ['/default'], // routes which you want to protect
        methods: ['get', 'post'] // methods for routes protection (except 'any')
    })
    .newLayer(A) // Add new protective layer (A = function(req, next, cancel) {...})
    .newLayer(B) // (B = function(req, next, cancel) {...})
    .defend({ // Enable protection for some routes with two layers
        routes: ['/ab/'], // Access will be present if (authenticated && A && B) === true
        methods: ['post']
    })
    .defend({ // Defend may be called again and protect another routes with another methods
        routes: ['/posts/:post_id'],
        methods: ['put', 'get', 'delete']
    })
    .clean() // Remove all previous levels of protection (A)
    .newLayer(B, C) // Add new protective layer for some routes with several protective functions
    .or(D, A) // Add protective function in previous layer
    .defend({ // Access will be present if (authenticated && (B || C || D || A)) === true
        routes: ['/bcd/'],
        methods: ['post']
    })
    .newLayer(E)
    .defend({ // Access will be present if (authenticated && (B || C || D || A) && E) === true
        routes: ['/bcde/:post_id'],
        methods: ['delete']
    })
    .clean()
    .or(A)
    .defend({ // Access will be present if (authenticated || A) === true
        routes: ['/all'],
        methods: ['get']
    });
```

## Methods of simpleOAuth2Server object
### init(app, options)
It start session.
Params:
- app
  - your express application object
- options (type: `object`):
```javascript
{
  checkPassword: /* required declare */,
  tokenExpired: 24 * 60 * 60, // token lifetime
  tokenGetPath: '/token', // route where server gives tokens
  tokenRevocationPath: '/tokenRevocation', // route where server revokes tokens

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
  - default: `[]`
- methods:
  - type: `array`
  - default: `[]`

### newLayer(function(req, next, cancel), ...functions)
Add new protective layer.

### or(function(req, next, cancel), ...functions)
Add new protective function in current layer.

### clean()
Removes middleware functions which was added in the chain.

## Token info
On protected routes you can get token info from `req.token`
```javascript
app.get('/secret-data', (req, res) => {
    console.log(req.token);
    res.send('secret data');
});
```

Default information in token (can not be re-written)
```javascript
{
    access_token: uuid(),
    refresh_token: uuid(),
    expires_in: this.tokenExpired,
    expires_at: moment()
}

```

## Example
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js

Just run:
```
git clone https://github.com/justerest/simple-oauth2-server.git
cd /simple-oauth2-server
npm i && npm start
```

## Have questions or problems?
You can send me message on justerest@yandex.ru or create an issue.
I'm glad to listen any questions, criticism and suggestions.

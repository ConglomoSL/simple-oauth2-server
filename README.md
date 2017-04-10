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
    // your function for authentication (must return `true` or `false`)
    checkPassword: function(request) {
        const {
            username,
            password
        } = request.body;
        if (username === 'user' && password === 'pass') {
            return true;
        }
        return false;
    }
});
simpleOAuth2Server.defend({
    routes: ['/secret'], // routes which you want to protect
    methods: ['get', 'post', 'delete', 'put'] // methods for protective routes
});
```
Your protection is enabled! And server send tokens on requests on `tokenGetPath` (by default '/token').


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

## add(function(req, res, next))
Add new middleware function for protection in chain.

## reset()
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

## Add new layer of protection
If you need to several levels protection you can add new protect function and defend other routes:
```javascript
const newLayer = simpleOAuth2Server.addProtect(checkUserRights);
newLayer.defend({
      routes: ['/secret*'],
      methods: ['get']
  });
// or it can be written like chain:
simpleOAuth2Server
    .addProtect(checkUserRights)
    .defend({
        routes: ['/secret*'],
        methods: ['get']
    });
```

You can combine many layers of protection for your application. And you can add layer of protection as middleware in route:
```javascript
const superProtect = simpleOAuth2Server
    .addProtect(checkUserRights)
    .addProtect(isSuperAdmin)
    .protect;

app.get('/only/super/users/can/read', superProtect, (req, res) => {
    res.send('You are super!');
});
```

## Full usage
```javascript
simpleOAuth2Server
    // Let's start session
    .init(app, {
        checkPassword: authenticationCheck, // Your function for issuing tokens (required)
        tokenExpired: 24 * 60 * 60, // one day by default
        tokenGetPath: '/token',
        tokenRevocationPath: '/tokenRevocation',
        // Your function for configuring token format if it's needed
        tokenExtend: function(request) {
            return {
                username: request.body.username
            };
        },
        // Function for extraction access token from headers (must return value of access token)
        // Configured for Bearer tokens by default
        authorizationHeader: function(request) {
            return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
        }
    })
    // Enable protection on routes (access only for authenticated users in this example)
    .defend({
        // routes which you want to protect
        routes: ['/secret-data/'],
        // methods for routes protection (except 'any')
        methods: ['get', 'post']
    })
    // Add new protective layer for some routes (checkAccess = function(req, res, next) {})
    .add(checkAccess)
    .defend({
        routes: ['/posts/'],
        methods: ['post']
    })
    .defend({
        routes: ['/posts/:post_id'],
        methods: ['put', 'get', 'delete']
    })
    // Remove all previous levels of protection (function checkAccess in this example)
    .reset()
    // Add new protective layer for some routes
    .add(isAdmin)
    // Access only for administator
    .defend({
        routes: ['/users/'],
        methods: ['post']
    })
    .defend({
        routes: ['/users/:post_id'],
        methods: ['delete']
    });
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

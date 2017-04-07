[![npm version](https://badge.fury.io/js/simple-oauth2-server.svg)](http://badge.fury.io/js/simple-oauth2-server)

# simple-oauth2-server
## Introdution
Simple module for deploying oAuth2 server with several levels of protection.
Perfect work with <a href="https://github.com/simplabs/ember-simple-auth">`ember-simple-auth`</a>

It use <a href="https://github.com/typicode/lowdb">`lowdb`</a> for saving tokens from the box.


## Basic usage
```
npm i --save simple-oauth2-server
```
```javascript
const express = require('express');
const app = express();

const simpleOAuth2Server = require('simple-oauth2-server');
simpleOAuth2Server.init(app, {    
    checkPassword: function(request) { // your function for authentication (must return `true` or `false`)
        const {username, password} = request.body;
        if(username === 'user' && password === 'pass'){
          return true;
        }
        return false;
      },    
    routes: ['/secret'], // routes which you want to protect    
    methods: ['get', 'post', 'delete', 'put'] // methods for protect routes
});
```
You protection is enabled! And server send tokens on requests on `tokenGetPath`.

## Default options
```javascript
{
  /**
    @function Your function for issuing tokens
    @default undefined
    @param request
  **/
  checkPassword: /* required declare */,
  /**
    @property Protected routes
    @default []
    @type array
  **/
  routes: [],
  /**
    @property Methods for protected routes ['get', 'post', 'delete', 'put'] (except 'any')
    @default []
    @type array
  **/
  methods: [],
  /**
    @property Token lifetime
    @default one day
    @type integer
  **/
  tokenExpired: 24 * 60 * 60,
  /**
    @property Route where server issues tokens
    @default '/token'
    @type string
  **/
  tokenGetPath: '/token',
  /**
    @property Route where server revokes tokens
    @default '/token'
    @type string
  **/
  tokenRevocationPath: '/tokenRevocation',
  /**
    @function Function for extraction access token from headers (must return value of access token)
    @default сonfigured for Bearer tokens
    @param request
  **/
  authorizationHeader: function(request) {
      return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
  }
}
```

## Add new layer of protection
If you need to several levels protection you can add new protect function and extend protection for other routes:
```javascript
simpleOAuth2Server.addProtect(checkUserRights)
  .extend({
      routes: ['/secret*'],
      methods: ['get']
  });
```
You can combine many layers of protection for your application. Make joint layers and layers with unique function of protection.
```javascript
const superProtectLayer = simpleOAuth2Server.addProtect(isSuperAdmin).addProtect(checkUserRights).protect;
```
You can add layer of protection as middleware in route instead extending
```javascript
app.get('/only/super/users/can/read', superProtectLayer, (req, res) => {
    res.send('you super!');
});
```

## Token info
On protect routes you can get token info from `req.token`
```javascript
app.get('/secret-data', (req, res) => {
    console.log(req.token);
    res.send(/* secret data */);
});
```
You can add information to tokens if you specify a function in the `tokenExtend` option when  initializing
```javascript
simpleOAuth2Server.init(app, {    
    checkPassword: function(request) { // your function for authentication (must return `true` or `false`)
        const {username, password} = request.body;
        if(username === 'user' && password === 'pass'){
          return true;
        }
        return false;
      },    
    tokenExtend: function(request) { // function must return `object` with new fields or `false`
      return {
        username: request.body.username
      };
    }
});
````

Default information in token (not re-written)
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

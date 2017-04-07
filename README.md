[![npm version](https://badge.fury.io/js/simple-oauth2-server.svg)](http://badge.fury.io/js/simple-oauth2-server)

# simple-oauth2-server
## Introdution
Simple module for deploying oAuth2 server with several levels of protection.
Perfect work with <a href="https://github.com/simplabs/ember-simple-auth">`ember-simple-auth`</a>


## Basic usage
```
npm i --save simple-oauth2-server
```
```javascript
const express = require('express');
const app = express();

const simpleOAuth2Server = require('simple-oauth2-server');
simpleOAuth2Server.init(app, {    
    checkPassword: (request) => { // your function for authentication (must return `true` or `false`)
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
routes: [], // protect routes
methods: [], // methods for protect routes ['get', 'post', 'delete', 'put'] (except 'any')
tokenExpired: 24 * 60 * 60, // one day
tokenGetPath: '/token',
tokenRevocationPath: '/tokenRevocation',

// function for extraction access token from header (must return access token value)
// by default сonfigured for Bearer tokens
authorizationHeader: function(request) {
    return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
}
```

## Add new layer of protection
If you need to several levels protection you can add new protect function:
```javascript
const $oAuth2$_newLayer = $oAuth2$.addProtect(checkUserRights);
```
And extend protection for other routes (you can send only `routes`, `methods` and `authorizationHeader` in options)
```javascript
$oAuth2$_newLayer.extend(app, {
    routes: ['/secret*'],
    methods: ['get']
});
```
You can combine many layers of protection for your application. Make joint layers and layers with unique function of protection.
```javascript
const superLevel = $oAuth2$_newLayer.addProtect(isSuperAdmin);
```
You can add layer of protection as middleware in route instead extending
```javascript
app.get('/only/super/users/can/read', superLevel.protect, (req, res) => {
    res.send('you super!');
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

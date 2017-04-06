# simple-oauth2-server
## Introdution
Simple module for deploying oAuth2 server with several levels of protection.
Perfect work with <a href="https://github.com/simplabs/ember-simple-auth">`ember-simple-auth`</a>
## Usage
```
npm i --save simple-oauth2-server
```
```
const simpleOAuth2Server = require('simple-oauth2-server');
simpleOAuth2Server.init(app, {
    checkPassword: false, // your function for authentication
    routes: ['/secret'], // routes which you want to protect
    methods: ['get', 'post', 'delete', 'put'], // methods for protect routes
});
```
You protect is initiate and enabled! And server give tokens by requests on `tokenGetPath`.
## Default options
```
routes: [], // protect routes
methods: [], //methods for protect routes ['get', 'post', 'delete', 'put']
tokenGetPath: '/token',
tokenRevocationPath: '/tokenRevocation',
tokenExpired: 24 * 60 * 60, // one day
```
## Add new layer of protection
If you need to several levels protection you can add new protect function:
```
const $oAuth2$_level2 = $oAuth2$.addProtect((req, res, next) => {
    next();
});
```
and extend protect on other routes (you can send in options only `routes` and `methods`)
```
$oAuth2$_level2.extend(app, {
    routes: '/secret*',
    methods: ['get']
});
```
## Example
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js
Just clone this repository and run `npm i && npm start`

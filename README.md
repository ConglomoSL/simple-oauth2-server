# simple-oauth2-server
## Usage
```
const $oAuth2$ = require('simple-oauth2-server');
const protectRouter = $oAuth2$.init({
  checkPassword: /* your function for authentication */,
  secretRoutes: ['/secret/*],
  controlMethods: ['delete','put']
});
//include protect router in your app
app.use(protectRoter);
```
## Example
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js
Just clone this repository and run `npm i && npm start`

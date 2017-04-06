# simple-oauth2-server
## Usage
```
const simpleOAuth2Server = require('simple-oauth2-server');

const protectRouter = simpleOAuth2Server.init({
    checkPassword: /*your function for authentication*/,
    routes: ['/secret*'],
    methods: ['get', 'delete', 'put']
});

app.use(protectRouter);
```
## Example
You can watch an usage example on https://github.com/justerest/simple-oauth2-server/blob/master/example/app.js
Just clone this repository and run `npm i && npm start`

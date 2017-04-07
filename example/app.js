const express = require('express');
const app = express();

const low = require('lowdb');
const usersData = low('./users.json');
const secretData = low('./secret-data.json');
const hasRec_prototype_in_lowdb = require('./../lib/extend-lowdb.js');
hasRec_prototype_in_lowdb(usersData);

usersData.defaults({
    users: [{
        username: 'justerest',
        password: 'asdasd'
    }]
}).write();

secretData.defaults({
    documents: [{
        level: 'secret',
        info: 'qwerty'
    }, {
        level: 'top-secret',
        info: '1234567890'
    }]
}).write();

const $oAuth2$ = require('./..');

// Your function for authentication (check user password, can be send with init options)
$oAuth2$.checkPassword = authenticationCheck;

$oAuth2$.init(app, {
    /***************
    checkPassword: false, // your function for authentication if not declared yet
    routes: [], // routes which you want to protect, example: ['/secret/documents', '/secret-images/**']
    methods: [], //methods for protect routes, example: ['get', 'post', 'delete', 'put'] (except 'any')
    tokenExpired: 24 * 60 * 60, // one day
    tokenGetPath: '/token',
    tokenRevocationPath: '/tokenRevocation',
    tokenExtend: function(request) { // you can include in token more information from request (must return `object` or `false`)
      return {
        username: request.body.user
      };
    },
    // function for extraction access token from header (must return access token value)
    // by default сonfigured for Bearer tokens
    authorizationHeader: function(request) {
        return request.get('Authorization') ? request.get('Authorization').replace('Bearer ', '') : false;
    }
    ***************/
});

// Great! You protect is enabled! And server send tokens on requests on `tokenGetPath`.

// If you need to several levels protection you can add new protect function:
const $oAuth2$_newLayer = $oAuth2$.addProtect(checkUserRights);

// And extend protection for other routes (you can send only `routes`, `methods` and `authorizationHeader` in options)
$oAuth2$_newLayer.extend({
    routes: ['/secret*'],
    methods: ['get']
});

// You can combine many layers of protection for your application. Make joint layers and layers with unique function of protection.
const superLevel = $oAuth2$_newLayer.addProtect(isSuperAdmin);

// You can add layer of protection as middleware in route
app.get('/only/super/users/can/read', superLevel.protect, (req, res) => {
    res.send('you super!');
});

// On protect routes you can get token info from `req.token`
app.get('/secret-data', (req, res) => {
    console.log(req.token);
    res.send(secretData.getState());
});

app.listen(3000, () => {
    console.log('Server start');
});

function authenticationCheck(request) {
    const {
        username,
        password
    } = request.body;
    if (username && password) {
        return usersData.get('users').hasRec({
            username: username,
            password: password
        });
    }
    return false;
}

function checkUserRights(req, res, next) {
    next();
}

function isSuperAdmin(req, res, next) {
    next();
}

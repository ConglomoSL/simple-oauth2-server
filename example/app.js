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

// your function for authentication (can be send with init options)
$oAuth2$.checkPassword = authenticationCheck;

$oAuth2$.init(app, {
    /***************
    // checkPassword: false, // your function for authentication
    routes: [], // routes which you want to protect
    methods: [], //methods for protect routes ['get', 'post', 'delete', 'put']
    tokenGetPath: '/token',
    tokenRevocationPath: '/tokenRevocation',
    tokenExpired: 24 * 60 * 60, // one day
    ***************/
});
// Great! You protect is initiate and enabled! And server give tokens by requests on `tokenGetPath`.

// If you need to several levels protection you can add new protect function:
const $oAuth2$_level2 = $oAuth2$.addProtect((req, res, next) => {
    next();
});
// -and extend protect on other routes (you can send in options only routes and methods)
$oAuth2$_level2.extend(app, {
    routes: '/secret*',
    methods: ['get']
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

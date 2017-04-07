const express = require('express');
const app = express();

const low = require('lowdb');
const usersData = low();
const secretData = low();
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

const simpleOAuth2Server = require('./..');

simpleOAuth2Server.init(app, {
        checkPassword: authenticationCheck, // Your function for issuing tokens
        routes: ['**'], // routes which you want to protect, example: ['/secret/documents', '/secret-images/**']
        methods: ['get'], //methods for protect routes, example: ['get', 'post', 'delete', 'put'] (except 'any')
    })
    .addProtect(isAdmin)
    .extend({
        routes: ['/posts**'],
        methods: ['post', 'delete', 'put']
    });

// Great! Your protection is enabled! And server send tokens on requests on `tokenGetPath` (default '/token').
// In this example all authenticated users can make GET requests on all ('**') routes.
// Admin can make POST, DELETE and PUT requests.

// You can combine many layers of protection for your application. Make joint layers and layers with unique function of protection.
const superLevel = simpleOAuth2Server.addProtect(isAdmin).protect;

// You can add layer of protection as middleware in route
app.get('/only/super/users/can/read', superLevel, (req, res) => {
    res.send('You are super!');
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

function isAdmin(req, res, next) {
    // if admin go to next
    next();
}

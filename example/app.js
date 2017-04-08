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

// Include simple oAuth2 server and start DB in /secretLocalDataBase
const simpleOAuth2Server = require('./..');

simpleOAuth2Server
    // Let's start issuing tokens
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
    // Enable protection on routes (access only for authenticated users)
    .extend({
        // routes which you want to protect, example: ['/secret/documents', '/secret-images/**']
        routes: ['/secret-data/'],
        // methods for protect routes, example (except 'any'): ['get', 'post', 'delete', 'put']
        methods: ['get', 'post']
    })
    // Add new protective layer for some routes
    .addProtect(checkAccess)
    // Access only for authorized users
    .extend({
        routes: ['/posts/'],
        methods: ['post']
    })
    .extend({
        routes: ['/posts/:post_id'],
        methods: ['put', 'get', 'delete']
    })
    // Remove all previous levels of protection (function checkAccess in this example)
    .clearProtects()
    // Add new protective layer for some routes
    .addProtect(isAdmin)
    // Access only for administator
    .extend({
        routes: ['/users/'],
        methods: ['post']
    })
    .extend({
        routes: ['/users/:post_id'],
        methods: ['delete']
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
        /* If user is in DB and password is matches then return true */
        return usersData.get('users').hasRec({
            username: username,
            password: password
        });
    }
    return false;
}

function checkAccess(req, res, next) {
    if ( /* have access then */ true) {
        next();
    } else res.status(401).send('Don`t have access!')
}

function isAdmin(req, res, next) {
    // Если администратор, то идём дальше
    next();
};

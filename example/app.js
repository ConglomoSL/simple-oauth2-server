const express = require('express');
const app = express();

const low = require('lowdb');
const usersData = low();
const secretData = low();
const hasRec_in_lowdb = require('./../lib/extend-lowdb.js');
hasRec_in_lowdb(usersData);

const moment = require('moment');

usersData
    .defaults({
        users: [{
            username: 'justerest',
            password: 'asdasd'
        }]
    })
    .write();

secretData
    .defaults({
        documents: [{
            level: 'secret',
            info: 'qwerty'
        }, {
            level: 'top-secret',
            info: '1234567890'
        }]
    })
    .write();

// Include simple oAuth2 server and start DB in /secretLocalDataBase
const simpleOAuth2Server = require('./..');

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
        routes: ['/secret-data'],
        // methods for routes protection (except 'any')
        methods: ['get', 'post']
    })
    // Add new protective layer
    .layer(1, checkAccess)
    // for some routes(checkAccess = function(req, res, next) {})
    .defend({
        routes: ['/posts/'],
        methods: ['post']
    })
    .defend({
        routes: ['/posts/:post_id'],
        methods: ['put', 'get', 'delete']
    })
    // Remove all previous levels of protection (function checkAccess in this example)
    .clearLayers()
    // Add new protective layer for some routes
    .layer(1, isAdmin)
    // Access only for administator
    .defend({
        routes: ['/users/'],
        methods: ['post']
    })
    .defend({
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

function authenticationCheck(req, next, cancel) {
    const {
        username,
        password
    } = req.body;
    /* If user is in DB and password is matches then return true */
    if (userInDB()) {
        next();
    } else cancel();

    function userInDB() {
        return username && password && usersData.get('users')
            .hasRec({
                username: username,
                password: password
            });
    }
}

function checkAccess(req, next, cancel) {
    if (moment().format('SS') % 2) {
        next(); /* if have access then next() */
    } else cancel('Don`t have access!');
}

function isAdmin(req, res, next) {
    // Если администратор, то идём дальше
    next();
};

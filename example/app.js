const express = require('express');
const app = express();

const soas2 = require('./../simpleOAuth2Server.js');

soas2.init(app, { // Start DB in /secretLocalDataBase
        checkPassword: (req, next, cancel) => { // Your function for issuing tokens (required)
            if (req.body.username === 'login' && req.body.password === 'pass') {
                console.log('Authentication is success!');
                next();
            } else cancel('Authentication is fail!');
        },
        tokenExpired: 20
    })
    .defend({ // Enable protection on routes (access only for authenticated users)
        routes: ['/secret-data'], // routes which you want to protect
        methods: ['get', 'post'] // methods for routes protection (except 'any')
    })
    .newLayer(A) // Add new protective layer (A = function(req, next, cancel) {...})
    .newLayer(B) // (B = function(req, next, cancel) {...})
    .defend({ // Enable protection for some routes with two layers
        routes: ['/ab'], // Access will be present if (authenticated && A && B) === true
        methods: ['post']
    })
    .defend({ // Defend may be called again and protect another routes with another methods
        routes: ['/posts/:post_id'],
        methods: ['put', 'get', 'delete']
    })
    .clean() // Remove all previous levels of protection (A)
    .newLayer(B, C) // Add new protective layer for some routes with several protective functions
    .or(D, A) // Add protective function in previous layer
    .defend({ // Access will be present if (authenticated && (B || C || D || A)) === true
        routes: ['/bcd/'],
        methods: ['post']
    })
    .newLayer(E)
    .defend({ // Access will be present if (authenticated && (B || C || D || A) && E) === true
        routes: ['/bcde/:post_id'],
        methods: ['delete']
    })
    .clean()
    .or(A, B)
    .defend({ // Access will be present if (authenticated || A) === true
        routes: ['/all'],
        methods: ['get']
    });

// On protect routes you can get token info from `req.token`

app.get('/all', (req, res) => {
    res.send('all');
})

app.listen(3000, () => {
    console.log('Server start');
});

function A(req, next, cancel) {
    if (true) {
        console.log('A is success!');
        next();
    } else cancel('A is fail!');
}

function B(req, next, cancel) {
    if (true) {
        console.log('B is success!');
        next();
    } else cancel('B is fail!');
}

function C(req, next, cancel) {
    if (true) {
        console.log('C is success!');
        next();
    } else cancel('C is fail!');
}

function D(req, next, cancel) {
    if (true) {
        console.log('D is success!');
        next();
    } else cancel('D is fail!');
}

function E(req, next, cancel) {
    if (true) {
        console.log('E is success!');
        next();
    } else cancel('E is fail!');
}

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

const simpleOAuth2Server = require('./..');

// your function for authentication
simpleOAuth2Server.checkPassword = function(request) {
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

const protectRouter = simpleOAuth2Server.init({ 
    routes: ['/secret*'],
    methods: ['get', 'delete', 'put']
});

app.use(protectRouter);

app.get('/secret-data', (req, res) => {
    res.send(secretData.getState());
});

app.get('/', simpleOAuth2Server.protect, (req, res) => {
    res.send('ok');
});

app.listen(3000, () => {
    console.log('Server start');
});

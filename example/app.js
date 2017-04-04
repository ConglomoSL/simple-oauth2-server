const express = require('express');
const app = express();
const low = require('lowdb');
const usersData = low('./users.json');
const secretData = low('./secret-data.json');
require('./../lib/extend-lowdb.js')(usersData);

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

const SoS = require('./..');
const oAuth2 = new SoS({
    checkPassword: (request) => {
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
    },
    securityRoutes: ['/**'],
    controllMethods: ['post', 'delete', 'put'],
    tokenLifeTime: 10,
});

app.use(oAuth2.init());

app.get('/secret-data', (req, res) => {
    // const sss = new SoS({
    //     controllMethods: ['get']
    // });
    // sss.options.controllMethods = ['get'];
    // app.use(sss.init());
    res.send(secretData.getState());
});

app.get('/', oAuth2.protect, (req, res) => {
    res.send('ok');
});

app.listen(3000, () => {
    console.log('Server start');
});

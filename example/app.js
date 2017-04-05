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

$oAuth2$.checkPassword = (request) => {
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

app.use($oAuth2$.init({
    securityRoutes: ['/token**', '/secret*'],
}));

app.get('/secret-data', (req, res) => {
    res.send(secretData.getState());
});

app.get('/', $oAuth2$.protect, (req, res) => {
    res.send('ok');
});

app.listen(3000, () => {
    console.log('Server start');
});

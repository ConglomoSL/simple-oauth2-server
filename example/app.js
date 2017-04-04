const express = require('express');
const app = express();
const low = require('lowdb');
const usersData = low('./users.json');
require('./../lib/extend-lowdb.js')(usersData);

usersData.defaults({
    users: [{
        username: 'justerest',
        password: 'asdasd'
    }]
}).write();

const SoS = require('./..');
const oAuth2 = new SoS(app);

oAuth2.checkPassword = (username, password) => {
    if (username && password) {
        return usersData.get('users').hasRec({
            username: username,
            password: password
        });
    }
    return false;
}

oAuth2.tokenLifeTime = 5;

app.listen(3000, () => {
    console.log('Server start');
});

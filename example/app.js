const express = require('express');
const app = express();

const SoS = require('./..');
const oAuth2 = new SoS(app);

const low = require('lowdb');
const usersData = low(baseDir + 'users.json', {
    storage: fileAsyncStorage
});

// LISTEN SERVER
app.listen(3000, () => {
    console.log('Server start');
});

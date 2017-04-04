const express = require('express');
const app = express();

const SoS = require('./simpleOauth2Server');
const oAuth2 = new SoS(app);

// LISTEN SERVER
app.listen(3000, () => {
    console.log('Server start');
});

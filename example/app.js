const app = require('express')();
const soas2 = require('./../');

soas2.init({
  expressApp: app,
  checkPassword(req, next, cancel) {
    const { username } = req.body;
    if(username === 'Администратор' || username === 'Сотрудник') {
      next();
    } else cancel('Authentication is fail!');
  },
  tokenExtend(req) {
    return { user: req.body.username };
  },
  expiredToken: 15
});

app.use('/public', (req, res) => res.send('Public information!'))

soas2.defend();

soas2.layerAnd((req, next, cancel) =>
    req.token.user === 'Администратор' ? next() : cancel()
  )
  .defend({ route: '/administrator' });

soas2.layerAnd((req, next, cancel) =>
    req.token.user === 'Сотрудник' ? next() : cancel()
  )
  .defend({ route: '/secret-service' });

soas2.layerOr((req, next) => next())
  .defend({ route: '/public' });

app.use('/service', (req, res) => res.send('Service information!'))
app.use('/administrator', (req, res) => res.send('Administrator information!'))
app.use('/secret-service', (req, res) => res.send('Only service information!'))

soas2.layerAnd((req, next, cancel) => cancel()).defend();

app.listen(3000);

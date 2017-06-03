const app = require('express')();
const soas2 = require('./../');

const users = ['Администратор', 'Сотрудник', 'Administrator', 'Collaborator'];

soas2.init({
  expressApp: app,
  authentication(req, next, cancel) {
    users.includes(req.body.username) ?
      next() :
      cancel('Authentication is fail!');
  },
  tokenExtend(req) {
    return { role: req.body.username };
  },
  expiredToken: 15
});

const administrator = soas2.layerAnd((req, next, cancel) =>
    req.token.role === 'Администратор' ?
    next() :
    cancel()
  )
  .layerOr((req, next, cancel) =>
    req.token.role === 'Administrator' ?
    next() :
    cancel()
  );

const collaborator = soas2.layerAnd((req, next, cancel) =>
    req.token.role === 'Сотрудник' ?
    next() :
    cancel()
  )
  .layerOr((req, next, cancel) =>
    req.token.role === 'Collaborator' ?
    next() :
    cancel()
  );

soas2.defend({ routes: ['/secret/**'] });
administrator.defend({ routes: ['/secret/administrator'] });
collaborator.defend({ routes: ['/secret/only-service'] });

app.use('/public', (req, res) => res.send('Public information!'))
  .use('/secret/only-service', (req, res) => res.send('Only service information!'))
  .use('/secret/service', (req, res) => res.send('Service information!'))
  .use('/secret/administrator', (req, res) => res.send('Administrator information!'));

app.listen(3000);

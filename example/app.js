const app = require('express')();
const soas2 = require('./../simpleOAuth2Server');

soas2.init({
    expressApp: app,
    checkPassword: (req, next, cancel) => {
      const { username, password } = req.body;
      if(username === 'login' && password === 'pass') {
        console.log('Authentication is success!');
        next();
      } else {
        console.log('Wrong password!');
        cancel('Authentication is fail!');
      }
    }
  })
  .defend({ // Enable protection on routes (access only for authenticated users)
    routes: ['/secret-data'], // routes which you want to protect
    methods: ['get', 'post', 'put', 'delete', 'patch'] // methods for routes protection
  })
  .and(A) // Add new protective layer (A = function(req, next, cancel) {...})
  .and(B)
  .defend({ // Enable protection for some routes with two layers
    routes: ['/a/b'], // Access will be present if (authenticated && A && B) is true
    methods: ['get', 'post', 'put', 'delete', 'patch']
  })
  .defend({ // Defend may be called again and protect another routes with another methods
    routes: ['/a/b-2'],
    methods: 'get,post,put,delete,patch'
  })
  .clean()
  .and(A, B) // Add new protective layer for some routes with several protective functions
  .or(C) // Add protective function in previous layer
  .defend({ // Access will be present if (authenticated && (A || B || C)) === true
    route: ['/abc/'],
    method: 'get,post,put,delete,patch'
  })
  .and(D)
  .defend({ // Access will be present if (authenticated && (A || B || C) && D) === true
    routes: ['/abc/d'],
    methods: 'get,post,put,delete,patch'
  })
  .clean()
  .or(A)
  .defend({ // Access will be present if (authenticated || A || B) === true
    routes: ['/public'],
    methods: 'get,post,put,delete,patch'
  });

['get', 'post', 'put', 'delete', 'patch'].forEach(method =>
  app[method]('/public', (req, res) => res.send('Public information!'))
);

const customLayer = soas2.or(D).and(A, B).and(C).layersProtect;

app.get('/custom_protection', customLayer, (req, res) => {
  res.send('custom_protection is OK!');
});

soas2.defend();
app.all('*', (req, res) => {
  res.send('Access is allow!');
});

app.listen(3000, () => {
  console.log('Server start');
});

function A(req, next, cancel) {
  if(true) {
    console.log('A is success!');
    next();
  }
  cancel('A is fail!');
}

function B(req, next, cancel) {
  if(true) {
    console.log('B is success!');
    next();
  }
  cancel('B is fail!');
}

function C(req, next, cancel) {
  if(true) {
    console.log('C is success!');
    next();
  }
  cancel('C is fail!');
}

function D(req, next, cancel) {
  if(true) {
    console.log('D is success!');
    next();
  }
  cancel('D is fail!');
}

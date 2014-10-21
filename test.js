var Q = require('./index');

global.XMLHttpRequest = require('xhr2');

global.btoa = function (b) { return new Buffer(b).toString('base64'); };
Q.Promise = require('es6-promise').Promise;

var q = new Q('http://yuno:6544/', [
  Q.service('global', 'v1', [
    Q.type('project', [
      Q.type('member')
    ]),
    Q.type('account')
  ])
]);

q.setBasicAuth('cc714abb-e1e2-471b-9e55-97840d20527a', 'inNIfwXBWNRS9gKRnyTEIPMQreku2EZRkQY5dgrV8gE0f6DYEjnqheiPJ2ur462QBltoNKJgkQGYYVy5bXFY04b05qi6AorkscHPJrS88vXahvDN5PmBX79FXDrV3sEk');

var p = q.services.global.Project.byId('892047f7-a00a-434f-a589-9910e109db12');
p.Member.byId('4a1b4aa8-6b52-4e9a-913e-616b59ceae8b').toObject(['']).then(function (o) {
  console.log(o);
});

p.Member.all().toArray(['', '/account']).then(function (a) {
  console.log(a);
});


var url = require('url'),
    pointer = require('./pointer');

var reference = module.exports = new ReferenceScope();
reference.ReferenceScope = ReferenceScope;

function ReferenceScope () {
  this.jsons = {};
}

ReferenceScope.prototype._absolutize = function (baseUrl, obj) {
  if (Array.isArray(obj)) {
    return obj.map(this._absolutize.bind(this, baseUrl));
  } else if (typeof obj === 'object') {
    if (obj.hasOwnProperty('$ref')) {
      // reference
      return { $ref: url.resolve(baseUrl, obj.$ref) };
    } else {
      // normal
      return Object.keys(obj).reduce(function (newObj, key) {
        newObj[key] = this._absolutize(baseUrl, obj[key]);
        return newObj;
      }.bind(this), {});
    }
  } else {
    return obj;
  }  
};

ReferenceScope.prototype.addJSON = function (baseUrl, json) {
  var urlObj = url.parse(baseUrl);
  if (urlObj.host === null) {
    throw new Error('baseUrl must be an absolute URL');
  }
  if (urlObj.hash === '#') {
    urlObj.hash = null;
  }
  if (urlObj.hash !== null) {
    throw new Error('baseUrl must not contain fragments');
  }
  baseUrl = url.format(urlObj);
  this.jsons[baseUrl] = this._absolutize(baseUrl, json);
};

ReferenceScope.prototype.getJSON = function (targetUrl) {
  var urlObj = url.parse(targetUrl),
      fragment = (urlObj.hash || '#').substring(1);
  urlObj.hash = null;
  targetUrl = url.format(urlObj);
  if (this.jsons.hasOwnProperty(targetUrl)) {
    return pointer(this.jsons[targetUrl], fragment).get();
  } else {
    throw new Error('the url is not registered');
  }
};

ReferenceScope.prototype.resolve = function (baseUrl, obj) {
  if (arguments.length < 2) {
    obj = baseUrl;
    baseUrl = '';
  }

  if (Array.isArray(obj)) {
    return obj.map(this.resolve.bind(this, baseUrl));
  } else if (typeof obj === 'object') {
    if (obj.hasOwnProperty('$ref')) {
      // reference
      var $ref = url.resolve(baseUrl, obj.$ref);
      return this.resolve(this.getJSON($ref));
    } else {
      // normal
      return Object.keys(obj).reduce(function (newObj, key) {
        newObj[key] = this.resolve(baseUrl, obj[key]);
        return newObj;
      }.bind(this), {});
    }
  } else {
    return obj;
  }
};

if (!module.parent) {
  var assert = require('assert');

  function check(baseUrl, relative, absolute) {
    assert.deepEqual(reference._absolutize(baseUrl, relative), absolute);
  }

  check('http://example.com/',
        { $ref: '/foo#bar' },
        { $ref: 'http://example.com/foo#bar' });

  check('http://example.com/',
        { foo: { $ref: '/foo#bar' } },
        { foo: { $ref: 'http://example.com/foo#bar' } });

  check('http://example.com/',
        [ { $ref: '/foo#bar' } ],
        [ { $ref: 'http://example.com/foo#bar' } ]);

  !function normal () {
    var reference = new ReferenceScope();
    var baseUrl = 'http://example.com/foo.json';
    var json = {
      bar: {
        baz: [0, 1, 2, 3],
        self: { $ref: 'foo.json' }
      }
    };

    reference.addJSON(baseUrl, json);
    assert.deepEqual(reference.getJSON('http://example.com/foo.json#/bar'),
                     reference._absolutize(baseUrl, json).bar);
    assert.deepEqual(reference.getJSON('http://example.com/foo.json#/bar/baz/0'),
                     0);
    assert.deepEqual(reference.getJSON('http://example.com/foo.json#/bar/self'),
                     reference._absolutize(baseUrl, json).bar.self);
  }();

  !function circular () {
    var reference = new ReferenceScope();
    var baseUrl = 'http://example.com/foo.json';
    var json = { foo: { $ref: 'foo.json' } };
    reference.addJSON(baseUrl, json);
    console.log(reference.resolve(reference.getJSON(baseUrl)));
  }();
}

var URI = require('uri-js'),
    pointer = require('./pointer');

function normalizeRef (uri) {
  var uriObj = URI.parse(uri);
  uriObj.fragment = uriObj.fragment || undefined;
  return URI.serialize(uriObj);
}

function normalizeKeys (scope) {
  return Object.keys(scope).reduce(function (obj, key) {
    obj[normalizeRef(key)] = scope[key];
    return obj;
  }, {});
}

function initInvIndex (scope) {
  return Object.keys(scope).reduce(function (obj, key) {
    obj[key] = [];
    return obj;
  }, {});  
}

function makeInvIndex (scope) {
  var refTable = initInvIndex(scope);
  return Object.keys(scope).map(function (key) {
    return listPointers(key, [], scope[key]);
  }).reduce(concat).reduce(function (idx, ref) {
    if (!(idx.hasOwnProperty(ref.dst))) {
      idx[ref.dst] = [];
    }
    idx[ref.dst].push(ref.src);
    return idx;
  }, {});
}

function concat (a, b) { return a.concat(b); }

function listPointers (baseUri, pTokens, obj) {
  if (Array.isArray(obj)) {
    // array
    return obj.map(function (v, i) {
      return listPointers(baseUri, pTokens.concat([i]), v);
    }).reduce(concat, []);
  } else if (typeof obj === 'object' && obj !== null) {
    // object
    if (obj.hasOwnProperty('$ref')) {
      // reference
      var srcObj = URI.parse(baseUri);
      srcObj.fragment = pointer.encode(pTokens);
      return [{
        src: normalizeRef(URI.serialize(srcObj)),
        dst: normalizeRef(URI.resolve(baseUri, obj.$ref))
      }];
    } else {
      // normal
      return Object.keys(obj).map(function (key) {
        return listPointers(baseUri, pTokens.concat([key]), obj[key]);
      }).reduce(concat, []);
    }
  } else {
    // premitive
    return [];
  }
}

function path (scope, uri) {
  var uriObj = URI.parse(uri),
      pointerPath = uriObj.fragment || '',
      baseUri;

  uriObj.fragment = undefined;
  baseUri = URI.serialize(uriObj);

  if (!scope.hasOwnProperty(baseUri)) {
    throw new Error('no such object in scope: ' + baseUri);
  }

  var p = pointer.path(scope[baseUri], pointerPath);
  
  return {
    get: function () {
      return p.get();
    },
    set: function (value) {
      return scope[baseUri] = p.set(value);
    }
  };
}

function resolve (scope) {
  scope = normalizeKeys(scope);
  
  // make ref table
  var invIndex = makeInvIndex(scope),
      _path = path.bind(null, scope);

  var tracks = {};

  function resolve (dst) {
    if (!invIndex.hasOwnProperty(dst)) { return; }
    if (tracks.hasOwnProperty(dst)) {
      throw new Error('bad reference: no entity');
    }
    tracks[dst] = true;
    var srcList = invIndex[dst];
    srcList.forEach(function (src) {
      _path(src).set(_path(dst).get());
      resolve(src);
    });
    delete tracks[dst];
  }

  Object.keys(invIndex).forEach(function (key) {
    resolve(key);
  });

  return scope;
}

var reference = module.exports = {
  path: path,
  resolve: resolve
};

if (!module.parent) {
  var assert = require('assert');

  function check (obj, cb) {
    cb(obj);
  }

  check(reference.resolve({
    '/': { self: { $ref: '#' } }
  }), function (v) {
    assert.ok(v['/'] === v['/'].self);
  });

  check(reference.resolve({
    '/foo': { bar: { $ref: '/bar' } },
    '/bar': { foo: { $ref: '/foo' } }
  }), function (v) {
    assert.ok(v['/foo'] === v['/bar'].foo);
    assert.ok(v['/bar'] === v['/foo'].bar);
  });

  check(reference.resolve({
    '/foo': { $ref: '/bar' },
    '/bar': { foo: { $ref: '/foo' } },
    '/baz': { $ref: '/bar#/foo' }
  }), function (v) {

  });
  
  assert.throws(function () {
    reference.resolve({
      '/a': { $ref: '/b' },
      '/b': { $ref: '/a' }
    });
  }, Error);
  
  assert.throws(function () {
    reference.resolve({
      '/': { $ref: '#' }
    });
  }, Error);
}

var util = require('util'),
    assert = require('assert');

function InvalidSyntaxError (message) {
  Error.call(this);
  this.message = 'Invalid Syntax: ' + message;
}
util.inherits(InvalidSyntaxError, Error);

function BadReferenceError (message) {
  Error.call(this);
  this.message = 'Bad Reference: ' + message;
}
util.inherits(BadReferenceError, Error);

function unescapeToken (token) {
  return token.split('~1').join('/').split('~0').join('~');
}

function escapeToken (token) {
  return token.split('~').join('~0').split('/').join('~1');
}

function encodeTokens (tokens) {
  return tokens.map(escapeToken).map(function (token) {
    return '/' + token;
  }).join('');
}

function decodePath (path) {
  var tokens = path.split('/').map(unescapeToken);
  if (tokens[0].length !== 0) {
    throw new InvalidSyntaxError('path must start with "/" or be empty');
  }
  return tokens;
}

function toIndex (array, token) {
  if (token === '-') {
    return array.length;
  }

  if (!(/^(0|[1-9][0-9]*)$/.test(token))) {
    throw new InvalidSyntaxError('only digits or "-" are allowed for an array as a key');
  }

  var index = ~~token;
  if (!(0 <= index && index < array.length)) {
    throw new BadReferenceError('index is out of range');
  }

  return index;
}

function travasal (obj, tokens, isGet, value) {
  assert(tokens.length >= 1);

  var isLast = (tokens.length === 1);
  
  var token = tokens.shift();
  if (Array.isArray(obj)) {
    var index = toIndex(obj, token);
    if (index === obj.length) {
      if (isGet) {
        throw new InvalidSyntaxError('key "-" is invalid for gettter of array');
      } else if (isLast) {
        return obj.push(value);
      }
    }
    if (isLast) {
      if (isGet) {
        return obj[index];
      } else {
        return obj[index] = value;
      }
    } else {
      return travasal(obj[index], tokens.slice(1), isGet, value);
    }
  } else if (typeof obj === 'object') {
    if (isGet && !(obj.hasOwnProperty(token))) {
      throw new BadReferenceError('the pointer references a nonexistent value');
    }
    if (isLast) {
      if (isGet) {
        return obj[token];
      } else {
        return obj[token] = value;
      }
    } else {
      return travasal(obj[token], tokens, isGet, value);
    }
  } else {
    throw new BadReferenceError('the pointer references a nonexistent value');
  }
}

function path (obj, path) {
  var wrapper, f, tokens;

  if (Array.isArray(path)) {
    tokens = path;
  } else {
    tokens = decodePath(path);
  }

  wrapper = { '': obj };
  f = travasal.bind(this, wrapper, tokens);

  return {
    get: function () {
      return f(true);
    },
    set: function (value) {
      f(false, value);
      return wrapper[''];
    }
  };
}

var pointer = module.exports = {
  path: path,
  encode: encodeTokens,
  decode: decodePath
};

if (!module.parent) {
  !function getter () {
    var obj = { a: 1, b: { c: 2 }, l: [0, 1, 2] };
    
    assert.deepEqual(pointer.path(obj, '').get(), obj);

    assert.deepEqual(pointer.path(obj, '/a').get(), 1);

    assert.deepEqual(pointer.path(obj, '/b').get(), { c: 2 });

    assert.deepEqual(pointer.path(obj, '/b/c').get(), 2);

    assert.deepEqual(pointer.path(obj, '/l').get(), [0, 1, 2]);

    assert.deepEqual(pointer.path(obj, '/l/0').get(), 0);

    assert.deepEqual(pointer.path(obj, '/l/2').get(), 2);

    assert.throws(function () {
      pointer.path(obj, '/l/a').get();
    }, InvalidSyntaxError);

    assert.throws(function () {
      pointer.path(obj, '/l/-').get();
    }, InvalidSyntaxError);

    assert.throws(function () {
      pointer.path(obj, '/c').get();
    }, BadReferenceError);
  }();

  !function setter () {
    var obj;

    obj = { a: 1, b: { c: 2 } };
    assert.deepEqual(pointer.path(obj, '').set(1), 1);

    obj = { a: 1, b: { c: 2 } };  
    assert.deepEqual(pointer.path(obj, '/a').set(3), { a: 3, b: { c: 2 } });

    obj = { a: 1, b: { c: 2 } };
    assert.deepEqual(pointer.path(obj, '/b').set(3), { a: 1, b: 3 });

    obj = { a: 1, b: { c: 2 } };
    assert.deepEqual(pointer.path(obj, '/b/c').set(3), { a: 1, b: { c: 3 } });

    obj = { a: 1, b: { c: 2 } };
    assert.deepEqual(pointer.path(obj, '/b/d').set(3), { a: 1, b: { c: 2, d: 3 } });

    obj = { a: 1, b: { c: 2 }, l: [0, 1, 2] };
    assert.deepEqual(pointer.path(obj, '/l/0').set(3), { a: 1, b: { c: 2 }, l: [3, 1, 2] });

    obj = { a: 1, b: { c: 2 }, l: [0, 1, 2] };
    assert.deepEqual(pointer.path(obj, '/l/-').set(3), { a: 1, b: { c: 2 }, l: [0, 1, 2, 3] });

    obj = { a: 1, b: { c: 2 } };
    assert.doesNotThrow(function () {
      assert.deepEqual(pointer.path(obj, '/d').set(1), { a: 1, b: { c: 2 }, d: 1 });
    });

    obj = { a: 1, b: { c: 2 } };
    assert.throws(function () {
      pointer.path(obj, '/d/e').set(1);
    }, BadReferenceError);
  }();

  !function syntax () {
    var obj = { a: 1, b: { c: 2 } };
    assert.throws(function () {
      pointer.path(obj, 'a');
    }, InvalidSyntaxError);
  }();
}

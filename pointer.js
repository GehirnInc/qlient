var util = require('util'),
    assert = require('assert');

function unescapeToken (token) {
  return token.split('~1').join('/').split('~0').join('~');
}

function escapeToken (token) {
  return token.split('~').join('~0').split('/').join('~1');
}

function encodeTokens (tokens) {
  return tokens.map(String).map(escapeToken).map(function (token) {
    return '/' + token;
  }).join('');
}

function decodePath (path) {
  var tokens = path.split('/').map(unescapeToken);
  if (tokens[0].length !== 0) {
    throw new SyntaxError('path must start with "/" or be empty');
  }
  return tokens;
}

function toIndex (array, token) {
  if (token === '-') {
    return array.length;
  }

  if (!(/^(0|[1-9][0-9]*)$/.test(token))) {
    throw new SyntaxError('only digits or "-" are allowed for an array as a key');
  }

  var index = ~~token;
  if (!(0 <= index && index < array.length)) {
    throw new ReferenceError('index is out of range');
  }

  return index;
}

var ops = {
  array: {
    set: function (arr, idx, value) {
      if (idx === arr.length) {
        return arr.push(value);
      } else {
        return arr[idx] = value;
      }
    },
    get: function (arr, idx, value) {
      if (this.chk.apply(this, arguments)) {
        return arr[idx];
      } else {
        throw new ReferenceError('the pointer references a nonexistent value');
      }
    },
    add: function (arr, idx, value) {
      if (idx < 0 || arr.length < idx) {
        throw new RangeError('index `' + idx + '` is out of range');
      }
      arr.splice(idx, 0, value);
      return value;
    },
    chk: function (arr, idx, value) {
      return (0 <= idx && idx < arr.length);
    },
    rmv: function (arr, idx, value) {
      arr.splice(idx, 1);
      return value;
    }
  },
  object: {
    set: function (obj, key, value) {
      return obj[key] = value;
    },
    get: function (obj, key, value) {
      return ops.array.get.apply(this, arguments);
    },
    add: function (obj, key, value) {
      return ops.object.set.apply(this, arguments);
    },
    chk: function (obj, key, value) {
      return obj.hasOwnProperty(key);
    },
    rmv: function (obj, key, value) {
      return delete obj[key];
    }
  }
};

function travasal (obj, tokens, op, value) {
  assert(tokens.length >= 1);

  var isLast = (tokens.length === 1);
  
  var token = tokens[0],
      opset, key;
  if (Array.isArray(obj)) {
    key = toIndex(obj, token);
    opset = ops.array;
  } else if (obj instanceof Object) {
    key = token;
    opset = ops.object;
  } else {
    throw new ReferenceError('the pointer references a nonexistent value');
  }

  if (isLast) {
    if (opset.hasOwnProperty(op)) {
      return opset[op](obj, key, value);
    } else {
      throw new TypeError('invalid operation `' + op + '`');
    }
  } else {
    if (obj.hasOwnProperty(token)) {
      return travasal(obj[token], tokens.slice(1), op, value);      
    } else {
      throw new ReferenceError('the pointer references a nonexistent value');
    }
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
      return f('get');
    },
    set: function (value) {
      f('set', value);
      return wrapper[''];
    },
    add: function (value) {
      f('add', value);
      return wrapper[''];
    },
    chk: function () {
      return f('chk');
    },
    rmv: function () {
      f('rmv');
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
    }, SyntaxError);
    
    assert.throws(function () {
      pointer.path(obj, '/l/-').get();
    }, ReferenceError);

    assert.throws(function () {
      pointer.path(obj, '/c').get();
    }, ReferenceError);
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
    }, ReferenceError);
  }();

  !function syntax () {
    var obj = { a: 1, b: { c: 2 } };
    assert.throws(function () {
      pointer.path(obj, 'a');
    }, SyntaxError);
  }();
}

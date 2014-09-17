var pointer = require('./pointer');

var patch = module.exports;

var ops = {
  add: function (obj, path, patch) {
    return path.add(patch.value);
  },
  remove: function (obj, path, patch) {
    if (path.chk()) {
      return path.rmv();
    } else {
      throw new ReferenceError('removing a nonexistent value');
    }
  },
  replace: function (obj, path, patch) {
    if (path.chk()) {
      return path.set(patch.value);
    } else {
      throw new ReferenceError('replacing a nonexistent value');
    }
  },
  move: function (obj, path, patch) {
    if (!patch.hasOwnProperty('from')) {
      throw new TypeError('operation `move` requires a property `from`');
    }
    
    // TODO: check circular movement

    var from = pointer.path(patch.from),
        tmp = from.get();
    ops.remove(obj, from, {});
    return ops.add(obj, from, { value: tmp });
  },
  copy: function (obj, path, patch) {
    if (!patch.hasOwnProperty('from')) {
      throw new TypeError('operation `move` requires a property `from`');
    }
    var from = pointer.path(patch.from),
        tmp = from.get();
    return ops.add(obj, from, { value: tmp });
  },
  test: function (obj, path, patch) {
    // TODO: impl
    throw new Error('not implemented');
  }
};

patch.patch = function (obj, patches) {
  patches.forEach(function (patch) {
    if (!ops.hasOwnProperty(patch.op)) {
      throw new TypeError('invalid operation name');
    }
    obj = ops[patch.op](obj, pointer.path(obj, patch.path), patch);
  });
  return obj;
};

function getType (val) {
  if (val instanceof Object) {
    if (Array.isArray(val)) {
      return 'array';
    } else {
      return 'object';
    }
  } else {
    return typeof val;
  }
}

function _diff (orig, curr, pTokens) {
  var origType, currType;

  origType = getType(orig);
  currType = getType(curr);

  if (origType !== currType) {
    return [{
      op   : 'replace',
      path : pointer.encode(pTokens),
      value: curr
    }];
  }

  if (!(orig instanceof Object)) {
    if (orig !== curr) {
      return [{
        op   : 'replace',
        path : pointer.encode(pTokens),
        value: curr
      }];      
    } else {
      return [];
    }
  }

  // same type && object or array here

  var origKeys, currKeys, i, patches;
  origKeys = Object.keys(orig).reverse();
  currKeys = Object.keys(curr);
  patches = [];

  origKeys.forEach(function (key) {
    var origVal = orig[key];
    if (curr.hasOwnProperty(key)) {
      patches = patches.concat(_diff(origVal, curr[key], pTokens.concat([key])));
    } else {
      patches.push({
        op: 'remove',
        path: pointer.encode(pTokens.concat([key]))
      });
    }
  });
  
  currKeys.forEach(function (key) {
    if (!orig.hasOwnProperty(key)) {
      patches.push({
        op: 'add',
        path: pointer.encode(pTokens.concat([key])),
        value: curr[key]
      });      
    }
  });

  return patches;
}

patch.diff = function (orig, curr) {
  return _diff(orig, curr, []);
};

if (!module.parent) {
  var assert = require('assert');

  assert.deepEqual(patch.diff({a: 1}, {a: 2, b: 1}), [
    { op: 'replace', path: '/a', value: 2 },
    { op: 'add',     path: '/b', value: 1 }
  ]);

  assert.deepEqual(patch.diff([1,2,3], []), [
    { op: 'remove', path: '/2' },
    { op: 'remove', path: '/1' },
    { op: 'remove', path: '/0' } 
  ]);

  assert.deepEqual(patch.patch([1, 2, 3], [
    { op: 'remove', path: '/2' }
  ]), [1, 2]);

  assert.deepEqual(patch.patch([1, 2, 3], [
    { op: 'add', path: '/-', value: 4 }
  ]), [1, 2, 3, 4]);

  assert.deepEqual(patch.patch([1, 2, 3], [
    { op: 'replace', path: '', value: 'foobar' }
  ]), 'foobar');
}

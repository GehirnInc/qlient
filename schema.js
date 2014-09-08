var url = require('url');

function _isCircular (stack, obj) {
  if (stack.indexOf(obj) !== -1) {
    return true;
  }
  stack.push(obj);
  var flg = false;
  if (Array.isArray(obj)) {
    // array
    flg = obj.some(_isCircular.bind(null, stack));
  } else if (typeof obj === 'object' && obj !== null) {
    // object
    flg = Object.keys(obj).map(function (key) {
      return obj[key];
    }).some(_isCircular.bind(null, stack));
  } else {
    // premitive
    flg = false;
  }
  stack.pop();
  return flg;
}

function isCircular (obj) {
  return _isCircular([], obj);
}

function Schema () {
  this.type = '';
}

Schema.fromJSONSchema = function fromJSONSchema (jsonSchema) {
  
};

Schema.prototype.validate = function validate (obj) {
  
};

if (!module.parent) {
  var assert = require('assert');
  
  var circularObj = {};
  circularObj.prop = circularObj;
  
  assert.equal(isCircular(circularObj), true);
  assert.equal(isCircular({}), false);
}

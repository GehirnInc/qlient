var util = require('util'),
    URI = require('URI-js'),
    reference = require('./reference'),
    metaschemaJSON = require('./metaschema');

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

/*
 * Ref:
 * JSON Schema: core definitions and terminology
 *   7.2.  URI resolution scope alteration with the "id" keyword
 * 
 * http://json-schema.org/latest/json-schema-core.html#anchor27
 */
function expandScope (scope) {
  scope = reference.normalizeScopeKeys(scope);
  
  function traverse (baseUri, obj) {
    if (Array.isArray(obj)) {
      // array
      return obj.map(traverse.bind(null, baseUri));
    } else if (typeof obj === 'object' && obj !== null) {
      // object
      if (obj.hasOwnProperty('id')) {
        var key = reference.normalizeRefUri(URI.resolve(baseUri, obj.id));
        scope[key] = obj;
        return { '$ref': key };
      } else {
        // normal
        return Object.keys(obj).reduce(function (newObj, key) {
          newObj[key] = traverse(baseUri, obj[key]);
          return newObj;
        }, {});
      }
    } else {
      // primitive
      return obj;
    }
  }

  Object.keys(scope).forEach(function (baseUri) {
    scope[baseUri] = traverse(baseUri, scope[baseUri]);
  });

  return scope;
}

var metaschemaInverseIndex = reference.makeInverseIndex(
  reference.normalizeScopeKeys(metaschemaJSON));

function Schema (scope, entryPoint) {
  this.$scope = reference.resolve(expandScope(scope));
  this.$entryPoint = reference.normalizeRefUri(entryPoint);
  var schemaObject = this.$scope[this.$entryPoint];
  /* 
   * TODO: validate schema object here
   */
  function replace (stack, obj, a, b) {
    if (stack.indexOf(obj) !== -1) { return obj; }
    if (obj === a) { return b; }

    stack.push(obj);
    if (Array.isArray(obj)) {
      // array
      obj.forEach(function (v, i) {
        obj[i] = replace(stack, v, a, b);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      // object
      Object.keys(obj).forEach(function (key) {
        obj[key] = replace(stack, obj[key], a, b);
      });
    }
    stack.pop(obj);
    return obj;
  }
  Schema.keywords.forEach(function (keyword) {
    if (schemaObject.hasOwnProperty(keyword)) {
      this[keyword] = schemaObject[keyword];
      //replace([], schemaObject[keyword], schemaObject, this);
    } else if (metaschemaJSON.properties[keyword].hasOwnProperty('default')) {
      this[keyword] = metaschemaJSON.properties[keyword]['default'];
    } else {
      this[keyword] = undefined;
    }
  }.bind(this));
}

Schema.keywords = [
  'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',

  'maxLength', 'minLength', 'pattern',

  'additionalItems', 'items', 'maxItems', 'minItems', 'uniqueItems',

  'maxProperties', 'minProperties', 'required',
  'additionalProperties', 'properties', 'patternProperties', 'dependencies',

  'enum', 'type', 'allOf', 'anyOf', 'oneOf', 'not', 'definitions'
];

Schema.fromJSON = function (jsonSchema) {
  if (isCircular(jsonSchema)) {
    throw new TypeError('schema object is circular');
  }

  return new Schema({ '': jsonSchema }, '');
};

// -------------------- numeric --------------------
Schema.prototype['$multipleOf'] = function $multipleOf () {
  /* TODO: impl */
};
Schema.prototype['$maximum'] = function $maximum () {
  /* TODO: impl */
};
Schema.prototype['$exclusiveMaximum'] = function $exclusiveMaximum () {
  /* TODO: impl */
};
Schema.prototype['$minimum'] = function $minimum () {
  /* TODO: impl */
};
Schema.prototype['$exclusiveMinimum'] = function $exclusiveMinimum () {
  /* TODO: impl */
};

// -------------------- string ---------------------
Schema.prototype['$maxLength'] = function $maxLength () {
  /* TODO: impl */
};
Schema.prototype['$minLength'] = function $minLength () {
  /* TODO: impl */
};
Schema.prototype['$pattern'] = function $pattern () {
  /* TODO: impl */
};

// --------------------- array ---------------------
Schema.prototype['$additionalItems'] = function $additionalItems () {
  /* TODO: impl */
};
Schema.prototype['$items'] = function $items () {
  /* TODO: impl */
};
Schema.prototype['$maxItems'] = function $maxItems () {
  /* TODO: impl */
};
Schema.prototype['$minItems'] = function $minItems () {
  /* TODO: impl */
};
Schema.prototype['$uniqueItems'] = function $uniqueItems () {
  /* TODO: impl */
};

// -------------------- object ---------------------
Schema.prototype['$maxProperties'] = function $maxProperties () {
  /* TODO: impl */
};
Schema.prototype['$minProperties'] = function $minProperties () {
  /* TODO: impl */
};
Schema.prototype['$required'] = function $required () {
  /* TODO: impl */
};
Schema.prototype['$additionalProperties'] = function $additionalProperties () {
  /* TODO: impl */
};
Schema.prototype['$properties'] = function $properties () {
  /* TODO: impl */
};
Schema.prototype['$patternProperties'] = function $patternProperties () {
  /* TODO: impl */
};
Schema.prototype['$dependencies'] = function $dependencies () {
  /* TODO: impl */
};

// ---------------------- any ----------------------
Schema.prototype['$enum'] = function $enum () {
  /* TODO: impl */
};
Schema.prototype['$type'] = function $type () {
  /* TODO: impl */
};
Schema.prototype['$allOf'] = function $allOf () {
  /* TODO: impl */
};
Schema.prototype['$anyOf'] = function $anyOf () {
  /* TODO: impl */
};
Schema.prototype['$oneOf'] = function $oneOf () {
  /* TODO: impl */
};
Schema.prototype['$not'] = function $not () {
  /* TODO: impl */
};
Schema.prototype['$definitions'] = function $definitions () {
  /* TODO: impl */
};

/*
Schema.premitiveTypes = (function () {
  var numeric, string, array, object, any;

  numeric = [
    'multipleOf',
    'maximum', 'exclusiveMaximum',
    'minimum', 'exclusiveMinimum'
  ];
  string = [
    'maxLength', 'minLength', 'pattern'
  ];
  array = [
    'additionalItems', 'items', 'maxItems', 'minItems', 'uniqueItems'
  ];
  object = [
    'maxProperties', 'minProperties',
    'required', 'additionalProperties', 'properties', 'patternProperties',
    'dependencies'
  ];
  any = [
    'enum', 'type', 'allOf', 'anyOf', 'oneOf', 'not', 'definitions'
  ];

  return {
    'object' :  object.concat(any),
    'array'  :   array.concat(any),
    'string' :  string.concat(any),
    'number' : numeric.concat(any),
    'integer': numeric.concat(any),
    'boolean':                any ,
    'null'   :                any
  };
})();
*/

Schema.prototype.validate = function validate (obj) {
  
};

if (!module.parent) {
  var assert = require('assert');
  
  var circularObj = {};
  circularObj.prop = circularObj;
  
  assert.equal(isCircular(circularObj), true);
  assert.equal(isCircular({}), false);

  console.log(util.inspect(Schema.fromJSON(metaschemaJSON), {depth: null, colors:true}));
}

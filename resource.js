module.exports = Resource;

var util = require('util'),
    pointer = require('./pointer');

var Flow = require('./flow'),
    Q = require('./qlient');

function NOOP () {}

function isObject (obj) {
  return (typeof obj === 'object' && obj !== null);
}

function travasal (obj, tokens) {
  if (tokens.length === 0) {
    return obj;
  }

  var token = tokens[0];
  if (obj instanceof Resource) {
    return travasal(obj.value[token], tokens.slice(1));      
  } else if (isObject(obj)) {
    return travasal(obj[token], tokens.slice(1));  
  } else {
    throw new TypeError('premitive value `' + obj + '`(' + typeof obj + ') has no property: ' + tokens.toString());
  }    
}

function Resource (type, obj, children) {
  Flow.call(this);
  
  this.type = type;

  this.types = children.map(function (typeDefinition) {
    var Type = typeDefinition.new(this);
    this[typeDefinition.name.toUpperCamelCase()] = Type;

    return { key: typeDefinition.name, value: Type };
  }.bind(this)).toObject();

  this.set(obj);
}
util.inherits(Resource, Flow);

Object.defineProperties(Resource.prototype, {
  path: { get: function () {
    if (this.id.length === 0) {
      throw new Error('id is not set');
    }
    return this.id + '/';
  } },
  id: { get: function () {
    return (isObject(this.value) && this.value.hasOwnProperty(this.type.idField)) ?
      this.value[this.type.idField] : '';
  } }
});

Resource.prototype.create = function (query) {
  return this.type.request('POST', '', query, {}, this.value).then(this.set.bind(this));
};

Resource.prototype.$create = function (query, cb) {
  this.$create(query).then(cb || NOOP);
  return this;
};

Resource.prototype.resolve = function (resolutions) {
  function resolve (res) {
    if (res instanceof Resource) {
      return res.fetch();
    } else if (Array.isArray(res)) {
      return Q.Promise.all(res.map(function (res) { return resolve(res, []); }));
    }
    return res;
  }

  return resolutions.map(pointer.decode).map(function (tokens) {
    return function () {
      return resolve(travasal({'': this}, tokens));
    }.bind(this);
  }.bind(this)).reduce(function (p, n) {
    return p.then(n);
  }, Q.Promise.resolve()).then(function () {
    return this;
  }.bind(this));
};

Resource.prototype.$resolve = function (resolutions, cb) {
  this.resolve(resolutions).then(cb || NOOP);
  return this;  
};

Resource.prototype.fetch = function (query) {
  return this.request('GET', null, query).then(this.set.bind(this));
};

Resource.prototype.$fetch = function (query, cb) {
  this.fetch(query).then(cb || NOOP);
  return this;
};

Resource.prototype.update = function (query) {
  return this.request('PUT', null, query, null, this.value).then(this.set.bind(this));
};

Resource.prototype.$update = function (query, cb) {
  this.update(query).then(cb || NOOP);
  return this;  
};

Resource.prototype.remove = function (query) {
  return this.request('DELETE', null, query).then(this.set.bind(this));
};

Resource.prototype.$remove = function (query, cb) {
  this.remove(query).then(cb || NOOP);
  return this;  
};

Resource.prototype.request = function (method, pathname, query, headers, body) {
  pathname = pathname || '';
  return this.type.request(method, this.path + pathname, query, headers, body);
};

Resource.prototype.set = function (jsonObj) {
  var that = this;

  this.value = (function resolve (jsonObj) {
    if (Array.isArray(jsonObj)) {
      return jsonObj.map(resolve);
    } else if (isObject(jsonObj)) {
      if (jsonObj.hasOwnProperty('$ref')) {
        return that.q.resolveReference(jsonObj.$ref);
      } else {
        return Object.keys(jsonObj).map(function (key) {
          return { key: key, value: resolve(jsonObj[key]) };
        }).toObject();
      }
    } else {
      return jsonObj;
    }
  })(jsonObj);

  return this;
};

Resource.prototype.toObject = function (resolutions) {
  resolutions = resolutions || [''];

  function copy (res) {
    if (res instanceof Resource) {
      return Object.keys(res.value).map(function (key) {
        return { key: key, value: res.value[key] };
      }).filter(function (kv) {
        return !(kv.value instanceof Resource);
      }).map(function (kv) {
        return { key: kv.key, value: copy(kv.value) };
      }).toObject();
    } else if (Array.isArray(res)) {
      return res.map(copy);
    } else {
      return res;
    }
  }

  return this.resolve(resolutions).then(function () {
    return resolutions.map(pointer.decode).reduce(function (o, tokens) {
      return pointer.path(o, tokens).set(copy(travasal({'': this}, tokens)));
    }.bind(this), {});
  }.bind(this)).catch(function (err) {
    console.warn(err.stack);
  });
};

Resource.prototype.$toObject = function (resolutions, cb) {
  this.toObject(resolutions).then(cb || NOOP);
  return this;
};

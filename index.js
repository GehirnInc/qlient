var http = require('http'),
    url = require('url'),
    util = require('util'),
    path = require('path'),
    pointer = require('./pointer'),
    patch = require('./patch'),
    inflect = require('i')();

var Qlass = require('./qlass');

function NOOP () { /* NOOP */ }

function isObject (obj) {
  return (typeof obj === 'object' && obj !== null);
}

function parseRef (ref) {
  var re, matches = null, model = null, id = null, rest = null;

  re = new RegExp('^(/([^/]+))(.*)$');

  matches = ref.match(re);
  if (matches === null) {
    throw new SyntaxError('invalid reference');
  }

  model = inflect.singularize(matches[2]);
  matches = matches[3].match(re);
  if (matches !== null) {
    id = matches[2];
    rest = matches[3].match(re) && matches[3];
  }

  return {
    model: model,
    id: id,
    rest: rest
  };
}

// TODO: write tests
// TODO: impl. the mode when srcMustIncludeDst is false
function makeRelativePath (srcPath, dstPath, srcMustIncludeDst) {
  if (!srcMustIncludeDst) { throw new Error('TODO: not implemented'); }

  var src = path.normalize(srcPath).split(/(\/)/),
      dst = path.normalize(dstPath).split(/(\/)/);

  var l = Math.min(src.length, dst.length),
      i = 0;

  if (srcMustIncludeDst && l !== src.length) {
    throw new Error('src must include dst');
  }
  
  for (i = 0; i < l; ++i) {
    if (src[i] !== dst[i] && src[i].length > 0) {
      return srcPath;
    }
  }

  return dst.slice(l).join('');
}

// TODO: write tests
function makeRelativeUrl (src, dst) {
  // TODO: consider query

  var srcObj = url.parse(src, true),
      dstObj = url.parse(dst, true);

  delete srcObj.host;
  delete dstObj.host;
  
  if (srcObj.protocol === dstObj.protocol) {
    srcObj.protocol = null;
    srcObj.slashes = false;
  }

  if (srcObj.auth !== dstObj.auth) {
    return url.format(srcObj);
  }

  if (srcObj.protocol !== null || srcObj.auth !== null) {
    return url.format(srcObj);
  }

  if (srcObj.hostname === dstObj.hostname && srcObj.port === dstObj.port) {
    srcObj.hostname = null;
    srcObj.port = null;
  } else {
    return url.format(srcObj);
  }

  if (srcObj.pathname === dstObj.pathname) {
    srcObj.pathname = '';
    return url.format(srcObj);
  }

  srcObj.pathname = makeRelativePath(srcObj.pathname, dstObj.pathname, true);

  return url.format(srcObj);
}

function wrapPromise (value, promise) {
  value.$promise = promise;
  return value;
}

function dumpStack () {
  var obj = {};
  Error.captureStackTrace(obj, dumpStack);
  console.log(obj.stack);
}

function hookLog (a) {
  console.log(a);
  return a;
}

var AbstractModel = Qlass.$extend({
  $def: function (statics, dynamics, children) {
    if (!isObject(statics)) {
      statics = {};
    }
    if (!isObject(dynamics)) {
      dynamics = {};
    }

    if (Array.isArray(children)) {
      statics.children = {};
      children.map(function (child) {
        child.type = child.type || 'resource';
        //child.name = inflect.singularize(child.name).toLowerCase();
        child.idField = child.hasOwnProperty('idField') ? child.idField : 'id';
        return child;
      }).forEach(function (child) {
        var T = {
          resource: AbstractResource,
          service: Service
        }[child.type];
        statics.children[child.name] = T.G(child.name, child.idField, child.children);
      }, {});
    }

    return AbstractModel.$super.$def.call(this, statics, dynamics);
  },
  C: function (parent) {
    return this.$extend({
      parent: parent
    }, {});
  },
  get path () {
    throw new TypeError('not implemented');
  },
  get abspath () {
    throw new TypeError('not implemented');
  },
  // class method
  get root () {
    if (this.parent === null) {
      // root is this
      return this;
    } else {
      return this.parent.root;
    }
  },
  get service () {
    if (this.parent === this.root) {
      return this;
    } else {
      return this.parent.service;
    }
  },
  queue: function (procedure, args) {
    var Task = this.service.task;
    if (!isObject(args)) {
      args = {};
    }
    args.self = this.abspath;
    return Task.new({
      procedure: procedure,
      arguments: args
    }).create({ is_sync: true });
  }
}, {
  ctor: function () {
    if (isObject(this.$class.children)) {
      Object.keys(this.$class.children).forEach(function (key) {
        this[key] = this.$class.children[key].C(this);
      }.bind(this));
    }
  },
  request: function (method, pathname, query, headers, body) {
    throw new TypeError('not implemented');
  },
  requestJSON: function (method, pathname, query, headers, bodyObject) {
    if (isObject(bodyObject)) {
      bodyObject = Object.keys(bodyObject).reduce(function (obj, key) {
        if (key.indexOf('$') !== 0) {
          obj[key] = bodyObject[key];
        }
        return obj;
      }, {});
    }

    var body = JSON.stringify(bodyObject);
    return this.request(method, pathname, query, headers, body).then(function (xhr) {
      return JSON.parse(xhr.response);
    }).catch(function () {
      return {};// TODO!!!!!!!!!!!!!!!
    });
  },
  get parent () {
    return this.$class.parent;
  },
  get root () {
    if (this.parent === null) {
      // root is this
      return this;
    } else {
      return this.parent.root;
    }
  },
  get service () {
    if (this.parent === this.root) {
      return this;
    } else {
      return this.parent.service;
    }
  },
  get path () {
    throw new TypeError('not implemented');
  },
  get abspath () {
    throw new TypeError('not implemented');
  },
  resolveRef: function (ref) {
    if (this.root === this) {
      var Q = Object.keys(this.$class.children).map(function (key) {
        return this[key];
      }.bind(this)).filter(function (Q) {
        return ref.indexOf(Q.endpoint) === 0;
      })[0];
      return Q.new().resolveRef(ref);
    }
    var childRef = makeRelativeUrl(this.path, ref),
        refObj = parseRef(childRef);
    if (!this.$class.children.hasOwnProperty(refObj.model)) {
      debugger;
      throw new SyntaxError('invalid reference: no such child model');
    }
    var Model = this[refObj.model];
    if (refObj.id === null) {
      console.warn('really???');
      return Model.all();
    } else {
      var model = Model.byId(refObj.id);
      if (refObj.rest === null) {
        model.resolve();
        return model;
      } else {
        return model.resolveRef(childRef);
      }
    }
  },
  // instance method
  queue: function (procedure, args) {
    var Task = this.root.task;
    if (!isObject(args)) {
      args = {};
    }
    args.self = this.abspath;
    return Task.new({
      procedure: procedure,
      arguments: args
    }).create({ is_sync: true });
  }
});

var ResourceList = Qlass.$extend({
}, {
  ctor: function () {
    this._list = [];
    Object.defineProperties(this.value,  {
      $: { enumerable: false, value: this },
      $promise: { enumerable: false, value: null, writable: true }
    });
  },
  get value() {
    return this._list;
  },
  set: function (newList) {
    // TODO: optimization

    // remove all elements
    var list = this.value;
    while (list.length > 0) {
      list.pop();
    }

    // add new elements
    for (var i = 0; i < newList.length; ++i) {
      list.push(newList[i]);
    }

    return this.value;
  }
});

var AbstractResource = AbstractModel.$extend({
  G: function (name, idField, children) {
    return AbstractResource.$extend({
      name: inflect.singularize(name),
      _idField: idField,
      _instances: {},
      _list: ResourceList.new()
    }, {}, children);      
  },
  byId: function (id) {
    var Resource = this;

    if (Resource._instances.hasOwnProperty(id)) {
      return Resource._instances[id];
    }

    var res = Resource.new();
    res._value[Resource._idField] = id;

    return res;
  },
  get pluralizedName() {
    return inflect.pluralize(this.name);
  },
  all: function (isDeep) {
    var Resource = this;
    
    isDeep = isDeep || false; // TODO

    return wrapPromise(
      Resource._list.value,
      this.parent.requestJSON('GET', '/' + Resource.pluralizedName).then(function (list) {
        return Resource._list.set(list.map(function (jsonObj) {
          return Resource.new(jsonObj).value;
        }));
      }).then(function (list) {
        if (isDeep) {
          return Qlient.Promise.all(list.map(function (value) {
            return value.$.resolve().$promise;
          })).then(function () {
            return Resource._list.value;
          });
        } else {
          return list;
        }
      }));
  },
  get path () {
    return ['/', this.pluralizedName].join('');
  },
  get abspath () {
    return this.parent.path + this.path;
  }
}, {
  ctor: function (jsonObj) {
    AbstractResource.$super.$proto.ctor.call(this);

    if (this.$class === AbstractResource) {
      throw new TypeError('abstract class');
    }

    this._value = Object.create({
      $: this,
      $promise: Qlient.Promise.resolve()
    });

    if (isObject(jsonObj)) {
      return this.set(jsonObj);
    }

    return this;
  },
  get value () {
    return this._value;
  },
  get path () {
    if (!this._isIdSet()) {
      debugger;
      throw new Error('id is not set');
    }
    return [this.$class.path, '/', this.id].join('');
  },
  get abspath () {
    return this.parent.path + this.path;
  },
  get id () {
    return this._value.hasOwnProperty(this.$class._idField) ?
      (this.value[this.$class._idField] || '') : '';
  },
  resolve: function (query) {
    if (!this._isIdSet()) { throw new Error('id is not set'); }
    return wrapPromise(
      this.value,
      this.requestJSON('GET', '', query).then(this.set.bind(this)));
  },
  update: function (query) {
    if (!this._isIdSet()) { throw new Error('id is not set'); }
    return wrapPromise(
      this.value,
      this.requestJSON('PUT', '', query, {}, this.value).then(this.set.bind(this)));
  },
  remove: function (query) {
    if (!this._isIdSet()) { throw new Error('id is not set'); }
    return wrapPromise(
      this.value,
      this.requestJSON('DELETE', '', query).then(this.set.bind(this)));
  },
  create: function (query) {
    if (this._isIdSet()) { throw new Error('id is set'); }
    return wrapPromise(
      this.value,
      this.parent.requestJSON('POST', ['/', this.$class.pluralizedName].join(''), query, {}, this.value)
        .then(this.set.bind(this)));
  },
  assign: function (obj, key, path) {
    var ref = pointer.path(this.value, path);
    if (ref.chk()) {
      obj[key] = ref.get();
    }
    return this.resolve().$promise.then(function (res) {
      obj[key] = ref.get();
      return res;
    });
  },
  _isIdSet: function () {
    return typeof this.id === 'string' && this.id.length > 0;
  },
  _setInstance: function () {
    if (this._isIdSet()) {
      this.$class._instances[this.id] = this;
    } else {
      delete this.$class._instances[this.id];
    }
  },
  set: function (jsonObj) {
    if (jsonObj.hasOwnProperty('$ref')) {
      return this.root.resolveRef(jsonObj.$ref);
    } else {
      var that = this;
      jsonObj = (function walk (jsonObj) {
        switch (true) {
        case Array.isArray(jsonObj):
          return jsonObj.map(walk);
        case isObject(jsonObj):
          if (jsonObj.hasOwnProperty('$ref')) {
            return that.root.resolveRef(jsonObj.$ref).value;
          } else {
            Object.keys(jsonObj).forEach(function (key) {
              jsonObj[key] = walk(jsonObj[key]);
            });
            return jsonObj;
          }
        default:
          return jsonObj;
        }
      })(jsonObj);

      //var diff = patch.diff(this.value, jsonObj);
      //patch.patch(this.value, diff);

      Object.keys(jsonObj).forEach(function (key) {
        this.value[key] = jsonObj[key];
      }.bind(this));

      this._setInstance();

      return this;
    }
  },
  request: function (method, pathname, query, headers, body) {
    return this.parent.request(method, this.path + pathname, query, headers, body);
  }
});

var Service = AbstractModel.$extend({
  G: function (endpoint, _, children) {
    return Service.$extend({
      endpoint: endpoint,
      instance: null
    }, {}, children);
  },
  get path () {
    return this.endpoint;
  },
  get abspath () {
    return this.endpoint;
  }
}, {
  ctor: function () {
    if (this.$class.instance !== null) {
      return this.$class.instance;
    }
    Service.$super.$proto.ctor.call(this);
    this.$class.instance = this;
    return this;
  },
  get path () {
    return this.$class.endpoint;
  },
  get abspath () {
    return this.$class.endpoint;
  },  
  request: function (method, pathname, query, headers, body) {
    headers = headers || {};
    var urlObj = url.parse(this.path + pathname);
    urlObj.query = query;
    var endPoint = url.format(urlObj);

    return new Qlient.Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.status >= 400) {
          reject(xhr);
        } else {
          resolve(xhr);        
        }
      };
      xhr.onerror = function (err) {
        reject(err);
      };
      xhr.open(method, endPoint);
      if (this.parent.auth !== null) {
        xhr.setRequestHeader('Authorization', this.parent.auth);
      }
      Object.keys(headers).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
      });
      xhr.send(body);
    }.bind(this));
  }
});

var Qlient = AbstractModel.$extend({
  G: function (children) {
    return Qlient.$extend({
      parent: null
    }, {}, children);
  },
  Promise: global.Promise
}, {
  ctor: function (user, password) {
    Qlient.$super.$proto.ctor.call(this);

    this.auth = null;    
    if (user && password) {
      this.setBasicAuth(user, password);
    }
  },
  setBasicAuth: function (user, password) {
    this.auth = 'Basic ' + new Buffer(user + ':' + password).toString('base64');
  }
});

module.exports = Qlient;

var http = require('http'),
    url = require('url'),
    util = require('util'),
    path = require('path'),
    pointer = require('./pointer'),
    patch = require('./patch'),
    inflect = require('i')();

var Qlass = require('./qlass');

function NOOP () { /* NOOP */ }

function makeResourceMethod (name) {
  return function (arg0, arg1) {
    var Resource = this._models[name],
        parent = (AbstractResource.isClassOf(this) ? this : null);
    
    switch (typeof arg0) {
    case 'undefined':
      // resource()
    case 'boolean':
      // resource(true)
      return Resource.all(parent, !!arg0);
      break;
    case 'string':
      // resource('id')
      if (arg1) {
        var res = Resource.byId(parent, arg0);
        res.resolve();
        return res.value;
      } else {
        return Resource.byId(parent, arg0);
      }
      break;
    case 'object':
      // resource({ key: value })
      return Resource.new(parent, arg0);
      break;
    default:
      throw new TypeError('unknown type argument');
    }
  };
}

function parseDefinition (qlient, defs) {
  function parseModelName (name) {
    var fragments = name.split('$');
    switch (fragments.length) {
    case 1:
      return {
        orig: name,
        name: inflect.singularize(fragments[0].trim()),
        idField: 'id'
      };
      break;
    case 2:
      return {
        orig: name,
        name: inflect.singularize(fragments[0].trim()),
        idField: fragments[1].trim()
      };
      break;
    default:
      throw new SyntaxError('invalid model definition');
    }
  }

  var methods, models;

  models = Object.keys(defs)
    .map(parseModelName)
    .reduce(function (obj, def) {
      obj[def.name] = AbstractResource.def(qlient, def.name, def.idField,
                                           defs[def.orig]);
      return obj;
    }, {});

  methods = Object.keys(models).reduce(function (obj, name) {
    var p = inflect.pluralize(name),
        s = name;

    obj[p] = obj[s] = makeResourceMethod(name);
    return obj;
  }, {});

  return {
    methods: methods,
    models: models
  };
}

var Qlient = Qlass.$extend({
  def: function (modelDefs, endpoint) {
    return Qlient.$extend({
      modelDefs: modelDefs,
      endpoint: endpoint
    }, {});
  },
  Promise: global.Promise
}, {
  ctor: function (user, password) {
    this.auth = null;    
    if (user && password) {
      this.setBasicAuth(user, password);
    }

    var def = parseDefinition(this, this.$class.modelDefs);
    def.models.task = AbstractTask.def(this);
    def.methods.task = makeResourceMethod('task');

    this.Task = def.models.task;
    this.$ = def.methods;
    this.$._models = def.models;
  },
  request: function (method, pathname, headers, body) {
    headers = headers || {};
    var endPoint = url.resolve(this.$class.endpoint, pathname);

    return new Qlient.Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr);
      };
      xhr.onerror = function (err) {
        reject(err);
      };
      xhr.open(method, endPoint);
      if (this.auth !== null) {
        //xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', this.auth);
      }
      Object.keys(headers).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
      });
      xhr.send(body);
    }.bind(this));
  },
  setBasicAuth: function (user, password) {
    this.auth = 'Basic ' + new Buffer(user + ':' + password).toString('base64');
  }
});

var ResourceList = Qlass.$extend({
  
}, {
  _list: [],
  ctor: function () {
    Object.defineProperty(this.value, '$', {
      enumerable: false
    });
    this.value.$ = this;
  },
  get value() {
    return this._list;
  },
  sync: function (list) {
    var activeIds = list.map(function (value) {
      return value.$.id;
    });

    var i = 0;
    for (i = this.value.length-1; i >= 0; --i) {
      if (activeIds.indexOf(this.value[i].$.id) === -1) {
        this.value[i].$.destroy();
      }
    }
  }
});

var AbstractResource = Qlient.$extend({
  def: function (qlient, name, idField, childDefs) {
    var def = parseDefinition(qlient, childDefs);
    return this.$extend({
      name: name,
      _qlient: qlient,
      _idField: idField,
      _instances: {},
      _models: def.models
    }, def.methods);
  },
  byId: function (parent, id) {
    var Resource = this;
    if (Resource._instances.hasOwnProperty(id)) {
      return Resource._instances[id];
    }
    
    var res = Resource.new(parent);
    res._value[res.$class._idField] = id;
    return res;
  },
  all: function (parent, isDeep) {
    var Resource = this,
        res = Resource.new(parent);

    var tmpArray = [];

    tmpArray.$promise = res._request('GET').then(function (list) {
      var activeIds = list.map(function (value) {
        return value[Resource._idField];
      });
      Object.keys(Resource._instances).forEach(function (instanceId) {
        if (activeIds.indexOf(instanceId) < 0) {
          Resource._instances[instanceId]._destroy();
        }
      });

      return Qlient.Promise.all(list.map(function (value) {
        var instance = Resource.new(parent);
        instance._sync(value, true);
        return isDeep ? instance.resolve() : instance;
      }));
    }).then(function (list) {
      list.forEach(function (elem) { tmpArray.push(elem.value); });
      return list;
    });

    return tmpArray;
  }
}, {
  ctor: function (parent, obj) {
    this._parent = parent || null;
    this._value = Object.create({ $: this });

    // TODO: dirty
    this._models = this.$class._models;

    if (typeof obj === 'object' && obj !== null) {
      this._sync(obj);
    }
  },
  get value () {
    return this._value;
  },
  get id () {
    return this._value.hasOwnProperty(this.$class._idField) ?
      (this._value[this.$class._idField] || '') : '';
  },
  resolve: function () {
    if (!this._isSetId()) { throw new Error('id is not set'); }
    return this._request('GET').then(this._sync.bind(this));
  },
  update: function () {
    if (!this._isSetId()) { throw new Error('id is not set'); }
    return this._request('PUT', {}, {}, this.value).then(this._sync.bind(this));
  },
  remove: function () {
    if (!this._isSetId()) { throw new Error('id is not set'); }
    return this._request('DELETE').then(this._sync.bind(this));
  },
  create: function () {
    if (this._isSetId()) { throw new Error('id is set'); }
    return this._request('POST', {}, {}, this.value).then(this._sync.bind(this));
  },
  assign: function (obj, key, path) {
    var ref = pointer.path(this.value, path);
    if (ref.chk()) {
      obj[key] = ref.get();
    }
    return this.resolve().then(function (res) {
      obj[key] = ref.get();
      return res;
    });
  },
  _destroy: function () {
    return this._sync({});
  },
  _isSetId: function () {
    return typeof this.id === 'string' && this.id.length > 0;
  },
  _setInstance: function () {
    if (this._isSetId) {
      this.$class._instances[this.id] = this;
    } else {
      delete this.$class._instances[this.id];
    }
  },
  _sync: function (newValue, shallow) {
    var diff = patch.diff(this.value, newValue).filter(function (patch) {
      return !shallow || patch.op !== 'remove';
    });
    patch.patch(this.value, diff);

    this._setInstance();

    return this;
  },
  _getPath: function () {
    var path = (this._parent !== null) ? this._parent._getPath() : [],
        name = inflect.pluralize(this.$class.name);

    return path.concat([name, this.id]);
  },
  _request: function (method, query, headers, body) {
    var urlPath, qlient;

    urlPath = url.format({
      pathname: path.join.apply(path, this._getPath()),
      query: query || {}
    });

    qlient = this.$class._qlient;

    if (typeof body === 'object' && body !== null) {
      body = Object.keys(body).reduce(function (obj, key) {
        if (key.indexOf('$$') !== 0) {
          obj[key] = body[key];
        }
        return obj;
      }, {});
    }
    
    return qlient.request(method, urlPath, headers, JSON.stringify(body))
      .then(function (xhr) {
        // TODO: unsupported feature 'PATCH'
        // this.$_etag = xhr.getResponseHeader('ETag');

        return JSON.parse(xhr.response);
      }.bind(this));
  }
});

var AbstractTask = AbstractResource.$extend({
  def: function (qlient, interval) {
    return this.$extend({
      name: 'task',
      _qlient: qlient,
      _idField: 'id',
      _instances: {},
      _cb: NOOP,
      _timer: null,
      _interval: interval
    }, {});
  },
  queue: function (procedure, arguments, isSync) {
    var Task = this,
        task = Task.new();
    return task._request('POST', { is_sync: isSync }, {}, {
      procedure: procedure,
      arguments: arguments
    }).then(task._sync.bind(task));
  },
  sync: function (cb) {
    this.unsync();

    var Task = this;
    Task._cb = cb || NOOP;
    Task._timer = setInterval(function () {
      Task.all().then(function (tasks) {
        return Qlient.Promise.all(tasks.map(function (task) { return task.resolve(); }));
      }).then(function (tasks) {
        cb(tasks);
      });
    }, Task._interval);
  },
  unsync: function () {
    var Task = this;
    Task._cb = NOOP;
    clearInterval(Task._timer);
  }
}, {});

module.exports = Qlient;

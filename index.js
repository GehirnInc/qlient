var http = require('http'),
    url = require('url'),
    util = require('util'),
    path = require('path'),
    pointer = require('./pointer'),
    patch = require('./patch'),
    inflect = require('i')();

function NOOP () { /* NOOP */ }

function make$lessObj ($ful) {
  return Object.keys($ful).filter(function (key) {
    return key.indexOf('$') !== 0;
  }).reduce(function ($less, key) {
    $less[key] = $ful[key];
    return $less;
  }, {});
}

function AbstractResource (qlient, id, idField) {
  if (typeof id === 'string') {
    var instances = this.constructor.instances;

    if (instances.hasOwnProperty(id)) {
      return instances[id];
    } else {
      this.$_id = id;
      instances[id] = this;
    }
  } else {
    this.$_id = null;
  }

  //this.$_isSuspective = true;
  this.$_idField = idField || 'id';
  this.$_value = {};
  this.$_etag = null;

  return this;
}

AbstractResource.all = function () {
  var instance = new this();
  return instance.$request('GET').then(function (list) {
    return list.map(function (value) {
      var res = new this(value.id);
      res.$sync(value, false);
      return res;
    }.bind(this));
  }.bind(this));
};

AbstractResource.T = function (qlient, name, idField) {
  function Resource (id) {
    return AbstractResource.call(this, qlient, id, idField);
  }
  util.inherits(Resource, AbstractResource);

  Resource.instances = {};
  Resource.$name = name;
  Resource.$qlient = qlient;

  Resource.all = AbstractResource.all;

  return Resource;
};

AbstractResource.prototype.$getPath = function () {
  var res = inflect.pluralize(this.constructor.$name),
      id = this.$_id || '';

  return [res, id];
};

AbstractResource.prototype.$makeUrl = function (query) {
  query = query || {};
  return url.format({
    pathname: path.join.apply(path, this.$getPath()),
    query: query
  });
};

AbstractResource.prototype.$request = function (method, query, headers, body) {
  var urlPath = this.$makeUrl(query);
  return this.constructor.$qlient.request(method, urlPath, headers, JSON.stringify(body))
    .then(function (xhr) {
      //this.$_etag = xhr.getResponseHeader('ETag');
      return JSON.parse(xhr.response);
    }.bind(this));
};

AbstractResource.prototype.$sync = function (newValue, canDelete) {
  // TODO: check if value is an object
  var current = make$lessObj(this);
  var diff = patch.diff(current, newValue).filter(function (patch) {
    return canDelete || patch.op !== 'remove';
  });
  patch.patch(this, diff);
  this.$_value = newValue;
  if (typeof this.$_id !== 'string') {
    this.constructor.instances[this.id] = this;
    this.$_id = this[this.$_idField];
  }
  return this;
};

AbstractResource.prototype.$resolve = function () {
  return this.$request('GET').then(function (newValue) {
    return this.$sync(newValue, true);
  }.bind(this));
};

AbstractResource.prototype.$transaction = function (cb, query, isPatch) {
  cb = cb || NOOP;
  isPatch = !!isPatch;
  return Promise.resolve(cb(this)).then(function () {
    var newValue = make$lessObj(this);

    return (function () {
      if (this.$_id === null) {
        return this.$request('POST', query, {}, newValue);
      } else {
        if (isPatch) {
          return this.$request('PATCH', query, {
            'Content-Type': 'application/patch+json',
            'If-Match': this.$_etag
          }, patch.diff(this.$_value, newValue));
        } else {
          return this.$request('PUT', query, {}, newValue);
        }
      }
    }).call(this).then(function (newValue) {
      return this.$sync(newValue, true);
    }.bind(this));
  }.bind(this));
};

function AbstractTask () {
  return AbstractResource.apply(this, arguments);
}
util.inherits(AbstractTask, AbstractResource);

AbstractTask.queue = function (procedure, args, isSync) {
  isSync = isSync || false;

  var task = new this();
  return task.$transaction(function () {
    task.procedure = procedure;
    task.arguments = args;
  }, { is_sync: isSync });
};

AbstractTask.T = function (qlient, name, idField) {
  function Task (id) {
    return AbstractTask.call(this, qlient, id, idField);
  }
  util.inherits(Task, AbstractTask);

  Task.instances = {};
  Task.$name = name;
  Task.$qlient = qlient;
  Task.all = AbstractResource.all;
  Task.queue = AbstractTask.queue;

  return Task;
};

function Qlient (baseUrl, wrap) {
  this.models = {};
  this.baseUrl = baseUrl;
  this.auth = null;

  // Angular Support
  this.wrap = wrap || function (a) { return a; };
}

Qlient.prototype.def = function (name, model) {
  return this.models[name] = model;
};

Qlient.prototype.model = function (name) {
  return this.models[name];
};

Qlient.prototype.res = function (name, idField) {
  return this.def(name, AbstractResource.T(this, name, idField));
};

Qlient.prototype.task = function (name, idField) {
  return this.def(name, AbstractTask.T(this, name, idField));
};

Qlient.prototype.setBasicAuth = function (user, password) {
  this.auth = 'Basic ' + new Buffer(user + ':' + password).toString('base64');
};

Qlient.prototype.request = function (method, pathname, headers, body) {
  headers = headers || {};
  var endPoint = url.resolve(this.baseUrl, pathname);

  return this.wrap(new Promise(function (resolve, reject) {
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
  }.bind(this)));
};

module.exports = Qlient;

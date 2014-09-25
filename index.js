var http = require('http'),
    url = require('url'),
    util = require('util'),
    path = require('path'),
    pointer = require('./pointer'),
    patch = require('./patch'),
    inflect = require('i')();

function NOOP () { /* NOOP */ }

if (!global.hasOwnProperty('Promise')) {
  global.Promise = require('es6-promise').Promise;
}

if (!global.hasOwnProperty('XMLHttpRequest')) {
  global.XMLHttpRequest = require('xhr2');
}

function AbstractResource (qlient, id) {
  if (typeof id === 'string') {
    var instances = this.constructor.instances;

    if (instances.hasOwnProperty(id)) {
      return instances[id];
    } else {
      instances[id] = this;
    }
  }

  this.$_qlient = qlient;

  this.$_name = null;
  this.$_id = null;
  this.$_isSuspective = true;
  this.$_value = {};
  this.$_etag = null;

  return this;
}

AbstractResource.all = function () {
  return qlient.requestRESTfully('GET', this.$name).then(function (list) {
    return list.map(function (value) {
      var res = new this(value.id);
      res.$sync(value, false);
      return res;
    }.bind(this));
  }.bind(this));
};

AbstractResource.T = function (qlient, name) {
  function Resource (id) {
    AbstractResource.call(this, qlient, id);

    this.$_name = name;
    this.$_id = id || null;
  }
  util.inherits(Resource, AbstractResource);

  Resource.instances = {};
  Resource.all = AbstractResource.all;
  Resource.$name = name;

  return Resource;
};

AbstractResource.prototype.$sync = function (newValue, canDelete) {
  // TODO: check if value is an object
  var diff = patch.diff(this.$_value, newValue).filter(function (patch) {
    return canDelete || patch.op !== 'remove';
  });
  patch.patch(this, diff);
  this.$_value = newValue;
  if (typeof this.$_id !== 'string') {
    this.constructor.instances[this.id] = this;
    this.$_id = this.id;
  }
};

AbstractResource.prototype.$resolve = function () {
  return this.$_qlient.requestRESTfully('GET', this.$_name, this.$_id)
    .then(function (newValue) {
      return this.$sync(newValue, true);
    }.bind(this));
};

AbstractResource.prototype.$transaction = function (cb, queries) {
  cb = cb || NOOP;
  return Promise.resolve(cb(this)).then(function () {
    var newValue = Object.keys(this).filter(function (key) {
      return key.indexOf('$') !== 0;
    }).reduce(function (obj, key) {
      obj[key] = this[key];
      return obj;
    }.bind(this), {});

    (function () {
      if (this.$_id === null) {
        return this.$_qlient.requestRESTfully(
          'POST', this.$_name, null, queries, {}, newValue);
      } else {
        return this.$_qlient.requestRESTfully(
          'PUT', this.$_name, this.$_id, queries, {}, newValue);
      }
    }).call(this).then(function (newValue) {
      return this.$sync(newValue);
    });
  }.bind(this));
};

function AbstractTask () {
}
util.inherits(AbstractTask, AbstractResource);

AbstractTask.T = function (qlient, name) {
  function Task (id) {
    AbstractTask.call(this, qlient, id);

    this.$_name = name;
    this.$_id = id || null;
  }
  util.inherits(Task, AbstractTask);

  Task.instances = {};
  Task.all = AbstractResource.call;
  Task.$name = name;
  Task.queue = function (procedure, isSync) {
    isSync = isSync || false;
    var task = new Task();
    return task.$transaction(function () {
      task.procedure = procedure;
    }, { isSync: isSync });
  };

  return Task;
};

function Qlient (baseUrl) {
  this.models = {};
  this.baseUrl = baseUrl;
}

Qlient.prototype.def = function (name, model) {
  return this.models[name] = model;
};

Qlient.prototype.model = function (name) {
  return this.models[name];
};

Qlient.prototype.res = function (name) {
  return this.def(name, AbstractResource.T(this, name));
};

Qlient.prototype.request = function (method, pathname, headers, body) {
  headers = headers || {};
  var endPoint = url.resolve(this.baseUrl, pathname);
  console.log(endPoint);
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr);
    };
    xhr.onerror = function (err) {
      reject(err);
    };
    xhr.open(method, endPoint);
    Object.keys(headers).forEach(function (key) {
      xhr.setRequstHeader(key, headers[key]);
    });
    xhr.send(body);
  });
};

Qlient.prototype.requestRESTfully = function (method, res, id,
                                              queries, headers, body) {
  res = inflect.pluralize(res);
  id = id || '';
  queries = queries || {};
  var urlPath = url.stringify({
    pathname: path.join([ res, id ]),
    query: queries
  });
  return this.request(method, urlPath, headers, JSON.stringify(body))
    .then(function (xhr) {
      return JSON.parse(xhr.response);
    });
};

module.exports = Qlient;

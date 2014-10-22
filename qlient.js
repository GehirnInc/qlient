module.exports = Qlient;

var url = require('url'),
    util = require('util'),
    events = require('events'),
    EventEmitter = events.EventEmitter;;

var Resource = require('./resource');

function isObject (obj) {
  return (typeof obj === 'object' && obj !== null);
}

function toJSONRef (res) {
  if (!isObject(res)) { return null; }
  return JSON.stringify(Object.keys(res.value).map(function (key) {
    var value = res.value[key];
    if (value instanceof Resource) {
      return { key: key, value: { $ref: res.abspath } };
    } else {
      return { key: key, value: value };
    }
  }).toObject());
}

function Qlient (baseurl, services) {
  this.baseurl = baseurl;
  
  this.services = services.map(function (service) {
    return { key: service.name, value: service.new(this) };
  }.bind(this)).toObject();

  this.defaultHeaders = {};

  this._connections = 0;
  
  EventEmitter.call(this);

  this.emit('stats', 0);
}
util.inherits(Qlient, EventEmitter);

Qlient.prototype.request = function (method, pathname, query, headers, objBody) {
  headers = headers || {};
  Object.keys(this.defaultHeaders).forEach(function (key) {
    if (!headers.hasOwnProperty(key)) {
      headers[key] = this.defaultHeaders[key];
    }
  }.bind(this));
  var urlObj = url.parse(this.baseurl + pathname);
  urlObj.query = query;
  var endPoint = url.format(urlObj).slice(0, -1); // remove last slash
  
  var body = toJSONRef(objBody);

  return (new Qlient.Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      this._connections -= 1;
      this.emit('stats', this._connections);
      //console.log('response', xhr.response, xhr.status, endPoint);
      if (xhr.status >= 400) {
        reject(xhr);
      } else {
        resolve(JSON.parse(xhr.response));
      }
    }.bind(this);
    xhr.onerror = function (err) {
      this._connections -= 1;
      this.emit('stats', this._connections);
      reject(err);
    }.bind(this);
    this._connections += 1;
    this.emit('stats', this._connections);
    xhr.open(method, endPoint);
    Object.keys(headers).forEach(function (key) {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.send(body);
  }.bind(this))).catch(function (err) {
    console.warn(err);
  });
};

Qlient.prototype.setBasicAuth = function (user, password) {
  if (user === null) {
    delete this.defaultHeaders['Authorization'];
  } else {
    this.defaultHeaders['Authorization'] = 'Basic ' + global.btoa(user + ':' + password);
  }
};

module.exports = Type;

var util = require('util'),
    inflect = require('i')(),
    Flow = require('./flow'),
    Collection = require('./collection'),
    Resource = require('./resource');

function Type (parent, name, idField, children) {
  this.parent = parent;
  this.name = name;
  this.idField = idField;
  this.children = children || [];

  this.path = inflect.pluralize(name) + '/';
  
  // cache
  this.resources = {};
  this.collection = new Collection(this, []);
}

Type.prototype._createObjectWithId = function (id) {
  var obj = {};
  obj[this.idField] = id;
  return obj;
};

Type.prototype.all = function () {
  this.request('GET').then(function (list) {
    this.collection.set(list);
  }.bind(this)).catch(function (err) {
    console.warn(err);
  });

  return this.collection;
};

Type.prototype.byId = function (id) {
  if (this.resources.hasOwnProperty(id)) {
    return this.resources[id];
  } else {
    return new Resource(this, this._createObjectWithId(id), this.children);
  }
};

Type.prototype.new = function (obj) {
  return new Resource(this, obj || {}, this.children);
};

Type.prototype.request = function (method, pathname, query, headers, body) {
  pathname = pathname || '';
  return this.parent.request(method, this.path + pathname, query, headers, body);
};

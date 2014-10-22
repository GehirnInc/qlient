module.exports = Service;

var Resource = require('./resource');

function Service (parent, name, version, children) {
  this.name = name;
  this.version = version;
  this.path = name + '/' + version + '/';

  this.parent = parent;

  this.types = children.map(function (typeDefinition) {
    var Type = typeDefinition.new(this);
    this[typeDefinition.name.toUpperCamelCase()] = Type;
    
    return { key: typeDefinition.name, value: Type };
  }.bind(this)).toObject();

  this.defaultHeaders = {};
}

Service.prototype.request = function (method, pathname, query, headers, body) {
  headers = headers || {};
  Object.keys(this.defaultHeaders).forEach(function (key) {
    if (!headers.hasOwnProperty(key)) {
      headers[key] = this.defaultHeaders[key];
    }
  }.bind(this));
  return this.parent.request(method, this.path + pathname, query, headers, body);
};

Service.prototype.setBasicAuth = function (user, password) {
  if (user === null) {
    delete this.defaultHeaders['Authorization'];
  } else {
    this.defaultHeaders['Authorization'] = 'Basic ' + global.btoa(user + ':' + password);
  }
};

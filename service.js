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
}

Service.prototype.request = function (method, pathname, query, headers, body) {
  return this.parent.request(method, this.path + pathname, query, headers, body);
};

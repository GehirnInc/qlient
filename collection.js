module.exports = Collection;

var util = require('util'),
    Q = require('./qlient'),
    Flow = require('./flow');

function Collection (type, list) {
  Flow.call(this);
  this.type = type;
}
util.inherits(Collection, Flow);

Collection.prototype.set = function (jsonArray) {
  var that = this;

  this.value = jsonArray.map(function (jsonObj) {
    if (jsonObj.hasOwnProperty('$ref')) {
      return that.type.q.resolveReference(jsonObj.$ref);
    } else {
      return that.type.new(jsonObj);
    }
  });

  return this;
};

Collection.prototype.toArray = function (resolutions) {
  return this.ready().then(function (list) {
    return Q.Promise.all(list.map(function (res) {
      return res.toObject(resolutions);
    }));
  }).catch(function (err) {
    console.warn(err);
  });
};

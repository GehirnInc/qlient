var http = require('http'),
    util = require('util');

if (global.hasOwnProperty('DOMParser')) {
  global.DOMParser = require('xmldom').DOMParser;
}

function Resource (qlient) {
  this.qlient = qlient;
  this.isSuspective = true;
}

Resource.T = function (qlient, name, schema) {
  function ResourceT() {
    this.$name = name;
  }
  util.inherits(ResourceT, Resource);
  return ResourceT;
};

Resource.prototype._makeRefArrayProp = function () {
  return function (index) {
    
  };
};

Resource.prototype.$resolve = function () {
  
};

function Qlient () {
  this.models = {};
}

Qlient.load = function () {
  // TODO
};

Qlient.prototype.def = function (name, model) {
  return this.models[name] = model;
};

Qlient.prototype.model = function (name) {
  return this.models[name];
};

function Task () {
  
}

if (!module.parent) {
  var qlient = Qlient.fromSchema({
    resources: [
      {
        id: 'domain',
        methods: ['GET', 'POST'],
        schema: {}
      }
    ]
  });

  var Topic = qlient.res('topic');

  var topic = Topic.get('id');

  topic.$transaction();

  topic.publishers(0).$resolve(function () {
    
  });
}

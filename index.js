var path = require('path'),
    url = require('url'),
    inflect = require('i')();

var Flow = require('./flow'),
    Collection = require('./collection'),
    Type = require('./type'),
    Resource = require('./resource'),
    Service = require('./service'),
    Qlient = require('./qlient');

var Q = module.exports = Qlient;

Q.Promise = global.Promise;

Q.Flow = Flow;
Q.Collection = Collection;
Q.Type = Type;
Q.Resource = Resource;
Q.Service = Service;
Q.Qlient = Qlient;

// --------------------------------------------------------------------------------

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

  return dst.slice(l-1).join('');
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

function parseRef (baseurl, ref, n) {
  var fragments = makeRelativeUrl(baseurl, ref + '/').split('/');
  return {
    child: fragments[0],
    rest: fragments.join('/')
  };
}

Array.prototype.toObject = function toObject () {
  return this.reduce(function (obj, kv) {
    obj[kv.key] = kv.value;
    return obj;
  }, {});  
};

String.prototype.toUpperCamelCase = function () {
  return this.replace(/(\w)(\w*)/g, function(g0, g1, g2){
    return g1.toUpperCase() + g2.toLowerCase();
  });
};

// --------------------------------------------------------------------------------

Qlient.prototype.resolveReference = function (ref) {
  var refObj = parseRef(this.baseurl, ref, 2);
  if (this.services.hasOwnProperty(refObj.child)) {
    var Service = this.services[refObj.child];
    return Service.resolveReference(refObj.rest);
  } else {
    console.log(ref, refObj);
    throw new TypeError('no such service: ' + refObj.child);
  }
};

Resource.prototype.resolveReference = function (ref) {
  var refObj = parseRef(this.path, ref, 1);
  if (refObj.child.length === 0) { return this; }
  var typename = inflect.singularize(refObj.child);
  if (this.types.hasOwnProperty(typename)) {
    var Type = this.types[typename];
    return Type.resolveReference(refObj.rest);
  } else {
    throw new TypeError('no such resource type: ' + refObj.child);
  }  
};

Type.prototype.resolveReference = function (ref) {
  var refObj = parseRef(this.path, ref, 1);
  if (refObj.child.length === 0) { new Error('not implemented'); return this; }

  var resource = this.byId(refObj.child);
  return resource.resolveReference(refObj.rest);
};

Service.prototype.resolveReference = Resource.prototype.resolveReference;

Object.defineProperties(Qlient.prototype, {
  q      : { get: function () { return this; } },
  abspath: { get: function () { return this.baseurl; } }
});
Object.defineProperties(Resource.prototype, {
  q      : { get: function () { return this.type.q; } },
  abspath: { get: function () { return this.type.abspath + this.path ; } }
});
Object.defineProperties(Type.prototype, {
  q      : { get: function () { return this.parent.q; } },
  abspath: { get: function () { return this.parent.abspath + this.path ; } }
});
Object.defineProperties(Service.prototype, {
  q      : { get: function () { return this.parent.q; } },
  abspath: { get: function () { return this.parent.abspath + this.path ; } }
});

// --------------------------------------------------------------------------------

function ServiceDefinition (name, version, children) {
  this.name = name;
  this.version = version;
  this.children = children;
}

ServiceDefinition.prototype.new = function (parent) {
  return new Service(parent, this.name, this.version, this.children);
};

function TypeDefinition (name, idField, children) {
  this.name = name;
  this.idField = idField;
  this.children = children;

  if (Array.isArray(idField)) {
    this.children = this.idField;
    this.idField = 'id';
  }

  this.idField = this.idField || 'id';
  this.children = this.children || [];
}

TypeDefinition.prototype.new = function (parent) {
  return new Type(parent, this.name, this.idField, this.children);
};

Q.service = function (name, version, children) {
  return new ServiceDefinition(name, version, children);
};

Q.type = function (name, idField, children) {
  return new TypeDefinition(name, idField, children);
};

'use strict';

var BaseQlass = {};

BaseQlass.$extend = function (/* statics, dynamics */) {
  var Super = this,
      Class = Object.create(Super);

  Object.defineProperty(Class, '$proto', {
    value: Object.create(Super.$proto)
  });
  Object.defineProperty(Class.$proto, '$class', {
    value: Class
  });
  Object.defineProperty(Class, '$super', {
    value: Super
  });

  var ret = Super.$def.apply(Class, Array.prototype.slice.call(arguments));

  return (ret === undefined) ? Class : ret;
};

BaseQlass.$def = function (statics, dynamics) {
  var Class = this;

  Object.keys(statics).forEach(function (key) {
    Object.defineProperty(
      Class, key,
      Object.getOwnPropertyDescriptor(statics, key));
  });

  Object.keys(dynamics).forEach(function (key) {
    Object.defineProperty(
      Class.$proto, key,
      Object.getOwnPropertyDescriptor(dynamics, key));
  });
};

Object.defineProperties(BaseQlass, {
  $proto: { value: {} },
  $super: { value: BaseQlass }
});

var Qlass = BaseQlass.$extend({
  new: function (/* args */) {
    var Class, instance, ret;
    Class = this;
    instance = Object.create(Class.$proto);
    ret = instance.ctor.apply(instance, arguments);

    return (ret === undefined) ? instance : ret;
  },
  isChildOf: function (Super) {
    for (var Class = this; Class !== BaseQlass; Class = Class.$super) {
      if (Class.$super === Super) {
        return true;
      }
    }
    return false;
  },
  isClassOf: function (instance) {
    for (var proto = Object.getPrototypeOf(instance);
         proto !== null;
         proto = Object.getPrototypeOf(proto)) {
      if (this.$proto === proto) {
        return true;
      }
    }
    return false;
  }
}, {
  ctor: function () { /* NOOP */ },
  get $super() {
    return Object.getPrototypeOf(this);
  },
  isInstanceOf: function (Class) {
    return this.$class === Class || this.$class.isChildOf(Class);
  }
});

module.exports = Qlass;

if (!module.parent) {
  (function () {
    var assert = require('assert');

    assert.ok(Qlass.isChildOf(BaseQlass));
    
    var Parent = Qlass.$extend({
      // class member
      foo: function () {
        return 'foo';
      },
      bar: function () {
        return 'bar';
      }
    }, {
      // instance member
      hoge: function () {
        return 'hoge';
      },
      huga: function () {
        return 'huga';
      }
    });

    var Child = Parent.$extend({
      // class member
      baz: function () {
        return 'baz';
      }
    }, {
      // instance member
      piyo: function () {
        return 'piyo';
      },
      hogehoge: function () {
        return this.$super.huga();
      }
    });

    assert.equal(Parent.foo(), 'foo');
    assert.equal(Child.foo(), 'foo');
    assert.equal(Child.baz(), 'baz');

    var i = Child.new();
    assert.ok(Child.isChildOf(Parent));
    assert.ok(!Child.isChildOf(Child));

    assert.ok(i.isInstanceOf(Child));
    assert.ok(i.isInstanceOf(Parent));

    assert.equal(i.hoge(), 'hoge');
    assert.equal(i.piyo(), 'piyo');
    assert.equal(i.hogehoge(), 'huga');
  })();
}

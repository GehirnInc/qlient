var Qlass = module.exports = {};

Qlass.$def = function (statics, dynamics) {
  statics.$proto = Object.create(this.$proto);

  Object.keys(dynamics).forEach(function (key) {
    Object.defineProperty(
      statics.$proto, key,
      Object.getOwnPropertyDescriptor(dynamics, key));
  });

  var Klass = Object.create(this);

  Object.keys(statics).forEach(function (key) {
    Object.defineProperty(
      Klass, key,
      Object.getOwnPropertyDescriptor(statics, key));
  });

  return Klass;
};

Qlass.$proto = {};

Qlass = Qlass.$def({
  new: function (/* args */) {
    var instance = Object.create(this.$proto),
        ret = instance.ctor();

    return (ret === undefined) ? instance : ret;
  }
}, {
  ctor: function () { /* NOOP */}
});

module.exports = Qlass;

if (!module.parent) {
  var assert = require('assert');

  var Klass = Qlass.$def({
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

  var Child = Klass.$def({
    // class member
    baz: function () {
      return 'baz';
    }
  }, {
    // instance member
    piyo: function () {
      return 'piyo';
    }
  });

  assert.equal(Klass.foo(), 'foo');
  assert.equal(Child.foo(), 'foo');
  assert.equal(Child.baz(), 'baz');

  var i = Child.new();
  assert.equal(i.hoge(), 'hoge');
  assert.equal(i.piyo(), 'piyo');
}

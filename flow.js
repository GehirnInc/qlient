module.exports = Flow;

var pointer = require('./pointer'),
    events = require('events'),
    EventEmitter = events.EventEmitter;

var Q = require('./qlient');

function Flow () {
  this.ee = new EventEmitter;
  this._value = null;
  this._isReady = false;
}

Object.defineProperty(Flow.prototype, 'value', {
  get: function () {
    return this._value;
  },
  set: function (v) {
    this._value = v;
    this._notify(v);
    return this._value;
  }
});

Flow.prototype._notify = function (value) {
  this._isReady = true;
  this.ee.emit('change', value);
};

Flow.prototype.subscribe = function (f, i) {
  if (i && this._isReady) {
    f(this.value);
  }
  this.ee.on('change', f);
};

Flow.prototype.unsubscribe = function (f) {
  this.ee.removeListener('change', f);
};

Flow.prototype.ready = function () {
  return new Q.Promise(function (f) {
    if (this._idReady) {
      f(this.value);
    } else {
      this.ee.once('change', f);
    }
  }.bind(this));
};

Flow.prototype.prop = function (path) {
  var f = new Flow();
  this.subscribe(function (v) {
    var p = pointer.path(v, path);
    if (p.chk()) {
      f.value = p.get();
    }
  }, true);
  return f;
};

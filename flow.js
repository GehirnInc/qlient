module.exports = Flow;

var events = require('events'),
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

Flow.prototype.subscribe = function (f) {
  this.ee.on('change', f);
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

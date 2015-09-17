'use strict';

var asap;
if (typeof setImmediate === 'function') {
  asap = setImmediate;
} else if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
  asap = process.nextTick
} else {
  asap = function asap(callback) {
    setTimeout(callback, 0);
  };
}

module.exports = asap;

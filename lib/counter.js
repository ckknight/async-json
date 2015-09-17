'use strict';

module.exports = Counter;

function Counter(limit) {
  this.count = 0;
  this.limit = limit;
}

Counter.prototype.inc = function() {
  if (++this.count >= this.limit) {
    this.count = 0;
    return true;
  } else {
    return false;
  }
};

'use strict';

module.exports = Object.keys || (function() {
  // older browsers
  var has = Object.prototype.hasOwnProperty || function hasOwnProperty() {
    // Object.prototype.hasOwnProperty should really always exist.
    return true;
  };

  return function getKeys(obj) {
    var result = [];
    for (var key in obj) {
      if (has.call(obj, key)) {
        result.push(key);
      }
    }
    return result;
  };
}());

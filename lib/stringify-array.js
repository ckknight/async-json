'use strict';

var polyfills = require('./browser-polyfills');
var asap  =polyfills.asap;

module.exports = internalStringifyArray;

/**
 * Stringify an array
 *
 * @param {Function} stringify the top-level stringify function.
 * @param {Array} array The array to stringify.
 * @param {Function} callback The callback to invoke when completed the stringification.
 * @api private
 *
 * @example internalStringifyArray([1, 2, 3], function(err, value) { value === "[1,2,3]"; });
 */
 function internalStringifyArray(stringify, array, callback, errback, counter) {
  var len = array.length;
  if (len === 0) {
    callback("[]");
    return;
  }

  // buffer is our ultimate return value
  var buffer = "[";

  function step(n) {
    if (n === len) {
      // we're done
      buffer += "]";
      callback(buffer);
      return false;
    }

    var synchronous = true;
    var completedSynchronously = false;
    // asynchronously stringify the nth element.
    stringify(array[n], function(value) {
      if (n > 0) {
        buffer += ",";
      }

      if (value === undefined) {
        // JSON.stringify turns bad values in arrays into null, so we need to as well
        buffer += "null";
      } else {
        buffer += value;
      }

      // go to the next element
      if (counter.inc()) {
        asap(function() {
          run(n + 1);
        });
      } else if (synchronous) {
        completedSynchronously = true;
      } else {
        run(n + 1);
      }
    }, errback, String(n), counter, array);
    synchronous = false;
    return completedSynchronously;
  }

  function run(start) {
    try {
      for (var i = start; step(i); ++i) {
        // nothing to do, as step's return value will cause a halt eventually
      }
    } catch (e) {
      errback(e);
    }
  }

  // let's pump, starting at index 0
  run(0);
}

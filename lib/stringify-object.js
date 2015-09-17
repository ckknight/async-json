'use strict';

var polyfills = require('./browser-polyfills');
var getKeys = polyfills.getKeys;
var asap  =polyfills.asap;
var jsonStringify = polyfills.jsonStringify;

module.exports = internalStringifyObject;

/**
 * Stringify an object
 *
 * @param {Function} stringify the top-level stringify function.
 * @param {Object} object The object to stringify.
 * @param {Function} callback The callback to invoke when completed the stringification.
 * @api private
 *
 * @example internalStringifyObject({alpha: 1, bravo: 2}, function(err, value) { value === '{"alpha":1,"bravo":2}'; });
 */
function internalStringifyObject(stringify, object, callback, errback, counter) {
  // getKeys _should_ be a reference to Object.keys
  // JSON.stringify gets the keys in the same order as this, but that is arbitrary.
  var keys = getKeys(object);
  var len = keys.length;
  if (len === 0) {
    callback("{}");
    return;
  }

  // whether or not we've placed the first element in yet.
  // can't rely on i === 0, since we might skip it if the value === undefined.
  var first = true;

  // buffer is our ultimate return value
  var buffer = "{";

  function step(n) {
    if (n === len) {
      buffer += "}";
      callback(buffer);
      return false;
    }

    var synchronous = true;
    var completedSynchronously = false;
    var key = keys[n];
    // asynchronously stringify the nth element in our list of keys
    stringify(object[key], function(value) {
      // if we get an undefined, rather than placing in null like the array does, we just skip it.
      if (value !== undefined) {
        if (first) {
          first = false;
        } else {
          buffer += ",";
        }

        buffer += jsonStringify(key);
        buffer += ":";
        buffer += value;
      }

      // go to the next key
      if (counter.inc()) {
        asap(function() {
          run(n + 1);
        });
      } else if (synchronous) {
        completedSynchronously = true;
      } else {
        run(n + 1);
      }
    }, errback, key, counter, object);
    synchronous = false;
    return completedSynchronously;
  };

  function run(start) {
    try {
      for (var i = start; step(i); ++i) {
        // nothing to do, as step's return value will cause a halt eventually
      }
    } catch (e) {
      errback(e);
    }
  };

  // let's pump, starting at index 0
  run(0);
}

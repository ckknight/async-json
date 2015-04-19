(function(exports, undefined) {
  "use strict";

  if (typeof JSON === 'undefined' || !JSON || !JSON.stringify) {
    // older browsers
    throw new Error("The json2.js file must be included before async-json.js");
  }
  var jsonStringify = JSON.stringify;
  var isArray = Array.isArray || function(o) {
    // older browsers
    return Object.prototype.toString.call(o) === '[object Array]';
  };
  var getKeys = Object.keys || (function() {
    // older browsers

    var has = Object.prototype.hasOwnProperty || function() {
      // Object.prototype.hasOwnProperty should really always exist.
      return true;
    };

    return function(obj) {
      var result = [];
      for (var key in obj) {
        if (has.call(obj, key)) {
          result.push(key);
        }
      }
      return result;
    };
  }());

  var LIMIT = 200;
  var asap = (function() {
    if (typeof setImmediate === 'function') {
      return function(callback) {
        setImmediate(callback);
      }
    } else if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      return function(callback) {
        process.nextTick(callback);
      };
    } else {
      return function(callback) {
        setTimeout(callback, 0);
      };
    }
  }());

  function stringifyAux(data, callback, key, counter) {
    switch (typeof data) {
      case "undefined":
        callback(null, undefined);
        break;
      case "string":
      case "number":
        callback(null, jsonStringify(data));
        break;
      case "boolean":
        callback(null, data ? "true" : "false");
        break;
      case "object":
        if (data === null) {
          // why is typeof null === "object"?
          callback(null, "null");
        } else {
          var then = data.then;
          if (typeof then === 'function') {
            then.call(data, function(value) {
              stringify(value, callback, key, counter);
            }, function(error) {
              callback(error);
            });
          } else if (typeof data.toJSON === "function") {
            // used by Date and possibly some others.
            stringify(data.toJSON(key), callback, key, counter);
          } else if (isPrimitiveConstructor(data.constructor)) {
            // horrible, someone used the new String(), new Number(), or new Boolean() syntax.
            stringify(data.valueOf(), callback, key, counter);
          } else if (isArray(data)) {
            internalStringifyArray(data, callback, counter);
          } else {
            internalStringifyObject(data, callback, counter);
          }
        }
        break;
      case "function":
        if (data.length === 0) {
          // assume a sync function that returns a value
          stringify(data(), callback, key, counter);
        } else {
          // assume an async function that takes a callback
          data(function(err, value) {
            if (err) {
              callback(err);
            } else {
              stringify(value, callback, key, counter);
            }
          });
        }
        break;
      case "null":
        callback(null, "null");
        break;
      default:
        callback(null, jsonStringify(value));
        break;
    }
  }

  function stringify(data, callback, key, counter) {
    if (!counter) {
      throw new Error("Expected counter");
    }
    try {
      stringifyAux(data, callback, key, counter);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Stringify an array
   *
   * @param {Array} array The array to stringify.
   * @param {Function} callback The callback to invoke when completed the stringification.
   * @api private
   *
   * @example internalStringifyArray([1, 2, 3], function(err, value) { value === "[1,2,3]"; });
   */
  var internalStringifyArray = function(array, callback, counter) {
    var len = array.length;
    if (len === 0) {
      callback(null, "[]");
      return;
    }

    // buffer is our ultimate return value
    var buffer = "[";

    var handle = function(n) {
      if (n === len) {
        // we're done
        buffer += "]";
        callback(null, buffer);
        return false;
      }

      var synchronous = true;
      var completedSynchronously = false;
      // asynchronously stringify the nth element.
      stringify(array[n], function(err, value) {
        if (err) {
          callback(err);
          return;
        }

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
      }, String(n), counter);
      synchronous = false;
      return completedSynchronously;
    };

    var run = function(start) {
      for (var i = start;; ++i) {
        if (!handle(i)) {
          break;
        }
      }
    };

    // let's pump, starting at index 0
    run(0);
  };

  /**
   * Stringify an object
   *
   * @param {Object} object The object to stringify.
   * @param {Function} callback The callback to invoke when completed the stringification.
   * @api private
   *
   * @example internalStringifyObject({alpha: 1, bravo: 2}, function(err, value) { value === '{"alpha":1,"bravo":2}'; });
   */
  var internalStringifyObject = function(object, callback, counter) {
    // getKeys _should_ be a reference to Object.keys
    // JSON.stringify gets the keys in the same order as this, but that is arbitrary.
    var keys = getKeys(object);
    var len = keys.length;
    if (len === 0) {
      callback(null, "{}");
      return;
    }

    // whether or not we've placed the first element in yet.
    // can't rely on i === 0, since we might skip it if the value === undefined.
    var first = true;

    // buffer is our ultimate return value
    var buffer = "{";

    var handle = function(n) {
      if (n === len) {
        buffer += "}";
        callback(null, buffer);
        return false;
      }

      var synchronous = true;
      var completedSynchronously = false;
      var key = keys[n];
      // asynchronously stringify the nth element in our list of keys
      stringify(object[key], function(err, value) {
        if (err) {
          callback(err);
          return;
        }

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
      }, key, counter);
      synchronous = false;
      return completedSynchronously;
    };

    var run = function(start) {
      for (var i = start;; ++i) {
        if (!handle(i)) {
          break;
        }
      }
    };

    // let's pump, starting at index 0
    run(0);
  };

  function isPrimitiveConstructor(ctor) {
    return ctor === String || ctor === Number || ctor === Boolean;
  }

  var Counter = (function() {
    function Counter() {
      this.count = 0;
    }
    Counter.prototype.inc = function() {
      if (++this.count >= LIMIT) {
        this.count = 0;
        return true;
      } else {
        return false;
      }
    };
    return Counter;
  }());

  function runStringify(data, callback) {
    asap(function() {
      stringify(data, callback, undefined, new Counter());
    });
  }

  var stringifyPromise = function(data) {
    return new Promise(function(resolve, reject) {
      runStringify(data, function(err, value) {
        if (err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  };

  /**
   * Asynchronously convert a JavaScript object to JSON.
   * If any functions are supplied in the data, it will be invoked.
   * If the function has 0 parameters, it will be invoked and treated as synchronous, its return value being its replacement.
   * Otherwise, the first parameter is assumed to be a callback which should be invoked as callback(error, result)
   *
   * @param {Any} data Any JavaScript object.
   * @param {Function or null} callback A callback that takes an error and the result as parameters.
   * @api public
   * @return {Promise or undefined} If a callback is not provided, a Promise will be returned.
   *
   * @example stringify({some: "data"}, function(err, value) { if (err) { throw err; } value === '{"some":"data"}' })
   * @example stringify({some: "data"}.then(function(value) { assert(value === '{"some":"data"}') })
   */
  exports.stringify = function(data, callback) {
    if (callback == null) {
      return stringifyPromise(data);
    } else {
      runStringify(data, callback);
    }
  };
}(exports || (this.asyncJSON = {})));
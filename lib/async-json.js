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

  function isPrimitiveConstructor(ctor) {
    return ctor === String || ctor === Number || ctor === Boolean;
  }

  function stringifyAux(data, callback, errback, key, counter, context) {
    switch (typeof data) {
      case "object":
        if (data === null) {
          // why is typeof null === "object"?
          callback("null");
        } else {
          var then = data.then;
          if (typeof then === 'function') {
            then.call(data, function(value) {
              stringify(value, callback, errback, key, counter, undefined);
            }, errback);
          } else if (typeof data.toJSON === "function") {
            // used by Date and possibly some others.
            callback(jsonStringify(data.toJSON(key)));
          } else if (isPrimitiveConstructor(data.constructor)) {
            // horrible, someone used the new String(), new Number(), or new Boolean() syntax.
            callback(jsonStringify(data));
          } else if (isArray(data)) {
            internalStringifyArray(data, callback, errback, counter);
          } else {
            internalStringifyObject(data, callback, errback, counter);
          }
        }
        break;
      case "function":
        if (data.length === 0) {
          // assume a sync function that returns a value
          stringify(data.call(context), callback, errback, key, counter, undefined);
        } else {
          // assume an async function that takes a callback
          data.call(context, function(err, value) {
            if (err) {
              errback(err);
            } else {
              stringify(value, callback, errback, key, counter, undefined);
            }
          });
        }
        break;
      default:
        callback(jsonStringify(data));
        break;
    }
  }

  function stringify(data, callback, errback, key, counter, context) {
    if (!counter) {
      throw new Error("Expected counter");
    }
    try {
      stringifyAux(data, callback, errback, key, counter, context);
    } catch (err) {
      errback(err);
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
   function internalStringifyArray(array, callback, errback, counter) {
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
 function internalStringifyObject(object, callback, errback, counter) {
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
  };

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

  function runStringify(data, callback, errback) {
    asap(function() {
      stringify(data, callback, errback, undefined, new Counter(), undefined);
    });
  }

  function stringifyPromise(data) {
    return new Promise(function(resolve, reject) {
      runStringify(data, resolve, reject);
    });
  };

  function stringifyNode(data, callback) {
    // the inner callbacks are wrapped in asap to prevent an error potentially
    // being thrown by invoking the callback being handled by an outer caller
    runStringify(data, function (value) {
      asap(function () {
        callback(null, value);
      });
    }, function (error) {
      asap(function () {
        callback(error);
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
      return stringifyNode(data, callback);
    }
  };
}(exports || (this.asyncJSON = {})));
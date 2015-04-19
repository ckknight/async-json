(function (exports, undefined) {
    "use strict";

    if (!JSON || !JSON.stringify) {
        // older browsers
        throw new Error("The json2.js file must be included before async-json.js");
    }
    var jsonStringify = JSON.stringify;
    var isArray = Array.isArray || function (o) {
        // older browsers
        return Object.prototype.toString.call(o) === '[object Array]';
    };
    var getKeys = Object.keys || (function () {
        // older browsers

        var has = Object.prototype.hasOwnProperty || function () {
            // Object.prototype.hasOwnProperty should really always exist.
            return true;
        };

        return function (obj) {
            var result = [];
            for (var key in obj) {
                if (has.call(obj, key)) {
                    result.push(key);
                }
            }
            return result;
        };
    }());

    var stringify = function (data, callback, key) {
        if (data === undefined) {
            return callback(null, undefined);
        }
        try {
            switch (typeof data) {
            case "string":
            case "number":
                return callback(null, jsonStringify(data));
            case "boolean":
                return callback(null, data ? "true" : "false");
            case "object":
                if (data === null) {
                    // why is typeof null === "object"?
                    return callback(null, "null");
                } else if (typeof data.toJSON === "function") {
                    // used by Date and possibly some others.
                    return stringify(data.toJSON(key), callback, key);
                } else if (isPrimitiveConstructor(data.constructor)) {
                    // horrible, someone used the new String(), new Number(), or new Boolean() syntax.
                    return stringify(data.valueOf(), callback, key);
                } else if (isArray(data)) {
                    return internalStringifyArray(data, callback);
                } else {
                    return internalStringifyObject(data, callback);
                }
                break;
            case "function":
                if (data.length === 0) {
                    // assume a sync function that returns a value
                    return stringify(data(), callback, key);
                } else {
                    // assume an async function that takes a callback
                    return data(function (err, value) {
                        if (err) {
                            callback(err);
                        } else {
                            stringify(value, callback, key);
                        }
                    });
                }
                break;
            default:
                throw new Error("Unknown object type: " + (typeof data));
            }
        } catch (err) {
            return callback(err);
        }
    };

    /**
     * Stringify an array
     *
     * @param {Array} array The array to stringify.
     * @param {Function} callback The callback to invoke when completed the stringification.
     * @api private
     *
     * @example internalStringifyArray([1, 2, 3], function(err, value) { value === "[1,2,3]"; });
     */
    var internalStringifyArray = function (array, callback) {
        var len = array.length;
        if (len === 0) {
            callback(null, "[]");
            return;
        }

        // buffer is our ultimate return value
        var buffer = "[";

        var handle = function (n) {
            if (n === len) {
                // we're done
                buffer += "]";
                callback(null, buffer);
                return false;
            }

            var synchronous = true;
            var completedSynchronously = false;
            // asynchronously stringify the nth element.
            stringify(array[n], function (err, value) {
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
                if (synchronous) {
                  completedSynchronously = true;
                } else {
                  run(n + 1);
                }
            }, String(n));
            synchronous = false;
            return completedSynchronously;
        };

        var run = function (start) {
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
    var internalStringifyObject = function (object, callback) {
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

        var handle = function (n) {
            if (n === len) {
                buffer += "}";
                callback(null, buffer);
                return false;
            }

            var synchronous = true;
            var completedSynchronously = false;
            var key = keys[n];
            // asynchronously stringify the nth element in our list of keys
            stringify(object[key], function (err, value) {
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
                if (synchronous) {
                  completedSynchronously = true;
                } else {
                  run(n + 1);
                }
            }, key);
            synchronous = false;
            return completedSynchronously;
        };

        var run = function (start) {
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

    var stringifyPromise = function (data) {
      return new Promise(function (resolve, reject) {
        stringify(data, function (err, value) {
          if (err) {
            reject(err);
          } else {
            resolve(value)
          }
        })
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
    exports.stringify = function (data, callback) {
      if (callback == null) {
        return stringifyPromise(data);
      } else {
        stringify(data, callback);
      }
    };
}(exports || (this.asyncJSON = {})));
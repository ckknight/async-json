(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var runStringify = require('./stringify');
var polyfills = require('./browser-polyfills');
var asap = polyfills.asap;

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
module.exports.stringify = function(data, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else {
    options = options || {};
  }

  if (callback == null) {
    return stringifyPromise(data, options);
  } else {
    return stringifyNode(data, options, callback);
  }
};

function stringifyPromise(data, options) {
  return new Promise(function(resolve, reject) {
    runStringify(data, options, resolve, reject);
  });
};

function stringifyNode(data, options, callback) {
  // the inner callbacks are wrapped in asap to prevent an error potentially
  // being thrown by invoking the callback being handled by an outer caller
  runStringify(data, options, function (value) {
    asap(function () {
      callback(null, value);
    });
  }, function (error) {
    asap(function () {
      callback(error);
    });
  });
};

},{"./browser-polyfills":2,"./stringify":9}],2:[function(require,module,exports){
'use strict';

if (typeof JSON === 'undefined' || !JSON || !JSON.stringify) {
  // older browsers
  throw new Error("The json2.js file must be included before async-json.js");
}

module.exports = {
  asap: require('./polyfill-asap'),
  getKeys: require('./polyfill-get-keys'),
  isArray: require('./polyfill-is-array'),
  jsonStringify: JSON.stringify
};

},{"./polyfill-asap":4,"./polyfill-get-keys":5,"./polyfill-is-array":6}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
(function (process){
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

}).call(this,require('_process'))
},{"_process":10}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
'use strict';

module.exports = Array.isArray || function isArray(o) {
  // older browsers
  return Object.prototype.toString.call(o) === '[object Array]';
};

},{}],7:[function(require,module,exports){
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

},{"./browser-polyfills":2}],8:[function(require,module,exports){
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

},{"./browser-polyfills":2}],9:[function(require,module,exports){
'use strict';

var Counter = require('./counter');
var stringifyArray = require('./stringify-array');
var stringifyObject = require('./stringify-object');
var polyfills = require('./browser-polyfills');
var isArray = polyfills.isArray;
var asap  =polyfills.asap;
var jsonStringify = polyfills.jsonStringify;

module.exports = runStringify;

var DEFAULT_COUNTER_LIMIT = 200;
function runStringify(data, options, callback, errback) {
  asap(function() {
    stringify(data, callback, errback, undefined, new Counter(options.limit || DEFAULT_COUNTER_LIMIT), undefined);
  });
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

function stringifyAux(data, callback, errback, key, counter, context) {
  switch (typeof data) {
    case "object":
      if (data === null) {
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
          stringifyArray(stringify, data, callback, errback, counter);
        } else {
          stringifyObject(stringify, data, callback, errback, counter);
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

function isPrimitiveConstructor(ctor) {
  return ctor === String || ctor === Number || ctor === Boolean;
}

},{"./browser-polyfills":2,"./counter":3,"./stringify-array":7,"./stringify-object":8}],10:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);

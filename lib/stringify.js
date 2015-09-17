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

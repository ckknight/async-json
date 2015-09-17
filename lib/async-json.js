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

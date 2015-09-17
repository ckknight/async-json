'use strict';

module.exports = Array.isArray || function isArray(o) {
  // older browsers
  return Object.prototype.toString.call(o) === '[object Array]';
};

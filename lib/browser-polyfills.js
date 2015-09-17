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

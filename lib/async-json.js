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

    var stringify;
    
    var internalStringifyArray = function (array, callback) {
        var len = array.length;
        if (len === 0) {
            callback(null, "[]");
            return;
        }

        var sb = "[";
        var handle = function (i) {
            stringify(array[i], function (err, value) {
                if (err) {
                    callback(err);
                    return;
                }
 
                if (i > 0) {
                    sb += ",";
                }
                
                if (value === undefined) {
                    sb += "null";
                } else {
                    sb += value;
                }

                if (i === len - 1) {
                    sb += "]";
                    callback(null, sb);
                    return;
                } else {
                    handle(i + 1);
                }
            });
        };
        handle(0);
    };
    var internalStringifyObject = function (object, callback) {
        var keys = getKeys(object);
        var len = keys.length;
        if (len === 0) {
            callback(null, "{}");
            return;
        }
        
        var first = true;
        var sb = "{";
        var handle = function (i) {
            var key = keys[i];
            stringify(object[key], function (err, value) {
                if (err) {
                    callback(err);
                    return;
                }
                
                if (value !== undefined) {
                    if (first) {
                        first = false;
                    } else {
                        sb += ",";
                    }
                    
                    sb += jsonStringify(key);
                    sb += ":";
                    sb += value;
                }

                if (i === len - 1) {
                    sb += "}";
                    callback(null, sb);
                    return;
                } else {
                    handle(i + 1);
                }
            });
        };
        handle(0);
    };
    exports.stringify = stringify = function (data, callback) {
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
                    return callback(null, "null");
                } else if (data.constructor === String || data.constructor === Number || data.constructor === Boolean) {
                    // horrible, someone used the new String(), new Number(), or new Boolean() syntax.
                    return stringify(data.valueOf(), callback);
                } else if (isArray(data)) {
                    return internalStringifyArray(data, callback);
                } else {
                    return internalStringifyObject(data, callback);
                }
                break;
            case "function":
                if (data.length === 0) {
                    // assume a sync function that returns a value
                    return stringify(data(), callback);
                } else {
                    // assume an async function that takes a callback
                    return data(function (err, value) {
                        if (err) {
                            callback(err);
                        } else {
                            stringify(value, callback);
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
}(exports || (this.asyncJSON = {})));
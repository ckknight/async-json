/*jshint strict: false */

var assert = require("assert"),
    asyncJSON = require("../index");

// this is used because JSHint yells if you use new String(), and I need that for testing.
var construct = function (Constructor, value) {
    return new Constructor(value);
};

var beforeExitCallbacks = null;

var asyncEquality = function (beforeExit, value, syncValue) {
    var calls = 0;
    var error;
    asyncJSON.stringify(value, function (err, serializedValue) {
        calls += 1;
        error = err;
        if (err || calls > 1) {
            return;
        }
        
        assert.strictEqual(syncValue, serializedValue);
    });
    
    if (!beforeExitCallbacks) {
        beforeExitCallbacks = [];
        beforeExit(function () {
            for (var i = 0; i < beforeExitCallbacks.length; i += 1) {
                beforeExitCallbacks[i].call(this);
            }
        });
    }
    beforeExitCallbacks.push(function () {
        assert.isNull(error);
        assert.equal(1, calls, 'Ensure callback is called');
    });
};

var asyncEqualityToSync = function (beforeExit, value) {
    asyncEquality(beforeExit, value, JSON.stringify(value));
};

module.exports = {
    "string": function (beforeExit) {
        var value = "";
        for (var i = 0; i < 65535; i += 1) {
            value += String.fromCharCode(i);
        }
        
        asyncEqualityToSync(beforeExit, value);
        asyncEqualityToSync(beforeExit, construct(String, value));
    },
    "number": function (beforeExit) {
        for (var i = 0; i < 100; i += 1) {
            asyncEqualityToSync(beforeExit, Math.random());
            asyncEqualityToSync(beforeExit, Math.floor(1000000 * Math.random()));
            asyncEqualityToSync(beforeExit, construct(Number, Math.random()));
            asyncEqualityToSync(beforeExit, construct(Number, Math.floor(1000000 * Math.random())));
        }
        asyncEqualityToSync(beforeExit, 0);
        asyncEqualityToSync(beforeExit, 1);
        asyncEqualityToSync(beforeExit, -1);
        asyncEqualityToSync(beforeExit, Infinity);
        asyncEqualityToSync(beforeExit, -Infinity);
        asyncEqualityToSync(beforeExit, NaN);
    },
    "null": function (beforeExit) {
        asyncEqualityToSync(beforeExit, null);
    },
    "date": function (beforeExit) {
        asyncEqualityToSync(beforeExit, new Date());
    },
    "undefined": function (beforeExit) {
        asyncEqualityToSync(beforeExit, undefined);
    },
    "boolean": function (beforeExit) {
        asyncEqualityToSync(beforeExit, true);
        asyncEqualityToSync(beforeExit, false);
        asyncEqualityToSync(beforeExit, construct(Boolean, true));
        asyncEqualityToSync(beforeExit, construct(Boolean, false));
    },
    "array": function (beforeExit) {
        asyncEqualityToSync(beforeExit, [1, 2, 3, 4, "hey", "there", null, undefined, true, false, [], {}, ["a", ["b", ["c"], "d"], "e"]]);
    },
    "object": function (beforeExit) {
        asyncEqualityToSync(beforeExit, {
            alpha: 1,
            bravo: "hey",
            charlie: null,
            delta: undefined,
            echo: true,
            foxtrot: false,
            golf: [],
            hotel: {},
            india: {
                juliet: "kilo",
                lima: {
                    mike: "november",
                    oscar: {
                        papa: "romeo"
                    }
                }
            }
        });
    },
    "lazy functions": function (beforeExit) {
        asyncEquality(beforeExit, function () {
            return {};
        }, JSON.stringify({}));
        
        asyncEquality(beforeExit, function () {
            return [];
        }, JSON.stringify([]));
        
        asyncEquality(beforeExit, [
            function () {
                return "alpha";
            },
            function () {
                return 1;
            },
            function () {
                return;
            }
        ], JSON.stringify(["alpha", 1, undefined]));
        
        asyncEquality(beforeExit, {
            alpha: function () {
                return {
                    bravo: function () {
                        return {
                            charlie: "delta"
                        };
                    }
                };
            }
        }, JSON.stringify({ alpha: { bravo: { charlie: "delta" } } }));
    },
    "lazy function error handling": function (beforeExit) {
        var error = new Error();
        var calls = 0;
        asyncJSON.stringify(function () {
            throw error;
        }, function (err) {
            calls += 1;
            assert.strictEqual(error, err);
        });
        
        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    },
    "async functions": function (beforeExit) {
        asyncEquality(beforeExit, function (callback) {
            process.nextTick(function () {
                callback(null, {});
            });
        }, JSON.stringify({}));
        
        asyncEquality(beforeExit, function (callback) {
            process.nextTick(function () {
                callback(null, []);
            });
        }, JSON.stringify([]));
        
        asyncEquality(beforeExit, [
            function (callback) {
                process.nextTick(function () {
                    callback(null, "alpha");
                });
            },
        ], JSON.stringify(["alpha"]));
    },
    "async function error handling": function (beforeExit) {
        var error = new Error();
        var calls = 0;
        
        asyncJSON.stringify(function (callback) {
            process.nextTick(function () {
                callback(error);
            });
        }, function (err) {
            calls += 1;
            assert.strictEqual(error, err);
        });
        
        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    }
};
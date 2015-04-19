/*jshint strict: false */

if (process.env.BLUEBIRD) {
    global.Promise = require('bluebird');
}

var assert = require("assert"),
    asyncJSON = require("../index");

// this is used because JSHint yells if you use new String(), and I need that for testing.
var construct = function (Constructor, value) {
    return new Constructor(value);
};

var beforeExitCallbacks = null;

var asyncEqualityNode = function (beforeExit, value, syncValue) {
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

    beforeExit(function () {
        if (error) {
          console.error(error.stack || error);
        }
        assert.isNull(error);
        assert.equal(1, calls, 'Ensure callback is called');
    });
    assert.equal(0, calls, 'Ensure callback is called');
};

var hasPromise = typeof Promise === 'function';
var asyncEqualityPromise = function (beforeExit, value, syncValue) {
    var calls = 0;
    var error;
    asyncJSON.stringify(value).then(function (serializedValue) {
        calls += 1;
        assert.strictEqual(syncValue, serializedValue);
    }).then(null, function (err) {
        error = err;
    });

    beforeExit(function () {
        assert.isUndefined(error);
        assert.equal(1, calls, 'Ensure callback is called');
    });
    assert.equal(0, calls, 'Ensure callback is called');
};

var asyncEquality = function (beforeExit, value, syncValue) {
  asyncEqualityNode(beforeExit, value, syncValue);
  if (hasPromise) {
    asyncEqualityPromise(beforeExit, value, syncValue);
  }
};

function asThenable(value) {
    return {
        then: function (callback) {
            process.nextTick(function () {
                callback(value);
            });
        }
    }
}

function asReject(error) {
    return {
        then: function (_, errback) {
            process.nextTick(function () {
                errback(error);
            });
        }
    }
}

var asyncEqualityToSync = function (beforeExit, value) {
    asyncEquality(beforeExit, value, JSON.stringify(value));
    asyncEquality(beforeExit, asThenable(value), JSON.stringify(value));
};

var range = function (count) {
    var result = [];
    for (var i = 0; i < count; ++i) {
        result.push(i);
    }
    return result;
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
        asyncEqualityToSync(beforeExit, range(10000));
    },
    "array (thenables)": function (beforeExit) {
        asyncEquality(beforeExit, [asThenable(1), asThenable([asThenable(2)])], JSON.stringify([1, [2]]));
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
        var obj = {};
        for (var i = 0; i < 10000; ++i) {
          obj['k' + i] = i;
        }
        asyncEqualityToSync(beforeExit, obj);
    },
    "object (thenables)": function (beforeExit) {
        asyncEquality(beforeExit, {
            a: asThenable({
              b: asThenable({
                c: asThenable('d')
              })
            })
        }, JSON.stringify({
          a: {
            b: {
              c: 'd'
            }
          }
        }));
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
    "lazy functions returning thenables": function (beforeExit) {
        asyncEquality(beforeExit, function () {
            return asThenable({});
        }, JSON.stringify({}));

        asyncEquality(beforeExit, function () {
            return asThenable([]);
        }, JSON.stringify([]));

        asyncEquality(beforeExit, [
            function () {
                return asThenable("alpha");
            },
            function () {
                return asThenable(1);
            },
            function () {
                return asThenable(undefined);
            }
        ], JSON.stringify(["alpha", 1, undefined]));

        asyncEquality(beforeExit, {
            alpha: function () {
                return asThenable({
                    bravo: function () {
                        return asThenable({
                            charlie: "delta"
                        });
                    }
                });
            }
        }, JSON.stringify({ alpha: { bravo: { charlie: "delta" } } }));
    },
    "lazy function error handling": function (beforeExit) {
        var error = new Error();
        var calls = 0;
        asyncJSON.stringify(function () {
            throw error;
        }, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    },
    "lazy functions returning rejecting thenables error handling": function (beforeExit) {
        var error = new Error();
        var calls = 0;
        asyncJSON.stringify(function () {
            return asReject(error);
        }, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    },
    "lazy function error handling (promise)": hasPromise ? function (beforeExit) {
        var error = new Error();
        var calls = 0;
        asyncJSON.stringify(function () {
            throw error;
        }).then(null, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    } : null,
    "lazy function returning rejecting thenables error handling (promise)": hasPromise ? function (beforeExit) {
        var error = new Error();
        var calls = 0;
        asyncJSON.stringify(function () {
            return asReject(error);
        }).then(null, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    } : null,
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
    "async functions with thenables": function (beforeExit) {
        asyncEquality(beforeExit, function (callback) {
            process.nextTick(function () {
                callback(null, asThenable({}));
            });
        }, JSON.stringify({}));

        asyncEquality(beforeExit, function (callback) {
            process.nextTick(function () {
                callback(null, asThenable([]));
            });
        }, JSON.stringify([]));

        asyncEquality(beforeExit, [
            function (callback) {
                process.nextTick(function () {
                    callback(null, asThenable("alpha"));
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
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    },
    "async function with thenable error handling": function (beforeExit) {
        var error = new Error();
        var calls = 0;

        asyncJSON.stringify(function (callback) {
            process.nextTick(function () {
                callback(null, asReject(error));
            });
        }, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    },
    "async function error handling (promise)": hasPromise ? function (beforeExit) {
        var error = new Error();
        var calls = 0;

        asyncJSON.stringify(function (callback) {
            process.nextTick(function () {
                callback(error);
            });
        }).then(null, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    } : null,
    "async function error handling with thenable (promise)": hasPromise ? function (beforeExit) {
        var error = new Error();
        var calls = 0;

        asyncJSON.stringify(function (callback) {
            process.nextTick(function () {
                callback(null, asReject(error));
            });
        }).then(null, function (err) {
            assert.strictEqual(error, err);
            calls += 1;
        });

        beforeExit(function () {
            assert.strictEqual(1, calls);
        });
    } : null
};
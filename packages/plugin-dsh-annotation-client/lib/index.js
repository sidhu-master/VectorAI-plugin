var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var _lines;
var jsxRuntime = { exports: {} };
var reactJsxRuntime_production_min = {};
var react = { exports: {} };
var react_production_min = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReact_production_min;
function requireReact_production_min() {
  if (hasRequiredReact_production_min) return react_production_min;
  hasRequiredReact_production_min = 1;
  var l = Symbol.for("react.element"), n = Symbol.for("react.portal"), p = Symbol.for("react.fragment"), q = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), t = Symbol.for("react.provider"), u = Symbol.for("react.context"), v = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), z = Symbol.iterator;
  function A(a) {
    if (null === a || "object" !== typeof a) return null;
    a = z && a[z] || a["@@iterator"];
    return "function" === typeof a ? a : null;
  }
  var B = { isMounted: function() {
    return false;
  }, enqueueForceUpdate: function() {
  }, enqueueReplaceState: function() {
  }, enqueueSetState: function() {
  } }, C = Object.assign, D = {};
  function E(a, b, e) {
    this.props = a;
    this.context = b;
    this.refs = D;
    this.updater = e || B;
  }
  E.prototype.isReactComponent = {};
  E.prototype.setState = function(a, b) {
    if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
    this.updater.enqueueSetState(this, a, b, "setState");
  };
  E.prototype.forceUpdate = function(a) {
    this.updater.enqueueForceUpdate(this, a, "forceUpdate");
  };
  function F() {
  }
  F.prototype = E.prototype;
  function G(a, b, e) {
    this.props = a;
    this.context = b;
    this.refs = D;
    this.updater = e || B;
  }
  var H = G.prototype = new F();
  H.constructor = G;
  C(H, E.prototype);
  H.isPureReactComponent = true;
  var I = Array.isArray, J = Object.prototype.hasOwnProperty, K = { current: null }, L = { key: true, ref: true, __self: true, __source: true };
  function M(a, b, e) {
    var d, c = {}, k = null, h = null;
    if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
    var g = arguments.length - 2;
    if (1 === g) c.children = e;
    else if (1 < g) {
      for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
      c.children = f;
    }
    if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
    return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
  }
  function N(a, b) {
    return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
  }
  function O(a) {
    return "object" === typeof a && null !== a && a.$$typeof === l;
  }
  function escape(a) {
    var b = { "=": "=0", ":": "=2" };
    return "$" + a.replace(/[=:]/g, function(a2) {
      return b[a2];
    });
  }
  var P = /\/+/g;
  function Q(a, b) {
    return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
  }
  function R(a, b, e, d, c) {
    var k = typeof a;
    if ("undefined" === k || "boolean" === k) a = null;
    var h = false;
    if (null === a) h = true;
    else switch (k) {
      case "string":
      case "number":
        h = true;
        break;
      case "object":
        switch (a.$$typeof) {
          case l:
          case n:
            h = true;
        }
    }
    if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
      return a2;
    })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
    h = 0;
    d = "" === d ? "." : d + ":";
    if (I(a)) for (var g = 0; g < a.length; g++) {
      k = a[g];
      var f = d + Q(k, g);
      h += R(k, b, e, f, c);
    }
    else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
    else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
    return h;
  }
  function S(a, b, e) {
    if (null == a) return a;
    var d = [], c = 0;
    R(a, d, "", "", function(a2) {
      return b.call(e, a2, c++);
    });
    return d;
  }
  function T(a) {
    if (-1 === a._status) {
      var b = a._result;
      b = b();
      b.then(function(b2) {
        if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
      }, function(b2) {
        if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
      });
      -1 === a._status && (a._status = 0, a._result = b);
    }
    if (1 === a._status) return a._result.default;
    throw a._result;
  }
  var U = { current: null }, V = { transition: null }, W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
  function X2() {
    throw Error("act(...) is not supported in production builds of React.");
  }
  react_production_min.Children = { map: S, forEach: function(a, b, e) {
    S(a, function() {
      b.apply(this, arguments);
    }, e);
  }, count: function(a) {
    var b = 0;
    S(a, function() {
      b++;
    });
    return b;
  }, toArray: function(a) {
    return S(a, function(a2) {
      return a2;
    }) || [];
  }, only: function(a) {
    if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
    return a;
  } };
  react_production_min.Component = E;
  react_production_min.Fragment = p;
  react_production_min.Profiler = r;
  react_production_min.PureComponent = G;
  react_production_min.StrictMode = q;
  react_production_min.Suspense = w;
  react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
  react_production_min.act = X2;
  react_production_min.cloneElement = function(a, b, e) {
    if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
    var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
    if (null != b) {
      void 0 !== b.ref && (k = b.ref, h = K.current);
      void 0 !== b.key && (c = "" + b.key);
      if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
      for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
    }
    var f = arguments.length - 2;
    if (1 === f) d.children = e;
    else if (1 < f) {
      g = Array(f);
      for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
      d.children = g;
    }
    return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
  };
  react_production_min.createContext = function(a) {
    a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
    a.Provider = { $$typeof: t, _context: a };
    return a.Consumer = a;
  };
  react_production_min.createElement = M;
  react_production_min.createFactory = function(a) {
    var b = M.bind(null, a);
    b.type = a;
    return b;
  };
  react_production_min.createRef = function() {
    return { current: null };
  };
  react_production_min.forwardRef = function(a) {
    return { $$typeof: v, render: a };
  };
  react_production_min.isValidElement = O;
  react_production_min.lazy = function(a) {
    return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
  };
  react_production_min.memo = function(a, b) {
    return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
  };
  react_production_min.startTransition = function(a) {
    var b = V.transition;
    V.transition = {};
    try {
      a();
    } finally {
      V.transition = b;
    }
  };
  react_production_min.unstable_act = X2;
  react_production_min.useCallback = function(a, b) {
    return U.current.useCallback(a, b);
  };
  react_production_min.useContext = function(a) {
    return U.current.useContext(a);
  };
  react_production_min.useDebugValue = function() {
  };
  react_production_min.useDeferredValue = function(a) {
    return U.current.useDeferredValue(a);
  };
  react_production_min.useEffect = function(a, b) {
    return U.current.useEffect(a, b);
  };
  react_production_min.useId = function() {
    return U.current.useId();
  };
  react_production_min.useImperativeHandle = function(a, b, e) {
    return U.current.useImperativeHandle(a, b, e);
  };
  react_production_min.useInsertionEffect = function(a, b) {
    return U.current.useInsertionEffect(a, b);
  };
  react_production_min.useLayoutEffect = function(a, b) {
    return U.current.useLayoutEffect(a, b);
  };
  react_production_min.useMemo = function(a, b) {
    return U.current.useMemo(a, b);
  };
  react_production_min.useReducer = function(a, b, e) {
    return U.current.useReducer(a, b, e);
  };
  react_production_min.useRef = function(a) {
    return U.current.useRef(a);
  };
  react_production_min.useState = function(a) {
    return U.current.useState(a);
  };
  react_production_min.useSyncExternalStore = function(a, b, e) {
    return U.current.useSyncExternalStore(a, b, e);
  };
  react_production_min.useTransition = function() {
    return U.current.useTransition();
  };
  react_production_min.version = "18.3.1";
  return react_production_min;
}
var react_development = { exports: {} };
/**
 * @license React
 * react.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
react_development.exports;
var hasRequiredReact_development;
function requireReact_development() {
  if (hasRequiredReact_development) return react_development.exports;
  hasRequiredReact_development = 1;
  (function(module, exports) {
    if (process.env.NODE_ENV !== "production") {
      (function() {
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: function(publicInstance) {
            return false;
          },
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          },
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          },
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }
            });
          };
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        function getContextName(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config2) {
          {
            if (hasOwnProperty.call(config2, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.ref !== void 0;
        }
        function hasValidKey(config2) {
          {
            if (hasOwnProperty.call(config2, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.key !== void 0;
        }
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        function warnIfStringRefCannotBeAutoConverted(config2) {
          {
            if (typeof config2.ref === "string" && ReactCurrentOwner.current && config2.__self && ReactCurrentOwner.current.stateNode !== config2.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config2.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        var ReactElement = function(type, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        };
        function createElement(type, config2, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self = null;
          var source = null;
          if (config2 != null) {
            if (hasValidRef(config2)) {
              ref = config2.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config2);
              }
            }
            if (hasValidKey(config2)) {
              {
                checkKeyStringCoercion(config2.key);
              }
              key = "" + config2.key;
            }
            self = config2.__self === void 0 ? null : config2.__self;
            source = config2.__source === void 0 ? null : config2.__source;
            for (propName in config2) {
              if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config2[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
        }
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        function cloneElement(element, config2, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config2 != null) {
            if (hasValidRef(config2)) {
              ref = config2.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config2)) {
              {
                checkKeyStringCoercion(config2.key);
              }
              key = "" + config2.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config2) {
              if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config2[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config2[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self, source, owner, props);
        }
        function isValidElement(object2) {
          return typeof object2 === "object" && object2 !== null && object2.$$typeof === REACT_ELEMENT_TYPE;
        }
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex2 = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex2, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text) {
          return text.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        function getElementKey(element, index) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index.toString(36);
        }
        function mapIntoArray(children, array2, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array2, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array2.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child = children[i];
              nextName = nextNamePrefix + getElementKey(child, i);
              subtreeCount += mapIntoArray(child, array2, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array2, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        function toArray(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                },
                set: function(_Provider) {
                  context.Provider = _Provider;
                }
              },
              _currentValue: {
                get: function() {
                  return context._currentValue;
                },
                set: function(_currentValue) {
                  context._currentValue = _currentValue;
                }
              },
              _currentValue2: {
                get: function() {
                  return context._currentValue2;
                },
                set: function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }
              },
              _threadCount: {
                get: function() {
                  return context._threadCount;
                },
                set: function(_threadCount) {
                  context._threadCount = _threadCount;
                }
              },
              Consumer: {
                get: function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }
              },
              displayName: {
                get: function() {
                  return context.displayName;
                },
                set: function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: function() {
                  return defaultProps;
                },
                set: function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }
              },
              propTypes: {
                configurable: true,
                get: function() {
                  return propTypes;
                },
                set: function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }
              }
            });
          }
          return lazyType;
        }
        function forwardRef(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        function useEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create, deps);
        }
        function useInsertionEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create, deps);
        }
        function useLayoutEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create, deps);
        }
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        function useMemo(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create, deps);
        }
        function useImperativeHandle(ref, create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create, deps);
        }
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                c--;
              }
              for (; s >= 1 && c >= 0; s--, c--) {
                if (sampleLines[s] !== controlLines[c]) {
                  if (s !== 1 || c !== 1) {
                    do {
                      s--;
                      c--;
                      if (c < 0 || sampleLines[s] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        function validateChildKeys(node, parentType) {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }
            });
          }
          return validatedFactory;
        }
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              };
            }
          }
          return enqueueTaskImpl(task);
        }
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: function(resolve, reject) {
                    resolve(returnValue);
                  }
                };
                return _thenable2;
              }
            }
          }
        }
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  })(react_development, react_development.exports);
  return react_development.exports;
}
var hasRequiredReact;
function requireReact() {
  if (hasRequiredReact) return react.exports;
  hasRequiredReact = 1;
  if (process.env.NODE_ENV === "production") {
    react.exports = requireReact_production_min();
  } else {
    react.exports = requireReact_development();
  }
  return react.exports;
}
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactJsxRuntime_production_min;
function requireReactJsxRuntime_production_min() {
  if (hasRequiredReactJsxRuntime_production_min) return reactJsxRuntime_production_min;
  hasRequiredReactJsxRuntime_production_min = 1;
  var f = requireReact(), k = Symbol.for("react.element"), l = Symbol.for("react.fragment"), m = Object.prototype.hasOwnProperty, n = f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p = { key: true, ref: true, __self: true, __source: true };
  function q(c, a, g) {
    var b, d = {}, e = null, h = null;
    void 0 !== g && (e = "" + g);
    void 0 !== a.key && (e = "" + a.key);
    void 0 !== a.ref && (h = a.ref);
    for (b in a) m.call(a, b) && !p.hasOwnProperty(b) && (d[b] = a[b]);
    if (c && c.defaultProps) for (b in a = c.defaultProps, a) void 0 === d[b] && (d[b] = a[b]);
    return { $$typeof: k, type: c, key: e, ref: h, props: d, _owner: n.current };
  }
  reactJsxRuntime_production_min.Fragment = l;
  reactJsxRuntime_production_min.jsx = q;
  reactJsxRuntime_production_min.jsxs = q;
  return reactJsxRuntime_production_min;
}
var reactJsxRuntime_development = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactJsxRuntime_development;
function requireReactJsxRuntime_development() {
  if (hasRequiredReactJsxRuntime_development) return reactJsxRuntime_development;
  hasRequiredReactJsxRuntime_development = 1;
  if (process.env.NODE_ENV !== "production") {
    (function() {
      var React = requireReact();
      var REACT_ELEMENT_TYPE = Symbol.for("react.element");
      var REACT_PORTAL_TYPE = Symbol.for("react.portal");
      var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
      var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
      var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
      var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
      var REACT_CONTEXT_TYPE = Symbol.for("react.context");
      var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
      var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
      var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
      var REACT_MEMO_TYPE = Symbol.for("react.memo");
      var REACT_LAZY_TYPE = Symbol.for("react.lazy");
      var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
      var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
      var FAUX_ITERATOR_SYMBOL = "@@iterator";
      function getIteratorFn(maybeIterable) {
        if (maybeIterable === null || typeof maybeIterable !== "object") {
          return null;
        }
        var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
        if (typeof maybeIterator === "function") {
          return maybeIterator;
        }
        return null;
      }
      var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
      function error(format) {
        {
          {
            for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
              args[_key2 - 1] = arguments[_key2];
            }
            printWarning("error", format, args);
          }
        }
      }
      function printWarning(level, format, args) {
        {
          var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
          var stack = ReactDebugCurrentFrame2.getStackAddendum();
          if (stack !== "") {
            format += "%s";
            args = args.concat([stack]);
          }
          var argsWithFormat = args.map(function(item) {
            return String(item);
          });
          argsWithFormat.unshift("Warning: " + format);
          Function.prototype.apply.call(console[level], console, argsWithFormat);
        }
      }
      var enableScopeAPI = false;
      var enableCacheElement = false;
      var enableTransitionTracing = false;
      var enableLegacyHidden = false;
      var enableDebugTracing = false;
      var REACT_MODULE_REFERENCE;
      {
        REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
      }
      function isValidElementType(type) {
        if (typeof type === "string" || typeof type === "function") {
          return true;
        }
        if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
          return true;
        }
        if (typeof type === "object" && type !== null) {
          if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
          // types supported by any Flight configuration anywhere since
          // we don't know which Flight build this will end up being used
          // with.
          type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
            return true;
          }
        }
        return false;
      }
      function getWrappedName(outerType, innerType, wrapperName) {
        var displayName = outerType.displayName;
        if (displayName) {
          return displayName;
        }
        var functionName = innerType.displayName || innerType.name || "";
        return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
      }
      function getContextName(type) {
        return type.displayName || "Context";
      }
      function getComponentNameFromType(type) {
        if (type == null) {
          return null;
        }
        {
          if (typeof type.tag === "number") {
            error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
          }
        }
        if (typeof type === "function") {
          return type.displayName || type.name || null;
        }
        if (typeof type === "string") {
          return type;
        }
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PORTAL_TYPE:
            return "Portal";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
        }
        if (typeof type === "object") {
          switch (type.$$typeof) {
            case REACT_CONTEXT_TYPE:
              var context = type;
              return getContextName(context) + ".Consumer";
            case REACT_PROVIDER_TYPE:
              var provider = type;
              return getContextName(provider._context) + ".Provider";
            case REACT_FORWARD_REF_TYPE:
              return getWrappedName(type, type.render, "ForwardRef");
            case REACT_MEMO_TYPE:
              var outerName = type.displayName || null;
              if (outerName !== null) {
                return outerName;
              }
              return getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE: {
              var lazyComponent = type;
              var payload = lazyComponent._payload;
              var init = lazyComponent._init;
              try {
                return getComponentNameFromType(init(payload));
              } catch (x) {
                return null;
              }
            }
          }
        }
        return null;
      }
      var assign = Object.assign;
      var disabledDepth = 0;
      var prevLog;
      var prevInfo;
      var prevWarn;
      var prevError;
      var prevGroup;
      var prevGroupCollapsed;
      var prevGroupEnd;
      function disabledLog() {
      }
      disabledLog.__reactDisabledLog = true;
      function disableLogs() {
        {
          if (disabledDepth === 0) {
            prevLog = console.log;
            prevInfo = console.info;
            prevWarn = console.warn;
            prevError = console.error;
            prevGroup = console.group;
            prevGroupCollapsed = console.groupCollapsed;
            prevGroupEnd = console.groupEnd;
            var props = {
              configurable: true,
              enumerable: true,
              value: disabledLog,
              writable: true
            };
            Object.defineProperties(console, {
              info: props,
              log: props,
              warn: props,
              error: props,
              group: props,
              groupCollapsed: props,
              groupEnd: props
            });
          }
          disabledDepth++;
        }
      }
      function reenableLogs() {
        {
          disabledDepth--;
          if (disabledDepth === 0) {
            var props = {
              configurable: true,
              enumerable: true,
              writable: true
            };
            Object.defineProperties(console, {
              log: assign({}, props, {
                value: prevLog
              }),
              info: assign({}, props, {
                value: prevInfo
              }),
              warn: assign({}, props, {
                value: prevWarn
              }),
              error: assign({}, props, {
                value: prevError
              }),
              group: assign({}, props, {
                value: prevGroup
              }),
              groupCollapsed: assign({}, props, {
                value: prevGroupCollapsed
              }),
              groupEnd: assign({}, props, {
                value: prevGroupEnd
              })
            });
          }
          if (disabledDepth < 0) {
            error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
          }
        }
      }
      var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
      var prefix;
      function describeBuiltInComponentFrame(name, source, ownerFn) {
        {
          if (prefix === void 0) {
            try {
              throw Error();
            } catch (x) {
              var match = x.stack.trim().match(/\n( *(at )?)/);
              prefix = match && match[1] || "";
            }
          }
          return "\n" + prefix + name;
        }
      }
      var reentry = false;
      var componentFrameCache;
      {
        var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
        componentFrameCache = new PossiblyWeakMap();
      }
      function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) {
          return "";
        }
        {
          var frame = componentFrameCache.get(fn);
          if (frame !== void 0) {
            return frame;
          }
        }
        var control;
        reentry = true;
        var previousPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        var previousDispatcher;
        {
          previousDispatcher = ReactCurrentDispatcher.current;
          ReactCurrentDispatcher.current = null;
          disableLogs();
        }
        try {
          if (construct) {
            var Fake = function() {
              throw Error();
            };
            Object.defineProperty(Fake.prototype, "props", {
              set: function() {
                throw Error();
              }
            });
            if (typeof Reflect === "object" && Reflect.construct) {
              try {
                Reflect.construct(Fake, []);
              } catch (x) {
                control = x;
              }
              Reflect.construct(fn, [], Fake);
            } else {
              try {
                Fake.call();
              } catch (x) {
                control = x;
              }
              fn.call(Fake.prototype);
            }
          } else {
            try {
              throw Error();
            } catch (x) {
              control = x;
            }
            fn();
          }
        } catch (sample) {
          if (sample && control && typeof sample.stack === "string") {
            var sampleLines = sample.stack.split("\n");
            var controlLines = control.stack.split("\n");
            var s = sampleLines.length - 1;
            var c = controlLines.length - 1;
            while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
              c--;
            }
            for (; s >= 1 && c >= 0; s--, c--) {
              if (sampleLines[s] !== controlLines[c]) {
                if (s !== 1 || c !== 1) {
                  do {
                    s--;
                    c--;
                    if (c < 0 || sampleLines[s] !== controlLines[c]) {
                      var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                      if (fn.displayName && _frame.includes("<anonymous>")) {
                        _frame = _frame.replace("<anonymous>", fn.displayName);
                      }
                      {
                        if (typeof fn === "function") {
                          componentFrameCache.set(fn, _frame);
                        }
                      }
                      return _frame;
                    }
                  } while (s >= 1 && c >= 0);
                }
                break;
              }
            }
          }
        } finally {
          reentry = false;
          {
            ReactCurrentDispatcher.current = previousDispatcher;
            reenableLogs();
          }
          Error.prepareStackTrace = previousPrepareStackTrace;
        }
        var name = fn ? fn.displayName || fn.name : "";
        var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
        {
          if (typeof fn === "function") {
            componentFrameCache.set(fn, syntheticFrame);
          }
        }
        return syntheticFrame;
      }
      function describeFunctionComponentFrame(fn, source, ownerFn) {
        {
          return describeNativeComponentFrame(fn, false);
        }
      }
      function shouldConstruct(Component) {
        var prototype = Component.prototype;
        return !!(prototype && prototype.isReactComponent);
      }
      function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
        if (type == null) {
          return "";
        }
        if (typeof type === "function") {
          {
            return describeNativeComponentFrame(type, shouldConstruct(type));
          }
        }
        if (typeof type === "string") {
          return describeBuiltInComponentFrame(type);
        }
        switch (type) {
          case REACT_SUSPENSE_TYPE:
            return describeBuiltInComponentFrame("Suspense");
          case REACT_SUSPENSE_LIST_TYPE:
            return describeBuiltInComponentFrame("SuspenseList");
        }
        if (typeof type === "object") {
          switch (type.$$typeof) {
            case REACT_FORWARD_REF_TYPE:
              return describeFunctionComponentFrame(type.render);
            case REACT_MEMO_TYPE:
              return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
            case REACT_LAZY_TYPE: {
              var lazyComponent = type;
              var payload = lazyComponent._payload;
              var init = lazyComponent._init;
              try {
                return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
              } catch (x) {
              }
            }
          }
        }
        return "";
      }
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var loggedTypeFailures = {};
      var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
      function setCurrentlyValidatingElement(element) {
        {
          if (element) {
            var owner = element._owner;
            var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
            ReactDebugCurrentFrame.setExtraStackFrame(stack);
          } else {
            ReactDebugCurrentFrame.setExtraStackFrame(null);
          }
        }
      }
      function checkPropTypes(typeSpecs, values, location, componentName, element) {
        {
          var has = Function.call.bind(hasOwnProperty);
          for (var typeSpecName in typeSpecs) {
            if (has(typeSpecs, typeSpecName)) {
              var error$1 = void 0;
              try {
                if (typeof typeSpecs[typeSpecName] !== "function") {
                  var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                  err.name = "Invariant Violation";
                  throw err;
                }
                error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
              } catch (ex) {
                error$1 = ex;
              }
              if (error$1 && !(error$1 instanceof Error)) {
                setCurrentlyValidatingElement(element);
                error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                setCurrentlyValidatingElement(null);
              }
              if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                loggedTypeFailures[error$1.message] = true;
                setCurrentlyValidatingElement(element);
                error("Failed %s type: %s", location, error$1.message);
                setCurrentlyValidatingElement(null);
              }
            }
          }
        }
      }
      var isArrayImpl = Array.isArray;
      function isArray(a) {
        return isArrayImpl(a);
      }
      function typeName(value) {
        {
          var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
          var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          return type;
        }
      }
      function willCoercionThrow(value) {
        {
          try {
            testStringCoercion(value);
            return false;
          } catch (e) {
            return true;
          }
        }
      }
      function testStringCoercion(value) {
        return "" + value;
      }
      function checkKeyStringCoercion(value) {
        {
          if (willCoercionThrow(value)) {
            error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
            return testStringCoercion(value);
          }
        }
      }
      var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
      var RESERVED_PROPS = {
        key: true,
        ref: true,
        __self: true,
        __source: true
      };
      var specialPropKeyWarningShown;
      var specialPropRefWarningShown;
      function hasValidRef(config2) {
        {
          if (hasOwnProperty.call(config2, "ref")) {
            var getter = Object.getOwnPropertyDescriptor(config2, "ref").get;
            if (getter && getter.isReactWarning) {
              return false;
            }
          }
        }
        return config2.ref !== void 0;
      }
      function hasValidKey(config2) {
        {
          if (hasOwnProperty.call(config2, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config2, "key").get;
            if (getter && getter.isReactWarning) {
              return false;
            }
          }
        }
        return config2.key !== void 0;
      }
      function warnIfStringRefCannotBeAutoConverted(config2, self) {
        {
          if (typeof config2.ref === "string" && ReactCurrentOwner.current && self) ;
        }
      }
      function defineKeyPropWarningGetter(props, displayName) {
        {
          var warnAboutAccessingKey = function() {
            if (!specialPropKeyWarningShown) {
              specialPropKeyWarningShown = true;
              error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
            }
          };
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
      }
      function defineRefPropWarningGetter(props, displayName) {
        {
          var warnAboutAccessingRef = function() {
            if (!specialPropRefWarningShown) {
              specialPropRefWarningShown = true;
              error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
            }
          };
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
      }
      var ReactElement = function(type, key, ref, self, source, owner, props) {
        var element = {
          // This tag allows us to uniquely identify this as a React Element
          $$typeof: REACT_ELEMENT_TYPE,
          // Built-in properties that belong on the element
          type,
          key,
          ref,
          props,
          // Record the component responsible for creating this element.
          _owner: owner
        };
        {
          element._store = {};
          Object.defineProperty(element._store, "validated", {
            configurable: false,
            enumerable: false,
            writable: true,
            value: false
          });
          Object.defineProperty(element, "_self", {
            configurable: false,
            enumerable: false,
            writable: false,
            value: self
          });
          Object.defineProperty(element, "_source", {
            configurable: false,
            enumerable: false,
            writable: false,
            value: source
          });
          if (Object.freeze) {
            Object.freeze(element.props);
            Object.freeze(element);
          }
        }
        return element;
      };
      function jsxDEV(type, config2, maybeKey, source, self) {
        {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          if (maybeKey !== void 0) {
            {
              checkKeyStringCoercion(maybeKey);
            }
            key = "" + maybeKey;
          }
          if (hasValidKey(config2)) {
            {
              checkKeyStringCoercion(config2.key);
            }
            key = "" + config2.key;
          }
          if (hasValidRef(config2)) {
            ref = config2.ref;
            warnIfStringRefCannotBeAutoConverted(config2, self);
          }
          for (propName in config2) {
            if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
              props[propName] = config2[propName];
            }
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          if (key || ref) {
            var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
            if (key) {
              defineKeyPropWarningGetter(props, displayName);
            }
            if (ref) {
              defineRefPropWarningGetter(props, displayName);
            }
          }
          return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
        }
      }
      var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
      var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
      function setCurrentlyValidatingElement$1(element) {
        {
          if (element) {
            var owner = element._owner;
            var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
            ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
          } else {
            ReactDebugCurrentFrame$1.setExtraStackFrame(null);
          }
        }
      }
      var propTypesMisspellWarningShown;
      {
        propTypesMisspellWarningShown = false;
      }
      function isValidElement(object2) {
        {
          return typeof object2 === "object" && object2 !== null && object2.$$typeof === REACT_ELEMENT_TYPE;
        }
      }
      function getDeclarationErrorAddendum() {
        {
          if (ReactCurrentOwner$1.current) {
            var name = getComponentNameFromType(ReactCurrentOwner$1.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
      }
      function getSourceInfoErrorAddendum(source) {
        {
          return "";
        }
      }
      var ownerHasKeyUseWarning = {};
      function getCurrentComponentErrorInfo(parentType) {
        {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
      }
      function validateExplicitKey(element, parentType) {
        {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner$1.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          setCurrentlyValidatingElement$1(element);
          error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
          setCurrentlyValidatingElement$1(null);
        }
      }
      function validateChildKeys(node, parentType) {
        {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
      }
      function validatePropTypes(element) {
        {
          var type = element.type;
          if (type === null || type === void 0 || typeof type === "string") {
            return;
          }
          var propTypes;
          if (typeof type === "function") {
            propTypes = type.propTypes;
          } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
          // Inner props are checked in the reconciler.
          type.$$typeof === REACT_MEMO_TYPE)) {
            propTypes = type.propTypes;
          } else {
            return;
          }
          if (propTypes) {
            var name = getComponentNameFromType(type);
            checkPropTypes(propTypes, element.props, "prop", name, element);
          } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
            propTypesMisspellWarningShown = true;
            var _name = getComponentNameFromType(type);
            error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
          }
          if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
            error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
          }
        }
      }
      function validateFragmentProps(fragment) {
        {
          var keys = Object.keys(fragment.props);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (key !== "children" && key !== "key") {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
              setCurrentlyValidatingElement$1(null);
              break;
            }
          }
          if (fragment.ref !== null) {
            setCurrentlyValidatingElement$1(fragment);
            error("Invalid attribute `ref` supplied to `React.Fragment`.");
            setCurrentlyValidatingElement$1(null);
          }
        }
      }
      var didWarnAboutKeySpread = {};
      function jsxWithValidation(type, props, key, isStaticChildren, source, self) {
        {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendum();
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            error("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
          }
          var element = jsxDEV(type, props, key, source, self);
          if (element == null) {
            return element;
          }
          if (validType) {
            var children = props.children;
            if (children !== void 0) {
              if (isStaticChildren) {
                if (isArray(children)) {
                  for (var i = 0; i < children.length; i++) {
                    validateChildKeys(children[i], type);
                  }
                  if (Object.freeze) {
                    Object.freeze(children);
                  }
                } else {
                  error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
                }
              } else {
                validateChildKeys(children, type);
              }
            }
          }
          {
            if (hasOwnProperty.call(props, "key")) {
              var componentName = getComponentNameFromType(type);
              var keys = Object.keys(props).filter(function(k) {
                return k !== "key";
              });
              var beforeExample = keys.length > 0 ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
              if (!didWarnAboutKeySpread[componentName + beforeExample]) {
                var afterExample = keys.length > 0 ? "{" + keys.join(": ..., ") + ": ...}" : "{}";
                error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', beforeExample, componentName, afterExample, componentName);
                didWarnAboutKeySpread[componentName + beforeExample] = true;
              }
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
      }
      function jsxWithValidationStatic(type, props, key) {
        {
          return jsxWithValidation(type, props, key, true);
        }
      }
      function jsxWithValidationDynamic(type, props, key) {
        {
          return jsxWithValidation(type, props, key, false);
        }
      }
      var jsx = jsxWithValidationDynamic;
      var jsxs = jsxWithValidationStatic;
      reactJsxRuntime_development.Fragment = REACT_FRAGMENT_TYPE;
      reactJsxRuntime_development.jsx = jsx;
      reactJsxRuntime_development.jsxs = jsxs;
    })();
  }
  return reactJsxRuntime_development;
}
var hasRequiredJsxRuntime;
function requireJsxRuntime() {
  if (hasRequiredJsxRuntime) return jsxRuntime.exports;
  hasRequiredJsxRuntime = 1;
  if (process.env.NODE_ENV === "production") {
    jsxRuntime.exports = requireReactJsxRuntime_production_min();
  } else {
    jsxRuntime.exports = requireReactJsxRuntime_development();
  }
  return jsxRuntime.exports;
}
var jsxRuntimeExports = requireJsxRuntime();
function evaluateHomogeneous(node, normalized2) {
  const pointCount = node.controlPoints.length;
  const lastControlIndex = pointCount - 1;
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[lastControlIndex + 1];
  const knotParameter = normalized2 === 1 ? domainEnd : domainStart + normalized2 * (domainEnd - domainStart);
  const span = normalized2 === 1 ? lastControlIndex : findSpan(node.knots, node.degree, lastControlIndex, knotParameter);
  const weights = node.weights ?? Array.from({ length: pointCount }, () => 1);
  const work = [];
  for (let index = 0; index <= node.degree; index += 1) {
    const sourceIndex = span - node.degree + index;
    const weight = weights[sourceIndex];
    const point3 = node.controlPoints[sourceIndex];
    work.push([point3[0] * weight, point3[1] * weight, weight]);
  }
  for (let level = 1; level <= node.degree; level += 1) {
    for (let index = node.degree; index >= level; index -= 1) {
      const knotIndex = span - node.degree + index;
      const denominator = node.knots[knotIndex + node.degree - level + 1] - node.knots[knotIndex];
      const alpha = denominator === 0 ? 0 : (knotParameter - node.knots[knotIndex]) / denominator;
      work[index] = mixHomogeneous(work[index - 1], work[index], alpha);
    }
  }
  return work[node.degree];
}
function sampleSpline(node, { maxError, maxDepth = 12 }) {
  if (!(Number.isFinite(maxError) && maxError > 0)) {
    throw new TypeError("SPLINE_MAX_ERROR_INVALID");
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 24) {
    throw new TypeError("SPLINE_MAX_DEPTH_INVALID");
  }
  validateSpline(node);
  const first = project(evaluateHomogeneous(node, 0));
  const output = [first];
  const spans = normalizedKnotSpans(node);
  for (let index = 1; index < spans.length; index += 1) {
    const controls = extractBezierControls(node, spans[index - 1], spans[index]);
    subdivideBezier(controls, 0, maxDepth, maxError, output);
  }
  if (node.closed && !samePoint(output[0], output.at(-1))) output.push(output[0]);
  return output;
}
function normalizedKnotSpans(node) {
  const start = node.knots[node.degree];
  const end = node.knots[node.controlPoints.length];
  return node.knots.slice(node.degree, node.controlPoints.length + 1).map((value) => (value - start) / (end - start)).filter((value, index, values) => index === 0 || value > values[index - 1]);
}
function splineBounds(node) {
  validateSpline(node);
  const controlMinX = Math.min(...node.controlPoints.map(([x]) => x));
  const controlMaxX = Math.max(...node.controlPoints.map(([x]) => x));
  const controlMinY = Math.min(...node.controlPoints.map(([, y]) => y));
  const controlMaxY = Math.max(...node.controlPoints.map(([, y]) => y));
  const span = Math.max(controlMaxX - controlMinX, controlMaxY - controlMinY, 1);
  const points = sampleSpline(node, { maxError: Math.max(span * 1e-6, 1e-8), maxDepth: 18 });
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function validateSpline(node) {
  if (!Number.isInteger(node.degree) || node.degree < 1) {
    throw new TypeError("SPLINE_DEGREE_INVALID");
  }
  if (node.controlPoints.length <= node.degree) {
    throw new TypeError("SPLINE_CONTROL_POINT_COUNT_INVALID");
  }
  if (node.controlPoints.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new TypeError("SPLINE_CONTROL_POINT_INVALID");
  }
  const expectedKnots = node.controlPoints.length + node.degree + 1;
  if (node.knots.length !== expectedKnots) {
    throw new TypeError("SPLINE_KNOT_COUNT_INVALID");
  }
  if (node.knots.some((value, index) => !Number.isFinite(value) || index > 0 && value < node.knots[index - 1])) {
    throw new TypeError("SPLINE_KNOT_SEQUENCE_INVALID");
  }
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[node.controlPoints.length];
  if (!(domainEnd > domainStart)) throw new TypeError("SPLINE_KNOT_DOMAIN_INVALID");
  if (node.weights !== void 0 && (node.weights.length !== node.controlPoints.length || node.weights.some((weight) => !Number.isFinite(weight) || weight <= 0))) {
    throw new TypeError("SPLINE_WEIGHTS_INVALID");
  }
}
function findSpan(knots, degree, lastControlIndex, value) {
  let low = degree;
  let high = lastControlIndex + 1;
  let middle = Math.floor((low + high) / 2);
  while (value < knots[middle] || value >= knots[middle + 1]) {
    if (value < knots[middle]) high = middle;
    else low = middle;
    middle = Math.floor((low + high) / 2);
  }
  return middle;
}
function mixHomogeneous(first, second, alpha) {
  return [
    first[0] * (1 - alpha) + second[0] * alpha,
    first[1] * (1 - alpha) + second[1] * alpha,
    first[2] * (1 - alpha) + second[2] * alpha
  ];
}
function subdivideBezier(controls, depth, maxDepth, maxError, output) {
  const points = controls.map(project);
  const start = points[0];
  const end = points.at(-1);
  const flatness = Math.max(0, ...points.slice(1, -1).map((point3) => pointSegmentDistance(point3, start, end)));
  if (depth >= maxDepth || flatness <= maxError) {
    output.push(end);
    return;
  }
  const [left, right] = splitBezier(controls);
  subdivideBezier(left, depth + 1, maxDepth, maxError, output);
  subdivideBezier(right, depth + 1, maxDepth, maxError, output);
}
function extractBezierControls(node, start, end) {
  const degree = node.degree;
  if (degree === 1) return [evaluateHomogeneous(node, start), evaluateHomogeneous(node, end)];
  const samples = Array.from({ length: degree + 1 }, (_, row) => {
    const local = row / degree;
    return evaluateHomogeneous(node, start + (end - start) * local);
  });
  const matrix = Array.from({ length: degree + 1 }, (_, row) => {
    const parameter = row / degree;
    return Array.from({ length: degree + 1 }, (_2, column) => bernstein(degree, column, parameter));
  });
  return solve(matrix, samples);
}
function solve(matrix, values) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) <= 1e-14) throw new TypeError("SPLINE_BEZIER_EXTRACTION_FAILED");
    for (let index = column; index < size + 3; index += 1) augmented[column][index] = augmented[column][index] / divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index < size + 3; index += 1) augmented[row][index] = augmented[row][index] - factor * augmented[column][index];
    }
  }
  return augmented.map((row) => [row[size], row[size + 1], row[size + 2]]);
}
function splitBezier(controls) {
  const levels = [controls.map((point3) => [...point3])];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1);
    levels.push(previous.slice(1).map((point3, index) => mixHomogeneous(previous[index], point3, 0.5)));
  }
  return [levels.map((level) => level[0]), levels.map((level) => level.at(-1)).reverse()];
}
function project(point3) {
  if (!(Math.abs(point3[2]) > Number.EPSILON)) throw new TypeError("SPLINE_WEIGHT_SUM_INVALID");
  return [point3[0] / point3[2], point3[1] / point3[2]];
}
function bernstein(degree, index, parameter) {
  return binomial(degree, index) * parameter ** index * (1 - parameter) ** (degree - index);
}
function binomial(n, k) {
  let result = 1;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
  return result;
}
function pointSegmentDistance(point3, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point3[0] - start[0], point3[1] - start[1]);
  const projection = Math.min(1, Math.max(0, ((point3[0] - start[0]) * dx + (point3[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(
    point3[0] - (start[0] + projection * dx),
    point3[1] - (start[1] + projection * dy)
  );
}
function samePoint(first, second) {
  return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
}
const GEOMETRY_LAYER = "GEOMETRY";
const ANNOTATION_LAYER = "ANNOTATIONS";
function exportDrawingDxf(document2) {
  const writer = new DxfWriter();
  writer.section("HEADER", () => {
    writer.pair(9, "$ACADVER");
    writer.pair(1, "AC1015");
    writer.pair(9, "$INSUNITS");
    writer.pair(70, insertionUnit(document2.unitSystem.length));
  });
  writer.section("TABLES", () => {
    writer.pair(0, "TABLE");
    writer.pair(2, "LAYER");
    writer.pair(70, 2);
    writeLayer(writer, GEOMETRY_LAYER, 7);
    writeLayer(writer, ANNOTATION_LAYER, 3);
    writer.pair(0, "ENDTAB");
  });
  writer.section("ENTITIES", () => {
    for (const node of document2.geometry) {
      if (node.visible) writeGeometry(writer, node);
    }
    for (const node of document2.annotations) {
      if (node.visible) writeAnnotation(writer, node);
    }
  });
  writer.pair(0, "EOF");
  return writer.toString();
}
class DxfWriter {
  constructor() {
    __privateAdd(this, _lines, []);
  }
  pair(code, value) {
    __privateGet(this, _lines).push(String(code), typeof value === "number" ? formatNumber(value) : value);
  }
  section(name, write) {
    this.pair(0, "SECTION");
    this.pair(2, name);
    write();
    this.pair(0, "ENDSEC");
  }
  toString() {
    return `${__privateGet(this, _lines).join("\r\n")}\r
`;
  }
}
_lines = new WeakMap();
function writeLayer(writer, name, color) {
  writer.pair(0, "LAYER");
  writer.pair(2, name);
  writer.pair(70, 0);
  writer.pair(62, color);
  writer.pair(6, "CONTINUOUS");
}
function writeGeometry(writer, node) {
  switch (node.type) {
    case "point":
      entity(writer, "POINT", GEOMETRY_LAYER);
      point(writer, 10, [node.x, node.y]);
      return;
    case "line":
      writeLine(writer, node.start, node.end, GEOMETRY_LAYER);
      return;
    case "ray":
    case "xline":
      entity(writer, node.type === "ray" ? "RAY" : "XLINE", GEOMETRY_LAYER);
      point(writer, 10, node.origin);
      point(writer, 11, node.direction);
      return;
    case "circle":
      entity(writer, "CIRCLE", GEOMETRY_LAYER);
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      return;
    case "arc": {
      entity(writer, "ARC", GEOMETRY_LAYER);
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      writer.pair(50, normalizeDegrees(node.counterClockwise ? node.startAngle : node.endAngle));
      writer.pair(51, normalizeDegrees(node.counterClockwise ? node.endAngle : node.startAngle));
      return;
    }
    case "ellipse":
      entity(writer, "ELLIPSE", GEOMETRY_LAYER);
      point(writer, 10, node.center);
      point(writer, 11, node.majorAxis);
      writer.pair(40, node.ratio);
      writer.pair(41, node.startParam ?? 0);
      writer.pair(42, node.endParam ?? Math.PI * 2);
      return;
    case "polyline":
      if (node.vertices.length === 0) return;
      entity(writer, "LWPOLYLINE", GEOMETRY_LAYER);
      writer.pair(90, node.vertices.length);
      writer.pair(70, node.closed ? 1 : 0);
      for (const vertex of node.vertices) {
        writer.pair(10, vertex.point[0]);
        writer.pair(20, vertex.point[1]);
        if (vertex.bulge !== void 0) writer.pair(42, vertex.bulge);
      }
      return;
    case "spline":
      if (node.controlPoints.length === 0) return;
      entity(writer, "SPLINE", GEOMETRY_LAYER);
      writer.pair(70, 8 | (node.closed ? 1 : 0) | (node.periodic ? 2 : 0) | (node.weights ? 4 : 0));
      writer.pair(71, node.degree);
      writer.pair(72, node.knots.length);
      writer.pair(73, node.controlPoints.length);
      writer.pair(74, 0);
      for (const knot of node.knots) writer.pair(40, knot);
      for (const weight of node.weights ?? []) writer.pair(41, weight);
      for (const controlPoint of node.controlPoints) point(writer, 10, controlPoint);
  }
}
function writeAnnotation(writer, node) {
  switch (node.type) {
    case "text":
      writeText(
        writer,
        node.position,
        node.content,
        node.height,
        node.rotation,
        node.alignment,
        node.verticalAlignment
      );
      return;
    case "dimension": {
      writePolyline(writer, node.definitionPoints, false, ANNOTATION_LAYER);
      writeText(writer, node.textPosition, dimensionLabel$1(node), annotationTextHeight(node), 0, "center", "middle");
      return;
    }
    case "leader": {
      writePolyline(writer, node.points, false, ANNOTATION_LAYER);
      const textPosition = node.points.at(-1);
      if (textPosition !== void 0) {
        writeText(writer, textPosition, node.content, node.textHeight, 0, "left", "baseline");
      }
      return;
    }
    case "centerline": {
      const [start, end] = extendLine(node.start, node.end, node.extension);
      writeLine(writer, start, end, ANNOTATION_LAYER, "CENTER");
      return;
    }
    case "section-hatch":
      if (node.hatch !== void 0) {
        writeHatch(writer, node);
        return;
      }
      for (const segment of node.segments ?? []) {
        writeLine(writer, segment.start, segment.end, ANNOTATION_LAYER);
      }
  }
}
function writeHatch(writer, node) {
  var _a2;
  const hatch = node.hatch;
  entity(writer, "HATCH", ANNOTATION_LAYER);
  writer.pair(100, "AcDbHatch");
  writer.pair(10, 0);
  writer.pair(20, 0);
  writer.pair(30, hatch.elevation);
  writer.pair(210, hatch.extrusion[0]);
  writer.pair(220, hatch.extrusion[1]);
  writer.pair(230, hatch.extrusion[2]);
  writer.pair(2, node.pattern);
  writer.pair(70, 0);
  writer.pair(71, 0);
  writer.pair(91, hatch.boundaryPaths.length);
  for (const path of hatch.boundaryPaths) {
    writer.pair(92, path.flags & -3);
    writer.pair(93, path.edges.length);
    for (const edge of path.edges) {
      if (edge.type === "line") {
        writer.pair(72, 1);
        point2(writer, 10, edge.start);
        point2(writer, 11, edge.end);
      } else if (edge.type === "arc") {
        writer.pair(72, 2);
        point2(writer, 10, edge.center);
        writer.pair(40, edge.radius);
        writer.pair(50, edge.startAngle);
        writer.pair(51, edge.endAngle);
        writer.pair(73, edge.counterClockwise ? 1 : 0);
      } else if (edge.type === "ellipse") {
        writer.pair(72, 3);
        point2(writer, 10, edge.center);
        point2(writer, 11, edge.majorAxis);
        writer.pair(40, edge.axisRatio);
        writer.pair(50, edge.startParameter);
        writer.pair(51, edge.endParameter);
        writer.pair(73, edge.counterClockwise ? 1 : 0);
      } else {
        writer.pair(72, 4);
        writer.pair(94, edge.degree);
        writer.pair(73, edge.rational ? 1 : 0);
        writer.pair(74, edge.periodic ? 1 : 0);
        writer.pair(95, edge.knots.length);
        writer.pair(96, edge.controlPoints.length);
        for (const knot of edge.knots) writer.pair(40, knot);
        edge.controlPoints.forEach((controlPoint, index) => {
          var _a3;
          point2(writer, 10, controlPoint);
          if (edge.rational) writer.pair(42, ((_a3 = edge.weights) == null ? void 0 : _a3[index]) ?? 1);
        });
        writer.pair(97, ((_a2 = edge.fitPoints) == null ? void 0 : _a2.length) ?? 0);
        for (const fitPoint of edge.fitPoints ?? []) point2(writer, 11, fitPoint);
      }
    }
    writer.pair(97, 0);
  }
  writer.pair(75, { normal: 0, outer: 1, ignore: 2 }[hatch.style]);
  writer.pair(76, 0);
  writer.pair(52, hatch.patternAngle);
  writer.pair(41, hatch.patternScale);
  writer.pair(77, hatch.double ? 1 : 0);
  writer.pair(78, hatch.patternLines.length);
  for (const line of hatch.patternLines) {
    writer.pair(53, line.angle);
    writer.pair(43, line.base[0]);
    writer.pair(44, line.base[1]);
    writer.pair(45, line.offset[0]);
    writer.pair(46, line.offset[1]);
    writer.pair(79, line.dashLengths.length);
    for (const dash of line.dashLengths) writer.pair(49, dash);
  }
  writer.pair(98, 0);
}
function entity(writer, type, layer) {
  writer.pair(0, type);
  writer.pair(8, layer);
}
function point(writer, xCode, value) {
  writer.pair(xCode, value[0]);
  writer.pair(xCode + 10, value[1]);
  writer.pair(xCode + 20, 0);
}
function point2(writer, xCode, value) {
  writer.pair(xCode, value[0]);
  writer.pair(xCode + 10, value[1]);
}
function writeLine(writer, start, end, layer, lineType) {
  entity(writer, "LINE", layer);
  if (lineType !== void 0) writer.pair(6, lineType);
  point(writer, 10, start);
  point(writer, 11, end);
}
function writePolyline(writer, points, closed, layer) {
  if (points.length === 0) return;
  entity(writer, "LWPOLYLINE", layer);
  writer.pair(90, points.length);
  writer.pair(70, 0);
  for (const value of points) {
    writer.pair(10, value[0]);
    writer.pair(20, value[1]);
  }
}
function writeText(writer, position, content, height, rotation, alignment, verticalAlignment) {
  entity(writer, "TEXT", ANNOTATION_LAYER);
  point(writer, 10, position);
  writer.pair(40, Math.max(height, Number.EPSILON));
  writer.pair(1, dxfText(content));
  writer.pair(50, rotation);
  writer.pair(72, { left: 0, center: 1, right: 2 }[alignment]);
  writer.pair(73, { baseline: 0, bottom: 1, middle: 2, top: 3 }[verticalAlignment]);
  if (alignment !== "left" || verticalAlignment !== "baseline") point(writer, 11, position);
}
function extendLine(start, end, extension) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(extension > 0)) return [start, end];
  const extendX = dx / length * extension;
  const extendY = dy / length * extension;
  return [
    [start[0] - extendX, start[1] - extendY],
    [end[0] + extendX, end[1] + extendY]
  ];
}
function annotationTextHeight(node) {
  const points = node.definitionPoints;
  if (points.length < 2) return 2.5;
  return Math.max(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) * 0.05, 0.1);
}
function dimensionLabel$1(node) {
  const base = baseDimensionLabel(node);
  const tolerance = toleranceLabel(node);
  return tolerance === void 0 ? base : `${base} ${tolerance}`;
}
function baseDimensionLabel(node) {
  if (node.displayText !== void 0) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  if (value === void 0) return "—";
  return `${node.prefix ?? ""}${value}${node.unit ? ` ${node.unit}` : ""}${node.suffix ?? ""}`;
}
function toleranceLabel(node) {
  var _a2;
  const projection = node.toleranceProjection;
  if (projection && (projection.status === "resolved" || projection.status === "confirmed")) {
    switch (projection.mode) {
      case "bilateral":
        if (finite(projection.upperDeviation) && finite(projection.lowerDeviation)) {
          return `${signed(projection.upperDeviation)}/${signed(projection.lowerDeviation)}`;
        }
        return void 0;
      case "unilateral":
        if (finite(projection.upperDeviation) || finite(projection.lowerDeviation)) {
          return `${signed(projection.upperDeviation ?? 0)}/${signed(projection.lowerDeviation ?? 0)}`;
        }
        return void 0;
      case "limits":
        if (finite(projection.upperLimit) && finite(projection.lowerLimit) && projection.lowerLimit <= projection.upperLimit) {
          return `[${textNumber(projection.upperLimit)}/${textNumber(projection.lowerLimit)}]`;
        }
        return void 0;
      case "fit":
        return ((_a2 = projection.fitDesignation) == null ? void 0 : _a2.trim()) || void 0;
      case "none":
        return void 0;
    }
  }
  const legacy2 = node.tolerance;
  if (legacy2 && (finite(legacy2.upper) || finite(legacy2.lower))) {
    return `${signed(legacy2.upper ?? 0)}/${signed(legacy2.lower ?? 0)}`;
  }
  return void 0;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function signed(value) {
  if (Object.is(value, -0) || value === 0) return "0";
  return value > 0 ? `+${textNumber(value)}` : textNumber(value);
}
function textNumber(value) {
  return Object.is(value, -0) ? "0" : String(value);
}
function dxfText(value) {
  return [...value.replace(/\r\n|\r|\n/g, "\\P")].filter((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code >= 32 && code !== 127;
  }).join("");
}
function insertionUnit(unit) {
  return { mm: 4, cm: 5, m: 6 }[unit];
}
function normalizeDegrees(value) {
  return (value % 360 + 360) % 360;
}
function formatNumber(value) {
  if (!Number.isFinite(value)) throw new TypeError("DXF values must be finite numbers");
  return Object.is(value, -0) ? "0" : String(value);
}
var reactExports = requireReact();
const DrawingWorkspaceStoreContext = reactExports.createContext(null);
function useDrawingWorkspaceStore() {
  const store = reactExports.useContext(DrawingWorkspaceStoreContext);
  if (store === null) {
    throw new Error("Drawing workspace components require DrawingWorkspaceProvider");
  }
  return store;
}
function useDrawingWorkspace(selector) {
  const store = useDrawingWorkspaceStore();
  return reactExports.useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}
function gridPatternMetrics(viewport) {
  const minorSize = 10 * viewport.scale;
  const majorSize = 50 * viewport.scale;
  return {
    minorSize,
    majorSize,
    minorX: modulo$2(viewport.x, minorSize),
    minorY: modulo$2(viewport.y, minorSize),
    majorX: modulo$2(viewport.x, majorSize),
    majorY: modulo$2(viewport.y, majorSize)
  };
}
function modulo$2(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
function CadGrid({
  viewport,
  showGrid,
  showAxes
}) {
  const id = reactExports.useId().replace(/:/g, "");
  const metrics = gridPatternMetrics(viewport);
  const minorId = `vai-grid-minor-${id}`;
  const majorId = `vai-grid-major-${id}`;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { "data-cad-grid": "true", pointerEvents: "none", children: [
    showGrid ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("defs", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "pattern",
          {
            id: minorId,
            "data-grid-pattern": "minor",
            width: metrics.minorSize,
            height: metrics.minorSize,
            patternUnits: "userSpaceOnUse",
            x: metrics.minorX,
            y: metrics.minorY,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: `M ${metrics.minorSize} 0 H 0 V ${metrics.minorSize}`, className: "vai-grid__minor", fill: "none" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "pattern",
          {
            id: majorId,
            "data-grid-pattern": "major",
            width: metrics.majorSize,
            height: metrics.majorSize,
            patternUnits: "userSpaceOnUse",
            x: metrics.majorX,
            y: metrics.majorY,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: `M ${metrics.majorSize} 0 H 0 V ${metrics.majorSize}`, className: "vai-grid__major", fill: "none" })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { "data-grid-layer": "minor", width: "100%", height: "100%", fill: `url(#${minorId})` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { "data-grid-layer": "major", width: "100%", height: "100%", fill: `url(#${majorId})` })
    ] }) : null,
    showAxes ? /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { className: "vai-grid__axes", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-axis": "x", x1: 0, y1: viewport.y, x2: "100%", y2: viewport.y, vectorEffect: "non-scaling-stroke" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-axis": "y", x1: viewport.x, y1: 0, x2: viewport.x, y2: "100%", vectorEffect: "non-scaling-stroke" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("text", { "data-axis-label": "x", x: Math.max(8, viewport.width - 18), y: viewport.y - 7, children: "X" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("text", { "data-axis-label": "y", x: viewport.x + 7, y: 14, children: "Y" })
    ] }) : null
  ] });
}
const TAU = Math.PI * 2;
function flattenHatchEdge(edge, tolerance) {
  if (edge.type === "line") return [edge.start, edge.end];
  if (edge.type === "arc") {
    const orientation = edge.counterClockwise ? 1 : -1;
    return sampleAngularCurve(
      degrees(edge.startAngle),
      degrees(edge.endAngle),
      Math.abs(edge.radius),
      tolerance,
      (angle) => [
        edge.center[0] + Math.cos(angle) * edge.radius,
        edge.center[1] + Math.sin(angle) * edge.radius * orientation
      ]
    );
  }
  if (edge.type === "ellipse") {
    const majorLength = Math.hypot(...edge.majorAxis);
    const minorLength = majorLength * edge.axisRatio;
    const orientation = edge.counterClockwise ? 1 : -1;
    const ux = majorLength > 0 ? edge.majorAxis[0] / majorLength : 1;
    const uy = majorLength > 0 ? edge.majorAxis[1] / majorLength : 0;
    return sampleAngularCurve(
      edge.startParameter,
      edge.endParameter,
      Math.max(majorLength, minorLength),
      tolerance,
      (parameter) => [
        edge.center[0] + ux * majorLength * Math.cos(parameter) - uy * minorLength * Math.sin(parameter) * orientation,
        edge.center[1] + uy * majorLength * Math.cos(parameter) + ux * minorLength * Math.sin(parameter) * orientation
      ]
    );
  }
  return flattenSpline(edge, tolerance);
}
function sampleAngularCurve(start, end, radius, tolerance, pointAt) {
  const rawSweep = end - start;
  const sweep = (rawSweep % TAU + TAU) % TAU || TAU;
  const safeRadius = Math.max(radius, tolerance);
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / safeRadius)));
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(maxStep, Math.PI / 90)));
  return Array.from({ length: count + 1 }, (_, index) => pointAt(start + sweep * index / count));
}
function flattenSpline(edge, tolerance) {
  const domainStart = edge.knots[edge.degree] ?? 0;
  const domainEnd = edge.knots[edge.controlPoints.length] ?? 1;
  const first = splinePoint(edge, domainStart);
  const last = splinePoint(edge, domainEnd);
  const output = [first];
  subdivideSpline(edge, domainStart, domainEnd, first, last, tolerance, 0, output);
  return output;
}
function subdivideSpline(edge, start, end, a, b, tolerance, depth, output) {
  const middleParameter = (start + end) / 2;
  const middle = splinePoint(edge, middleParameter);
  const chordMiddle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (depth >= 16 || Math.hypot(middle[0] - chordMiddle[0], middle[1] - chordMiddle[1]) <= tolerance) {
    output.push(b);
    return;
  }
  subdivideSpline(edge, start, middleParameter, a, middle, tolerance, depth + 1, output);
  subdivideSpline(edge, middleParameter, end, middle, b, tolerance, depth + 1, output);
}
function splinePoint(edge, parameter) {
  var _a2, _b, _c;
  const degree = edge.degree;
  const count = edge.controlPoints.length;
  const basis = Array.from({ length: count }, (_, index) => basisValue(index, degree, parameter, edge.knots, parameter === edge.knots[count]));
  let x = 0;
  let y = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    const weight = ((_a2 = edge.weights) == null ? void 0 : _a2[index]) ?? 1;
    const weightedBasis = (basis[index] ?? 0) * weight;
    x += (((_b = edge.controlPoints[index]) == null ? void 0 : _b[0]) ?? 0) * weightedBasis;
    y += (((_c = edge.controlPoints[index]) == null ? void 0 : _c[1]) ?? 0) * weightedBasis;
    denominator += weightedBasis;
  }
  return denominator === 0 ? edge.controlPoints[0] ?? [0, 0] : [x / denominator, y / denominator];
}
function basisValue(index, degree, parameter, knots, atEnd) {
  if (degree === 0) {
    if (atEnd && parameter === knots[index + 1] && parameter === knots[knots.length - 1]) return 1;
    return knots[index] <= parameter && parameter < knots[index + 1] ? 1 : 0;
  }
  const leftDenominator = knots[index + degree] - knots[index];
  const rightDenominator = knots[index + degree + 1] - knots[index + 1];
  const left = leftDenominator === 0 ? 0 : (parameter - knots[index]) / leftDenominator * basisValue(index, degree - 1, parameter, knots, atEnd);
  const right = rightDenominator === 0 ? 0 : (knots[index + degree + 1] - parameter) / rightDenominator * basisValue(index + 1, degree - 1, parameter, knots, atEnd);
  return left + right;
}
function degrees(value) {
  return value * Math.PI / 180;
}
var ClipType;
(function(ClipType2) {
  ClipType2[ClipType2["NoClip"] = 0] = "NoClip";
  ClipType2[ClipType2["Intersection"] = 1] = "Intersection";
  ClipType2[ClipType2["Union"] = 2] = "Union";
  ClipType2[ClipType2["Difference"] = 3] = "Difference";
  ClipType2[ClipType2["Xor"] = 4] = "Xor";
})(ClipType || (ClipType = {}));
var PathType;
(function(PathType2) {
  PathType2[PathType2["Subject"] = 0] = "Subject";
  PathType2[PathType2["Clip"] = 1] = "Clip";
})(PathType || (PathType = {}));
var FillRule;
(function(FillRule2) {
  FillRule2[FillRule2["EvenOdd"] = 0] = "EvenOdd";
  FillRule2[FillRule2["NonZero"] = 1] = "NonZero";
  FillRule2[FillRule2["Positive"] = 2] = "Positive";
  FillRule2[FillRule2["Negative"] = 3] = "Negative";
})(FillRule || (FillRule = {}));
var PointInPolygonResult;
(function(PointInPolygonResult2) {
  PointInPolygonResult2[PointInPolygonResult2["IsOn"] = 0] = "IsOn";
  PointInPolygonResult2[PointInPolygonResult2["IsInside"] = 1] = "IsInside";
  PointInPolygonResult2[PointInPolygonResult2["IsOutside"] = 2] = "IsOutside";
})(PointInPolygonResult || (PointInPolygonResult = {}));
const maxSafeInteger = Number.MAX_SAFE_INTEGER;
const maxDeltaForSafeProduct = Math.floor(Math.sqrt(maxSafeInteger));
function isSafeProduct(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b))
    return false;
  if (a === 0 || b === 0)
    return true;
  return Math.abs(a) <= maxSafeInteger / Math.abs(b);
}
function isSafeSum(a, b) {
  return Math.abs(a) + Math.abs(b) <= maxSafeInteger;
}
function safeMultiplyDifference(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 - prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) - BigInt(c) * BigInt(d));
  }
  return a * b - c * d;
}
function safeMultiplySum(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 + prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d));
  }
  return a * b + c * d;
}
const B0$1 = BigInt(0);
const B2$1 = BigInt(2);
const B4$1 = BigInt(4);
const B64 = BigInt(64);
const UINT64_MASK = BigInt("0xFFFFFFFFFFFFFFFF");
const IC_MaxInt64 = BigInt("9223372036854775807");
const IC_MaxCoord = Number(IC_MaxInt64 / B4$1);
const IC_Invalid64 = Number(IC_MaxInt64);
const IC_floatingPointTolerance = 1e-12;
const IC_defaultMinimumEdgeLength = 0.1;
const IC_maxCoordForSafeAreaProduct = Math.floor(maxDeltaForSafeProduct / 2);
const IC_maxCoordForSafeCrossSq = Math.floor(Math.sqrt(Math.sqrt(maxSafeInteger / 4)));
function maxSafeCoordinateForScale(scale) {
  if (!Number.isFinite(scale)) {
    throw new RangeError("Scale must be a finite number");
  }
  const absScale = Math.abs(scale);
  if (absScale === 0)
    return Number.POSITIVE_INFINITY;
  return maxSafeInteger / absScale;
}
function checkSafeScaleValue(value, maxAbs, context) {
  if (!Number.isFinite(value) || Math.abs(value) > maxAbs) {
    throw new RangeError(`Scaled coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function ensureSafeInteger(value, context) {
  if (!Number.isFinite(value) || Math.abs(value) > maxSafeInteger) {
    throw new RangeError(`Coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function crossProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b - c * d;
  }
  return safeMultiplyDifference(a, b, c, d);
}
function crossProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  const bigProd1 = BigInt(a) * BigInt(b);
  const bigProd2 = BigInt(c) * BigInt(d);
  if (bigProd1 === bigProd2)
    return 0;
  return bigProd1 > bigProd2 ? 1 : -1;
}
function checkPrecision(precision) {
  if (precision < -8 || precision > 8) {
    throw new Error("Error: Precision is out of range.");
  }
}
function isAlmostZero(value) {
  return Math.abs(value) <= IC_floatingPointTolerance;
}
function triSign(x) {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}
function multiplyUInt64(a, b) {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  const res = aBig * bBig;
  return {
    lo64: res & UINT64_MASK,
    hi64: res >> B64
  };
}
function productsAreEqual(a, b, c, d) {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const absC = Math.abs(c);
  const absD = Math.abs(d);
  if (absA < maxDeltaForSafeProduct && absB < maxDeltaForSafeProduct && absC < maxDeltaForSafeProduct && absD < maxDeltaForSafeProduct) {
    return a * b === c * d;
  }
  const signAb = (a < 0 ? -1 : a > 0 ? 1 : 0) * (b < 0 ? -1 : b > 0 ? 1 : 0);
  const signCd = (c < 0 ? -1 : c > 0 ? 1 : 0) * (d < 0 ? -1 : d > 0 ? 1 : 0);
  if (signAb !== signCd)
    return false;
  if (signAb === 0)
    return true;
  if (!Number.isSafeInteger(absA) || !Number.isSafeInteger(absB) || !Number.isSafeInteger(absC) || !Number.isSafeInteger(absD)) {
    return a * b === c * d;
  }
  const bigA = BigInt(absA);
  const bigB = BigInt(absB);
  const bigC = BigInt(absC);
  const bigD = BigInt(absD);
  return bigA * bigB === bigC * bigD;
}
function isCollinear(pt1, sharedPt, pt2) {
  const a = sharedPt.x - pt1.x;
  const b = pt2.y - sharedPt.y;
  const c = sharedPt.y - pt1.y;
  const d = pt2.x - sharedPt.x;
  return productsAreEqual(a, b, c, d);
}
function dotProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b + c * d;
  }
  return safeMultiplySum(a, b, c, d);
}
function dotProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  const bigSum = BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d);
  if (bigSum === B0$1)
    return 0;
  return bigSum > B0$1 ? 1 : -1;
}
function icArea(path) {
  const cnt = path.length;
  if (cnt < 3)
    return 0;
  let allSmall = true;
  for (let i = 0; i < cnt && allSmall; i++) {
    const pt = path[i];
    if (Math.abs(pt.x) >= IC_maxCoordForSafeAreaProduct || Math.abs(pt.y) >= IC_maxCoordForSafeAreaProduct) {
      allSmall = false;
    }
  }
  let prevPt = path[cnt - 1];
  if (allSmall) {
    let total = 0;
    for (const pt of path) {
      total += (prevPt.y + pt.y) * (prevPt.x - pt.x);
      prevPt = pt;
    }
    return total * 0.5;
  }
  let totalBig = B0$1;
  for (const pt of path) {
    const sum = prevPt.y + pt.y;
    const diff = prevPt.x - pt.x;
    if (Number.isSafeInteger(sum) && Number.isSafeInteger(diff)) {
      totalBig += BigInt(sum) * BigInt(diff);
    } else if (Number.isSafeInteger(prevPt.y) && Number.isSafeInteger(pt.y) && Number.isSafeInteger(prevPt.x) && Number.isSafeInteger(pt.x)) {
      const sumBig = BigInt(prevPt.y) + BigInt(pt.y);
      const diffBig = BigInt(prevPt.x) - BigInt(pt.x);
      totalBig += sumBig * diffBig;
    } else {
      totalBig += BigInt(Math.round(sum * diff));
    }
    prevPt = pt;
  }
  return Number(totalBig) * 0.5;
}
function crossProductD(vec1, vec2) {
  return vec1.y * vec2.x - vec2.y * vec1.x;
}
function dotProductD(vec1, vec2) {
  return vec1.x * vec2.x + vec1.y * vec2.y;
}
function roundToEven(value) {
  const r = Math.round(value);
  if (value === r - 0.5 && (r & 1) !== 0)
    return r - 1;
  return r;
}
function checkCastInt64(val) {
  if (val >= IC_MaxCoord || val <= -IC_MaxCoord)
    return IC_Invalid64;
  return Math.round(val);
}
function getLineIntersectPt(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = safeMultiplyDifference(dy1, dx2, dy2, dx1);
  if (det === 0) {
    return null;
  }
  const t = safeMultiplyDifference(ln1a.x - ln2a.x, dy2, ln1a.y - ln2a.y, dx2) / det;
  if (t <= 0) {
    return { x: ln1a.x, y: ln1a.y, z: ln1a.z || 0 };
  } else if (t >= 1) {
    return { x: ln1b.x, y: ln1b.y, z: ln1b.z || 0 };
  } else {
    return {
      x: Math.trunc(ln1a.x + t * dx1),
      y: Math.trunc(ln1a.y + t * dy1),
      z: 0
    };
  }
}
function getLineIntersectPtD(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = dy1 * dx2 - dy2 * dx1;
  if (det === 0) {
    return { success: false, ip: { x: 0, y: 0, z: 0 } };
  }
  const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
  let ip;
  if (t <= 0) {
    ip = { ...ln1a, z: 0 };
  } else if (t >= 1) {
    ip = { ...ln1b, z: 0 };
  } else {
    ip = {
      x: ln1a.x + t * dx1,
      y: ln1a.y + t * dy1,
      z: 0
    };
  }
  return { success: true, ip };
}
function segsIntersect(seg1a, seg1b, seg2a, seg2b, inclusive = false) {
  if (!inclusive) {
    const s1 = crossProductSign(seg1a, seg2a, seg2b);
    const s2 = crossProductSign(seg1b, seg2a, seg2b);
    const s3 = crossProductSign(seg2a, seg1a, seg1b);
    const s4 = crossProductSign(seg2b, seg1a, seg1b);
    return s1 !== 0 && s2 !== 0 && s1 !== s2 && (s3 !== 0 && s4 !== 0 && s3 !== s4);
  }
  const res1 = crossProductSign(seg1a, seg2a, seg2b);
  const res2 = crossProductSign(seg1b, seg2a, seg2b);
  if (res1 !== 0 && res1 === res2)
    return false;
  const res3 = crossProductSign(seg2a, seg1a, seg1b);
  const res4 = crossProductSign(seg2b, seg1a, seg1b);
  if (res3 !== 0 && res3 === res4)
    return false;
  return res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0;
}
function icGetBounds(path) {
  if (path.length === 0)
    return { left: 0, top: 0, right: 0, bottom: 0 };
  const result = {
    left: Number.MAX_SAFE_INTEGER,
    top: Number.MAX_SAFE_INTEGER,
    right: Number.MIN_SAFE_INTEGER,
    bottom: Number.MIN_SAFE_INTEGER
  };
  for (const pt of path) {
    if (pt.x < result.left)
      result.left = pt.x;
    if (pt.x > result.right)
      result.right = pt.x;
    if (pt.y < result.top)
      result.top = pt.y;
    if (pt.y > result.bottom)
      result.bottom = pt.y;
  }
  return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, top: 0, right: 0, bottom: 0 } : result;
}
function getClosestPtOnSegment(offPt, seg1, seg2) {
  if (seg1.x === seg2.x && seg1.y === seg2.y)
    return { x: seg1.x, y: seg1.y, z: 0 };
  const dx = seg2.x - seg1.x;
  const dy = seg2.y - seg1.y;
  const q = safeMultiplySum(offPt.x - seg1.x, dx, offPt.y - seg1.y, dy) / safeMultiplySum(dx, dx, dy, dy);
  const qClamped = q < 0 ? 0 : q > 1 ? 1 : q;
  return {
    // use Math.round to match the C# MidpointRounding.ToEven behavior
    x: Math.round(seg1.x + qClamped * dx),
    y: Math.round(seg1.y + qClamped * dy),
    z: 0
  };
}
function icPointInPolygon(pt, polygon) {
  const len = polygon.length;
  let start = 0;
  if (len < 3)
    return PointInPolygonResult.IsOutside;
  while (start < len && polygon[start].y === pt.y)
    start++;
  if (start === len)
    return PointInPolygonResult.IsOutside;
  let isAbove = polygon[start].y < pt.y;
  const startingAbove = isAbove;
  let val = 0;
  let i = start + 1;
  let end = len;
  while (true) {
    if (i === end) {
      if (end === 0 || start === 0)
        break;
      end = start;
      i = 0;
    }
    if (isAbove) {
      while (i < end && polygon[i].y < pt.y)
        i++;
    } else {
      while (i < end && polygon[i].y > pt.y)
        i++;
    }
    if (i === end)
      continue;
    const curr = polygon[i];
    const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];
    if (curr.y === pt.y) {
      if (curr.x === pt.x || curr.y === prev.y && pt.x < prev.x !== pt.x < curr.x) {
        return PointInPolygonResult.IsOn;
      }
      i++;
      if (i === start)
        break;
      continue;
    }
    if (pt.x < curr.x && pt.x < prev.x) ;
    else if (pt.x > prev.x && pt.x > curr.x) {
      val = 1 - val;
    } else {
      const cps2 = crossProductSign(prev, curr, pt);
      if (cps2 === 0)
        return PointInPolygonResult.IsOn;
      if (cps2 < 0 === isAbove)
        val = 1 - val;
    }
    isAbove = !isAbove;
    i++;
  }
  if (isAbove === startingAbove) {
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  if (i === len)
    i = 0;
  const cps = i === 0 ? crossProductSign(polygon[len - 1], polygon[0], pt) : crossProductSign(polygon[i - 1], polygon[i], pt);
  if (cps === 0)
    return PointInPolygonResult.IsOn;
  if (cps < 0 === isAbove)
    val = 1 - val;
  return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
}
function path2ContainsPath1(path1, path2) {
  let pip = PointInPolygonResult.IsOn;
  for (const pt of path1) {
    switch (icPointInPolygon(pt, path2)) {
      case PointInPolygonResult.IsOutside:
        if (pip === PointInPolygonResult.IsOutside)
          return false;
        pip = PointInPolygonResult.IsOutside;
        break;
      case PointInPolygonResult.IsInside:
        if (pip === PointInPolygonResult.IsInside)
          return true;
        pip = PointInPolygonResult.IsInside;
        break;
    }
  }
  const mp = icGetBounds(path1);
  let midX, midY;
  if (Number.isSafeInteger(mp.left) && Number.isSafeInteger(mp.right) && Math.abs(mp.left) + Math.abs(mp.right) > Number.MAX_SAFE_INTEGER) {
    midX = Number((BigInt(mp.left) + BigInt(mp.right)) / B2$1);
    midY = Number((BigInt(mp.top) + BigInt(mp.bottom)) / B2$1);
  } else {
    midX = Math.round((mp.left + mp.right) / 2);
    midY = Math.round((mp.top + mp.bottom) / 2);
  }
  const midPt = { x: midX, y: midY };
  return icPointInPolygon(midPt, path2) !== PointInPolygonResult.IsOutside;
}
const InternalClipper = {
  MaxInt64: IC_MaxInt64,
  MaxCoord: IC_MaxCoord,
  max_coord: IC_MaxCoord,
  min_coord: -IC_MaxCoord,
  Invalid64: IC_Invalid64,
  floatingPointTolerance: IC_floatingPointTolerance,
  defaultMinimumEdgeLength: IC_defaultMinimumEdgeLength,
  maxCoordForSafeAreaProduct: IC_maxCoordForSafeAreaProduct,
  maxCoordForSafeCrossSq: IC_maxCoordForSafeCrossSq,
  maxSafeCoordinateForScale,
  checkSafeScaleValue,
  ensureSafeInteger,
  crossProduct,
  crossProductSign,
  checkPrecision,
  isAlmostZero,
  triSign,
  multiplyUInt64,
  productsAreEqual,
  isCollinear,
  dotProduct,
  dotProductSign,
  area: icArea,
  crossProductD,
  dotProductD,
  roundToEven,
  checkCastInt64,
  getLineIntersectPt,
  getLineIntersectPtD,
  segsIntersect,
  getBounds: icGetBounds,
  getClosestPtOnSegment,
  pointInPolygon: icPointInPolygon,
  path2ContainsPath1
};
const Rect64Utils = {
  create(l = 0, t = 0, r = 0, b = 0) {
    return { left: l, top: t, right: r, bottom: b };
  },
  createInvalid() {
    return {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
  },
  width(rect) {
    return rect.right - rect.left;
  },
  height(rect) {
    return rect.bottom - rect.top;
  },
  isEmpty(rect) {
    return rect.bottom <= rect.top || rect.right <= rect.left;
  },
  isValid(rect) {
    return rect.left < Number.MAX_SAFE_INTEGER;
  },
  midPoint(rect) {
    if (Number.isSafeInteger(rect.left) && Number.isSafeInteger(rect.right) && Math.abs(rect.left) + Math.abs(rect.right) > Number.MAX_SAFE_INTEGER) {
      const midX = Number((BigInt(rect.left) + BigInt(rect.right)) / B2$1);
      const midY = Number((BigInt(rect.top) + BigInt(rect.bottom)) / B2$1);
      return { x: midX, y: midY };
    }
    return {
      x: Math.round((rect.left + rect.right) / 2),
      y: Math.round((rect.top + rect.bottom) / 2)
    };
  },
  contains(rect, pt) {
    return pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom;
  },
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  },
  intersects(rect, rec) {
    return Math.max(rect.left, rec.left) <= Math.min(rect.right, rec.right) && Math.max(rect.top, rec.top) <= Math.min(rect.bottom, rec.bottom);
  },
  asPath(rect) {
    return [
      { x: rect.left, y: rect.top, z: 0 },
      { x: rect.right, y: rect.top, z: 0 },
      { x: rect.right, y: rect.bottom, z: 0 },
      { x: rect.left, y: rect.bottom, z: 0 }
    ];
  }
};
const B0 = BigInt(0);
const B2 = BigInt(2);
const B4 = BigInt(4);
var VertexFlags;
(function(VertexFlags2) {
  VertexFlags2[VertexFlags2["None"] = 0] = "None";
  VertexFlags2[VertexFlags2["OpenStart"] = 1] = "OpenStart";
  VertexFlags2[VertexFlags2["OpenEnd"] = 2] = "OpenEnd";
  VertexFlags2[VertexFlags2["LocalMax"] = 4] = "LocalMax";
  VertexFlags2[VertexFlags2["LocalMin"] = 8] = "LocalMin";
})(VertexFlags || (VertexFlags = {}));
class ScanlineHeap {
  constructor() {
    __publicField(this, "data", []);
  }
  push(value) {
    this.data.push(value);
    this.siftUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0)
      return null;
    const max = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return max;
  }
  clear() {
    this.data.length = 0;
  }
  // Hole-sift: lift the value once, shift parents/children, then place.
  // Avoids temporary array allocation from destructuring swap on every step.
  siftUp(index) {
    const val = this.data[index];
    while (index > 0) {
      const parent = index - 1 >> 1;
      if (this.data[parent] >= val)
        break;
      this.data[index] = this.data[parent];
      index = parent;
    }
    this.data[index] = val;
  }
  siftDown(index) {
    const length = this.data.length;
    const val = this.data[index];
    while (true) {
      const left = (index << 1) + 1;
      if (left >= length)
        break;
      const right = left + 1;
      let child = left;
      if (right < length && this.data[right] > this.data[left])
        child = right;
      if (this.data[child] <= val)
        break;
      this.data[index] = this.data[child];
      index = child;
    }
    this.data[index] = val;
  }
}
class Vertex {
  constructor(pt, flags, prev) {
    __publicField(this, "pt");
    __publicField(this, "next", null);
    __publicField(this, "prev", null);
    __publicField(this, "flags");
    this.pt = pt;
    this.flags = flags;
    this.prev = prev;
  }
}
class LocalMinima {
  constructor(vertex, polytype, isOpen = false) {
    __publicField(this, "vertex");
    __publicField(this, "polytype");
    __publicField(this, "isOpen");
    this.vertex = vertex;
    this.polytype = polytype;
    this.isOpen = isOpen;
  }
  equals(other) {
    return other !== null && this.vertex === other.vertex;
  }
}
function createIntersectNode(pt, edge1, edge2) {
  return { pt, edge1, edge2 };
}
class OutPt {
  constructor(pt, outrec) {
    __publicField(this, "pt");
    __publicField(this, "next");
    __publicField(this, "prev");
    __publicField(this, "outrec");
    __publicField(this, "horz");
    this.pt = pt;
    this.outrec = outrec;
    this.next = this;
    this.prev = this;
    this.horz = null;
  }
}
var JoinWith;
(function(JoinWith2) {
  JoinWith2[JoinWith2["None"] = 0] = "None";
  JoinWith2[JoinWith2["Left"] = 1] = "Left";
  JoinWith2[JoinWith2["Right"] = 2] = "Right";
})(JoinWith || (JoinWith = {}));
var HorzPosition;
(function(HorzPosition2) {
  HorzPosition2[HorzPosition2["Bottom"] = 0] = "Bottom";
  HorzPosition2[HorzPosition2["Middle"] = 1] = "Middle";
  HorzPosition2[HorzPosition2["Top"] = 2] = "Top";
})(HorzPosition || (HorzPosition = {}));
class OutRec {
  constructor() {
    __publicField(this, "idx", 0);
    __publicField(this, "owner", null);
    __publicField(this, "frontEdge", null);
    __publicField(this, "backEdge", null);
    __publicField(this, "pts", null);
    __publicField(this, "polypath", null);
    __publicField(this, "bounds", { left: 0, top: 0, right: 0, bottom: 0 });
    __publicField(this, "path", []);
    __publicField(this, "isOpen", false);
    __publicField(this, "splits", null);
    __publicField(this, "recursiveSplit", null);
  }
}
class HorzSegment {
  constructor(op) {
    __publicField(this, "leftOp");
    __publicField(this, "rightOp");
    __publicField(this, "leftToRight");
    this.leftOp = op;
    this.rightOp = null;
    this.leftToRight = true;
  }
}
class HorzJoin {
  constructor(ltor, rtol) {
    __publicField(this, "op1");
    __publicField(this, "op2");
    this.op1 = ltor;
    this.op2 = rtol;
  }
}
function compareHorzSegments(hs1, hs2) {
  if (hs1.rightOp === null) {
    return hs2.rightOp === null ? 0 : 1;
  }
  if (hs2.rightOp === null)
    return -1;
  return hs1.leftOp.pt.x - hs2.leftOp.pt.x;
}
function compareIntersectNodes(a, b) {
  if (a.pt.y !== b.pt.y)
    return a.pt.y > b.pt.y ? -1 : 1;
  if (a.pt.x !== b.pt.x)
    return a.pt.x < b.pt.x ? -1 : 1;
  if (a.edge1.curX !== b.edge1.curX)
    return a.edge1.curX < b.edge1.curX ? -1 : 1;
  return a.edge2.curX < b.edge2.curX ? -1 : a.edge2.curX > b.edge2.curX ? 1 : 0;
}
class Active {
  constructor() {
    __publicField(this, "bot", { x: 0, y: 0 });
    __publicField(this, "top", { x: 0, y: 0 });
    __publicField(this, "curX", 0);
    // current (updated at every new scanline) - keep as number but ensure integer precision
    __publicField(this, "dx", 0);
    __publicField(this, "windDx", 0);
    // 1 or -1 depending on winding direction
    __publicField(this, "windCount", 0);
    __publicField(this, "windCount2", 0);
    // winding count of the opposite polytype
    __publicField(this, "outrec", null);
    // AEL: 'active edge list' (Vatti's AET - active edge table)
    //     a linked list of all edges (from left to right) that are present
    //     (or 'active') within the current scanbeam (a horizontal 'beam' that
    //     sweeps from bottom to top over the paths in the clipping operation).
    __publicField(this, "prevInAEL", null);
    __publicField(this, "nextInAEL", null);
    // SEL: 'sorted edge list' (Vatti's ST - sorted table)
    //     linked list used when sorting edges into their new positions at the
    //     top of scanbeams, but also (re)used to process horizontals.
    __publicField(this, "prevInSEL", null);
    __publicField(this, "nextInSEL", null);
    __publicField(this, "jump", null);
    __publicField(this, "vertexTop", null);
    __publicField(this, "localMin", null);
    // the bottom of an edge 'bound' (also Vatti)
    __publicField(this, "isLeftBound", false);
    __publicField(this, "joinWith", JoinWith.None);
  }
}
const ClipperEngine = {
  addLocMin(vert, polytype, isOpen, minimaList) {
    if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None)
      return;
    vert.flags |= VertexFlags.LocalMin;
    const lm = new LocalMinima(vert, polytype, isOpen);
    minimaList.push(lm);
  },
  addPathsToVertexList(paths, polytype, isOpen, minimaList, vertexList) {
    for (let i = 0, len = paths.length; i < len; i++) {
      const path = paths[i];
      let v0 = null;
      let prevV = null;
      let prevPt = null;
      for (let j = 0, len2 = path.length; j < len2; j++) {
        const pt = path[j];
        if (v0 === null) {
          v0 = new Vertex(pt, VertexFlags.None, null);
          vertexList.push(v0);
          prevV = v0;
          prevPt = pt;
        } else if (!(prevPt.x === pt.x && prevPt.y === pt.y)) {
          const currV2 = new Vertex(pt, VertexFlags.None, prevV);
          prevV.next = currV2;
          prevV = currV2;
          prevPt = pt;
        }
      }
      if ((prevV == null ? void 0 : prevV.prev) == null)
        continue;
      if (!isOpen && prevV.pt.x === v0.pt.x && prevV.pt.y === v0.pt.y)
        prevV = prevV.prev;
      prevV.next = v0;
      v0.prev = prevV;
      if (!isOpen && prevV.next === prevV)
        continue;
      let goingUp;
      if (isOpen) {
        let currV2 = v0.next;
        while (currV2 !== v0 && currV2.pt.y === v0.pt.y)
          currV2 = currV2.next;
        goingUp = currV2.pt.y <= v0.pt.y;
        if (goingUp) {
          v0.flags = VertexFlags.OpenStart;
          ClipperEngine.addLocMin(v0, polytype, true, minimaList);
        } else {
          v0.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
        }
      } else {
        prevV = v0.prev;
        while (prevV !== v0 && prevV.pt.y === v0.pt.y)
          prevV = prevV.prev;
        if (prevV === v0)
          continue;
        goingUp = prevV.pt.y > v0.pt.y;
      }
      const goingUp0 = goingUp;
      prevV = v0;
      let currV = v0.next;
      while (currV !== v0) {
        if (currV.pt.y > prevV.pt.y && goingUp) {
          prevV.flags |= VertexFlags.LocalMax;
          goingUp = false;
        } else if (currV.pt.y < prevV.pt.y && !goingUp) {
          goingUp = true;
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
        }
        prevV = currV;
        currV = currV.next;
      }
      if (isOpen) {
        prevV.flags |= VertexFlags.OpenEnd;
        if (goingUp)
          prevV.flags |= VertexFlags.LocalMax;
        else
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
      } else if (goingUp !== goingUp0) {
        if (goingUp0)
          ClipperEngine.addLocMin(prevV, polytype, false, minimaList);
        else
          prevV.flags |= VertexFlags.LocalMax;
      }
    }
  }
};
const _ClipperBase = class _ClipperBase {
  constructor() {
    __publicField(this, "cliptype", ClipType.NoClip);
    __publicField(this, "fillrule", FillRule.EvenOdd);
    __publicField(this, "actives", null);
    __publicField(this, "sel", null);
    __publicField(this, "minimaList", []);
    __publicField(this, "intersectList", []);
    __publicField(this, "vertexList", []);
    __publicField(this, "outrecList", []);
    __publicField(this, "scanlineHeap", new ScanlineHeap());
    __publicField(this, "scanlineSet", /* @__PURE__ */ new Set());
    // For very small inputs, a heap + set can cost more than it saves.
    // Use an array-based scanline mode initially, and upgrade to heap+set
    // automatically if the scanline list grows beyond a threshold.
    __publicField(this, "scanlineArr", []);
    __publicField(this, "useScanlineArray", false);
    __publicField(this, "horzSegList", []);
    __publicField(this, "horzJoinList", []);
    __publicField(this, "currentLocMin", 0);
    __publicField(this, "currentBotY", 0);
    // True when every active edge's curX already equals topX(edge, topY) for the
    // scanbeam top being processed (set by buildIntersectList when the SEL scan
    // finds no inversions, i.e. no intersections; consumed by doTopOfScanbeam).
    __publicField(this, "curXValidAtTop", false);
    __publicField(this, "isSortedMinimaList", false);
    __publicField(this, "hasOpenPaths", false);
    __publicField(this, "usingPolytree", false);
    __publicField(this, "succeeded", false);
    // Cache Z callback for the duration of an execute to avoid repeated virtual calls
    // to getZCallback() in hot paths.
    __publicField(this, "zCallbackInternal");
    __publicField(this, "preserveCollinear", true);
    __publicField(this, "reverseSolution", false);
  }
  // Z-coordinate callback support
  // Override in subclasses (Clipper64/ClipperD) to provide callback
  getZCallback() {
    return void 0;
  }
  xyEqual(pt1, pt2) {
    return pt1.x === pt2.x && pt1.y === pt2.y;
  }
  setZ(ae1, ae2, intersectPt) {
    const zCallback = this.zCallbackInternal;
    if (!zCallback)
      return;
    if (_ClipperBase.getPolyType(ae1) === PathType.Subject) {
      if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae1.bot, ae1.top, ae2.bot, ae2.top, intersectPt);
    } else {
      if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae2.bot, ae2.top, ae1.bot, ae1.top, intersectPt);
    }
  }
  // Helper functions
  static isOdd(val) {
    return (val & 1) !== 0;
  }
  static isHotEdge(ae) {
    return ae.outrec != null;
  }
  static isOpen(ae) {
    return _ClipperBase.openPathsEnabled && ae.localMin.isOpen;
  }
  static isOpenEnd(ae) {
    return _ClipperBase.openPathsEnabled && ae.localMin.isOpen && _ClipperBase.isOpenEndVertex(ae.vertexTop);
  }
  static isOpenEndVertex(v) {
    return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
  }
  static getPrevHotEdge(ae) {
    let prev = ae.prevInAEL;
    if (!_ClipperBase.openPathsEnabled) {
      while (prev !== null && !_ClipperBase.isHotEdge(prev)) {
        prev = prev.prevInAEL;
      }
      return prev;
    }
    while (prev !== null && (prev.localMin.isOpen || !_ClipperBase.isHotEdge(prev))) {
      prev = prev.prevInAEL;
    }
    return prev;
  }
  static isFront(ae) {
    return ae === ae.outrec.frontEdge;
  }
  /*******************************************************************************
  *  Dx:                             0(90deg)                                    *
  *                                  |                                           *
  *               +inf (180deg) <--- o ---> -inf (0deg)                          *
  *******************************************************************************/
  static getDx(pt1, pt2) {
    const dy = pt2.y - pt1.y;
    if (dy !== 0) {
      return (pt2.x - pt1.x) / dy;
    }
    return pt2.x > pt1.x ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  static topX(ae, currentY) {
    if (currentY === ae.top.y || ae.top.x === ae.bot.x)
      return ae.top.x;
    if (currentY === ae.bot.y)
      return ae.bot.x;
    return InternalClipper.roundToEven(ae.bot.x + ae.dx * (currentY - ae.bot.y));
  }
  static isHorizontal(ae) {
    return ae.dx === Number.NEGATIVE_INFINITY || ae.dx === Number.POSITIVE_INFINITY;
  }
  static isHeadingRightHorz(ae) {
    return ae.dx === Number.NEGATIVE_INFINITY;
  }
  static isHeadingLeftHorz(ae) {
    return ae.dx === Number.POSITIVE_INFINITY;
  }
  static getPolyType(ae) {
    return ae.localMin.polytype;
  }
  static isSamePolyType(ae1, ae2) {
    return ae1.localMin.polytype === ae2.localMin.polytype;
  }
  static setDx(ae) {
    ae.dx = _ClipperBase.getDx(ae.bot, ae.top);
  }
  static nextVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.next : ae.vertexTop.prev;
  }
  static prevPrevVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.prev.prev : ae.vertexTop.next.next;
  }
  static isMaximaVertex(v) {
    return (v.flags & VertexFlags.LocalMax) !== VertexFlags.None;
  }
  static isMaximaEdge(ae) {
    return (ae.vertexTop.flags & VertexFlags.LocalMax) !== VertexFlags.None;
  }
  static getMaximaPair(ae) {
    let ae2 = ae.nextInAEL;
    while (ae2 !== null) {
      if (ae2.vertexTop === ae.vertexTop)
        return ae2;
      ae2 = ae2.nextInAEL;
    }
    return null;
  }
  // optimization (not in C# reference): fast bounding box overlap check for segment intersection
  boundingBoxesOverlap(p1, p2, p3, p4) {
    const min1x = p1.x < p2.x ? p1.x : p2.x;
    const max2x = p3.x > p4.x ? p3.x : p4.x;
    if (max2x < min1x)
      return false;
    const max1x = p1.x > p2.x ? p1.x : p2.x;
    const min2x = p3.x < p4.x ? p3.x : p4.x;
    if (max1x < min2x)
      return false;
    const min1y = p1.y < p2.y ? p1.y : p2.y;
    const max2y = p3.y > p4.y ? p3.y : p4.y;
    if (max2y < min1y)
      return false;
    const max1y = p1.y > p2.y ? p1.y : p2.y;
    const min2y = p3.y < p4.y ? p3.y : p4.y;
    return max1y >= min2y;
  }
  clearSolutionOnly() {
    while (this.actives !== null)
      this.deleteFromAEL(this.actives);
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.disposeIntersectNodes();
    this.outrecList.length = 0;
    this.horzSegList.length = 0;
    this.horzJoinList.length = 0;
  }
  clear() {
    this.clearSolutionOnly();
    this.minimaList.length = 0;
    this.vertexList.length = 0;
    this.currentLocMin = 0;
    this.isSortedMinimaList = false;
    this.hasOpenPaths = false;
  }
  reset() {
    if (!this.isSortedMinimaList) {
      this.minimaList.sort((a, b) => b.vertex.pt.y - a.vertex.pt.y);
      this.isSortedMinimaList = true;
    }
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.useScanlineArray = this.minimaList.length <= 16;
    for (let i = this.minimaList.length - 1; i >= 0; i--) {
      this.insertScanline(this.minimaList[i].vertex.pt.y);
    }
    this.currentBotY = 0;
    this.currentLocMin = 0;
    this.actives = null;
    this.sel = null;
    this.curXValidAtTop = false;
    this.succeeded = true;
  }
  upgradeScanlineStructureFromArray() {
    const arr = this.scanlineArr;
    for (let i = 0, len = arr.length; i < len; i++) {
      const y = arr[i];
      this.scanlineSet.add(y);
      this.scanlineHeap.push(y);
    }
    arr.length = 0;
    this.useScanlineArray = false;
  }
  insertScanline(y) {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      for (let i = 0, len = arr.length; i < len; i++) {
        if (arr[i] === y)
          return;
      }
      arr.push(y);
      if (arr.length > 64)
        this.upgradeScanlineStructureFromArray();
      return;
    }
    if (this.scanlineSet.has(y))
      return;
    this.scanlineSet.add(y);
    this.scanlineHeap.push(y);
  }
  // Returns the next scanline Y value, or null if empty.
  // Avoids allocating a wrapper object on every call in the main sweep loop.
  popScanline() {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      const len = arr.length;
      if (len === 0)
        return null;
      let bestIdx = 0;
      let bestY = arr[0];
      for (let i = 1; i < len; i++) {
        const v = arr[i];
        if (v > bestY) {
          bestY = v;
          bestIdx = i;
        }
      }
      arr[bestIdx] = arr[len - 1];
      arr.pop();
      return bestY;
    }
    const y = this.scanlineHeap.pop();
    if (y === null)
      return null;
    this.scanlineSet.delete(y);
    return y;
  }
  hasLocMinAtY(y) {
    return this.currentLocMin < this.minimaList.length && this.minimaList[this.currentLocMin].vertex.pt.y === y;
  }
  popLocalMinima() {
    return this.minimaList[this.currentLocMin++];
  }
  addPath(path, polytype, isOpen = false) {
    const tmp = [path];
    this.addPaths(tmp, polytype, isOpen);
  }
  addPaths(paths, polytype, isOpen = false) {
    if (isOpen)
      this.hasOpenPaths = true;
    this.isSortedMinimaList = false;
    ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this.minimaList, this.vertexList);
  }
  addReuseableData(reuseableData) {
    if (reuseableData["minimaList"].length === 0)
      return;
    this.isSortedMinimaList = false;
    for (const lm of reuseableData["minimaList"]) {
      this.minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
      if (lm.isOpen)
        this.hasOpenPaths = true;
    }
  }
  deleteFromAEL(ae) {
    const prev = ae.prevInAEL;
    const next = ae.nextInAEL;
    if (prev === null && next === null && ae !== this.actives)
      return;
    if (prev !== null) {
      prev.nextInAEL = next;
    } else {
      this.actives = next;
    }
    if (next !== null)
      next.prevInAEL = prev;
  }
  getBounds() {
    const bounds = {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
    for (const t of this.vertexList) {
      let v = t;
      do {
        if (v.pt.x < bounds.left)
          bounds.left = v.pt.x;
        if (v.pt.x > bounds.right)
          bounds.right = v.pt.x;
        if (v.pt.y < bounds.top)
          bounds.top = v.pt.y;
        if (v.pt.y > bounds.bottom)
          bounds.bottom = v.pt.y;
        v = v.next;
      } while (v !== t);
    }
    return Rect64Utils.isEmpty(bounds) ? { left: 0, top: 0, right: 0, bottom: 0 } : bounds;
  }
  executeInternal(ct, fillRule) {
    if (ct === ClipType.NoClip)
      return;
    _ClipperBase.openPathsEnabled = this.hasOpenPaths;
    this.zCallbackInternal = this.getZCallback();
    this.fillrule = fillRule;
    this.cliptype = ct;
    this.reset();
    let y = this.popScanline();
    if (y === null)
      return;
    while (this.succeeded) {
      this.insertLocalMinimaIntoAEL(y);
      let ae;
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
      if (this.horzSegList.length > 0) {
        this.convertHorzSegsToJoins();
        this.horzSegList.length = 0;
      }
      this.currentBotY = y;
      const nextY = this.popScanline();
      if (nextY === null)
        break;
      y = nextY;
      this.doIntersections(y);
      this.doTopOfScanbeam(y);
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
    }
    if (this.succeeded)
      this.processHorzJoins();
  }
  insertLocalMinimaIntoAEL(botY) {
    while (this.hasLocMinAtY(botY)) {
      const localMinima = this.popLocalMinima();
      let leftBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
        leftBound = null;
      } else {
        leftBound = new Active();
        leftBound.bot = localMinima.vertex.pt;
        leftBound.curX = localMinima.vertex.pt.x;
        leftBound.windDx = -1;
        leftBound.vertexTop = localMinima.vertex.prev;
        leftBound.top = localMinima.vertex.prev.pt;
        leftBound.outrec = null;
        leftBound.localMin = localMinima;
        _ClipperBase.setDx(leftBound);
      }
      let rightBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
        rightBound = null;
      } else {
        rightBound = new Active();
        rightBound.bot = localMinima.vertex.pt;
        rightBound.curX = localMinima.vertex.pt.x;
        rightBound.windDx = 1;
        rightBound.vertexTop = localMinima.vertex.next;
        rightBound.top = localMinima.vertex.next.pt;
        rightBound.outrec = null;
        rightBound.localMin = localMinima;
        _ClipperBase.setDx(rightBound);
      }
      if (leftBound !== null && rightBound !== null) {
        if (_ClipperBase.isHorizontal(leftBound)) {
          if (_ClipperBase.isHeadingRightHorz(leftBound)) {
            const tmp = leftBound;
            leftBound = rightBound;
            rightBound = tmp;
          }
        } else if (_ClipperBase.isHorizontal(rightBound)) {
          if (_ClipperBase.isHeadingLeftHorz(rightBound)) {
            const tmp = leftBound;
            leftBound = rightBound;
            rightBound = tmp;
          }
        } else if (leftBound.dx < rightBound.dx) {
          const tmp = leftBound;
          leftBound = rightBound;
          rightBound = tmp;
        }
      } else if (leftBound === null) {
        leftBound = rightBound;
        rightBound = null;
      }
      let contributing;
      leftBound.isLeftBound = true;
      this.insertLeftEdge(leftBound);
      if (!_ClipperBase.openPathsEnabled) {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      } else if (_ClipperBase.isOpen(leftBound)) {
        this.setWindCountForOpenPathEdge(leftBound);
        contributing = this.isContributingOpen(leftBound);
      } else {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      }
      if (rightBound !== null) {
        rightBound.windCount = leftBound.windCount;
        rightBound.windCount2 = leftBound.windCount2;
        this.insertRightEdge(leftBound, rightBound);
        if (contributing) {
          this.addLocalMinPoly(leftBound, rightBound, leftBound.bot, true);
          if (!_ClipperBase.isHorizontal(leftBound)) {
            this.checkJoinLeft(leftBound, leftBound.bot);
          }
        }
        while (rightBound.nextInAEL !== null && this.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
          this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
          this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
        }
        if (_ClipperBase.isHorizontal(rightBound)) {
          this.pushHorz(rightBound);
        } else {
          this.checkJoinRight(rightBound, rightBound.bot);
          this.insertScanline(rightBound.top.y);
        }
      } else if (contributing && _ClipperBase.openPathsEnabled) {
        this.startOpenPath(leftBound, leftBound.bot);
      }
      if (_ClipperBase.isHorizontal(leftBound)) {
        this.pushHorz(leftBound);
      } else {
        this.insertScanline(leftBound.top.y);
      }
    }
  }
  pushHorz(ae) {
    ae.nextInSEL = this.sel;
    this.sel = ae;
  }
  popHorz() {
    const ae = this.sel;
    if (ae === null)
      return null;
    this.sel = this.sel.nextInSEL;
    return ae;
  }
  doHorizontal(horz) {
    if (!_ClipperBase.openPathsEnabled) {
      this.doHorizontalClosed(horz);
      return;
    }
    const horzIsOpen = _ClipperBase.isOpen(horz);
    const y = horz.bot.y;
    const vertexMax = horzIsOpen ? this.getCurrYMaximaVertexOpen(horz) : this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (_ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop || _ClipperBase.isOpenEnd(horz)) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
            const pt2 = _ClipperBase.nextVertex(horz).pt;
            if (_ClipperBase.isOpen(ae) && !_ClipperBase.isSamePolyType(ae, horz) && !_ClipperBase.isHotEdge(ae)) {
              if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) > pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) < pt2.x)
                break;
            } else if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) >= pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) <= pt2.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (horzIsOpen && _ClipperBase.isOpenEnd(horz)) {
        if (_ClipperBase.isHotEdge(horz)) {
          this.addOutPt(horz, horz.top);
          if (_ClipperBase.isFront(horz)) {
            horz.outrec.frontEdge = null;
          } else {
            horz.outrec.backEdge = null;
          }
          horz.outrec = null;
        }
        this.deleteFromAEL(horz);
        return;
      }
      if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (_ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  // Closed-path-only horizontal processing (no open-path branching).
  doHorizontalClosed(horz) {
    const y = horz.bot.y;
    const vertexMax = this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (_ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
            const nextPt = _ClipperBase.nextVertex(horz).pt;
            const tx = _ClipperBase.topX(ae, nextPt.y);
            if (isLeftToRight && tx >= nextPt.x || !isLeftToRight && tx <= nextPt.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (_ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  convertHorzSegsToJoins() {
    const list = this.horzSegList;
    let k = 0;
    for (let i = 0, len = list.length; i < len; i++) {
      const hs = list[i];
      if (this.updateHorzSegment(hs))
        list[k++] = hs;
    }
    if (k < 2)
      return;
    list.length = k;
    this.horzSegList.sort(compareHorzSegments);
    for (let i = 0; i < k - 1; i++) {
      const hs1 = this.horzSegList[i];
      for (let j = i + 1; j < k; j++) {
        const hs2 = this.horzSegList[j];
        if (hs2.leftOp.pt.x >= hs1.rightOp.pt.x || hs2.leftToRight === hs1.leftToRight || hs2.rightOp.pt.x <= hs1.leftOp.pt.x)
          continue;
        const currY = hs1.leftOp.pt.y;
        if (hs1.leftToRight) {
          while (hs1.leftOp.next.pt.y === currY && hs1.leftOp.next.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.next;
          while (hs2.leftOp.prev.pt.y === currY && hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.prev;
          const join = new HorzJoin(this.duplicateOp(hs1.leftOp, true), this.duplicateOp(hs2.leftOp, false));
          this.horzJoinList.push(join);
        } else {
          while (hs1.leftOp.prev.pt.y === currY && hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.prev;
          while (hs2.leftOp.next.pt.y === currY && hs2.leftOp.next.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.next;
          const join = new HorzJoin(this.duplicateOp(hs2.leftOp, true), this.duplicateOp(hs1.leftOp, false));
          this.horzJoinList.push(join);
        }
      }
    }
  }
  updateHorzSegment(hs) {
    const op = hs.leftOp;
    const outrec = this.getRealOutRec(op.outrec);
    const outrecHasEdges = outrec.frontEdge !== null;
    const currY = op.pt.y;
    let opP = op;
    let opN = op;
    if (outrecHasEdges) {
      const opA = outrec.pts;
      const opZ = opA.next;
      while (opP !== opZ && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN !== opA && opN.next.pt.y === currY)
        opN = opN.next;
    } else {
      while (opP.prev !== opN && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN.next !== opP && opN.next.pt.y === currY)
        opN = opN.next;
    }
    const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp.horz === null;
    if (result) {
      hs.leftOp.horz = hs;
    } else {
      hs.rightOp = null;
    }
    return result;
  }
  setHorzSegHeadingForward(hs, opP, opN) {
    if (opP.pt.x === opN.pt.x)
      return false;
    if (opP.pt.x < opN.pt.x) {
      hs.leftOp = opP;
      hs.rightOp = opN;
      hs.leftToRight = true;
    } else {
      hs.leftOp = opN;
      hs.rightOp = opP;
      hs.leftToRight = false;
    }
    return true;
  }
  duplicateOp(op, insertAfter) {
    const result = new OutPt(op.pt, op.outrec);
    if (insertAfter) {
      result.next = op.next;
      result.next.prev = result;
      result.prev = op;
      op.next = result;
    } else {
      result.prev = op.prev;
      result.prev.next = result;
      result.next = op;
      op.prev = result;
    }
    return result;
  }
  getRealOutRec(outRec) {
    while (outRec !== null && outRec.pts === null) {
      outRec = outRec.owner;
    }
    return outRec;
  }
  doIntersections(y) {
    if (this.buildIntersectList(y)) {
      this.processIntersectList();
      this.disposeIntersectNodes();
    }
  }
  doTopOfScanbeam(y) {
    const curXValid = this.curXValidAtTop;
    this.curXValidAtTop = false;
    this.sel = null;
    let ae = this.actives;
    while (ae !== null) {
      if (ae.top.y === y) {
        ae.curX = ae.top.x;
        if (_ClipperBase.isMaximaEdge(ae)) {
          ae = this.doMaxima(ae);
          continue;
        } else {
          if (_ClipperBase.isHotEdge(ae))
            this.addOutPt(ae, ae.top);
          this.updateEdgeIntoAEL(ae);
          if (_ClipperBase.isHorizontal(ae)) {
            this.pushHorz(ae);
          }
        }
      } else if (!curXValid) {
        ae.curX = _ClipperBase.topX(ae, y);
      }
      ae = ae.nextInAEL;
    }
  }
  processHorzJoins() {
    for (const j of this.horzJoinList) {
      const or1 = this.getRealOutRec(j.op1.outrec);
      const or2 = this.getRealOutRec(j.op2.outrec);
      const op1b = j.op1.next;
      const op2b = j.op2.prev;
      j.op1.next = j.op2;
      j.op2.prev = j.op1;
      op1b.prev = op2b;
      op2b.next = op1b;
      if (or1 === or2) {
        const or2New = this.newOutRec();
        or2New.pts = op1b;
        this.fixOutRecPts(or2New);
        if (or1.pts.outrec === or2New) {
          or1.pts = j.op1;
          or1.pts.outrec = or1;
        }
        if (this.usingPolytree) {
          if (this.path1InsidePath2(or1.pts, or2New.pts)) {
            [or2New.pts, or1.pts] = [or1.pts, or2New.pts];
            this.fixOutRecPts(or1);
            this.fixOutRecPts(or2New);
            or2New.owner = or1;
          } else if (this.path1InsidePath2(or2New.pts, or1.pts)) {
            or2New.owner = or1;
          } else {
            or2New.owner = or1.owner;
          }
          if (or1.splits === null)
            or1.splits = [];
          or1.splits.push(or2New.idx);
        } else {
          or2New.owner = or1;
        }
      } else {
        or2.pts = null;
        if (this.usingPolytree) {
          this.setOwner(or2, or1);
          this.moveSplits(or2, or1);
        } else {
          or2.owner = or1;
        }
      }
    }
  }
  fixOutRecPts(outrec) {
    let op = outrec.pts;
    do {
      op.outrec = outrec;
      op = op.next;
    } while (op !== outrec.pts);
  }
  path1InsidePath2(op1, op2) {
    let pip = PointInPolygonResult.IsOn;
    let op = op1;
    do {
      switch (this.pointInOpPolygon(op.pt, op2)) {
        case PointInPolygonResult.IsOutside:
          if (pip === PointInPolygonResult.IsOutside)
            return false;
          pip = PointInPolygonResult.IsOutside;
          break;
        case PointInPolygonResult.IsInside:
          if (pip === PointInPolygonResult.IsInside)
            return true;
          pip = PointInPolygonResult.IsInside;
          break;
      }
      op = op.next;
    } while (op !== op1);
    return InternalClipper.path2ContainsPath1(this.getCleanPath(op1), this.getCleanPath(op2));
  }
  pointInOpPolygon(pt, op) {
    if (op === op.next || op.prev === op.next) {
      return PointInPolygonResult.IsOutside;
    }
    let op2 = op;
    do {
      if (op.pt.y !== pt.y)
        break;
      op = op.next;
    } while (op !== op2);
    if (op.pt.y === pt.y)
      return PointInPolygonResult.IsOutside;
    let isAbove = op.pt.y < pt.y;
    const startingAbove = isAbove;
    let val = 0;
    op2 = op.next;
    while (op2 !== op) {
      if (isAbove) {
        while (op2 !== op && op2.pt.y < pt.y)
          op2 = op2.next;
      } else {
        while (op2 !== op && op2.pt.y > pt.y)
          op2 = op2.next;
      }
      if (op2 === op)
        break;
      if (op2.pt.y === pt.y) {
        if (op2.pt.x === pt.x || op2.pt.y === op2.prev.pt.y && pt.x < op2.prev.pt.x !== pt.x < op2.pt.x)
          return PointInPolygonResult.IsOn;
        op2 = op2.next;
        if (op2 === op)
          break;
        continue;
      }
      if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
        if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x) {
          val = 1 - val;
        } else {
          const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
          if (d === 0)
            return PointInPolygonResult.IsOn;
          if (d < 0 === isAbove)
            val = 1 - val;
        }
      }
      isAbove = !isAbove;
      op2 = op2.next;
    }
    if (isAbove === startingAbove)
      return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
    {
      const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
      if (d === 0)
        return PointInPolygonResult.IsOn;
      if (d < 0 === isAbove)
        val = 1 - val;
    }
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  getCleanPath(op) {
    const result = [];
    let op2 = op;
    while (op2.next !== op && (op2.pt.x === op2.next.pt.x && op2.pt.x === op2.prev.pt.x || op2.pt.y === op2.next.pt.y && op2.pt.y === op2.prev.pt.y))
      op2 = op2.next;
    result.push(op2.pt);
    let prevOp = op2;
    op2 = op2.next;
    while (op2 !== op) {
      if ((op2.pt.x !== op2.next.pt.x || op2.pt.x !== prevOp.pt.x) && (op2.pt.y !== op2.next.pt.y || op2.pt.y !== prevOp.pt.y)) {
        result.push(op2.pt);
        prevOp = op2;
      }
      op2 = op2.next;
    }
    return result;
  }
  moveSplits(fromOr, toOr) {
    if (fromOr.splits === null)
      return;
    if (toOr.splits === null)
      toOr.splits = [];
    for (const i of fromOr.splits) {
      if (i !== toOr.idx) {
        toOr.splits.push(i);
      }
    }
    fromOr.splits = null;
  }
  buildIntersectList(topY) {
    var _a2;
    if (((_a2 = this.actives) == null ? void 0 : _a2.nextInAEL) === null)
      return false;
    if (!this.adjustCurrXAndCopyToSEL(topY)) {
      this.curXValidAtTop = true;
      return false;
    }
    let left = this.sel;
    while (left !== null && left.jump !== null) {
      let prevBase = null;
      while (left !== null && left.jump !== null) {
        let currBase = left;
        let right = left.jump;
        let lEnd = right;
        const rEnd = (right == null ? void 0 : right.jump) || null;
        left.jump = rEnd;
        while (left !== lEnd && right !== rEnd) {
          if (right.curX < left.curX) {
            let tmp = right.prevInSEL;
            while (true) {
              this.addNewIntersectNode(tmp, right, topY);
              if (tmp === left)
                break;
              tmp = tmp.prevInSEL;
            }
            tmp = right;
            right = this.extractFromSEL(tmp);
            lEnd = right;
            if (left !== null)
              this.insert1Before2InSEL(tmp, left);
            if (left !== currBase)
              continue;
            currBase = tmp;
            currBase.jump = rEnd;
            if (prevBase === null) {
              this.sel = currBase;
            } else {
              prevBase.jump = currBase;
            }
          } else {
            left = left.nextInSEL;
          }
        }
        prevBase = currBase;
        left = rEnd;
      }
      left = this.sel;
    }
    return this.intersectList.length > 0;
  }
  processIntersectList() {
    this.intersectList.sort(compareIntersectNodes);
    for (let i = 0; i < this.intersectList.length; ++i) {
      if (!this.edgesAdjacentInAEL(this.intersectList[i])) {
        let j = i + 1;
        while (!this.edgesAdjacentInAEL(this.intersectList[j]))
          j++;
        [this.intersectList[j], this.intersectList[i]] = [this.intersectList[i], this.intersectList[j]];
      }
      const node = this.intersectList[i];
      this.intersectEdges(node.edge1, node.edge2, node.pt);
      this.swapPositionsInAEL(node.edge1, node.edge2);
      node.edge1.curX = node.pt.x;
      node.edge2.curX = node.pt.x;
      this.checkJoinLeft(node.edge2, node.pt, true);
      this.checkJoinRight(node.edge1, node.pt, true);
    }
  }
  edgesAdjacentInAEL(inode) {
    return inode.edge1.nextInAEL === inode.edge2 || inode.edge1.prevInAEL === inode.edge2;
  }
  // Returns true if any adjacent pair is inverted at topY (i.e. at least one
  // intersection exists within this scanbeam).
  adjustCurrXAndCopyToSEL(topY) {
    let ae = this.actives;
    this.sel = ae;
    let prevX = Number.NEGATIVE_INFINITY;
    let inverted = false;
    while (ae !== null) {
      ae.prevInSEL = ae.prevInAEL;
      ae.nextInSEL = ae.nextInAEL;
      ae.jump = ae.nextInSEL;
      const x = _ClipperBase.topX(ae, topY);
      ae.curX = x;
      if (x < prevX)
        inverted = true;
      prevX = x;
      ae = ae.nextInAEL;
    }
    return inverted;
  }
  doMaxima(ae) {
    const prevE = ae.prevInAEL;
    let nextE = ae.nextInAEL;
    if (_ClipperBase.isOpenEnd(ae)) {
      if (_ClipperBase.isHotEdge(ae))
        this.addOutPt(ae, ae.top);
      if (_ClipperBase.isHorizontal(ae))
        return nextE;
      if (_ClipperBase.isHotEdge(ae)) {
        if (_ClipperBase.isFront(ae)) {
          ae.outrec.frontEdge = null;
        } else {
          ae.outrec.backEdge = null;
        }
        ae.outrec = null;
      }
      this.deleteFromAEL(ae);
      return nextE;
    }
    const maxPair = _ClipperBase.getMaximaPair(ae);
    if (maxPair === null)
      return nextE;
    if (this.isJoined(ae))
      this.split(ae, ae.top);
    if (this.isJoined(maxPair))
      this.split(maxPair, maxPair.top);
    while (nextE !== maxPair) {
      this.intersectEdges(ae, nextE, ae.top);
      this.swapPositionsInAEL(ae, nextE);
      nextE = ae.nextInAEL;
    }
    if (_ClipperBase.isOpen(ae)) {
      if (_ClipperBase.isHotEdge(ae)) {
        this.addLocalMaxPoly(ae, maxPair, ae.top);
      }
      this.deleteFromAEL(maxPair);
      this.deleteFromAEL(ae);
      return prevE !== null ? prevE.nextInAEL : this.actives;
    }
    if (_ClipperBase.isHotEdge(ae)) {
      this.addLocalMaxPoly(ae, maxPair, ae.top);
    }
    this.deleteFromAEL(ae);
    this.deleteFromAEL(maxPair);
    return prevE !== null ? prevE.nextInAEL : this.actives;
  }
  updateEdgeIntoAEL(ae) {
    ae.bot = ae.top;
    ae.vertexTop = _ClipperBase.nextVertex(ae);
    ae.top = ae.vertexTop.pt;
    ae.curX = ae.bot.x;
    _ClipperBase.setDx(ae);
    if (this.isJoined(ae))
      this.split(ae, ae.bot);
    if (_ClipperBase.isHorizontal(ae)) {
      if (!_ClipperBase.openPathsEnabled) {
        this.trimHorz(ae, this.preserveCollinear);
      } else if (!_ClipperBase.isOpen(ae)) {
        this.trimHorz(ae, this.preserveCollinear);
      }
      return;
    }
    this.insertScanline(ae.top.y);
    this.checkJoinLeft(ae, ae.bot);
    this.checkJoinRight(ae, ae.bot, true);
  }
  trimHorz(horzEdge, preserveCollinear) {
    let wasTrimmed = false;
    let pt = _ClipperBase.nextVertex(horzEdge).pt;
    while (pt.y === horzEdge.top.y) {
      if (preserveCollinear && pt.x < horzEdge.top.x !== horzEdge.bot.x < horzEdge.top.x) {
        break;
      }
      horzEdge.vertexTop = _ClipperBase.nextVertex(horzEdge);
      horzEdge.top = pt;
      wasTrimmed = true;
      if (_ClipperBase.isMaximaVertex(horzEdge.vertexTop))
        break;
      pt = _ClipperBase.nextVertex(horzEdge).pt;
    }
    if (wasTrimmed)
      _ClipperBase.setDx(horzEdge);
  }
  addToHorzSegList(op) {
    if (op.outrec.isOpen)
      return;
    this.horzSegList.push(new HorzSegment(op));
  }
  addNewIntersectNode(ae1, ae2, topY) {
    let ip = InternalClipper.getLineIntersectPt(ae1.bot, ae1.top, ae2.bot, ae2.top);
    if (ip === null) {
      ip = { x: ae1.curX, y: topY };
    }
    if (ip.y > this.currentBotY || ip.y < topY) {
      const absDx1 = Math.abs(ae1.dx);
      const absDx2 = Math.abs(ae2.dx);
      if (absDx1 > 100 && absDx2 > 100) {
        if (absDx1 > absDx2) {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
        } else {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
        }
      } else if (absDx1 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
      } else if (absDx2 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
      } else {
        if (ip.y < topY)
          ip.y = topY;
        else
          ip.y = this.currentBotY;
        if (absDx1 < absDx2)
          ip.x = _ClipperBase.topX(ae1, ip.y);
        else
          ip.x = _ClipperBase.topX(ae2, ip.y);
      }
    }
    const node = createIntersectNode(ip, ae1, ae2);
    this.intersectList.push(node);
  }
  extractFromSEL(ae) {
    const res = ae.nextInSEL;
    if (res !== null) {
      res.prevInSEL = ae.prevInSEL;
    }
    ae.prevInSEL.nextInSEL = res;
    return res;
  }
  insert1Before2InSEL(ae1, ae2) {
    ae1.prevInSEL = ae2.prevInSEL;
    if (ae1.prevInSEL !== null) {
      ae1.prevInSEL.nextInSEL = ae1;
    }
    ae1.nextInSEL = ae2;
    ae2.prevInSEL = ae1;
  }
  getCurrYMaximaVertexOpen(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.prev;
    }
    if (!_ClipperBase.isMaximaVertex(result))
      result = null;
    return result;
  }
  getCurrYMaximaVertex(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y)
        result = result.prev;
    }
    if (!_ClipperBase.isMaximaVertex(result))
      result = null;
    return result;
  }
  resetHorzDirection(horz, vertexMax) {
    if (horz.bot.x === horz.top.x) {
      const leftX = horz.curX;
      const rightX = horz.curX;
      let ae = horz.nextInAEL;
      while (ae !== null && ae.vertexTop !== vertexMax)
        ae = ae.nextInAEL;
      return { isLeftToRight: ae !== null, leftX, rightX };
    }
    if (horz.curX < horz.top.x) {
      return { isLeftToRight: true, leftX: horz.curX, rightX: horz.top.x };
    } else {
      return { isLeftToRight: false, leftX: horz.top.x, rightX: horz.curX };
    }
  }
  getLastOp(hotEdge) {
    const outrec = hotEdge.outrec;
    return hotEdge === outrec.frontEdge ? outrec.pts : outrec.pts.next;
  }
  insertLeftEdge(ae) {
    if (this.actives === null) {
      ae.prevInAEL = null;
      ae.nextInAEL = null;
      this.actives = ae;
    } else if (!this.isValidAelOrder(this.actives, ae)) {
      ae.prevInAEL = null;
      ae.nextInAEL = this.actives;
      this.actives.prevInAEL = ae;
      this.actives = ae;
    } else {
      let ae2 = this.actives;
      while (ae2.nextInAEL !== null && this.isValidAelOrder(ae2.nextInAEL, ae)) {
        ae2 = ae2.nextInAEL;
      }
      if (ae2.joinWith === JoinWith.Right)
        ae2 = ae2.nextInAEL;
      ae.nextInAEL = ae2.nextInAEL;
      if (ae2.nextInAEL !== null)
        ae2.nextInAEL.prevInAEL = ae;
      ae.prevInAEL = ae2;
      ae2.nextInAEL = ae;
    }
  }
  insertRightEdge(ae1, ae2) {
    ae2.nextInAEL = ae1.nextInAEL;
    if (ae1.nextInAEL !== null)
      ae1.nextInAEL.prevInAEL = ae2;
    ae2.prevInAEL = ae1;
    ae1.nextInAEL = ae2;
  }
  setWindCountForOpenPathEdge(ae) {
    let ae2 = this.actives;
    if (this.fillrule === FillRule.EvenOdd) {
      let cnt1 = 0, cnt2 = 0;
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
          cnt2++;
        } else if (!_ClipperBase.isOpen(ae2)) {
          cnt1++;
        }
        ae2 = ae2.nextInAEL;
      }
      ae.windCount = _ClipperBase.isOdd(cnt1) ? 1 : 0;
      ae.windCount2 = _ClipperBase.isOdd(cnt2) ? 1 : 0;
    } else {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
          ae.windCount2 += ae2.windDx;
        } else if (!_ClipperBase.isOpen(ae2)) {
          ae.windCount += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  setWindCountForClosedPathEdge(ae) {
    let ae2 = ae.prevInAEL;
    const pt = _ClipperBase.getPolyType(ae);
    if (!_ClipperBase.openPathsEnabled) {
      while (ae2 !== null && _ClipperBase.getPolyType(ae2) !== pt)
        ae2 = ae2.prevInAEL;
      if (ae2 === null) {
        ae.windCount = ae.windDx;
        ae2 = this.actives;
      } else if (this.fillrule === FillRule.EvenOdd) {
        ae.windCount = ae.windDx;
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      } else {
        if (ae2.windCount * ae2.windDx < 0) {
          if (Math.abs(ae2.windCount) > 1) {
            if (ae2.windDx * ae.windDx < 0) {
              ae.windCount = ae2.windCount;
            } else {
              ae.windCount = ae2.windCount + ae.windDx;
            }
          } else {
            ae.windCount = ae.windDx;
          }
        } else {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        }
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      }
      if (this.fillrule === FillRule.EvenOdd) {
        while (ae2 !== ae) {
          if (_ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
          }
          ae2 = ae2.nextInAEL;
        }
      } else {
        while (ae2 !== ae) {
          if (_ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 += ae2.windDx;
          }
          ae2 = ae2.nextInAEL;
        }
      }
      return;
    }
    while (ae2 !== null && (_ClipperBase.getPolyType(ae2) !== pt || _ClipperBase.isOpen(ae2)))
      ae2 = ae2.prevInAEL;
    if (ae2 === null) {
      ae.windCount = ae.windDx;
      ae2 = this.actives;
    } else if (this.fillrule === FillRule.EvenOdd) {
      ae.windCount = ae.windDx;
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    } else {
      if (ae2.windCount * ae2.windDx < 0) {
        if (Math.abs(ae2.windCount) > 1) {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        } else {
          ae.windCount = _ClipperBase.isOpen(ae) ? 1 : ae.windDx;
        }
      } else {
        if (ae2.windDx * ae.windDx < 0) {
          ae.windCount = ae2.windCount;
        } else {
          ae.windCount = ae2.windCount + ae.windDx;
        }
      }
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    }
    if (this.fillrule === FillRule.EvenOdd) {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
          ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
        }
        ae2 = ae2.nextInAEL;
      }
    } else {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
          ae.windCount2 += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  isContributingOpen(ae) {
    let isInClip, isInSubj;
    switch (this.fillrule) {
      case FillRule.Positive:
        isInSubj = ae.windCount > 0;
        isInClip = ae.windCount2 > 0;
        break;
      case FillRule.Negative:
        isInSubj = ae.windCount < 0;
        isInClip = ae.windCount2 < 0;
        break;
      default:
        isInSubj = ae.windCount !== 0;
        isInClip = ae.windCount2 !== 0;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return isInClip;
      case ClipType.Union:
        return !isInSubj && !isInClip;
      default:
        return !isInClip;
    }
  }
  isContributingClosed(ae) {
    switch (this.fillrule) {
      case FillRule.Positive:
        if (ae.windCount !== 1)
          return false;
        break;
      case FillRule.Negative:
        if (ae.windCount !== -1)
          return false;
        break;
      case FillRule.NonZero:
        if (Math.abs(ae.windCount) !== 1)
          return false;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return this.fillrule === FillRule.Positive ? ae.windCount2 > 0 : this.fillrule === FillRule.Negative ? ae.windCount2 < 0 : ae.windCount2 !== 0;
      case ClipType.Union:
        return this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
      case ClipType.Difference: {
        const result = this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
        return _ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;
      }
      case ClipType.Xor:
        return true;
      // XOr is always contributing unless open
      default:
        return false;
    }
  }
  addLocalMinPoly(ae1, ae2, pt, isNew = false) {
    const outrec = this.newOutRec();
    ae1.outrec = outrec;
    ae2.outrec = outrec;
    if (_ClipperBase.isOpen(ae1)) {
      outrec.owner = null;
      outrec.isOpen = true;
      if (ae1.windDx > 0) {
        this.setSides(outrec, ae1, ae2);
      } else {
        this.setSides(outrec, ae2, ae1);
      }
    } else {
      outrec.isOpen = false;
      const prevHotEdge = _ClipperBase.getPrevHotEdge(ae1);
      if (prevHotEdge !== null) {
        if (this.usingPolytree) {
          this.setOwner(outrec, prevHotEdge.outrec);
        }
        outrec.owner = prevHotEdge.outrec;
        if (this.outrecIsAscending(prevHotEdge) === isNew) {
          this.setSides(outrec, ae2, ae1);
        } else {
          this.setSides(outrec, ae1, ae2);
        }
      } else {
        outrec.owner = null;
        if (isNew) {
          this.setSides(outrec, ae1, ae2);
        } else {
          this.setSides(outrec, ae2, ae1);
        }
      }
    }
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  outrecIsAscending(hotEdge) {
    return hotEdge === hotEdge.outrec.frontEdge;
  }
  newOutRec() {
    const result = new OutRec();
    result.idx = this.outrecList.length;
    this.outrecList.push(result);
    return result;
  }
  startOpenPath(ae, pt) {
    const outrec = this.newOutRec();
    outrec.isOpen = true;
    if (ae.windDx > 0) {
      outrec.frontEdge = ae;
      outrec.backEdge = null;
    } else {
      outrec.frontEdge = null;
      outrec.backEdge = ae;
    }
    ae.outrec = outrec;
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  checkJoinLeft(ae, pt, checkCurrX = false) {
    const prev = ae.prevInAEL;
    if (prev === null)
      return;
    if (!checkCurrX && ae.curX !== prev.curX)
      return;
    if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(prev) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(prev) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(prev))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < prev.top.y + 2) && // avoid trivial joins
    (ae.bot.y > pt.y || prev.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, prev.bot, prev.top))
        return;
    }
    if (!InternalClipper.isCollinear(ae.top, pt, prev.top))
      return;
    if (ae.outrec.idx === prev.outrec.idx) {
      this.addLocalMaxPoly(prev, ae, pt);
    } else if (ae.outrec.idx < prev.outrec.idx) {
      this.joinOutrecPaths(ae, prev);
    } else {
      this.joinOutrecPaths(prev, ae);
    }
    prev.joinWith = JoinWith.Right;
    ae.joinWith = JoinWith.Left;
  }
  checkJoinRight(ae, pt, checkCurrX = false) {
    const next = ae.nextInAEL;
    if (next === null)
      return;
    if (!checkCurrX && ae.curX !== next.curX)
      return;
    if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(next) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(next) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(next))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < next.top.y + 2) && // avoid trivial joins
    (ae.bot.y > pt.y || next.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, next.bot, next.top))
        return;
    }
    if (!InternalClipper.isCollinear(ae.top, pt, next.top))
      return;
    if (ae.outrec.idx === next.outrec.idx) {
      this.addLocalMaxPoly(ae, next, pt);
    } else if (ae.outrec.idx < next.outrec.idx) {
      this.joinOutrecPaths(ae, next);
    } else {
      this.joinOutrecPaths(next, ae);
    }
    ae.joinWith = JoinWith.Right;
    next.joinWith = JoinWith.Left;
  }
  perpendicDistFromLineSqrdGreaterThanQuarter(pt, line1, line2) {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0)
      return false;
    const maxCoord = InternalClipper.maxCoordForSafeCrossSq;
    if (Math.abs(a) < maxCoord && Math.abs(b) < maxCoord && Math.abs(c) < maxCoord && Math.abs(d) < maxCoord) {
      const cross2 = a * d - c * b;
      return cross2 * cross2 / (c * c + d * d) > 0.25;
    }
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
      const cross2 = BigInt(a) * BigInt(d) - BigInt(c) * BigInt(b);
      const crossSq = cross2 * cross2;
      const denom = BigInt(c) * BigInt(c) + BigInt(d) * BigInt(d);
      return B4 * crossSq > denom;
    }
    const cross = a * d - c * b;
    return cross * cross / (c * c + d * d) > 0.25;
  }
  intersectEdges(ae1, ae2, pt) {
    let resultOp;
    if (this.hasOpenPaths && (_ClipperBase.isOpen(ae1) || _ClipperBase.isOpen(ae2))) {
      if (_ClipperBase.isOpen(ae1) && _ClipperBase.isOpen(ae2))
        return;
      if (_ClipperBase.isOpen(ae2)) {
        const tmp = ae1;
        ae1 = ae2;
        ae2 = tmp;
      }
      if (this.isJoined(ae2))
        this.split(ae2, pt);
      if (this.cliptype === ClipType.Union) {
        if (!_ClipperBase.isHotEdge(ae2))
          return;
      } else if (ae2.localMin.polytype === PathType.Subject)
        return;
      switch (this.fillrule) {
        case FillRule.Positive:
          if (ae2.windCount !== 1)
            return;
          break;
        case FillRule.Negative:
          if (ae2.windCount !== -1)
            return;
          break;
        default:
          if (Math.abs(ae2.windCount) !== 1)
            return;
          break;
      }
      if (_ClipperBase.isHotEdge(ae1)) {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        if (_ClipperBase.isFront(ae1)) {
          ae1.outrec.frontEdge = null;
        } else {
          ae1.outrec.backEdge = null;
        }
        ae1.outrec = null;
      } else if (pt.x === ae1.localMin.vertex.pt.x && pt.y === ae1.localMin.vertex.pt.y && !_ClipperBase.isOpenEndVertex(ae1.localMin.vertex)) {
        const ae3 = this.findEdgeWithMatchingLocMin(ae1);
        if (ae3 !== null && _ClipperBase.isHotEdge(ae3)) {
          ae1.outrec = ae3.outrec;
          if (ae1.windDx > 0) {
            this.setSides(ae3.outrec, ae1, ae3);
          } else {
            this.setSides(ae3.outrec, ae3, ae1);
          }
          return;
        }
        resultOp = this.startOpenPath(ae1, pt);
      } else {
        resultOp = this.startOpenPath(ae1, pt);
      }
      this.setZ(ae1, ae2, resultOp.pt);
      return;
    }
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    let oldE1WindCount, oldE2WindCount;
    if (ae1.localMin.polytype === ae2.localMin.polytype) {
      if (this.fillrule === FillRule.EvenOdd) {
        oldE1WindCount = ae1.windCount;
        ae1.windCount = ae2.windCount;
        ae2.windCount = oldE1WindCount;
      } else {
        if (ae1.windCount + ae2.windDx === 0) {
          ae1.windCount = -ae1.windCount;
        } else {
          ae1.windCount += ae2.windDx;
        }
        if (ae2.windCount - ae1.windDx === 0) {
          ae2.windCount = -ae2.windCount;
        } else {
          ae2.windCount -= ae1.windDx;
        }
      }
    } else {
      if (this.fillrule !== FillRule.EvenOdd) {
        ae1.windCount2 += ae2.windDx;
      } else {
        ae1.windCount2 = ae1.windCount2 === 0 ? 1 : 0;
      }
      if (this.fillrule !== FillRule.EvenOdd) {
        ae2.windCount2 -= ae1.windDx;
      } else {
        ae2.windCount2 = ae2.windCount2 === 0 ? 1 : 0;
      }
    }
    switch (this.fillrule) {
      case FillRule.Positive:
        oldE1WindCount = ae1.windCount;
        oldE2WindCount = ae2.windCount;
        break;
      case FillRule.Negative:
        oldE1WindCount = -ae1.windCount;
        oldE2WindCount = -ae2.windCount;
        break;
      default:
        oldE1WindCount = Math.abs(ae1.windCount);
        oldE2WindCount = Math.abs(ae2.windCount);
        break;
    }
    const e1WindCountIs0or1 = oldE1WindCount === 0 || oldE1WindCount === 1;
    const e2WindCountIs0or1 = oldE2WindCount === 0 || oldE2WindCount === 1;
    if (!_ClipperBase.isHotEdge(ae1) && !e1WindCountIs0or1 || !_ClipperBase.isHotEdge(ae2) && !e2WindCountIs0or1)
      return;
    if (_ClipperBase.isHotEdge(ae1) && _ClipperBase.isHotEdge(ae2)) {
      if (oldE1WindCount !== 0 && oldE1WindCount !== 1 || oldE2WindCount !== 0 && oldE2WindCount !== 1 || ae1.localMin.polytype !== ae2.localMin.polytype && this.cliptype !== ClipType.Xor) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      } else if (_ClipperBase.isFront(ae1) || ae1.outrec === ae2.outrec) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
      } else {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addOutPt(ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
        this.swapOutrecs(ae1, ae2);
      }
    } else if (_ClipperBase.isHotEdge(ae1)) {
      resultOp = this.addOutPt(ae1, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else if (_ClipperBase.isHotEdge(ae2)) {
      resultOp = this.addOutPt(ae2, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else {
      let e1Wc2, e2Wc2;
      switch (this.fillrule) {
        case FillRule.Positive:
          e1Wc2 = ae1.windCount2;
          e2Wc2 = ae2.windCount2;
          break;
        case FillRule.Negative:
          e1Wc2 = -ae1.windCount2;
          e2Wc2 = -ae2.windCount2;
          break;
        default:
          e1Wc2 = Math.abs(ae1.windCount2);
          e2Wc2 = Math.abs(ae2.windCount2);
          break;
      }
      if (!_ClipperBase.isSamePolyType(ae1, ae2)) {
        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, resultOp.pt);
      } else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
        resultOp = null;
        switch (this.cliptype) {
          case ClipType.Union:
            if (e1Wc2 > 0 && e2Wc2 > 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          case ClipType.Difference:
            if (_ClipperBase.getPolyType(ae1) === PathType.Clip && e1Wc2 > 0 && e2Wc2 > 0 || _ClipperBase.getPolyType(ae1) === PathType.Subject && e1Wc2 <= 0 && e2Wc2 <= 0) {
              resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            }
            break;
          case ClipType.Xor:
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          default:
            if (e1Wc2 <= 0 || e2Wc2 <= 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
        }
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      }
    }
  }
  swapPositionsInAEL(ae1, ae2) {
    const next = ae2.nextInAEL;
    if (next !== null)
      next.prevInAEL = ae1;
    const prev = ae1.prevInAEL;
    if (prev !== null)
      prev.nextInAEL = ae2;
    ae2.prevInAEL = prev;
    ae2.nextInAEL = ae1;
    ae1.prevInAEL = ae2;
    ae1.nextInAEL = next;
    if (ae2.prevInAEL === null)
      this.actives = ae2;
  }
  isValidAelOrder(resident, newcomer) {
    if (newcomer.curX !== resident.curX) {
      return newcomer.curX > resident.curX;
    }
    const d = InternalClipper.crossProductSign(resident.top, newcomer.bot, newcomer.top);
    if (d !== 0)
      return d < 0;
    if (!_ClipperBase.isMaximaEdge(resident) && resident.top.y > newcomer.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, resident.top, _ClipperBase.nextVertex(resident).pt) <= 0;
    }
    if (!_ClipperBase.isMaximaEdge(newcomer) && newcomer.top.y > resident.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, newcomer.top, _ClipperBase.nextVertex(newcomer).pt) >= 0;
    }
    const y = newcomer.bot.y;
    const newcomerIsLeft = newcomer.isLeftBound;
    if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y) {
      return newcomer.isLeftBound;
    }
    if (resident.isLeftBound !== newcomerIsLeft) {
      return newcomerIsLeft;
    }
    if (InternalClipper.isCollinear(_ClipperBase.prevPrevVertex(resident).pt, resident.bot, resident.top))
      return true;
    return InternalClipper.crossProductSign(_ClipperBase.prevPrevVertex(resident).pt, newcomer.bot, _ClipperBase.prevPrevVertex(newcomer).pt) > 0 === newcomerIsLeft;
  }
  isJoined(e) {
    return e.joinWith !== JoinWith.None;
  }
  split(e, currPt) {
    if (e.joinWith === JoinWith.Right) {
      e.joinWith = JoinWith.None;
      e.nextInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e, e.nextInAEL, currPt, true);
    } else {
      e.joinWith = JoinWith.None;
      e.prevInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e.prevInAEL, e, currPt, true);
    }
  }
  setSides(outrec, startEdge, endEdge) {
    outrec.frontEdge = startEdge;
    outrec.backEdge = endEdge;
  }
  findEdgeWithMatchingLocMin(e) {
    var _a2, _b;
    let result = e.nextInAEL;
    while (result !== null) {
      if ((_a2 = result.localMin) == null ? void 0 : _a2.equals(e.localMin))
        return result;
      if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        result = null;
      else
        result = result.nextInAEL;
    }
    result = e.prevInAEL;
    while (result !== null) {
      if ((_b = result.localMin) == null ? void 0 : _b.equals(e.localMin))
        return result;
      if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        return null;
      result = result.prevInAEL;
    }
    return result;
  }
  addOutPt(ae, pt) {
    const outrec = ae.outrec;
    const toFront = _ClipperBase.isFront(ae);
    const opFront = outrec.pts;
    const opBack = opFront.next;
    if (toFront && pt.x === opFront.pt.x && pt.y === opFront.pt.y) {
      return opFront;
    } else if (!toFront && pt.x === opBack.pt.x && pt.y === opBack.pt.y) {
      return opBack;
    }
    const newOp = new OutPt(pt, outrec);
    opBack.prev = newOp;
    newOp.prev = opFront;
    newOp.next = opBack;
    opFront.next = newOp;
    if (toFront)
      outrec.pts = newOp;
    return newOp;
  }
  addLocalMaxPoly(ae1, ae2, pt) {
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    if (_ClipperBase.isFront(ae1) === _ClipperBase.isFront(ae2)) {
      if (_ClipperBase.isOpenEnd(ae1)) {
        this.swapFrontBackSides(ae1.outrec);
      } else if (_ClipperBase.isOpenEnd(ae2)) {
        this.swapFrontBackSides(ae2.outrec);
      } else {
        this.succeeded = false;
        return null;
      }
    }
    const result = this.addOutPt(ae1, pt);
    if (ae1.outrec === ae2.outrec) {
      const outrec = ae1.outrec;
      outrec.pts = result;
      if (this.usingPolytree) {
        const e = _ClipperBase.getPrevHotEdge(ae1);
        if (e === null) {
          outrec.owner = null;
        } else {
          this.setOwner(outrec, e.outrec);
        }
      }
      this.uncoupleOutRec(ae1);
    } else if (_ClipperBase.isOpen(ae1)) {
      if (ae1.windDx < 0) {
        this.joinOutrecPaths(ae1, ae2);
      } else {
        this.joinOutrecPaths(ae2, ae1);
      }
    } else if (ae1.outrec.idx < ae2.outrec.idx) {
      this.joinOutrecPaths(ae1, ae2);
    } else {
      this.joinOutrecPaths(ae2, ae1);
    }
    return result;
  }
  swapFrontBackSides(outrec) {
    const ae2 = outrec.frontEdge;
    outrec.frontEdge = outrec.backEdge;
    outrec.backEdge = ae2;
    outrec.pts = outrec.pts.next;
  }
  setOwner(outrec, newOwner) {
    while (newOwner.owner !== null && newOwner.owner.pts === null) {
      newOwner.owner = newOwner.owner.owner;
    }
    let tmp = newOwner;
    while (tmp !== null && tmp !== outrec) {
      tmp = tmp.owner;
    }
    if (tmp !== null) {
      newOwner.owner = outrec.owner;
    }
    outrec.owner = newOwner;
  }
  uncoupleOutRec(ae) {
    const outrec = ae.outrec;
    if (outrec === null)
      return;
    outrec.frontEdge.outrec = null;
    outrec.backEdge.outrec = null;
    outrec.frontEdge = null;
    outrec.backEdge = null;
  }
  joinOutrecPaths(ae1, ae2) {
    const p1Start = ae1.outrec.pts;
    const p2Start = ae2.outrec.pts;
    const p1End = p1Start.next;
    const p2End = p2Start.next;
    if (_ClipperBase.isFront(ae1)) {
      p2End.prev = p1Start;
      p1Start.next = p2End;
      p2Start.next = p1End;
      p1End.prev = p2Start;
      ae1.outrec.pts = p2Start;
      ae1.outrec.frontEdge = ae2.outrec.frontEdge;
      if (ae1.outrec.frontEdge !== null) {
        ae1.outrec.frontEdge.outrec = ae1.outrec;
      }
    } else {
      p1End.prev = p2Start;
      p2Start.next = p1End;
      p1Start.next = p2End;
      p2End.prev = p1Start;
      ae1.outrec.backEdge = ae2.outrec.backEdge;
      if (ae1.outrec.backEdge !== null) {
        ae1.outrec.backEdge.outrec = ae1.outrec;
      }
    }
    ae2.outrec.frontEdge = null;
    ae2.outrec.backEdge = null;
    ae2.outrec.pts = null;
    this.setOwner(ae2.outrec, ae1.outrec);
    if (_ClipperBase.isOpenEnd(ae1)) {
      ae2.outrec.pts = ae1.outrec.pts;
      ae1.outrec.pts = null;
    }
    ae1.outrec = null;
    ae2.outrec = null;
  }
  swapOutrecs(ae1, ae2) {
    const or1 = ae1.outrec;
    const or2 = ae2.outrec;
    if (or1 === or2) {
      const ae = or1.frontEdge;
      or1.frontEdge = or1.backEdge;
      or1.backEdge = ae;
      return;
    }
    if (or1 !== null) {
      if (ae1 === or1.frontEdge) {
        or1.frontEdge = ae2;
      } else {
        or1.backEdge = ae2;
      }
    }
    if (or2 !== null) {
      if (ae2 === or2.frontEdge) {
        or2.frontEdge = ae1;
      } else {
        or2.backEdge = ae1;
      }
    }
    ae1.outrec = or2;
    ae2.outrec = or1;
  }
  disposeIntersectNodes() {
    this.intersectList.length = 0;
  }
  static ptsReallyClose(pt1, pt2) {
    return Math.abs(pt1.x - pt2.x) < 2 && Math.abs(pt1.y - pt2.y) < 2;
  }
  static isVerySmallTriangle(op) {
    return op.next.next === op.prev && (_ClipperBase.ptsReallyClose(op.prev.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.prev.pt));
  }
  static buildPath(op, reverse, isOpen, path) {
    if (op === null || op.next === op || !isOpen && op.next === op.prev)
      return false;
    path.length = 0;
    let lastPt;
    let op2;
    if (reverse) {
      lastPt = op.pt;
      op2 = op.prev;
    } else {
      op = op.next;
      lastPt = op.pt;
      op2 = op.next;
    }
    path.push(lastPt);
    while (op2 !== op) {
      if (!(op2.pt.x === lastPt.x && op2.pt.y === lastPt.y)) {
        lastPt = op2.pt;
        path.push(lastPt);
      }
      if (reverse) {
        op2 = op2.prev;
      } else {
        op2 = op2.next;
      }
    }
    return path.length !== 3 || isOpen || !_ClipperBase.isVerySmallTriangle(op2);
  }
  buildPaths(solutionClosed, solutionOpen) {
    solutionClosed.length = 0;
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      const path = [];
      if (outrec.isOpen) {
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path)) {
          solutionOpen.push(path);
        }
      } else {
        this.cleanCollinear(outrec);
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path)) {
          solutionClosed.push(path);
        }
      }
    }
    return true;
  }
  buildTree(polytree, solutionOpen) {
    polytree.clear();
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      if (outrec.isOpen) {
        const openPath = [];
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, openPath)) {
          solutionOpen.push(openPath);
        }
        continue;
      }
      if (this.checkBounds(outrec)) {
        this.recursiveCheckOwners(outrec, polytree);
      }
    }
  }
  checkBounds(outrec) {
    if (outrec.pts === null)
      return false;
    if (!Rect64Utils.isEmpty(outrec.bounds))
      return true;
    this.cleanCollinear(outrec);
    if (outrec.pts === null || !_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path)) {
      return false;
    }
    outrec.bounds = InternalClipper.getBounds(outrec.path);
    return true;
  }
  recursiveCheckOwners(outrec, polypath) {
    if (outrec.polypath !== null || Rect64Utils.isEmpty(outrec.bounds))
      return;
    while (outrec.owner !== null) {
      if (outrec.owner.splits !== null && this.checkSplitOwner(outrec, outrec.owner.splits))
        break;
      if (outrec.owner.pts !== null && this.checkBounds(outrec.owner) && // Fast reject: a container must contain the child's bounds.
      this.containsRect(outrec.owner.bounds, outrec.bounds) && this.path1InsidePath2(outrec.pts, outrec.owner.pts))
        break;
      outrec.owner = outrec.owner.owner;
    }
    if (outrec.owner !== null) {
      if (outrec.owner.polypath === null) {
        this.recursiveCheckOwners(outrec.owner, polypath);
      }
      outrec.polypath = outrec.owner.polypath.addChild(outrec.path);
    } else {
      outrec.polypath = polypath.addChild(outrec.path);
    }
  }
  cleanCollinear(outrec) {
    outrec = this.getRealOutRec(outrec);
    if (outrec === null || outrec.isOpen)
      return;
    if (!this.isValidClosedPath(outrec.pts)) {
      outrec.pts = null;
      return;
    }
    let startOp = outrec.pts;
    let op2 = startOp;
    while (true) {
      if (op2 !== null && InternalClipper.isCollinear(op2.prev.pt, op2.pt, op2.next.pt) && (op2.pt.x === op2.prev.pt.x && op2.pt.y === op2.prev.pt.y || op2.pt.x === op2.next.pt.x && op2.pt.y === op2.next.pt.y || !this.preserveCollinear || InternalClipper.dotProductSign(op2.prev.pt, op2.pt, op2.next.pt) < 0)) {
        if (op2 === outrec.pts) {
          outrec.pts = op2.prev;
        }
        op2 = this.disposeOutPt(op2);
        if (!this.isValidClosedPath(op2)) {
          outrec.pts = null;
          return;
        }
        startOp = op2;
        continue;
      }
      if (op2 === null)
        break;
      op2 = op2.next;
      if (op2 === startOp)
        break;
    }
    this.fixSelfIntersects(outrec);
  }
  isValidClosedPath(op) {
    return op !== null && op.next !== op && (op.next !== op.prev || !_ClipperBase.isVerySmallTriangle(op));
  }
  disposeOutPt(op) {
    const result = op.next === op ? null : op.next;
    op.prev.next = op.next;
    op.next.prev = op.prev;
    return result;
  }
  fixSelfIntersects(outrec) {
    let op2 = outrec.pts;
    if (op2.prev === op2.next.next) {
      return;
    }
    while (true) {
      if (op2.next && op2.next.next && this.boundingBoxesOverlap(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt) && InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt)) {
        if (op2 === outrec.pts || op2.next === outrec.pts) {
          outrec.pts = outrec.pts.prev;
        }
        this.doSplitOp(outrec, op2);
        if (outrec.pts === null)
          return;
        op2 = outrec.pts;
        if (op2.prev === op2.next.next)
          break;
        continue;
      }
      op2 = op2.next;
      if (op2 === outrec.pts)
        break;
    }
  }
  doSplitOp(outrec, splitOp) {
    const prevOp = splitOp.prev;
    const nextNextOp = splitOp.next.next;
    outrec.pts = prevOp;
    const ip = InternalClipper.getLineIntersectPt(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt);
    if (this.zCallbackInternal) {
      this.zCallbackInternal(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt, ip);
    }
    const doubleArea1 = _ClipperBase.areaOutPt(prevOp);
    const absDoubleArea1 = doubleArea1 < B0 ? -doubleArea1 : doubleArea1;
    if (absDoubleArea1 < B4) {
      outrec.pts = null;
      return;
    }
    const doubleArea2 = this.areaTriangle(ip, splitOp.pt, splitOp.next.pt);
    const absDoubleArea2 = doubleArea2 < B0 ? -doubleArea2 : doubleArea2;
    if (ip.x === prevOp.pt.x && ip.y === prevOp.pt.y || ip.x === nextNextOp.pt.x && ip.y === nextNextOp.pt.y) {
      nextNextOp.prev = prevOp;
      prevOp.next = nextNextOp;
    } else {
      const newOp2 = new OutPt(ip, outrec);
      newOp2.prev = prevOp;
      newOp2.next = nextNextOp;
      nextNextOp.prev = newOp2;
      prevOp.next = newOp2;
    }
    if (!(absDoubleArea2 > B2) || // area > 1
    !(absDoubleArea2 > absDoubleArea1) && doubleArea2 > B0 !== doubleArea1 > B0)
      return;
    const newOutRec = this.newOutRec();
    newOutRec.owner = outrec.owner;
    splitOp.outrec = newOutRec;
    splitOp.next.outrec = newOutRec;
    const newOp = new OutPt(ip, newOutRec);
    newOp.prev = splitOp.next;
    newOp.next = splitOp;
    newOutRec.pts = newOp;
    splitOp.prev = newOp;
    splitOp.next.next = newOp;
    if (!this.usingPolytree)
      return;
    if (this.path1InsidePath2(prevOp, newOp)) {
      if (newOutRec.splits === null)
        newOutRec.splits = [];
      newOutRec.splits.push(outrec.idx);
    } else {
      if (outrec.splits === null)
        outrec.splits = [];
      outrec.splits.push(newOutRec.idx);
    }
  }
  static areaOutPt(op) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    let area = 0;
    let allSmall = true;
    let op2 = op;
    do {
      const prev = op2.prev;
      const pt = op2.pt;
      if (Math.abs(prev.pt.x) >= maxCoord || Math.abs(prev.pt.y) >= maxCoord || Math.abs(pt.x) >= maxCoord || Math.abs(pt.y) >= maxCoord) {
        allSmall = false;
        break;
      }
      area += (prev.pt.y + pt.y) * (prev.pt.x - pt.x);
      op2 = op2.next;
    } while (op2 !== op);
    if (allSmall) {
      return BigInt(Math.round(area));
    }
    let areaBig = B0;
    op2 = op;
    do {
      const prev = op2.prev;
      if (Number.isSafeInteger(prev.pt.y) && Number.isSafeInteger(op2.pt.y) && Number.isSafeInteger(prev.pt.x) && Number.isSafeInteger(op2.pt.x)) {
        const sumBig = BigInt(prev.pt.y) + BigInt(op2.pt.y);
        const diffBig = BigInt(prev.pt.x) - BigInt(op2.pt.x);
        areaBig += sumBig * diffBig;
      } else {
        const sum = prev.pt.y + op2.pt.y;
        const diff = prev.pt.x - op2.pt.x;
        areaBig += BigInt(Math.round(sum * diff));
      }
      op2 = op2.next;
    } while (op2 !== op);
    return areaBig;
  }
  areaTriangle(pt1, pt2, pt3) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    if (Math.abs(pt1.x) < maxCoord && Math.abs(pt1.y) < maxCoord && Math.abs(pt2.x) < maxCoord && Math.abs(pt2.y) < maxCoord && Math.abs(pt3.x) < maxCoord && Math.abs(pt3.y) < maxCoord) {
      const area2 = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
      return BigInt(Math.round(area2));
    }
    if (Number.isSafeInteger(pt1.x) && Number.isSafeInteger(pt1.y) && Number.isSafeInteger(pt2.x) && Number.isSafeInteger(pt2.y) && Number.isSafeInteger(pt3.x) && Number.isSafeInteger(pt3.y)) {
      const term1 = (BigInt(pt3.y) + BigInt(pt1.y)) * (BigInt(pt3.x) - BigInt(pt1.x));
      const term2 = (BigInt(pt1.y) + BigInt(pt2.y)) * (BigInt(pt1.x) - BigInt(pt2.x));
      const term3 = (BigInt(pt2.y) + BigInt(pt3.y)) * (BigInt(pt2.x) - BigInt(pt3.x));
      return term1 + term2 + term3;
    }
    const area = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
    return BigInt(Math.round(area));
  }
  isValidOwner(outRec, testOwner) {
    while (testOwner !== null && testOwner !== outRec) {
      testOwner = testOwner.owner;
    }
    return testOwner === null;
  }
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  }
  checkSplitOwner(outrec, splits) {
    for (let i = 0; i < splits.length; i++) {
      let split = this.outrecList[splits[i]];
      if (split.pts === null && split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      split = this.getRealOutRec(split);
      if (split === null || split === outrec || split.recursiveSplit === outrec)
        continue;
      split.recursiveSplit = outrec;
      if (split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      if (!this.checkBounds(split) || !this.containsRect(split.bounds, outrec.bounds) || !this.path1InsidePath2(outrec.pts, split.pts))
        continue;
      if (!this.isValidOwner(outrec, split)) {
        split.owner = outrec.owner;
      }
      outrec.owner = split;
      return true;
    }
    return false;
  }
};
// When there are no open paths, a lot of open-path branching becomes dead code.
// We set this per execute to allow fast short-circuiting in hot helpers.
__publicField(_ClipperBase, "openPathsEnabled", true);
let ClipperBase = _ClipperBase;
class Clipper64 extends ClipperBase {
  constructor() {
    super(...arguments);
    __publicField(this, "zCallback");
  }
  getZCallback() {
    return this.zCallback;
  }
  addPath(path, polytype, isOpen = false) {
    super.addPath(path, polytype, isOpen);
  }
  addReuseableData(reuseableData) {
    super.addReuseableData(reuseableData);
  }
  addPaths(paths, polytype, isOpen = false) {
    super.addPaths(paths, polytype, isOpen);
  }
  addSubject(paths) {
    this.addPaths(paths, PathType.Subject);
  }
  addOpenSubject(paths) {
    this.addPaths(paths, PathType.Subject, true);
  }
  addClip(paths) {
    this.addPaths(paths, PathType.Clip);
  }
  execute(clipType, fillRule, solutionOrTree, openPathsOrSolutionOpen) {
    if (Array.isArray(solutionOrTree)) {
      const solutionClosed = solutionOrTree;
      const solutionOpen = openPathsOrSolutionOpen;
      solutionClosed.length = 0;
      if (solutionOpen)
        solutionOpen.length = 0;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildPaths(solutionClosed, solutionOpen || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    } else {
      const polytree = solutionOrTree;
      const openPaths = openPathsOrSolutionOpen;
      polytree.clear();
      if (openPaths)
        openPaths.length = 0;
      this.usingPolytree = true;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildTree(polytree, openPaths || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    }
  }
}
BigInt(2);
function union$1(subject, clipOrFillRule, fillRule) {
  if (typeof clipOrFillRule === "number") {
    return booleanOp(ClipType.Union, subject, null, clipOrFillRule);
  } else {
    return booleanOp(ClipType.Union, subject, clipOrFillRule, fillRule);
  }
}
function booleanOp(clipType, subject, clip, fillRule) {
  const solution = [];
  if (subject === null)
    return solution;
  const c = new Clipper64();
  c.addPaths(subject, PathType.Subject);
  if (clip !== null) {
    c.addPaths(clip, PathType.Clip);
  }
  c.execute(clipType, fillRule, solution);
  return solution;
}
function normalizeHatchRegion(hatch, tolerance) {
  const safeTolerance = Math.max(1e-9, tolerance);
  const contours = [];
  for (const path of hatch.boundaryPaths) {
    const segments = [];
    for (const edge of path.edges) {
      const points = flattenHatchEdge(edge, safeTolerance);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) > safeTolerance) segments.push({ start, end });
      }
    }
    const assembled = assembleContours(segments, safeTolerance);
    if (!assembled) return { status: "invalid", code: "HATCH_BOUNDARY_OPEN" };
    contours.push(...assembled);
  }
  if (contours.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
  const largest = Math.max(...contours.flatMap((contour) => contour.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])), 1);
  const requestedScale = Math.max(1, Math.ceil(1 / safeTolerance));
  const maxScale = Math.floor(Number.MAX_SAFE_INTEGER / 1024 / largest);
  const scale = Math.min(requestedScale, maxScale);
  if (!(scale >= 1)) return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
  try {
    const paths = contours.map((contour) => contour.map(([x, y]) => ({ x: Math.round(x * scale), y: Math.round(y * scale) })));
    const normalized2 = union$1(paths, FillRule.EvenOdd).map((path) => path.map(({ x, y }) => [x / scale, y / scale])).filter((path) => path.length >= 3);
    if (normalized2.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
    const selected = selectByStyle(normalized2, hatch.style);
    return {
      status: "ok",
      region: { contours: selected, fillRule: hatch.style === "normal" ? "evenodd" : "nonzero", bounds: boundsOf(selected) }
    };
  } catch {
    return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
  }
}
function assembleContours(segments, tolerance) {
  if (segments.length < 3) return null;
  const key = ([x, y]) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
  const incidence = /* @__PURE__ */ new Map();
  segments.forEach((segment, index) => {
    for (const point3 of [segment.start, segment.end]) {
      const bucket = incidence.get(key(point3)) ?? [];
      bucket.push(index);
      incidence.set(key(point3), bucket);
    }
  });
  if ([...incidence.values()].some((indices) => indices.length !== 2)) return null;
  const unused = new Set(segments.map((_, index) => index));
  const contours = [];
  while (unused.size > 0) {
    const firstIndex = unused.values().next().value;
    const first = segments[firstIndex];
    unused.delete(firstIndex);
    const contour = [first.start, first.end];
    const startKey = key(first.start);
    let currentKey = key(first.end);
    while (currentKey !== startKey) {
      const nextIndex = (incidence.get(currentKey) ?? []).find((index) => unused.has(index));
      if (nextIndex === void 0) return null;
      const next = segments[nextIndex];
      unused.delete(nextIndex);
      const nextPoint = key(next.start) === currentKey ? next.end : next.start;
      contour.push(nextPoint);
      currentKey = key(nextPoint);
      if (contour.length > segments.length + 1) return null;
    }
    contour.pop();
    if (contour.length < 3) return null;
    contours.push(contour);
  }
  return contours;
}
function selectByStyle(contours, style) {
  if (style === "normal") return contours;
  const depths = contours.map((contour, index) => contours.reduce((depth, candidate, candidateIndex) => candidateIndex !== index && pointInPolygon(contour[0], candidate) ? depth + 1 : depth, 0));
  if (style === "outer") return contours.filter((_, index) => (depths[index] ?? 0) <= 1);
  return contours.filter((_, index) => (depths[index] ?? 0) === 0);
}
function pointInPolygon(point3, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (a[1] > point3[1] !== b[1] > point3[1] && point3[0] < (b[0] - a[0]) * (point3[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function boundsOf(contours) {
  const points = contours.flat();
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
const MAX_HATCH_RENDER_LINES = 2e4;
function createHatchRenderPlan(hatch, tolerance) {
  const normalized2 = normalizeHatchRegion(hatch, tolerance);
  if (normalized2.status !== "ok") return normalized2;
  const lines = [];
  for (const family of hatch.patternLines) {
    const generated = generateFamily(transformPatternFamily(family, hatch.patternAngle, hatch.patternScale), normalized2.region);
    if (lines.length + generated.length > MAX_HATCH_RENDER_LINES) {
      return { status: "invalid", code: "HATCH_PATTERN_DENSITY_LIMIT" };
    }
    lines.push(...generated);
  }
  return { status: "ok", plan: { region: normalized2.region, lines } };
}
function transformPatternFamily(family, angleDegrees, scale) {
  const angle = angleDegrees * Math.PI / 180;
  const rotateScale = ([x, y]) => [
    scale * (x * Math.cos(angle) - y * Math.sin(angle)),
    scale * (x * Math.sin(angle) + y * Math.cos(angle))
  ];
  return {
    angle: family.angle + angleDegrees,
    base: rotateScale(family.base),
    offset: rotateScale(family.offset),
    dashLengths: family.dashLengths.map((value) => value * scale)
  };
}
function generateFamily(family, region) {
  const angle = family.angle * Math.PI / 180;
  const direction = [Math.cos(angle), Math.sin(angle)];
  const normal = [-direction[1], direction[0]];
  const spacing = dot(family.offset, normal);
  if (Math.abs(spacing) <= 1e-12) return [];
  const corners = [
    [region.bounds.minX, region.bounds.minY],
    [region.bounds.maxX, region.bounds.minY],
    [region.bounds.maxX, region.bounds.maxY],
    [region.bounds.minX, region.bounds.maxY]
  ];
  const cornerProjections = corners.map((point3) => dot(point3, normal));
  const baseProjection = dot(family.base, normal);
  const minIndex = Math.floor((Math.min(...cornerProjections) - baseProjection) / spacing) - 1;
  const maxIndex = Math.ceil((Math.max(...cornerProjections) - baseProjection) / spacing) + 1;
  const first = Math.min(minIndex, maxIndex);
  const last = Math.max(minIndex, maxIndex);
  const diagonal = Math.hypot(region.bounds.maxX - region.bounds.minX, region.bounds.maxY - region.bounds.minY);
  const alongProjections = corners.map((point3) => dot(point3, direction));
  const minimumAlong = Math.min(...alongProjections) - Math.max(1, diagonal * 0.01);
  const maximumAlong = Math.max(...alongProjections) + Math.max(1, diagonal * 0.01);
  const result = [];
  for (let index = first; index <= last; index += 1) {
    const origin = [family.base[0] + family.offset[0] * index, family.base[1] + family.offset[1] * index];
    const originAlong = dot(origin, direction);
    const startDistance = minimumAlong - originAlong;
    const endDistance = maximumAlong - originAlong;
    result.push({
      start: [origin[0] + direction[0] * startDistance, origin[1] + direction[1] * startDistance],
      end: [origin[0] + direction[0] * endDistance, origin[1] + direction[1] * endDistance],
      dashArray: family.dashLengths.map(Math.abs),
      dashOffset: startDistance
    });
  }
  return result;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
const MIN_SCALE = 0.01;
const MAX_SCALE = 1e3;
function screenToWorld(point3, viewport) {
  return [
    (point3[0] - viewport.x) / viewport.scale,
    (viewport.y - point3[1]) / viewport.scale
  ];
}
function zoomViewportAt(viewport, screenPoint, factor) {
  const anchor = screenToWorld(screenPoint, viewport);
  const scale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
  return {
    ...viewport,
    scale,
    x: screenPoint[0] - anchor[0] * scale,
    y: screenPoint[1] + anchor[1] * scale
  };
}
function fitViewportToDrawing(document2, size, padding = 1.2) {
  const bounds = drawingBounds(document2) ?? { minX: -50, minY: -50, maxX: 50, maxY: 50 };
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const safePadding = Number.isFinite(padding) && padding > 0 ? padding : 1.2;
  const scale = clamp(Math.min(
    Math.max(size.width, 1) / (boundsWidth * safePadding),
    Math.max(size.height, 1) / (boundsHeight * safePadding)
  ), MIN_SCALE, MAX_SCALE);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    x: size.width / 2 - centerX * scale,
    y: size.height / 2 + centerY * scale,
    scale,
    width: size.width,
    height: size.height
  };
}
function drawingBounds(document2) {
  const bounds = [...document2.geometry, ...document2.annotations].filter((node) => node.visible).map(nodeBounds).filter((value) => value !== null);
  return unionBounds(bounds);
}
function nodesInWorldBox(document2, box) {
  return [...document2.geometry, ...document2.annotations].filter((node) => node.visible).filter((node) => {
    const bounds = nodeBounds(node);
    return bounds !== null && boundsIntersect(bounds, box);
  }).map((node) => node.id);
}
function nodeBounds(node) {
  switch (node.type) {
    case "point":
      return boundsFromPoints([[node.x, node.y]]);
    case "line":
      return boundsFromPoints([node.start, node.end]);
    case "ray":
    case "xline":
      return null;
    case "circle":
      return finiteCircleBounds(node.center, node.radius);
    case "arc":
      return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
    case "ellipse":
      return ellipseBounds(node);
    case "polyline":
      return boundsFromPoints(node.vertices.map((vertex) => vertex.point));
    case "spline":
      return splineBounds(node);
    case "text":
      return textBounds(node);
    case "dimension":
      return boundsFromPoints([...node.definitionPoints, node.textPosition]);
    case "leader":
      return boundsFromPoints(node.points);
    case "centerline":
      return extendedLineBounds(node.start, node.end, node.extension);
    case "section-hatch": {
      if (node.hatch !== void 0) {
        const normalized2 = normalizeHatchRegion(node.hatch, 1e-3);
        return normalized2.status === "ok" ? normalized2.region.bounds : null;
      }
      return boundsFromPoints((node.segments ?? []).flatMap(({ start, end }) => [start, end]));
    }
  }
}
function worldBoundsForViewport(viewport) {
  const first = screenToWorld([0, 0], viewport);
  const second = screenToWorld([viewport.width, viewport.height], viewport);
  return normalizeBounds$1(first, second);
}
function finiteCircleBounds(center, radius) {
  if (!finitePoint(center) || !Number.isFinite(radius) || radius < 0) return null;
  return {
    minX: center[0] - radius,
    minY: center[1] - radius,
    maxX: center[0] + radius,
    maxY: center[1] + radius
  };
}
function arcBounds(center, radius, start, end, counterClockwise) {
  if (finiteCircleBounds(center, radius) === null || !Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  const candidates = [start, end, ...[0, 90, 180, 270].filter((angle) => angleOnArc(angle, start, end, counterClockwise))];
  return boundsFromPoints(candidates.map((angle) => {
    const radians = angle * Math.PI / 180;
    return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
  }));
}
function ellipseBounds(node) {
  if (!finitePoint(node.center) || !finitePoint(node.majorAxis) || !Number.isFinite(node.ratio) || node.ratio <= 0) return null;
  const [axisX, axisY] = node.majorAxis;
  const majorRadius = Math.hypot(axisX, axisY);
  if (majorRadius === 0) return null;
  const minorRadius = majorRadius * node.ratio;
  const minorX = -axisY / majorRadius * minorRadius;
  const minorY = axisX / majorRadius * minorRadius;
  const extentX = Math.hypot(axisX, minorX);
  const extentY = Math.hypot(axisY, minorY);
  return {
    minX: node.center[0] - extentX,
    minY: node.center[1] - extentY,
    maxX: node.center[0] + extentX,
    maxY: node.center[1] + extentY
  };
}
function textBounds(node) {
  if (!finitePoint(node.position) || !Number.isFinite(node.height) || !Number.isFinite(node.rotation)) {
    return null;
  }
  const width = node.maxWidth ?? node.content.length * node.height * 0.6;
  const left = node.alignment === "center" ? -width / 2 : node.alignment === "right" ? -width : 0;
  const bottom = node.verticalAlignment === "top" ? -node.height : node.verticalAlignment === "middle" ? -node.height / 2 : node.verticalAlignment === "baseline" ? -node.height : 0;
  const radians = node.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return boundsFromPoints([
    [left, bottom],
    [left + width, bottom],
    [left + width, bottom + node.height],
    [left, bottom + node.height]
  ].map(([x, y]) => [
    node.position[0] + x * cos - y * sin,
    node.position[1] + x * sin + y * cos
  ]));
}
function extendedLineBounds(start, end, extension) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return boundsFromPoints([start]);
  return boundsFromPoints([
    [start[0] - dx / length * extension, start[1] - dy / length * extension],
    [end[0] + dx / length * extension, end[1] + dy / length * extension]
  ]);
}
function boundsFromPoints(points) {
  if (points.length === 0 || points.some((point3) => !finitePoint(point3))) return null;
  return {
    minX: Math.min(...points.map((point3) => point3[0])),
    minY: Math.min(...points.map((point3) => point3[1])),
    maxX: Math.max(...points.map((point3) => point3[0])),
    maxY: Math.max(...points.map((point3) => point3[1]))
  };
}
function unionBounds(bounds) {
  if (bounds.length === 0) return null;
  return bounds.reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY)
  }));
}
function normalizeBounds$1(first, second) {
  return {
    minX: Math.min(first[0], second[0]),
    minY: Math.min(first[1], second[1]),
    maxX: Math.max(first[0], second[0]),
    maxY: Math.max(first[1], second[1])
  };
}
function boundsIntersect(first, second) {
  return first.minX <= second.maxX && first.maxX >= second.minX && first.minY <= second.maxY && first.maxY >= second.minY;
}
function angleOnArc(angle, start, end, counterClockwise) {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  if (counterClockwise) {
    return modulo$1(normalizedAngle - normalizedStart, 360) <= modulo$1(normalizedEnd - normalizedStart, 360);
  }
  return modulo$1(normalizedStart - normalizedAngle, 360) <= modulo$1(normalizedStart - normalizedEnd, 360);
}
function normalizeAngle(value) {
  return modulo$1(value, 360);
}
function modulo$1(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
function finitePoint(point3) {
  return Number.isFinite(point3[0]) && Number.isFinite(point3[1]);
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function HatchRenderer({ node, viewportScale }) {
  const clipId = `vai-hatch-${reactExports.useId().replace(/:/g, "")}`;
  const vectorStroke = { vectorEffect: "non-scaling-stroke" };
  if (node.hatch === void 0) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-section-hatch": node.pattern, children: (node.segments ?? []).map((segment, index) => /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: segment.start[0], y1: segment.start[1], x2: segment.end[0], y2: segment.end[1], ...vectorStroke }, index)) });
  }
  const tolerance = Math.min(0.05, Math.max(1e-6, 0.25 / Math.max(viewportScale, 1e-9)));
  const result = createHatchRenderPlan(node.hatch, tolerance);
  if (result.status !== "ok") return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-section-hatch": node.pattern, "data-hatch-error": result.code });
  const path = result.plan.region.contours.map(contourPath).join(" ");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { "data-section-hatch": node.pattern, "data-hatch-representation": "parametric", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("defs", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: path, fillRule: result.plan.region.fillRule, clipRule: result.plan.region.fillRule }) }) }),
    result.plan.lines.map((line, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "line",
      {
        x1: line.start[0],
        y1: line.start[1],
        x2: line.end[0],
        y2: line.end[1],
        clipPath: `url(#${clipId})`,
        strokeDasharray: line.dashArray.length === 0 ? void 0 : line.dashArray.join(" "),
        strokeDashoffset: line.dashOffset,
        ...vectorStroke
      },
      index
    ))
  ] });
}
function contourPath(points) {
  if (points.length === 0) return "";
  return `M ${points[0][0]} ${points[0][1]} ${points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ")} Z`;
}
function screenSpaceTransform(position, viewportScale) {
  const inverse = 1 / Math.max(Math.abs(viewportScale), 1e-6);
  return `translate(${position[0]} ${position[1]}) scale(${inverse} ${-inverse})`;
}
function estimateScreenTextWidth(text, fontSize) {
  return [...text].reduce((width, character) => width + (character.codePointAt(0) > 255 ? 1 : 0.62) * fontSize, 0);
}
function ScreenSpaceLabel({
  position,
  viewportScale,
  children,
  fontSize = 11,
  textAnchor = "middle",
  background = false,
  paddingX = 5,
  paddingY = 3,
  textProps,
  ...groupProps
}) {
  const width = estimateScreenTextWidth(children, fontSize) + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const x = textAnchor === "middle" ? -width / 2 : textAnchor === "end" ? -width : 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "g",
    {
      ...groupProps,
      "data-screen-space-label": true,
      transform: screenSpaceTransform(position, viewportScale),
      children: [
        background && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "rect",
          {
            className: "vai-screen-space-label__background",
            x,
            y: -height / 2,
            width,
            height,
            rx: 4
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("text", { ...textProps, fontSize, textAnchor, dominantBaseline: "middle", children })
      ]
    }
  );
}
function EntityRenderer({
  node,
  viewport,
  selected,
  aiGrounded = false,
  motionRigActive = false,
  onSelect,
  onTextPointerDown,
  previewDiff
}) {
  if (!node.visible) return null;
  const semanticClassName = node.type === "dimension" && (node.dimensionKind === "angular" || node.dimensionKind === "diameter") ? ` vai-entity--${node.dimensionKind}-dimension` : node.type === "section-hatch" ? " vai-entity--section-hatch" : "";
  const className = `vai-entity vai-entity--${node.quality.status}${semanticClassName}${selected ? " vai-entity--selected" : ""}${aiGrounded ? " vai-entity--ai-grounded" : ""}${motionRigActive ? " vai-entity--motion-rig" : ""}${previewDiff === void 0 ? "" : ` vai-entity--preview-${previewDiff}`}`;
  const interactiveText = (node.type === "text" || node.type === "dimension") && onTextPointerDown !== void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "g",
    {
      className,
      "data-entity-id": node.id,
      "data-entity-type": node.type,
      "data-selected": selected || void 0,
      "data-ai-grounded": aiGrounded || void 0,
      "data-motion-rig-active": motionRigActive || void 0,
      "data-preview-diff": previewDiff,
      onClick: onSelect,
      onMouseDown: interactiveText ? onTextPointerDown : void 0,
      children: renderNode(node, viewport)
    }
  );
}
function renderNode(node, viewport) {
  const vectorStroke = { vectorEffect: "non-scaling-stroke" };
  switch (node.type) {
    case "point":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: node.x, cy: node.y, r: 3 / viewport.scale, ...vectorStroke });
    case "line":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: node.start[0], y1: node.start[1], x2: node.end[0], y2: node.end[1], ...vectorStroke });
    case "ray":
    case "xline": {
      const points = clipExtendedLine(node.origin, node.direction, worldBoundsForViewport(viewport), node.type === "ray");
      return points === null ? null : /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1], ...vectorStroke });
    }
    case "circle":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: node.center[0], cy: node.center[1], r: node.radius, fill: "none", ...vectorStroke });
    case "arc":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: arcPath(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise), fill: "none", ...vectorStroke });
    case "ellipse": {
      const radiusX = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        "ellipse",
        {
          cx: node.center[0],
          cy: node.center[1],
          rx: radiusX,
          ry: radiusX * node.ratio,
          transform: `rotate(${rotation} ${node.center[0]} ${node.center[1]})`,
          fill: "none",
          ...vectorStroke
        }
      );
    }
    case "polyline":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: polylinePath(node), fill: "none", ...vectorStroke });
    case "spline":
      return /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: splinePath(node, viewport), fill: "none", ...vectorStroke });
    case "text":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(WorldText, { position: node.position, rotation: node.rotation, height: node.height, align: node.alignment, children: node.content });
    case "dimension":
      if (node.dimensionKind === "angular" && node.definitionPoints.length >= 5) {
        return /* @__PURE__ */ jsxRuntimeExports.jsx(AngularDimension, { node, viewport });
      }
      if (node.dimensionKind === "diameter" && node.definitionPoints.length >= 2) {
        return /* @__PURE__ */ jsxRuntimeExports.jsx(DiameterDimension, { node, viewport });
      }
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        node.definitionPoints.length > 1 ? /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: pointsAttribute(node.definitionPoints), fill: "none", ...vectorStroke }) : null,
        /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: node.textPosition, viewportScale: viewport.scale, children: dimensionLabel(node) })
      ] });
    case "leader": {
      const textPosition = node.points.at(-1) ?? [0, 0];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: pointsAttribute(node.points), fill: "none", ...vectorStroke }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(WorldText, { position: textPosition, height: node.textHeight, align: "left", children: node.content })
      ] });
    }
    case "centerline": {
      const bounds = nodeBounds(node);
      return bounds === null ? null : /* @__PURE__ */ jsxRuntimeExports.jsx(
        "line",
        {
          x1: bounds.minX,
          y1: bounds.minY,
          x2: bounds.maxX,
          y2: bounds.maxY,
          strokeDasharray: "10 4 2 4",
          ...vectorStroke
        }
      );
    }
    case "section-hatch":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(HatchRenderer, { node, viewportScale: viewport.scale });
  }
}
function DiameterDimension({
  node,
  viewport
}) {
  const [first, second, sourceFirst = first, sourceSecond = second] = node.definitionPoints;
  if (!first || !second) return null;
  const vectorStroke = { vectorEffect: "non-scaling-stroke" };
  const arrowSize = 7 / Math.max(viewport.scale, 1e-9);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-diameter-role": "extension", x1: sourceFirst[0], y1: sourceFirst[1], x2: first[0], y2: first[1], ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-diameter-role": "extension", x1: sourceSecond[0], y1: sourceSecond[1], x2: second[0], y2: second[1], ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-diameter-role": "dimension", x1: first[0], y1: first[1], x2: second[0], y2: second[1], ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { "data-diameter-role": "arrow", d: arrowPath(first, second, arrowSize), ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { "data-diameter-role": "arrow", d: arrowPath(second, first, arrowSize), ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: node.textPosition, viewportScale: viewport.scale, children: dimensionLabel(node) })
  ] });
}
function AngularDimension({
  node,
  viewport
}) {
  const [vertex, firstExtension, secondExtension, arcStart, arcEnd] = node.definitionPoints;
  if (!vertex || !firstExtension || !secondExtension || !arcStart || !arcEnd) return null;
  const firstRadius = Math.hypot(arcStart[0] - vertex[0], arcStart[1] - vertex[1]);
  const secondRadius = Math.hypot(arcEnd[0] - vertex[0], arcEnd[1] - vertex[1]);
  const radius = (firstRadius + secondRadius) / 2;
  const startAngle = Math.atan2(arcStart[1] - vertex[1], arcStart[0] - vertex[0]);
  const endAngle = Math.atan2(arcEnd[1] - vertex[1], arcEnd[0] - vertex[0]);
  const sweep = selectAngularSweep(startAngle, endAngle, node.observedValue ?? node.computedValue);
  const tangentStep = Math.min(Math.abs(sweep) * 0.08, 0.15);
  const direction = sweep >= 0 ? 1 : -1;
  const startToward = polarPoint(vertex, radius, startAngle + direction * tangentStep);
  const endToward = polarPoint(vertex, radius, endAngle - direction * tangentStep);
  const vectorStroke = { vectorEffect: "non-scaling-stroke" };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-angular-role": "extension", x1: vertex[0], y1: vertex[1], x2: firstExtension[0], y2: firstExtension[1], ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("line", { "data-angular-role": "extension", x1: vertex[0], y1: vertex[1], x2: secondExtension[0], y2: secondExtension[1], ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "path",
      {
        "data-angular-role": "arc",
        d: `M ${arcStart[0]} ${arcStart[1]} A ${radius} ${radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep >= 0 ? 1 : 0} ${arcEnd[0]} ${arcEnd[1]}`,
        fill: "none",
        ...vectorStroke
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { "data-angular-role": "arrow", d: arrowPath(arcStart, startToward, 7 / Math.max(viewport.scale, 1e-9)), ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { "data-angular-role": "arrow", d: arrowPath(arcEnd, endToward, 7 / Math.max(viewport.scale, 1e-9)), ...vectorStroke }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: node.textPosition, viewportScale: viewport.scale, children: dimensionLabel(node) })
  ] });
}
function WorldText({
  position,
  rotation = 0,
  height,
  align,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { transform: `translate(${position[0]} ${position[1]}) rotate(${-rotation}) scale(1 -1)`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    "text",
    {
      fontSize: height,
      textAnchor: align === "center" ? "middle" : align === "right" ? "end" : "start",
      children
    }
  ) });
}
function dimensionLabel(node) {
  if (node.displayText !== void 0) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  if (value === void 0) return "—";
  return `${node.prefix ?? ""}${value}${node.unit ? ` ${node.unit}` : ""}${node.suffix ?? ""}`;
}
function pointsAttribute(points) {
  return points.map((point3) => `${point3[0]},${point3[1]}`).join(" ");
}
function splinePath(node, viewport) {
  const points = sampleSpline(node, { maxError: Math.max(0.25 / viewport.scale, 1e-8) });
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const commands = [
    `M ${points[0][0]} ${points[0][1]}`,
    ...points.slice(1).map(([x, y]) => `L ${x} ${y}`)
  ];
  if (node.closed) commands.push("Z");
  return commands.join(" ");
}
function polylinePath(node) {
  if (node.vertices.length === 0) return "";
  const output = [`M ${node.vertices[0].point[0]} ${node.vertices[0].point[1]}`];
  const segments = node.closed ? node.vertices.length : node.vertices.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const current = node.vertices[index];
    const next = node.vertices[(index + 1) % node.vertices.length];
    if (current.bulge !== void 0 && Math.abs(current.bulge) > 1e-9) {
      const radius = Math.hypot(
        next.point[0] - current.point[0],
        next.point[1] - current.point[1]
      ) * (1 + current.bulge * current.bulge) / (4 * Math.abs(current.bulge));
      output.push(`A ${radius} ${radius} 0 ${Math.abs(current.bulge) > 1 ? 1 : 0} ${current.bulge > 0 ? 1 : 0} ${next.point[0]} ${next.point[1]}`);
    } else {
      output.push(`L ${next.point[0]} ${next.point[1]}`);
    }
  }
  if (node.closed) output.push("Z");
  return output.join(" ");
}
function arcPath(center, radius, start, end, counterClockwise) {
  const point3 = (angle) => {
    const radians = angle * Math.PI / 180;
    return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
  };
  const first = point3(start);
  const last = point3(end);
  const span = counterClockwise ? modulo(end - start, 360) : modulo(start - end, 360);
  return `M ${first[0]} ${first[1]} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} ${counterClockwise ? 1 : 0} ${last[0]} ${last[1]}`;
}
function selectAngularSweep(start, end, valueDegrees) {
  const counterClockwise = modulo(end - start, Math.PI * 2);
  const clockwise = counterClockwise - Math.PI * 2;
  if (valueDegrees === void 0) return Math.abs(counterClockwise) <= Math.abs(clockwise) ? counterClockwise : clockwise;
  const target = Math.abs(valueDegrees) * Math.PI / 180;
  return Math.abs(Math.abs(counterClockwise) - target) <= Math.abs(Math.abs(clockwise) - target) ? counterClockwise : clockwise;
}
function polarPoint(center, radius, angle) {
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
}
function arrowPath(tip, toward, length) {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const base = [tip[0] + ux * length, tip[1] + uy * length];
  const halfWidth = length * 0.38;
  const first = [base[0] - uy * halfWidth, base[1] + ux * halfWidth];
  const second = [base[0] + uy * halfWidth, base[1] - ux * halfWidth];
  return `M ${tip[0]} ${tip[1]} L ${first[0]} ${first[1]} L ${second[0]} ${second[1]} Z`;
}
function clipExtendedLine(origin, direction, bounds, ray) {
  if (Math.hypot(direction[0], direction[1]) <= 1e-9) return null;
  let minimum = ray ? 0 : Number.NEGATIVE_INFINITY;
  let maximum = Number.POSITIVE_INFINITY;
  for (const [axisOrigin, axisDirection, low, high] of [
    [origin[0], direction[0], bounds.minX, bounds.maxX],
    [origin[1], direction[1], bounds.minY, bounds.maxY]
  ]) {
    if (Math.abs(axisDirection) <= 1e-9) {
      if (axisOrigin < low || axisOrigin > high) return null;
      continue;
    }
    const first = (low - axisOrigin) / axisDirection;
    const second = (high - axisOrigin) / axisDirection;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
  }
  if (minimum > maximum) return null;
  return [
    [origin[0] + direction[0] * minimum, origin[1] + direction[1] * minimum],
    [origin[0] + direction[0] * maximum, origin[1] + direction[1] * maximum]
  ];
}
function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
function SourceUnderlay({
  source,
  resource,
  document: document2
}) {
  const sourceFrame = document2.coordinateFrames.find((frame) => frame.kind === "source" && frame.id === `frame_source_${safeId(source.id)}`) ?? document2.coordinateFrames.find((frame) => frame.kind === "source");
  const transform2 = sourceFrame == null ? void 0 : sourceFrame.transform;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-source-underlay": source.id, pointerEvents: "none", opacity: 0.28, children: /* @__PURE__ */ jsxRuntimeExports.jsx("g", { transform: transform2 === void 0 ? `translate(0 ${source.height}) scale(1 -1)` : `matrix(${transform2.join(" ")})`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    "image",
    {
      href: resource.url,
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
      preserveAspectRatio: "none"
    }
  ) }) });
}
function safeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function isRasterDrawingSource(source) {
  return "width" in source && "height" in source;
}
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toKebabCase = (string2) => string2.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const toCamelCase = (string2) => string2.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
const toPascalCase = (string2) => {
  const camelCase = toCamelCase(string2);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
const mergeClasses = (...classes) => classes.filter((className, index, array2) => {
  return Boolean(className) && className.trim() !== "" && array2.indexOf(className) === index;
}).join(" ").trim();
const hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
};
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Icon = reactExports.forwardRef(
  ({
    color = "currentColor",
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children,
    iconNode,
    ...rest
  }, ref) => reactExports.createElement(
    "svg",
    {
      ref,
      ...defaultAttributes,
      width: size,
      height: size,
      stroke: color,
      strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
      className: mergeClasses("lucide", className),
      ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
      ...rest
    },
    [
      ...iconNode.map(([tag, attrs]) => reactExports.createElement(tag, attrs)),
      ...Array.isArray(children) ? children : [children]
    ]
  )
);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const createLucideIcon = (iconName, iconNode) => {
  const Component = reactExports.forwardRef(
    ({ className, ...props }, ref) => reactExports.createElement(Icon, {
      ref,
      iconNode,
      className: mergeClasses(
        `lucide-${toKebabCase(toPascalCase(iconName))}`,
        `lucide-${iconName}`,
        className
      ),
      ...props
    })
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
};
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$i = [
  [
    "path",
    {
      d: "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z",
      key: "lc1i9w"
    }
  ],
  ["path", { d: "m7 16.5-4.74-2.85", key: "1o9zyk" }],
  ["path", { d: "m7 16.5 5-3", key: "va8pkn" }],
  ["path", { d: "M7 16.5v5.17", key: "jnp8gn" }],
  [
    "path",
    {
      d: "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z",
      key: "8zsnat"
    }
  ],
  ["path", { d: "m17 16.5-5-3", key: "8arw3v" }],
  ["path", { d: "m17 16.5 4.74-2.85", key: "8rfmw" }],
  ["path", { d: "M17 16.5v5.17", key: "k6z78m" }],
  [
    "path",
    {
      d: "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z",
      key: "1xygjf"
    }
  ],
  ["path", { d: "M12 8 7.26 5.15", key: "1vbdud" }],
  ["path", { d: "m12 8 4.74-2.85", key: "3rx089" }],
  ["path", { d: "M12 13.5V8", key: "1io7kd" }]
];
const Boxes = createLucideIcon("boxes", __iconNode$i);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$h = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]];
const ChevronDown = createLucideIcon("chevron-down", __iconNode$h);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$g = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]];
const ChevronRight = createLucideIcon("chevron-right", __iconNode$g);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$f = [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
];
const Download = createLucideIcon("download", __iconNode$f);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$e = [
  ["path", { d: "m12.99 6.74 1.93 3.44", key: "iwagvd" }],
  ["path", { d: "M19.136 12a10 10 0 0 1-14.271 0", key: "ppmlo4" }],
  ["path", { d: "m21 21-2.16-3.84", key: "vylbct" }],
  ["path", { d: "m3 21 8.02-14.26", key: "1ssaw4" }],
  ["circle", { cx: "12", cy: "5", r: "2", key: "f1ur92" }]
];
const DraftingCompass = createLucideIcon("drafting-compass", __iconNode$e);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$d = [
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      key: "ct8e1f"
    }
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      key: "13bj9a"
    }
  ],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }]
];
const EyeOff = createLucideIcon("eye-off", __iconNode$d);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$c = [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      key: "1nclc0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
];
const Eye = createLucideIcon("eye", __iconNode$c);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$b = [
  ["path", { d: "m12 14 4-4", key: "9kzdfg" }],
  ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0", key: "19p75a" }]
];
const Gauge = createLucideIcon("gauge", __iconNode$b);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$a = [
  [
    "path",
    {
      d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
      key: "zw3jo"
    }
  ],
  [
    "path",
    {
      d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
      key: "1wduqc"
    }
  ],
  [
    "path",
    {
      d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",
      key: "kqbvx6"
    }
  ]
];
const Layers = createLucideIcon("layers", __iconNode$a);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$9 = [
  ["path", { d: "M21 12h-8", key: "1bmf0i" }],
  ["path", { d: "M21 6H8", key: "1pqkrb" }],
  ["path", { d: "M21 18h-8", key: "1tm79t" }],
  ["path", { d: "M3 6v4c0 1.1.9 2 2 2h3", key: "1ywdgy" }],
  ["path", { d: "M3 10v6c0 1.1.9 2 2 2h3", key: "2wc746" }]
];
const ListTree = createLucideIcon("list-tree", __iconNode$9);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$8 = [
  ["path", { d: "M12 20h9", key: "t2du7b" }],
  [
    "path",
    {
      d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
      key: "1ykcvy"
    }
  ],
  ["path", { d: "m15 5 3 3", key: "1w25hb" }]
];
const PencilLine = createLucideIcon("pencil-line", __iconNode$8);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$7 = [
  ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
  ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13", key: "6uklza" }]
];
const Redo2 = createLucideIcon("redo-2", __iconNode$7);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$6 = [
  [
    "path",
    {
      d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
      key: "icamh8"
    }
  ],
  ["path", { d: "m14.5 12.5 2-2", key: "inckbg" }],
  ["path", { d: "m11.5 9.5 2-2", key: "fmmyf7" }],
  ["path", { d: "m8.5 6.5 2-2", key: "vc6u1g" }],
  ["path", { d: "m17.5 15.5 2-2", key: "wo5hmg" }]
];
const Ruler = createLucideIcon("ruler", __iconNode$6);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$5 = [
  ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
  ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
  ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
  ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }]
];
const Scan = createLucideIcon("scan", __iconNode$5);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$4 = [
  ["line", { x1: "21", x2: "14", y1: "4", y2: "4", key: "obuewd" }],
  ["line", { x1: "10", x2: "3", y1: "4", y2: "4", key: "1q6298" }],
  ["line", { x1: "21", x2: "12", y1: "12", y2: "12", key: "1iu8h1" }],
  ["line", { x1: "8", x2: "3", y1: "12", y2: "12", key: "ntss68" }],
  ["line", { x1: "21", x2: "16", y1: "20", y2: "20", key: "14d8ph" }],
  ["line", { x1: "12", x2: "3", y1: "20", y2: "20", key: "m0wm8r" }],
  ["line", { x1: "14", x2: "14", y1: "2", y2: "6", key: "14e1ph" }],
  ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
  ["line", { x1: "16", x2: "16", y1: "18", y2: "22", key: "1lctlv" }]
];
const SlidersHorizontal = createLucideIcon("sliders-horizontal", __iconNode$4);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$3 = [
  [
    "path",
    {
      d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
      key: "4pj2yx"
    }
  ],
  ["path", { d: "M20 3v4", key: "1olli1" }],
  ["path", { d: "M22 5h-4", key: "1gvqau" }],
  ["path", { d: "M4 17v2", key: "vumght" }],
  ["path", { d: "M5 18H3", key: "zchphs" }]
];
const Sparkles = createLucideIcon("sparkles", __iconNode$3);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
];
const Undo2 = createLucideIcon("undo-2", __iconNode$2);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  ["path", { d: "M12 3v12", key: "1x0j5s" }],
  ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }]
];
const Upload = createLucideIcon("upload", __iconNode$1);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
];
const X = createLucideIcon("x", __iconNode);
function WorkspaceToolbarView({
  snapshot,
  viewport,
  unavailable = false,
  fitPadding = 1.2,
  canUndo,
  canRedo,
  onFit,
  onUndo,
  onRedo,
  onUploadFiles,
  uploadAccept = "image/png,image/jpeg,image/webp,image/gif",
  uploadMultiple = false,
  onExport
}) {
  const handleUpload = (event) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) onUploadFiles == null ? void 0 : onUploadFiles(files);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-toolbar", role: "toolbar", "aria-label": "图纸操作工具", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        "aria-label": "适配图纸",
        title: "缩放并居中显示整张图纸",
        onClick: () => onFit(fitViewportToDrawing(snapshot.document, viewport, fitPadding)),
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Scan, { "aria-hidden": "true", size: 17 })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-toolbar__separator" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        "aria-label": "撤销",
        disabled: unavailable || !canUndo,
        title: "撤销最近一次图纸修改",
        onClick: () => {
          void onUndo();
        },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Undo2, { "aria-hidden": "true", size: 17 })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        "aria-label": "反撤销",
        disabled: unavailable || !canRedo,
        title: "恢复最近一次撤销",
        onClick: () => {
          void onRedo();
        },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Redo2, { "aria-hidden": "true", size: 17 })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-toolbar__separator" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "label",
      {
        className: `vai-toolbar__upload${onUploadFiles === void 0 ? " vai-toolbar__upload--disabled" : ""}`,
        "aria-label": "上传图纸",
        title: "上传图纸",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { "aria-hidden": "true", size: 17 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "file",
              accept: uploadAccept,
              multiple: uploadMultiple,
              disabled: onUploadFiles === void 0,
              onChange: handleUpload
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        "aria-label": "导出 DXF",
        disabled: false,
        title: "导出当前 DXF 图纸",
        onClick: onExport ?? (() => exportSnapshotDxf(snapshot)),
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { "aria-hidden": "true", size: 17 })
      }
    )
  ] });
}
function exportSnapshotDxf(snapshot) {
  const blob = new Blob([exportDrawingDxf(snapshot.document)], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${snapshot.ref.drawingId}-R${snapshot.ref.revision}.dxf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
function ObjectList() {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const groundingOverlay = useDrawingWorkspace((state) => state.groundingOverlay);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const busy = useDrawingWorkspace((state) => state.busy);
  const setSelection = useDrawingWorkspace((state) => state.setSelection);
  const updateNode = useDrawingWorkspace((state) => state.updateNode);
  const deleteNodes = useDrawingWorkspace((state) => state.deleteNodes);
  if (snapshot === null) return null;
  const groups = [
    { label: "几何图元", nodes: snapshot.document.geometry },
    { label: "标注", nodes: snapshot.document.annotations },
    { label: "关系", nodes: snapshot.document.relations },
    { label: "语义特征", nodes: snapshot.document.features }
  ];
  const groundedNodeIds = new Set(
    (groundingOverlay == null ? void 0 : groundingOverlay.groups.filter((group) => group.role !== "reference").flatMap((group) => group.nodeIds)) ?? []
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "vai-panel vai-object-list", "aria-label": "图纸对象", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-panel__title", children: "对象" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-object-list__scroll", children: groups.map((group) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "vai-object-group", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
        group.label,
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: group.nodes.length })
      ] }),
      group.nodes.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-object-group__empty", children: "无" }) : group.nodes.map((node) => {
        const selected = selectedIds.includes(node.id);
        const aiGrounded = groundedNodeIds.has(node.id);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: `vai-object-row${selected ? " vai-object-row--selected" : ""}${aiGrounded ? " vai-object-row--ai-grounded" : ""}`,
            "data-object-id": node.id,
            "data-ai-grounded": aiGrounded || void 0,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: "vai-object-row__main",
                  onClick: (event) => {
                    if (event.metaKey || event.ctrlKey) {
                      setSelection(selectedIds.includes(node.id) ? selectedIds.filter((id) => id !== node.id) : [...selectedIds, node.id]);
                    } else setSelection([node.id]);
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(ObjectGlyph, { type: node.type }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "vai-object-row__identity", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: node.id }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: node.type })
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: "vai-icon-button",
                  "aria-label": `${node.visible ? "隐藏" : "显示"} ${node.id}`,
                  disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.edit),
                  onClick: () => {
                    void updateNode(node.id, { visible: !node.visible });
                  },
                  children: node.visible ? "◉" : "○"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: "vai-icon-button vai-icon-button--danger",
                  "aria-label": `删除 ${node.id}`,
                  disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.delete),
                  onClick: () => {
                    void deleteNodes([node.id]);
                  },
                  children: "×"
                }
              )
            ]
          },
          node.id
        );
      })
    ] }, group.label)) })
  ] });
}
function ObjectGlyph({ type }) {
  const glyph = type === "circle" ? "○" : type === "point" ? "·" : type === "text" ? "T" : type === "dimension" ? "↔" : type === "feature" ? "◇" : type === "topology" || type === "constraint" || type === "association" || type === "semantic" ? "⌁" : "∕";
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-object-row__glyph", "aria-hidden": "true", children: glyph });
}
function PropertyInspector() {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const busy = useDrawingWorkspace((state) => state.busy);
  const updateNode = useDrawingWorkspace((state) => state.updateNode);
  if (snapshot === null) return null;
  const node = locateNode(snapshot.document, selectedIds[0]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "vai-panel vai-inspector", "aria-label": "图元属性", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-panel__title", children: "图元属性" }),
    node === null ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-panel__empty", children: "选择图元查看和编辑属性" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-inspector__scroll", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { className: "vai-inspector__identity", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "ID" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: node.id }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "类型" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: node.type }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "状态" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: node.quality.status }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "置信度" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: node.quality.confidence === void 0 ? "—" : `${Math.round(node.quality.confidence * 100)}%` })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-inspector__fields", children: editableProperties(node).map((property) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        PropertyField,
        {
          property,
          disabled: busy || preview !== null || !(formalSnapshot == null ? void 0 : formalSnapshot.capabilities.edit),
          commit: (value) => {
            void updateNode(node.id, property.change(value));
          }
        },
        property.key
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("details", { className: "vai-inspector__raw", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("summary", { children: "完整属性" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { children: JSON.stringify(node, null, 2) })
      ] })
    ] })
  ] });
}
function PropertyField({
  property,
  disabled,
  commit
}) {
  if (property.kind === "boolean") {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "vai-field vai-field--check", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: property.label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "checkbox",
          defaultChecked: Boolean(property.value),
          disabled,
          onChange: (event) => commit(event.currentTarget.checked)
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "vai-field", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: property.label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: property.kind,
        defaultValue: String(property.value),
        disabled,
        step: property.kind === "number" ? "any" : void 0,
        onBlur: (event) => {
          const value = property.kind === "number" ? Number(event.currentTarget.value) : event.currentTarget.value;
          if (property.kind === "number" && !Number.isFinite(value)) return;
          if (value !== property.value) commit(value);
        }
      }
    )
  ] });
}
function editableProperties(node) {
  const fields = [booleanField("visible", "可见", node.visible, "visible")];
  switch (node.type) {
    case "point":
      return [...fields, numberField("x", "X", node.x, "x"), numberField("y", "Y", node.y, "y")];
    case "line":
      return [...fields, ...vec2Fields("start", "起点", node.start), ...vec2Fields("end", "终点", node.end)];
    case "ray":
    case "xline":
      return [...fields, ...vec2Fields("origin", "原点", node.origin), ...vec2Fields("direction", "方向", node.direction)];
    case "circle":
      return [...fields, ...vec2Fields("center", "圆心", node.center), numberField("radius", "半径", node.radius, "radius")];
    case "arc":
      return [
        ...fields,
        ...vec2Fields("center", "圆心", node.center),
        numberField("radius", "半径", node.radius, "radius"),
        numberField("startAngle", "起始角", node.startAngle, "startAngle"),
        numberField("endAngle", "结束角", node.endAngle, "endAngle"),
        booleanField("counterClockwise", "逆时针", node.counterClockwise, "counterClockwise")
      ];
    case "ellipse":
      return [
        ...fields,
        ...vec2Fields("center", "中心", node.center),
        ...vec2Fields("majorAxis", "主轴", node.majorAxis),
        numberField("ratio", "轴比", node.ratio, "ratio")
      ];
    case "polyline":
      return [...fields, booleanField("closed", "闭合", node.closed, "closed")];
    case "spline":
      return [
        ...fields,
        numberField("degree", "阶数", node.degree, "degree"),
        booleanField("closed", "闭合", node.closed, "closed"),
        booleanField("periodic", "周期", node.periodic, "periodic")
      ];
    case "text":
      return [
        ...fields,
        textField("content", "文字", node.content, "content"),
        ...vec2Fields("position", "位置", node.position),
        numberField("height", "字高", node.height, "height"),
        numberField("rotation", "旋转", node.rotation, "rotation")
      ];
    case "dimension":
      return [
        ...fields,
        textField("displayText", "显示文字", node.displayText ?? "", "displayText"),
        ...vec2Fields("textPosition", "文字位置", node.textPosition),
        textField("prefix", "前缀", node.prefix ?? "", "prefix"),
        textField("suffix", "后缀", node.suffix ?? "", "suffix")
      ];
    case "leader":
      return [
        ...fields,
        textField("content", "文字", node.content, "content"),
        numberField("textHeight", "字高", node.textHeight, "textHeight")
      ];
    case "centerline":
      return [...fields, numberField("extension", "延伸", node.extension, "extension")];
    case "section-hatch":
      return [
        ...fields,
        textField("pattern", "图案", node.pattern, "pattern"),
        numberField("angle", "角度", node.angle, "angle"),
        numberField("spacing", "间距", node.spacing, "spacing")
      ];
    case "topology":
    case "constraint":
    case "association":
    case "semantic":
    case "feature":
      return fields;
  }
}
function vec2Fields(key, label, value) {
  return [0, 1].map((index) => ({
    key: `${key}.${index}`,
    label: `${label} ${index === 0 ? "X" : "Y"}`,
    value: value[index],
    kind: "number",
    change: (next) => ({ [key]: value.map((item, itemIndex) => itemIndex === index ? Number(next) : item) })
  }));
}
function numberField(key, label, value, property) {
  return { key, label, value, kind: "number", change: (next) => ({ [property]: Number(next) }) };
}
function textField(key, label, value, property) {
  return { key, label, value, kind: "text", change: (next) => ({ [property]: String(next) }) };
}
function booleanField(key, label, value, property) {
  return { key, label, value, kind: "boolean", change: (next) => ({ [property]: Boolean(next) }) };
}
function locateNode(document2, id) {
  if (id === void 0) return null;
  return document2.geometry.find((node) => node.id === id) ?? document2.annotations.find((node) => node.id === id) ?? document2.relations.find((node) => node.id === id) ?? document2.features.find((node) => node.id === id) ?? null;
}
const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH = 420;
const PANEL_RESIZE_STEP = 16;
const defaultPanelDefinitions = [
  { id: "objects", label: "对象", icon: Layers, render: () => /* @__PURE__ */ jsxRuntimeExports.jsx(ObjectList, {}) },
  { id: "properties", label: "属性", icon: SlidersHorizontal, render: () => /* @__PURE__ */ jsxRuntimeExports.jsx(PropertyInspector, {}) }
];
function WorkspaceActivityBar({
  activePanel,
  panelWidth,
  onActivePanelChange,
  onPanelWidthChange,
  panels,
  overlay = false
}) {
  const resizeStart = reactExports.useRef(null);
  const latestWidth = reactExports.useRef(panelWidth);
  latestWidth.current = panelWidth;
  const definitions = panels ?? defaultPanelDefinitions;
  const activeDefinition = definitions.find(({ id }) => id === activePanel);
  function commitWidth(width) {
    const nextWidth = clampPanelWidth(width);
    latestWidth.current = nextWidth;
    onPanelWidthChange(nextWidth);
  }
  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      width: latestWidth.current
    };
  }
  function handlePointerMove(event) {
    const start = resizeStart.current;
    if (start === null || start.pointerId !== event.pointerId) return;
    commitWidth(start.width + event.clientX - start.clientX);
  }
  function finishPointerResize(event) {
    var _a2;
    if (((_a2 = resizeStart.current) == null ? void 0 : _a2.pointerId) === event.pointerId) resizeStart.current = null;
  }
  function handleResizeKeyDown(event) {
    const delta = event.key === "ArrowLeft" ? -PANEL_RESIZE_STEP : event.key === "ArrowRight" ? PANEL_RESIZE_STEP : 0;
    if (delta !== 0) {
      event.preventDefault();
      commitWidth(latestWidth.current + delta);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      commitWidth(event.key === "Home" ? MIN_PANEL_WIDTH : MAX_PANEL_WIDTH);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: `vai-activity-bar${overlay ? " vai-activity-bar--overlay" : ""}`, "aria-label": "信息面板工具栏", children: definitions.map(({ id, label, icon: Icon2 }) => {
      const active = activePanel === id;
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "vai-activity-bar__button",
          "aria-label": `${label}面板`,
          "aria-pressed": active,
          title: label,
          onClick: () => onActivePanelChange(active ? null : id),
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon2, { size: 19, strokeWidth: 1.75, "aria-hidden": "true" })
        },
        id
      );
    }) }),
    activeDefinition === void 0 ? null : /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "aside",
      {
        className: `vai-inspector-stack vai-inspector-stack--activity${overlay ? " vai-inspector-stack--overlay" : ""}`,
        "data-panel": activeDefinition.id,
        "aria-label": `${activeDefinition.label}信息面板`,
        style: { width: panelWidth, backgroundColor: "var(--vai-panel, #12161b)" },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "vai-panel-close",
              "aria-label": "关闭信息面板",
              title: "关闭",
              onClick: () => onActivePanelChange(null),
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { size: 16, "aria-hidden": "true" })
            }
          ),
          activeDefinition.render(),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "vai-panel-resizer",
              role: "separator",
              "aria-label": "调整信息面板宽度",
              "aria-orientation": "vertical",
              "aria-valuemin": MIN_PANEL_WIDTH,
              "aria-valuemax": MAX_PANEL_WIDTH,
              "aria-valuenow": panelWidth,
              tabIndex: 0,
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: finishPointerResize,
              onPointerCancel: finishPointerResize,
              onKeyDown: handleResizeKeyDown
            }
          )
        ]
      }
    )
  ] });
}
function clampPanelWidth(width) {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
}
function SourceLayer({
  document: document2,
  source,
  sourceUrl
}) {
  if (source === void 0 || !isRasterDrawingSource(source) || sourceUrl === null) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    SourceUnderlay,
    {
      source,
      resource: { url: sourceUrl, dispose() {
      } },
      document: document2
    }
  );
}
function GeometryLayer({
  nodes,
  viewport,
  selectedIds,
  attentionIds,
  onSelect
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-layer": "geometry", children: nodes.map((node) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    EntityRenderer,
    {
      node,
      viewport,
      selected: selectedIds.includes(node.id),
      aiGrounded: attentionIds.includes(node.id),
      onSelect: (event) => onSelect(node.id, event)
    },
    node.id
  )) });
}
function AnnotationLayer({
  nodes,
  viewport,
  selectedIds,
  attentionIds,
  onSelect
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-layer": "annotations", children: nodes.map((node) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    EntityRenderer,
    {
      node,
      viewport,
      selected: selectedIds.includes(node.id),
      aiGrounded: attentionIds.includes(node.id),
      onSelect: (event) => onSelect(node.id, event)
    },
    node.id
  )) });
}
function RelationLayer({
  document: document2,
  viewport
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("g", { className: "vai-relations", "data-layer": "relations", children: document2.relations.filter((relation) => relation.visible && relation.plane !== "topology").flatMap((relation) => relationSegments(document2, relation, viewport)) });
}
function SelectionLayer({
  box
}) {
  if (box === null) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "rect",
    {
      "data-selection-box": "true",
      "data-layer": "selection",
      x: Math.min(box.start[0], box.current[0]),
      y: Math.min(box.start[1], box.current[1]),
      width: Math.abs(box.current[0] - box.start[0]),
      height: Math.abs(box.current[1] - box.start[1]),
      className: "vai-canvas__selection-box",
      pointerEvents: "none"
    }
  );
}
function relationSegments(document2, relation, viewport) {
  const centers = relationNodeIds(relation).flatMap((id) => {
    const node = [...document2.geometry, ...document2.annotations].find((candidate) => candidate.id === id);
    const bounds = node === void 0 ? null : nodeBounds(node);
    return bounds === null ? [] : [[(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]];
  });
  return centers.slice(1).map((center, index) => {
    const start = centers[index];
    const midpoint = [(start[0] + center[0]) / 2, (start[1] + center[1]) / 2];
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { "data-relation-id": relation.id, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: start[0], y1: start[1], x2: center[0], y2: center[1], vectorEffect: "non-scaling-stroke" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: midpoint, viewportScale: viewport.scale, fontSize: 10, children: relation.kind })
    ] }, `${relation.id}:${index}`);
  });
}
function relationNodeIds(relation) {
  switch (relation.type) {
    case "topology":
      return relation.nodeIds;
    case "constraint":
      return relation.geometryIds;
    case "association":
      return [relation.annotationId, ...relation.geometryIds];
    case "semantic":
      return relation.nodeIds;
  }
}
const DEFAULT_DISPLAY = {
  grid: true,
  axes: true,
  relations: true,
  annotations: true,
  sourceUnderlay: false
};
function DrawingSurface({
  snapshot,
  viewport,
  selectedIds,
  attentionIds = [],
  display: displayInput,
  sourceUrl = null,
  worldLayers,
  screenLayers,
  className = "vai-canvas",
  fitToDrawingOnResize = false,
  fitPadding = 1.2,
  onViewportChange,
  onSelectionChange,
  onMouseWorldChange
}) {
  const display = { ...DEFAULT_DISPLAY, ...displayInput };
  const containerRef = reactExports.useRef(null);
  const dragRef = reactExports.useRef(null);
  const [selectionBox, setSelectionBox] = reactExports.useState(null);
  reactExports.useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const preventConversationScroll = (event) => event.preventDefault();
    element.addEventListener("wheel", preventConversationScroll, { passive: false });
    return () => element.removeEventListener("wheel", preventConversationScroll);
  }, []);
  reactExports.useEffect(() => {
    const element = containerRef.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!(width > 0 && height > 0) || viewport.width === width && viewport.height === height) return;
      onViewportChange(
        fitToDrawingOnResize || viewport.width === 0 || viewport.height === 0 ? fitViewportToDrawing(
          fitToDrawingOnResize === "geometry" ? { ...snapshot.document, annotations: [] } : snapshot.document,
          { width, height },
          fitPadding
        ) : { ...viewport, width, height }
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitPadding, fitToDrawingOnResize, onViewportChange, snapshot.document, viewport]);
  const handleWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onViewportChange(zoomViewportAt(viewport, eventScreenPoint(event), event.deltaY < 0 ? 1.1 : 1 / 1.1));
  };
  const handleMouseDown = (event) => {
    const point3 = eventScreenPoint(event);
    const boxSelect = event.button === 0 && (event.metaKey || event.ctrlKey);
    if (event.button === 1 || event.button === 0 && !boxSelect) {
      event.preventDefault();
      dragRef.current = {
        kind: "pan",
        start: point3,
        viewport,
        clearSelectionOnClick: event.button === 0 && isBlankCanvasTarget(event)
      };
      return;
    }
    if (!boxSelect) return;
    dragRef.current = { kind: "box", start: point3, current: point3, additive: true };
    setSelectionBox({ start: point3, current: point3 });
  };
  const handleMouseMove = (event) => {
    const point3 = eventScreenPoint(event);
    onMouseWorldChange == null ? void 0 : onMouseWorldChange(screenToWorld(point3, viewport));
    const drag = dragRef.current;
    if ((drag == null ? void 0 : drag.kind) === "pan") {
      onViewportChange({
        ...drag.viewport,
        x: drag.viewport.x + point3[0] - drag.start[0],
        y: drag.viewport.y + point3[1] - drag.start[1]
      });
    } else if ((drag == null ? void 0 : drag.kind) === "box") {
      drag.current = point3;
      setSelectionBox({ start: drag.start, current: point3 });
    }
  };
  const handleMouseUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if ((drag == null ? void 0 : drag.kind) === "pan") {
      const point3 = eventScreenPoint(event);
      if (drag.clearSelectionOnClick && Math.hypot(point3[0] - drag.start[0], point3[1] - drag.start[1]) < 3) {
        onSelectionChange([]);
      }
      return;
    }
    if ((drag == null ? void 0 : drag.kind) === "box") {
      const point3 = eventScreenPoint(event);
      if (Math.hypot(point3[0] - drag.start[0], point3[1] - drag.start[1]) >= 3) {
        const first = screenToWorld(drag.start, viewport);
        const second = screenToWorld(point3, viewport);
        const ids = nodesInWorldBox(snapshot.document, normalizeBounds(first, second));
        onSelectionChange(drag.additive ? [.../* @__PURE__ */ new Set([...selectedIds, ...ids])] : ids);
      }
      setSelectionBox(null);
    }
  };
  const selectEntity = (id, event) => {
    event.stopPropagation();
    onSelectionChange(event.metaKey || event.ctrlKey ? selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id] : [id]);
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    dragRef.current = null;
    setSelectionBox(null);
    onSelectionChange([]);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      ref: containerRef,
      className,
      "data-canvas-root": "true",
      "data-controlled-drawing-surface": "true",
      role: "application",
      "aria-label": "可交互图纸画布",
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "svg",
        {
          className: "vai-canvas__svg",
          width: "100%",
          height: "100%",
          "aria-label": "图纸画布",
          onWheel: handleWheel,
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: () => onMouseWorldChange == null ? void 0 : onMouseWorldChange(null),
          onDoubleClick: () => onViewportChange(fitViewportToDrawing(snapshot.document, viewport, fitPadding)),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(CadGrid, { viewport, showGrid: display.grid, showAxes: display.axes }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { "data-canvas-background": "true", width: "100%", height: "100%", fill: "transparent" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { transform: `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale} ${-viewport.scale})`, children: [
              display.sourceUnderlay ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                SourceLayer,
                {
                  document: snapshot.document,
                  source: snapshot.source,
                  sourceUrl
                }
              ) : null,
              display.relations ? /* @__PURE__ */ jsxRuntimeExports.jsx(RelationLayer, { document: snapshot.document, viewport }) : null,
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                GeometryLayer,
                {
                  nodes: snapshot.document.geometry,
                  viewport,
                  selectedIds,
                  attentionIds,
                  onSelect: selectEntity
                }
              ),
              display.annotations ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                AnnotationLayer,
                {
                  nodes: snapshot.document.annotations,
                  viewport,
                  selectedIds,
                  attentionIds,
                  onSelect: selectEntity
                }
              ) : null,
              worldLayers
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SelectionLayer, { box: selectionBox }),
            screenLayers
          ]
        }
      )
    }
  );
}
function eventScreenPoint(event) {
  const target = event.currentTarget;
  const svg = target.tagName.toLowerCase() === "svg" ? target : target.ownerSVGElement;
  const bounds = svg == null ? void 0 : svg.getBoundingClientRect();
  return [event.clientX - ((bounds == null ? void 0 : bounds.left) ?? 0), event.clientY - ((bounds == null ? void 0 : bounds.top) ?? 0)];
}
function isBlankCanvasTarget(event) {
  var _a2;
  const target = event.target;
  return target === event.currentTarget || ((_a2 = target.dataset) == null ? void 0 : _a2.canvasBackground) === "true";
}
function normalizeBounds(first, second) {
  return {
    minX: Math.min(first[0], second[0]),
    minY: Math.min(first[1], second[1]),
    maxX: Math.max(first[0], second[0]),
    maxY: Math.max(first[1], second[1])
  };
}
const CATEGORY_LABELS = {
  engineering: "工程信息",
  cad: "原始 CAD 图层",
  assistant: "AI 信息",
  interaction: "编辑辅助"
};
const CATEGORY_ORDER = [
  "engineering",
  "cad",
  "assistant",
  "interaction"
];
const LAYER_ICONS = {
  partition: Boxes,
  angle: DraftingCompass,
  dimension: Ruler,
  tolerance: Gauge,
  cad: Layers,
  assistant: Sparkles
};
function DrawingLayerManager({ layers, onVisibilityChange }) {
  const [open, setOpen] = reactExports.useState(false);
  const [collapsedIds, setCollapsedIds] = reactExports.useState(() => /* @__PURE__ */ new Set());
  const rootRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const closeOutside = (event) => {
      var _a2;
      if (!((_a2 = rootRef.current) == null ? void 0 : _a2.contains(event.target))) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  if (layers.length === 0) return null;
  const groups = CATEGORY_ORDER.flatMap((category) => {
    const items = layers.filter(({ definition }) => definition.category === category);
    return items.length === 0 ? [] : [{ category, items }];
  });
  const stopPointer = (event) => event.stopPropagation();
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    setOpen(false);
  };
  const renderItem = ({ definition, visible, children }, depth = 0) => {
    const LayerIcon = definition.icon === void 0 ? Layers : LAYER_ICONS[definition.icon];
    const expandable = Boolean(children == null ? void 0 : children.length);
    const collapsed = collapsedIds.has(definition.id);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-layer-manager__branch", "data-layer-depth": depth, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-layer-manager__row", children: [
        expandable ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "vai-layer-manager__disclosure",
            "aria-label": `${collapsed ? "展开" : "收起"}${definition.label}`,
            "aria-expanded": !collapsed,
            onClick: () => setCollapsedIds((current) => {
              const next = new Set(current);
              if (collapsed) next.delete(definition.id);
              else next.add(definition.id);
              return next;
            }),
            children: collapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { size: 14 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { size: 14 })
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-layer-manager__disclosure-spacer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            className: "vai-layer-manager__item",
            "aria-label": `${visible ? "隐藏" : "显示"}${definition.label}`,
            "aria-pressed": visible,
            onClick: () => onVisibilityChange(definition.id, !visible),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LayerIcon, { size: 15, "aria-hidden": "true" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: definition.label }),
              visible ? /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { size: 15, "aria-hidden": "true" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(EyeOff, { size: 15, "aria-hidden": "true" })
            ]
          }
        )
      ] }),
      expandable && !collapsed && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-layer-manager__children", children: children.map((child) => renderItem(child, depth + 1)) })
    ] }, definition.id);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: rootRef,
      className: "vai-layer-manager",
      "data-layer-manager": "true",
      onMouseDown: stopPointer,
      onClick: stopPointer,
      onKeyDown: handleKeyDown,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "vai-layer-manager__trigger",
            "aria-label": "管理图层",
            "aria-expanded": open,
            title: "图层显示",
            onClick: () => setOpen((current) => !current),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Layers, { size: 17, "aria-hidden": "true" })
          }
        ),
        open && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-layer-manager__menu", role: "dialog", "aria-label": "图层显示", children: groups.map(({ category, items }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "vai-layer-manager__group", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { "data-layer-category": category, children: CATEGORY_LABELS[category] }),
          items.map((item) => renderItem(item))
        ] }, category)) })
      ]
    }
  );
}
async function runSharedAnnotationHistory(operation, refreshPeers) {
  await operation();
  await Promise.all(refreshPeers.map((refresh) => refresh()));
}
function DimensionChainOverlay({
  scheme,
  scale,
  radialExtent = 0,
  visible,
  previewHeld = false,
  visibleChainIds,
  onMoveChain,
  onMoveCandidate,
  onChooseClosure
}) {
  const [dragPreviews, setDragPreviews] = reactExports.useState({});
  const [closureMenu, setClosureMenu] = reactExports.useState(null);
  const dragRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (typeof window === "undefined" || closureMenu === null) return void 0;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setClosureMenu(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closureMenu]);
  if (!visible) return null;
  const conflicts = new Set(scheme.diagnostics.flatMap(({ severity, entityIds }) => severity === "error" ? entityIds ?? [] : []));
  const layouts = layoutIntervals(scheme, scale, radialExtent, previewHeld, dragPreviews);
  const layoutByCandidate = new Map(layouts.map((layout) => [layout.candidate.id, layout]));
  const grouped = scheme.chains.map((chain, chainIndex) => ({
    chain,
    chainIndex,
    layouts: layouts.filter(({ chainId }) => chainId === chain.id)
  })).filter(({ chain }) => visibleChainIds === void 0 || visibleChainIds.has(chain.id));
  const standalone = layouts.filter(({ chainId }) => chainId === void 0);
  const screenNormal = normalized([scheme.topology.axis.normal[0], -scheme.topology.axis.normal[1]]);
  const safeScale = Math.max(scale, 1e-6);
  const beginDrag = (layout, event) => {
    const target = layout.chainId === void 0 ? { type: "candidate", id: layout.candidate.id } : { type: "chain", id: layout.chainId };
    const enabled = target.type === "chain" ? Boolean(onMoveChain) : Boolean(onMoveCandidate);
    if (event.button !== 0 || !enabled || previewHeld) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startClient: [event.clientX, event.clientY],
      startGroupOffset: layout.groupOffset,
      minimumGroupOffset: layout.minimumGroupOffset
    };
  };
  const updateDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0] + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const targetKey2 = `${drag.target.type}:${drag.target.id}`;
    setDragPreviews((current) => ({
      ...current,
      [targetKey2]: Math.max(drag.startGroupOffset + projected, drag.minimumGroupOffset)
    }));
  };
  const finishDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateDrag(event);
    const projected = ((event.clientX - drag.startClient[0]) * screenNormal[0] + (event.clientY - drag.startClient[1]) * screenNormal[1]) / safeScale;
    const groupOffset = Math.max(drag.startGroupOffset + projected, drag.minimumGroupOffset);
    const targetKey2 = `${drag.target.type}:${drag.target.id}`;
    dragRef.current = null;
    setDragPreviews((current) => ({ ...current, [targetKey2]: groupOffset }));
    event.currentTarget.releasePointerCapture(event.pointerId);
    const save = drag.target.type === "chain" ? onMoveChain == null ? void 0 : onMoveChain(drag.target.id, roundOffset(groupOffset)) : onMoveCandidate == null ? void 0 : onMoveCandidate(drag.target.id, roundOffset(groupOffset));
    void Promise.resolve(save).then(() => window.requestAnimationFrame(() => {
      setDragPreviews((current) => {
        if (!(targetKey2 in current)) return current;
        const next = { ...current };
        delete next[targetKey2];
        return next;
      });
    })).catch(() => setDragPreviews((current) => {
      const next = { ...current };
      delete next[targetKey2];
      return next;
    }));
  };
  const cancelDrag = (event, releaseCapture) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    const targetKey2 = `${drag.target.type}:${drag.target.id}`;
    setDragPreviews((current) => {
      const next = { ...current };
      delete next[targetKey2];
      return next;
    });
    if (releaseCapture) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const renderInterval = (layout, standaloneDraggable = false, groupedDraggable = false) => {
    const ownsPointerHandlers = standaloneDraggable && Boolean(onMoveCandidate) && !previewHeld;
    const draggable = groupedDraggable || ownsPointerHandlers;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      IntervalGraphic,
      {
        scheme,
        layout,
        scale,
        radialExtent,
        dragAxis: Math.abs(screenNormal[0]) > Math.abs(screenNormal[1]) ? "x" : "y",
        conflict: !previewHeld && conflicts.has(layout.candidate.id),
        draggable,
        onPointerDown: ownsPointerHandlers ? (event) => beginDrag(layout, event) : void 0,
        onPointerMove: ownsPointerHandlers ? updateDrag : void 0,
        onPointerUp: ownsPointerHandlers ? finishDrag : void 0,
        onPointerCancel: ownsPointerHandlers ? (event) => cancelDrag(event, true) : void 0,
        onLostPointerCapture: ownsPointerHandlers ? (event) => cancelDrag(event, false) : void 0,
        onContextMenu: onChooseClosure && layout.chainId !== void 0 && closureOptionsForCandidate(scheme, layout.candidate.id, layout.chainId).length > 0 ? (event, position) => {
          event.preventDefault();
          event.stopPropagation();
          setClosureMenu({ candidateId: layout.candidate.id, chainId: layout.chainId, position });
        } : void 0
      },
      layout.candidate.id
    );
  };
  const dragAxis = Math.abs(screenNormal[0]) > Math.abs(screenNormal[1]) ? "x" : "y";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "g",
    {
      className: "vai-dimension-chain-overlay",
      "data-dimension-chain-overlay": "true",
      onPointerDown: () => setClosureMenu(null),
      children: [
        grouped.map(({ chain, chainIndex, layouts: owned }) => {
          const draggable = Boolean(onMoveChain) && !previewHeld && owned.length > 0;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "g",
            {
              className: `vai-dimension-chain-group vai-dimension-chain-group--tone-${chainIndex % 3}`,
              "data-dimension-chain-group": chain.id,
              "data-dimension-draggable": draggable || void 0,
              "data-dimension-drag-axis": dragAxis,
              pointerEvents: draggable || Boolean(onChooseClosure) ? "all" : "none",
              onPointerDown: draggable ? (event) => beginDrag(owned[0], event) : void 0,
              onPointerMove: draggable ? updateDrag : void 0,
              onPointerUp: draggable ? finishDrag : void 0,
              onPointerCancel: draggable ? (event) => cancelDrag(event, true) : void 0,
              onLostPointerCapture: draggable ? (event) => cancelDrag(event, false) : void 0,
              children: [
                owned.map((layout) => renderInterval(layout, false, draggable)),
                !previewHeld && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  ChainBracket,
                  {
                    scheme,
                    chain,
                    chainIndex,
                    layoutByCandidate,
                    scale,
                    draggable
                  }
                )
              ]
            },
            chain.id
          );
        }),
        standalone.map((layout) => renderInterval(layout, true)),
        closureMenu && /* @__PURE__ */ jsxRuntimeExports.jsx(
          ClosureContextMenu,
          {
            scheme,
            candidateId: closureMenu.candidateId,
            chainId: closureMenu.chainId,
            position: closureMenu.position,
            scale: safeScale,
            onChoose: (chainId) => {
              setClosureMenu(null);
              void Promise.resolve(onChooseClosure == null ? void 0 : onChooseClosure(chainId, closureMenu.candidateId)).catch(() => void 0);
            }
          }
        )
      ]
    }
  );
}
function dimensionChainFitPadding({ scheme, radialExtent, scale, viewport }) {
  const safeScale = Math.max(scale, 1e-6);
  const layouts = layoutIntervals(scheme, safeScale, radialExtent, false);
  if (layouts.length === 0) return 1.2;
  const normal = normalized(scheme.topology.axis.normal);
  const availablePixels = Math.min(
    Math.abs(normal[0]) > 1e-6 ? viewport.width / Math.abs(normal[0]) : Number.POSITIVE_INFINITY,
    Math.abs(normal[1]) > 1e-6 ? viewport.height / Math.abs(normal[1]) : Number.POSITIVE_INFINITY
  );
  const structuralPixels = Math.max(...layouts.map(({ automaticOffset }) => (automaticOffset - radialExtent) * safeScale)) + 24;
  const maxManualOffset = Math.max(0, ...layouts.map(({ manualOffset }) => manualOffset));
  const stationCoordinates = scheme.topology.stations.map(({ sourceCoordinate }) => sourceCoordinate);
  const axisMin = Number.isFinite(scheme.topology.axis.zMin) ? scheme.topology.axis.zMin : Math.min(...stationCoordinates);
  const axisMax = Number.isFinite(scheme.topology.axis.zMax) ? scheme.topology.axis.zMax : Math.max(...stationCoordinates);
  const axisSpan = Math.max(0, axisMax - axisMin);
  const referenceRadius = Math.max(radialExtent, axisSpan * 0.05, 1);
  const freeFraction = Math.max(0.2, 1 - 2 * structuralPixels / Math.max(availablePixels, 1));
  return Math.max(1.2, (referenceRadius + maxManualOffset) / referenceRadius / freeFraction * 1.05);
}
function layoutIntervals(scheme, scale, radialExtent, previewHeld, dragPreviews = {}) {
  var _a2, _b;
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const coordinates = new Map(scheme.topology.stations.map(({ id, sourceCoordinate }) => [id, sourceCoordinate]));
  const closures = previewHeld ? /* @__PURE__ */ new Set() : new Set(scheme.closureCandidateIds);
  const visibleIds = [...scheme.displayedCandidateIds, ...closures];
  const membershipByCandidate = candidateMemberships(scheme);
  const chainDepths = chainDepthIndex(scheme);
  const maxDepth = Math.max(0, ...chainDepths.values());
  const safeScale = Math.max(scale, 1e-6);
  const base = radialExtent + 28 / safeScale;
  const manual = new Map(((_a2 = scheme.layout) == null ? void 0 : _a2.candidateNormalOffsets.map(({ candidateId, normalOffset }) => [candidateId, normalOffset])) ?? []);
  const chainOffsets = new Map(((_b = scheme.layout) == null ? void 0 : _b.chainNormalOffsets.map(({ chainId, normalOffset }) => [chainId, normalOffset])) ?? []);
  const occupiedByRow = /* @__PURE__ */ new Map();
  const layouts = [...new Set(visibleIds)].flatMap((candidateId) => {
    const candidate = candidates.get(candidateId);
    if (!candidate) return [];
    const first = coordinates.get(candidate.startStationId);
    const second = coordinates.get(candidate.endStationId);
    if (first === void 0 || second === void 0) return [];
    const memberships = membershipByCandidate.get(candidateId) ?? [];
    const owner = primaryMembership(memberships);
    const role = closures.has(candidateId) ? "closure" : (owner == null ? void 0 : owner.role) ?? "standalone";
    const depth = owner === void 0 ? 0 : chainDepths.get(owner.chainId) ?? 0;
    const row = role === "parent" ? maxDepth + 1 : role === "standalone" ? maxDepth + 2 : maxDepth - depth;
    const label = `${candidate.nominalValue} ${scheme.topology.unit}`;
    const halfLabelWidth = (estimateScreenTextWidth(label, 11) + 10) / (2 * safeScale);
    const center = (first + second) / 2;
    const visual = { start: Math.min(first, second, center - halfLabelWidth), end: Math.max(first, second, center + halfLabelWidth) };
    const occupied = occupiedByRow.get(row) ?? [];
    let lane = 0;
    while (occupied.some((item) => item.lane === lane && overlaps(visual, item, 8 / safeScale))) lane += 1;
    occupied.push({ start: visual.start, end: visual.end, lane });
    occupiedByRow.set(row, occupied);
    const automaticOffset = base + (row * 26 + lane * 22) / safeScale;
    const minimumOffset = radialExtent + 14 / safeScale;
    const candidateOffset = manual.get(candidateId) ?? 0;
    const targetKey2 = owner === void 0 ? `candidate:${candidateId}` : `chain:${owner.chainId}`;
    const requestedGroupOffset = dragPreviews[targetKey2] ?? (owner === void 0 ? candidateOffset : chainOffsets.get(owner.chainId) ?? 0);
    return [{
      candidate,
      ...owner === void 0 ? {} : { chainId: owner.chainId },
      chainIndex: (owner == null ? void 0 : owner.chainIndex) ?? -1,
      role,
      memberships,
      lane,
      start: first,
      end: second,
      automaticOffset,
      manualOffset: owner === void 0 ? 0 : candidateOffset,
      groupOffset: requestedGroupOffset,
      minimumGroupOffset: minimumOffset - automaticOffset - (owner === void 0 ? 0 : candidateOffset)
    }];
  });
  const minimumByTarget = /* @__PURE__ */ new Map();
  for (const layout of layouts) {
    const targetKey2 = layout.chainId === void 0 ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`;
    minimumByTarget.set(targetKey2, Math.max(minimumByTarget.get(targetKey2) ?? Number.NEGATIVE_INFINITY, layout.minimumGroupOffset));
  }
  return layouts.map((layout) => ({
    ...layout,
    groupOffset: Math.max(
      layout.groupOffset,
      minimumByTarget.get(layout.chainId === void 0 ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`) ?? Number.NEGATIVE_INFINITY
    ),
    minimumGroupOffset: minimumByTarget.get(
      layout.chainId === void 0 ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`
    ) ?? layout.minimumGroupOffset,
    manualOffset: layout.manualOffset + Math.max(
      layout.groupOffset,
      minimumByTarget.get(layout.chainId === void 0 ? `candidate:${layout.candidate.id}` : `chain:${layout.chainId}`) ?? Number.NEGATIVE_INFINITY
    )
  }));
}
function candidateMemberships(scheme) {
  const result = /* @__PURE__ */ new Map();
  const add = (candidateId, membership) => {
    result.set(candidateId, [...result.get(candidateId) ?? [], membership]);
  };
  scheme.chains.forEach((chain, chainIndex) => {
    add(chain.parentCandidateId, { chainId: chain.id, chainIndex, role: "parent" });
    for (const candidateId of chain.childCandidateIds) add(candidateId, { chainId: chain.id, chainIndex, role: "child" });
    add(chain.closureCandidateId, { chainId: chain.id, chainIndex, role: "closure" });
  });
  return result;
}
function primaryMembership(memberships) {
  return memberships.find(({ role }) => role === "closure") ?? memberships.find(({ role }) => role === "parent") ?? memberships[0];
}
function chainDepthIndex(scheme) {
  const byParentCandidate = new Map(scheme.chains.map((chain) => [chain.parentCandidateId, chain]));
  const parentByChain = /* @__PURE__ */ new Map();
  for (const chain of scheme.chains) {
    const parent = scheme.chains.find((candidate) => candidate.childCandidateIds.includes(chain.parentCandidateId));
    if (parent) parentByChain.set(chain.id, parent.id);
  }
  const result = /* @__PURE__ */ new Map();
  const depth = (chainId) => {
    const cached2 = result.get(chainId);
    if (cached2 !== void 0) return cached2;
    const parent = parentByChain.get(chainId);
    const value = parent === void 0 ? 0 : depth(parent) + 1;
    result.set(chainId, value);
    return value;
  };
  for (const chain of byParentCandidate.values()) depth(chain.id);
  return result;
}
function IntervalGraphic({ scheme, layout, scale, radialExtent, dragAxis, conflict, draggable, ...pointerHandlers }) {
  const { candidate, lane, role } = layout;
  const { origin, direction, normal } = scheme.topology.axis;
  const safeScale = Math.max(scale, 1e-6);
  const offset = layout.automaticOffset + layout.manualOffset;
  const point3 = (coordinate, normalOffset) => [
    origin[0] + direction[0] * coordinate + normal[0] * normalOffset,
    origin[1] + direction[1] * coordinate + normal[1] * normalOffset
  ];
  const a = point3(layout.start, offset);
  const b = point3(layout.end, offset);
  const witnessA = point3(layout.start, radialExtent + 3 / safeScale);
  const witnessB = point3(layout.end, radialExtent + 3 / safeScale);
  const lineMiddle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const labelOffset = (role === "closure" ? 14 : 11) / safeScale;
  const middle = [lineMiddle[0] + normal[0] * labelOffset, lineMiddle[1] + normal[1] * labelOffset];
  const screenLength = Math.abs(layout.end - layout.start) * safeScale;
  const closureDash = screenLength < 24 ? `${Math.max(1, screenLength / 5) / safeScale} ${Math.max(0.8, screenLength / 10) / safeScale}` : `${5 / safeScale} ${4 / safeScale}`;
  const tick = 4 / safeScale;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "g",
    {
      className: `vai-dimension-chain-interval vai-dimension-chain-interval--${role}`,
      "data-dimension-candidate-id": candidate.id,
      "data-dimension-chain-id": layout.chainId,
      "data-dimension-chain-index": layout.chainIndex,
      "data-dimension-role": role,
      "data-dimension-chain-memberships": layout.memberships.map(({ chainId }) => chainId).join(" "),
      "data-dimension-membership-roles": layout.memberships.map(({ role: role2 }) => role2).join(" "),
      "data-dimension-shared": layout.memberships.length > 1 || void 0,
      "data-dimension-lane": lane,
      "data-normal-offset": offset,
      "data-dimension-displayed": role !== "closure" || void 0,
      "data-dimension-closure": role === "closure" || void 0,
      "data-dimension-conflict": conflict || void 0,
      "data-dimension-draggable": draggable || void 0,
      "data-dimension-drag-axis": dragAxis,
      pointerEvents: draggable || pointerHandlers.onContextMenu ? "all" : "none",
      ...pointerHandlers,
      onContextMenu: pointerHandlers.onContextMenu ? (event) => {
        var _a2;
        return (_a2 = pointerHandlers.onContextMenu) == null ? void 0 : _a2.call(pointerHandlers, event, middle);
      } : void 0,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("line", { className: "vai-dimension-chain-extension", "data-dimension-extension": "start", x1: witnessA[0], y1: witnessA[1], x2: a[0], y2: a[1], vectorEffect: "non-scaling-stroke" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("line", { className: "vai-dimension-chain-extension", "data-dimension-extension": "end", x1: witnessB[0], y1: witnessB[1], x2: b[0], y2: b[1], vectorEffect: "non-scaling-stroke" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "line",
          {
            className: "vai-dimension-chain-line",
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            strokeDasharray: role === "closure" ? closureDash : void 0,
            vectorEffect: "non-scaling-stroke"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: a[0] - normal[0] * tick, y1: a[1] - normal[1] * tick, x2: a[0] + normal[0] * tick, y2: a[1] + normal[1] * tick, vectorEffect: "non-scaling-stroke" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: b[0] - normal[0] * tick, y1: b[1] - normal[1] * tick, x2: b[0] + normal[0] * tick, y2: b[1] + normal[1] * tick, vectorEffect: "non-scaling-stroke" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: middle, viewportScale: scale, background: true, className: "vai-dimension-chain-label", "data-dimension-lane": lane, children: `${candidate.nominalValue} ${scheme.topology.unit}` })
      ]
    }
  );
}
function ClosureContextMenu({ scheme, candidateId, chainId, position, scale, onChoose }) {
  const options = closureOptionsForCandidate(scheme, candidateId, chainId);
  const width = options.length > 1 ? 188 : 148;
  const rowHeight = 30;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "g",
    {
      className: "vai-dimension-closure-menu",
      "data-dimension-closure-menu": candidateId,
      role: "menu",
      transform: screenSpaceTransform(position, scale),
      pointerEvents: "all",
      onPointerDown: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { className: "vai-dimension-closure-menu__surface", x: 0, y: 0, width, height: options.length * rowHeight, rx: 8 }),
        options.map(({ chain, chainIndex, current }, optionIndex) => {
          const label = current ? options.length > 1 ? `尺寸链 ${chainIndex + 1} · 当前缺省段` : "当前缺省段" : options.length > 1 ? `尺寸链 ${chainIndex + 1} · 切换为缺省段` : "切换为缺省段";
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "g",
            {
              className: "vai-dimension-closure-menu__item",
              "data-closure-chain-id": chain.id,
              "data-closure-current": current || void 0,
              role: "menuitem",
              "aria-disabled": current || void 0,
              transform: `translate(0 ${optionIndex * rowHeight})`,
              onClick: current ? void 0 : (event) => {
                event.stopPropagation();
                onChoose(chain.id);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: 3, y: 3, width: width - 6, height: rowHeight - 6, rx: 6 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: 12, y: rowHeight / 2, dominantBaseline: "middle", fontSize: 11, children: label })
              ]
            },
            chain.id
          );
        })
      ]
    }
  );
}
function closureOptionsForCandidate(scheme, candidateId, chainId) {
  return scheme.chains.flatMap((chain, chainIndex) => chain.id !== chainId ? [] : chain.closureCandidateId === candidateId ? [{ chain, chainIndex, current: true }] : chain.alternativeClosureCandidateIds.includes(candidateId) ? [{ chain, chainIndex, current: false }] : []);
}
function ChainBracket({ scheme, chain, chainIndex, layoutByCandidate, scale, draggable }) {
  const layouts = [chain.parentCandidateId, ...chain.childCandidateIds, chain.closureCandidateId].flatMap((id) => layoutByCandidate.get(id) ?? []).filter((layout) => layout.chainId === chain.id);
  if (layouts.length === 0) return null;
  const safeScale = Math.max(scale, 1e-6);
  const { origin, direction, normal } = scheme.topology.axis;
  const offsetOf = (layout) => layout.automaticOffset + layout.manualOffset;
  const offsets = layouts.map(offsetOf);
  const coordinate = Math.min(...layouts.map(({ start, end }) => Math.min(start, end))) - 12 / safeScale;
  const near = Math.min(...offsets);
  const far = Math.max(...offsets);
  const point3 = (normalOffset) => [
    origin[0] + direction[0] * coordinate + normal[0] * normalOffset,
    origin[1] + direction[1] * coordinate + normal[1] * normalOffset
  ];
  const a = point3(near);
  const b = point3(far);
  const cap = 6 / safeScale;
  const titleAnchor = Math.max(...layouts.map(offsetOf));
  const title = point3(titleAnchor + 12 / safeScale);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { className: "vai-dimension-chain-bracket", "data-dimension-chain-bracket": chain.id, pointerEvents: draggable ? "all" : "none", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: `M ${a[0] + direction[0] * cap} ${a[1] + direction[1] * cap} L ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${b[0] + direction[0] * cap} ${b[1] + direction[1] * cap}`, fill: "none", vectorEffect: "non-scaling-stroke" }),
    layouts.map((layout) => {
      const member = point3(offsetOf(layout));
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        "line",
        {
          "data-dimension-chain-member": layout.candidate.id,
          x1: member[0],
          y1: member[1],
          x2: member[0] + direction[0] * cap,
          y2: member[1] + direction[1] * cap,
          vectorEffect: "non-scaling-stroke"
        },
        layout.candidate.id
      );
    }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenSpaceLabel, { position: title, viewportScale: scale, background: true, className: "vai-dimension-chain-title", "data-dimension-chain-title": chain.id, children: `尺寸链 ${chainIndex + 1}` })
  ] });
}
function overlaps(left, right, padding) {
  return !(left.end + padding < right.start || left.start - padding > right.end);
}
function normalized(value) {
  const x = typeof value[0] === "number" ? value[0] : 0;
  const y = typeof value[1] === "number" ? value[1] : 0;
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}
function roundOffset(value) {
  return Math.round(value * 1e3) / 1e3;
}
function DimensionChainInspector({ scheme, controller, editable = true }) {
  const candidates = new Map(scheme.candidates.map((candidate2) => [candidate2.id, candidate2]));
  const candidate = (id) => candidates.get(id);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "vai-dimension-chain-inspector", "aria-label": "尺寸链推断检查", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "轴向尺寸链" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-dimension-scheme-status": scheme.status, children: statusLabel(scheme.status) })
    ] }),
    scheme.diagnostics.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "vai-dimension-chain-inspector__diagnostics", children: scheme.diagnostics.map((diagnostic) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: diagnosticLabel(diagnostic.code) }, diagnostic.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { children: scheme.chains.map((chain) => {
      const parent = candidate(chain.parentCandidateId);
      const closure = candidate(chain.closureCandidateId);
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { "data-dimension-chain-id": chain.id, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
          (parent == null ? void 0 : parent.nominalValue) ?? "?",
          " ",
          scheme.topology.unit
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          chain.childCandidateIds.map((id) => {
            var _a2;
            return ((_a2 = candidate(id)) == null ? void 0 : _a2.nominalValue) ?? "?";
          }).join(" + "),
          " + ",
          (closure == null ? void 0 : closure.nominalValue) ?? "?"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("small", { children: [
          "闭环：",
          (closure == null ? void 0 : closure.nominalValue) ?? "?",
          " ",
          scheme.topology.unit
        ] }),
        editable && chain.alternativeClosureCandidateIds.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-dimension-chain-inspector__alternatives", children: chain.alternativeClosureCandidateIds.map((id) => {
          const item = candidate(id);
          if (!item) return null;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              type: "button",
              "aria-label": `选择候选闭环 ${item.nominalValue} ${scheme.topology.unit}`,
              onClick: () => void controller.actions.chooseClosure(chain.id, id).catch(() => void 0),
              children: [
                "改用 ",
                item.nominalValue,
                " ",
                scheme.topology.unit
              ]
            },
            id
          );
        }) })
      ] }, chain.id);
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "显示尺寸" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "vai-dimension-chain-inspector__candidates", children: scheme.candidates.filter(({ id }) => !scheme.closureCandidateIds.includes(id)).map((item) => {
      const displayed = scheme.displayedCandidateIds.includes(item.id);
      return /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: displayed, disabled: !editable, onChange: (event) => {
          void controller.actions.setDisplayed(item.id, event.currentTarget.checked).catch(() => void 0);
        } }),
        item.nominalValue,
        " ",
        scheme.topology.unit
      ] }) }, item.id);
    }) })
  ] });
}
function statusLabel(status) {
  return { resolved: "可确认", "needs-review": "待复核", conflict: "有冲突", stale: "已过期" }[status];
}
function diagnosticLabel(code) {
  if (code === "DIMENSION_DOCUMENT_DISPLAY_CONFLICT") return "文档与目标标注冲突";
  if (code === "DIMENSION_CLOSURE_AMBIGUOUS") return "闭环选择需要确认";
  if (code === "DIMENSION_CHAIN_INCOMPLETE") return "尺寸链不完整";
  return code;
}
function partitionBands(draft, mode) {
  if (mode === "segments") return draft.segments.map((segment, index) => ({
    id: segment.id,
    segmentIds: [segment.id],
    segments: [segment],
    zStart: segment.zStart,
    zEnd: segment.zEnd,
    startBoundaryIndex: index,
    endBoundaryIndex: index + 1,
    ...segment.name === void 0 ? {} : { name: segment.name },
    ...segment.semanticType === void 0 ? {} : { semanticType: segment.semanticType },
    origin: evidenceOrigin(draft, segment.semanticEvidenceIds) ?? "geometry"
  }));
  const indexById = new Map(draft.segments.map((segment, index) => [segment.id, index]));
  return draft.semanticGroups.flatMap((group) => {
    var _a2, _b;
    const origin = evidenceOrigin(draft, group.evidenceIds) ?? "geometry";
    if (origin === "ai" && isGenericFunctionalGroup(group.semanticType, group.name)) return [];
    const indices = group.segmentIds.map((id) => indexById.get(id)).filter((index) => index !== void 0).sort((a, b) => a - b);
    if (indices.length === 0) return [];
    const startBoundaryIndex = indices[0];
    const endBoundaryIndex = indices.at(-1) + 1;
    const segments = indices.map((index) => draft.segments[index]);
    const zStart = ((_a2 = group.range) == null ? void 0 : _a2.zStart) ?? segments[0].zStart;
    const zEnd = ((_b = group.range) == null ? void 0 : _b.zEnd) ?? segments.at(-1).zEnd;
    return [{
      id: group.id,
      segmentIds: segments.map(({ id }) => id),
      segments,
      zStart,
      zEnd,
      startBoundaryIndex,
      endBoundaryIndex,
      ...group.name === void 0 ? {} : { name: group.name },
      semanticType: group.semanticType,
      origin
    }];
  }).sort((a, b) => a.zStart - b.zStart || a.zEnd - b.zEnd);
}
function isGenericFunctionalGroup(semanticType, name) {
  return /(?:work[-_ ]?area|working[-_ ]?area|工作区域|工作区|普通轴段|常规区域|shaft[-_ ]?region)/u.test(`${semanticType} ${name ?? ""}`.toLowerCase());
}
function evidenceOrigin(draft, evidenceIds) {
  return evidenceIds.map((id) => {
    var _a2;
    return (_a2 = draft.evidence.find((item) => item.id === id)) == null ? void 0 : _a2.origin;
  }).find(Boolean);
}
function PartitionOverlay({ draft, mode = "functional", previewHeld, scale, onMoveBoundary, onMoveSemanticRange, onRenameBand }) {
  const [drag, setDrag] = reactExports.useState(null);
  const [naming, setNaming] = reactExports.useState(null);
  const nameCommit = reactExports.useRef(null);
  const current = reactExports.useRef(null);
  const point3 = (z, r) => [
    draft.axis.origin[0] + draft.axis.direction[0] * z + draft.axis.normal[0] * r,
    draft.axis.origin[1] + draft.axis.direction[1] * z + draft.axis.normal[1] * r
  ];
  const pointerMove = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!current.current) return;
    const screenX = event.clientX - current.current.lastClientX;
    const screenY = event.clientY - current.current.lastClientY;
    const delta = (screenX * draft.axis.direction[0] - screenY * draft.axis.direction[1]) / Math.max(scale, 1e-6);
    current.current = {
      ...current.current,
      z: current.current.z + delta,
      lastClientX: event.clientX,
      lastClientY: event.clientY
    };
    setDrag(current.current);
  };
  const finishPointer = async (event, releaseCapture) => {
    event.preventDefault();
    event.stopPropagation();
    const value = current.current;
    current.current = null;
    if (releaseCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
      }
    }
    if (!value) return;
    try {
      if (value.target.kind === "segment") {
        if (!onMoveBoundary) throw new Error("PARTITION_BOUNDARY_HANDLER_REQUIRED");
        await onMoveBoundary(value.target.index, value.z);
      } else {
        if (!onMoveSemanticRange) throw new Error("PARTITION_SEMANTIC_RANGE_HANDLER_REQUIRED");
        await onMoveSemanticRange(value.target.groupId, value.target.edge, value.z);
      }
      setDrag(null);
    } catch {
      setDrag(value);
    }
  };
  const bands = partitionBands(draft, mode);
  const commitName = async (band) => {
    var _a2;
    if ((naming == null ? void 0 : naming.bandId) !== band.id) return;
    const name = naming.value.trim();
    if (!name || name === ((_a2 = band.name) == null ? void 0 : _a2.trim())) {
      setNaming(null);
      return;
    }
    if (!onRenameBand) return;
    const commitKey = `${band.id}\0${name}`;
    if (nameCommit.current === commitKey) return;
    nameCommit.current = commitKey;
    try {
      await onRenameBand(band, name);
      setNaming(null);
    } catch {
    } finally {
      nameCommit.current = null;
    }
  };
  const editable = onMoveBoundary !== void 0 || onMoveSemanticRange !== void 0;
  const handles = !editable ? [] : mode === "segments" ? [...new Set(bands.flatMap(({ startBoundaryIndex, endBoundaryIndex }) => [startBoundaryIndex, endBoundaryIndex]))].filter((index) => index > 0 && index < draft.segments.length).sort((a, b) => a - b).map((index) => ({ key: `boundary:${index}`, z: draft.segments[index].zStart, target: { kind: "segment", index } })) : bands.flatMap((band, index) => {
    const label = bandLabel(band, index);
    return [
      { key: `semantic:${band.id}:start`, z: band.zStart, target: { kind: "semantic", groupId: band.id, edge: "start", label } },
      { key: `semantic:${band.id}:end`, z: band.zEnd, target: { kind: "semantic", groupId: band.id, edge: "end", label } }
    ];
  }).sort((a, b) => a.z - b.z || a.key.localeCompare(b.key));
  const boundaryLanes = handles.map(({ z }, offset) => {
    const previousIsClose = offset > 0 && Math.abs(z - handles[offset - 1].z) * scale < 18;
    const nextIsClose = offset < handles.length - 1 && Math.abs(handles[offset + 1].z - z) * scale < 18;
    return previousIsClose ? 1 : nextIsClose ? -1 : 0;
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { "data-partition-overlay": "true", children: [
    bands.map((band, bandIndex) => {
      const radius = Math.max(...band.segments.map(({ profile }) => profile.maxRadius), 0.1) * 1.04;
      const zStart = (drag == null ? void 0 : drag.target.kind) === "segment" && drag.target.index === band.startBoundaryIndex || (drag == null ? void 0 : drag.target.kind) === "semantic" && drag.target.groupId === band.id && drag.target.edge === "start" ? drag.z : band.zStart;
      const zEnd = (drag == null ? void 0 : drag.target.kind) === "segment" && drag.target.index === band.endBoundaryIndex || (drag == null ? void 0 : drag.target.kind) === "semantic" && drag.target.groupId === band.id && drag.target.edge === "end" ? drag.z : band.zEnd;
      const polygon = [point3(zStart, -radius), point3(zEnd, -radius), point3(zEnd, radius), point3(zStart, radius)];
      const label = bandLabel(band, bandIndex);
      const labelAnchor = point3((zStart + zEnd) / 2, radius);
      const labelWidth = Math.max(44, visualLength(label) * 7 + 18);
      const labelY = -18 - bandIndex % 3 * 22;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "g",
        {
          "data-partition-id": band.id,
          "data-partition-origin": band.origin,
          "data-segment-ids": band.segmentIds.join(" "),
          "aria-label": `分区 ${label}`,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "polygon",
              {
                "data-partition-band": "true",
                points: polygon.map((value) => value.join(",")).join(" "),
                className: `vai-partition-band vai-partition-band--${band.origin}`,
                "data-line-style": band.origin === "document" ? "solid" : band.origin === "ai" ? "dotted" : "dashed"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "g",
              {
                className: "vai-partition-label-anchor",
                "data-screen-space-label": true,
                transform: screenSpaceTransform(labelAnchor, scale),
                pointerEvents: previewHeld || !onRenameBand ? "none" : "all",
                role: previewHeld || !onRenameBand ? void 0 : "button",
                tabIndex: previewHeld || !onRenameBand ? void 0 : 0,
                "aria-label": previewHeld || !onRenameBand ? void 0 : `重命名分区 ${label}`,
                onPointerDown: (event) => {
                  if (onRenameBand && !previewHeld) event.stopPropagation();
                },
                onClick: (event) => {
                  if (!onRenameBand || previewHeld) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setNaming({ bandId: band.id, value: band.name ?? "" });
                },
                onKeyDown: (event) => {
                  if (!onRenameBand || previewHeld || event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setNaming({ bandId: band.id, value: band.name ?? "" });
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { className: "vai-partition-label-bg", x: -labelWidth / 2, y: labelY - 10, width: labelWidth, height: 20, rx: 7 }),
                  (naming == null ? void 0 : naming.bandId) === band.id ? /* @__PURE__ */ jsxRuntimeExports.jsx("foreignObject", { x: -labelWidth / 2 + 3, y: labelY - 9, width: labelWidth - 6, height: 18, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "input",
                    {
                      className: "vai-partition-label-input",
                      "aria-label": `编辑分区名称 ${label}`,
                      autoFocus: true,
                      maxLength: 120,
                      value: naming.value,
                      onChange: (event) => setNaming({ bandId: band.id, value: event.currentTarget.value }),
                      onClick: (event) => event.stopPropagation(),
                      onPointerDown: (event) => event.stopPropagation(),
                      onBlur: () => void commitName(band),
                      onKeyDown: (event) => {
                        event.stopPropagation();
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setNaming(null);
                        } else if (event.key === "Enter") {
                          event.preventDefault();
                          return commitName(band);
                        }
                      }
                    }
                  ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("text", { className: "vai-partition-label", x: 0, y: labelY, textAnchor: "middle", dominantBaseline: "middle", children: label })
                ]
              }
            )
          ]
        },
        band.id
      );
    }),
    !previewHeld && handles.map((handle, offset) => {
      const z = (drag == null ? void 0 : drag.target.kind) === handle.target.kind && targetKey(drag.target) === targetKey(handle.target) ? drag.z : handle.z;
      const anchor = point3(z, 0);
      const lane = boundaryLanes[offset];
      const position = point3(z, lane * 12 / Math.max(scale, 0.01));
      const ariaLabel = handle.target.kind === "segment" ? `移动分区边界 ${handle.target.index}` : `移动${handle.target.label}${handle.target.edge === "start" ? "起点" : "终点"}`;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
        lane !== 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("line", { className: "vai-partition-handle-leader", x1: anchor[0], y1: anchor[1], x2: position[0], y2: position[1], pointerEvents: "none" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "circle",
          {
            "aria-label": ariaLabel,
            "data-handle-lane": lane,
            className: "vai-partition-handle",
            cx: position[0],
            cy: position[1],
            r: 7 / Math.max(scale, 0.01),
            onMouseDown: (event) => {
              event.preventDefault();
              event.stopPropagation();
            },
            onPointerDown: (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              current.current = { target: handle.target, z, lastClientX: event.clientX, lastClientY: event.clientY };
              setDrag(current.current);
            },
            onPointerMove: pointerMove,
            onPointerUp: (event) => finishPointer(event, true),
            onPointerCancel: (event) => finishPointer(event, true),
            onLostPointerCapture: (event) => void finishPointer(event, false)
          }
        )
      ] }, handle.key);
    })
  ] });
}
function targetKey(target) {
  return target.kind === "segment" ? `segment:${target.index}` : `semantic:${target.groupId}:${target.edge}`;
}
function bandLabel(band, index) {
  var _a2, _b;
  const groupLabel = ((_a2 = band.name) == null ? void 0 : _a2.trim()) || ((_b = band.semanticType) == null ? void 0 : _b.trim());
  const names = groupLabel ? [groupLabel] : [...new Set(band.segments.map(({ name, semanticType }) => (name == null ? void 0 : name.trim()) || (semanticType == null ? void 0 : semanticType.trim())).filter(Boolean))];
  const label = names.length > 0 ? names.join(" · ") : `分区 ${index + 1}`;
  return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}
function visualLength(value) {
  return [...value].reduce((total, character) => total + ((character.codePointAt(0) ?? 0) > 255 ? 2 : 1), 0);
}
function PartitionActionToolbar({ controller, previewHeld, subject = "分区" }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-actions", role: "toolbar", "aria-label": `${subject}确认工具栏`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "vai-partition-action vai-partition-action--cancel", "aria-label": `取消${subject}`, title: "取消", onClick: () => void controller.actions.cancel().catch(() => void 0), children: "×" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: `vai-partition-action vai-partition-action--preview${previewHeld ? " is-held" : ""}`,
        "aria-label": `按住预览${subject}结果`,
        title: "按住预览",
        onPointerDown: () => controller.actions.setPreviewHeld(true),
        onPointerUp: () => controller.actions.setPreviewHeld(false),
        onPointerCancel: () => controller.actions.setPreviewHeld(false),
        onPointerLeave: () => controller.actions.setPreviewHeld(false),
        children: "◉"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "vai-partition-action vai-partition-action--confirm", "aria-label": `确认${subject}`, title: "确认", onClick: () => void controller.actions.confirm().catch(() => void 0), children: "✓" })
  ] });
}
function PartitionViewSwitch({ mode, onChange }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-view-switch", role: "group", "aria-label": "分区显示方式", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: mode === "functional" ? "is-active" : void 0,
        "aria-label": "显示功能分区",
        "aria-pressed": mode === "functional",
        onClick: () => onChange("functional"),
        children: "功能分区"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: mode === "segments" ? "is-active" : void 0,
        "aria-label": "显示连续轴段",
        "aria-pressed": mode === "segments",
        onClick: () => onChange("segments"),
        children: "连续轴段"
      }
    )
  ] });
}
function PartitionInspector({ draft, controller, mode, onModeChange }) {
  const functional = partitionBands(draft, "functional");
  const classified = new Set(functional.flatMap(({ segmentIds }) => segmentIds));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-inspector", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-inspector__title", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: mode === "functional" ? "功能分区" : "连续轴段" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionViewSwitch, { mode, onChange: onModeChange })
    ] }),
    mode === "functional" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { children: functional.map((band) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: band.name ?? band.semanticType ?? "未命名功能区" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("small", { children: [
          band.zStart.toFixed(2),
          " – ",
          band.zEnd.toFixed(2),
          " · ",
          sourceLabel(band.origin)
        ] }),
        band.semanticType && /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: band.semanticType })
      ] }, band.id)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "vai-partition-inspector__unclassified", children: [
        "未归入功能区的过渡轴段：",
        draft.segments.length - classified.size,
        " 段"
      ] })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { children: draft.segments.map((segment, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: segment.name ?? `轴段 S${index + 1}` }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("small", { children: [
        segment.zStart.toFixed(2),
        " – ",
        segment.zEnd.toFixed(2),
        " · ⌀",
        (segment.profile.maxRadius * 2).toFixed(2)
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-inspector__fields", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { "aria-label": `轴段 ${index + 1} 名称`, defaultValue: segment.name ?? "", placeholder: "名称", onBlur: (event) => void controller.actions.updateSegment(segment.id, { name: event.currentTarget.value }).catch(() => void 0) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { "aria-label": `轴段 ${index + 1} 类型`, defaultValue: segment.semanticType ?? "", placeholder: "类型", onBlur: (event) => void controller.actions.updateSegment(segment.id, { semanticType: event.currentTarget.value }).catch(() => void 0) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-inspector__commands", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": `拆分轴段 ${index + 1}`, onClick: () => void controller.actions.splitSegment(segment.id, (segment.zStart + segment.zEnd) / 2, Math.max(draft.axis.zMax * 3e-3, 0.05)).catch(() => void 0), children: "拆分" }),
        index > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": `合并边界 ${index}`, onClick: () => void controller.actions.mergeBoundary(index).catch(() => void 0), children: "与前段合并" })
      ] }),
      index < draft.segments.length - 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "vai-partition-inspector__boundary", children: [
        "结束位置",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", step: "any", defaultValue: segment.zEnd, "aria-label": `边界 ${index + 1} 精确位置`, onKeyDown: (event) => {
          if (event.key === "Enter") void controller.actions.moveBoundary(index + 1, Number(event.currentTarget.value), 0).catch(() => void 0);
        } })
      ] })
    ] }, segment.id)) }),
    draft.diagnostics.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-partition-diagnostics", children: draft.diagnostics.map((diagnostic) => /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: diagnostic.code }, diagnostic.id)) })
  ] });
}
function sourceLabel(origin) {
  return { document: "文档", ai: "AI 识别", manual: "人工", fused: "融合", geometry: "几何" }[origin] ?? origin;
}
function DimensionPlanInspector({ draft, generationOrder }) {
  const intentsById = new Map(draft.intents.map((intent) => [intent.id, intent]));
  const tolerancesByIntentId = new Map(draft.tolerances.map((tolerance) => [tolerance.dimensionIntentId, tolerance]));
  const datumsById = new Map(draft.datums.map((datum) => [datum.id, datum]));
  const orderedIntents = generationOrder.flatMap((id) => {
    const intent = intentsById.get(id);
    return intent === void 0 ? [] : [intent];
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "vai-dimension-plan", "aria-label": "尺寸计划检查", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "尺寸标注计划" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        orderedIntents.length,
        " 项"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { "aria-label": "尺寸标注顺序", children: orderedIntents.map((intent, index) => {
      const tolerance = tolerancesByIntentId.get(intent.id);
      const datumNames = intent.datumIds.flatMap((id) => {
        const datum = datumsById.get(id);
        return datum === void 0 ? [] : [datum.name];
      });
      const chainRoles = draft.chains.flatMap((chain) => chain.members.filter((member) => member.dimensionIntentId === intent.id).map((member) => `${chain.name ?? chain.id} · ${chainRoleLabel(member.role)}`));
      const diagnostics = [
        ...draft.diagnostics.filter(({ entityIds }) => entityIds == null ? void 0 : entityIds.includes(intent.id)),
        ...(tolerance == null ? void 0 : tolerance.diagnostics) ?? []
      ];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "li",
        {
          "data-dimension-intent-id": intent.id,
          "aria-label": `标注 ${index + 1}: ${intent.id}`,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-dimension-plan__row-title", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-dimension-plan__order", children: index + 1 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: roleLabel(intent.functionalRole) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `vai-dimension-badge vai-dimension-badge--${intent.status}`, children: stateLabel(intent.status) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-dimension-plan__nominal", children: [
              intent.nominalValue,
              " ",
              intent.unit
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "意图" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: intent.id }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "基准" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: datumNames.length === 0 ? "无" : datumNames.map((name) => `基准 ${name}`).join("、") }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "尺寸链" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: chainRoles.length === 0 ? "无" : chainRoles.join("；") }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "公差" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: tolerance === void 0 ? "未设置" : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  toleranceSourceLabel(tolerance.source),
                  " · ",
                  toleranceStateLabel(tolerance.status)
                ] }),
                tolerance.ruleRef && /* @__PURE__ */ jsxRuntimeExports.jsxs("code", { children: [
                  tolerance.ruleRef.id,
                  "@",
                  tolerance.ruleRef.version
                ] })
              ] }) })
            ] }),
            diagnostics.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-dimension-plan__diagnostics", "aria-label": `${intent.id} 诊断`, children: diagnostics.map((diagnostic) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: diagnostic.code }, diagnostic.id)) })
          ]
        },
        intent.id
      );
    }) })
  ] });
}
function roleLabel(role) {
  return {
    datum: "基准建立",
    overall: "总体尺寸",
    functional: "功能尺寸",
    assembly: "装配尺寸",
    process: "组成尺寸",
    inspection: "检验尺寸",
    auxiliary: "辅助尺寸",
    closure: "闭环尺寸"
  }[role];
}
function stateLabel(status) {
  return {
    candidate: "候选",
    resolved: "已解析",
    confirmed: "已确认",
    conflict: "冲突",
    stale: "已过期"
  }[status];
}
function toleranceStateLabel(status) {
  return status === "candidate" ? "待解析" : stateLabel(status);
}
function toleranceSourceLabel(source) {
  return {
    document: "文档",
    standard: "标准",
    "enterprise-rule": "企业规则",
    manual: "手动",
    "ai-candidate": "AI 候选"
  }[source];
}
function chainRoleLabel(role) {
  return { functional: "功能环", component: "组成环", closure: "封闭环" }[role];
}
const ROW_HEIGHT = 24;
const DRAWING_GAP = 28;
function GdtOverlay({
  draft,
  document: document2,
  scale,
  viewport,
  datumVisible,
  gdtVisible,
  previewHeld,
  selectedIntentId,
  onSelectIntent,
  onMoveDatum,
  onMoveGdtGroup
}) {
  const safeScale = Math.max(scale, 1e-6);
  const [datumDragPositions, setDatumDragPositions] = reactExports.useState({});
  const datumDragRef = reactExports.useRef(null);
  const datumPersistTimerRef = reactExports.useRef(null);
  const [gdtDragPositions, setGdtDragPositions] = reactExports.useState({});
  const gdtDragRef = reactExports.useRef(null);
  const gdtPersistTimerRef = reactExports.useRef(null);
  const gdtMouseCleanupRef = reactExports.useRef(null);
  const suppressGdtClickRef = reactExports.useRef(false);
  const geometry = new Map(document2.geometry.map((node) => [String(node.id), node]));
  const datums = new Map(draft.datums.map((datum) => [datum.id, datum]));
  const bounds = drawingBounds({ ...document2, annotations: [] }) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const groups = layoutGroups(draft, geometry, datums, bounds, viewport, safeScale);
  const updateDatumDrag = (event) => {
    const drag = datumDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    event.preventDefault();
    event.stopPropagation();
    const next = [
      drag.startPosition[0] + (event.clientX - drag.startClient[0]) / safeScale,
      drag.startPosition[1] - (event.clientY - drag.startClient[1]) / safeScale
    ];
    drag.currentPosition = next;
    setDatumDragPositions((current) => ({ ...current, [drag.datumId]: next }));
    if (datumPersistTimerRef.current !== null) clearTimeout(datumPersistTimerRef.current);
    datumPersistTimerRef.current = setTimeout(() => {
      datumPersistTimerRef.current = null;
      void Promise.resolve(onMoveDatum(drag.datumId, drag.currentPosition)).catch(() => void 0);
    }, 120);
    return next;
  };
  const commitDatumDrag = (drag, next) => {
    if (datumPersistTimerRef.current !== null) {
      clearTimeout(datumPersistTimerRef.current);
      datumPersistTimerRef.current = null;
    }
    datumDragRef.current = null;
    void Promise.resolve(onMoveDatum(drag.datumId, next)).then(() => {
      setDatumDragPositions((current) => {
        if (!(drag.datumId in current)) return current;
        const updated = { ...current };
        delete updated[drag.datumId];
        return updated;
      });
    }).catch(() => setDatumDragPositions((current) => {
      const updated = { ...current };
      delete updated[drag.datumId];
      return updated;
    }));
  };
  reactExports.useEffect(() => () => {
    var _a2;
    if (datumPersistTimerRef.current !== null) clearTimeout(datumPersistTimerRef.current);
    if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
    (_a2 = gdtMouseCleanupRef.current) == null ? void 0 : _a2.call(gdtMouseCleanupRef);
  }, []);
  const finishDatumDrag = (event) => {
    const drag = datumDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = updateDatumDrag(event) ?? drag.currentPosition;
    commitDatumDrag(drag, next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const updateGdtDragAt = (clientX, clientY) => {
    const drag = gdtDragRef.current;
    if (!drag) return null;
    const dx = clientX - drag.startClient[0];
    const dy = clientY - drag.startClient[1];
    const next = [drag.startPosition[0] + dx / safeScale, drag.startPosition[1] - dy / safeScale];
    drag.currentPosition = next;
    if (Math.hypot(dx, dy) > 3) suppressGdtClickRef.current = true;
    setGdtDragPositions((current) => ({ ...current, [drag.groupId]: next }));
    if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
    gdtPersistTimerRef.current = setTimeout(() => {
      gdtPersistTimerRef.current = null;
      void Promise.resolve(onMoveGdtGroup(drag.intentIds, drag.currentPosition)).catch(() => void 0);
    }, 120);
    return next;
  };
  const updateGdtDrag = (event) => {
    const drag = gdtDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return null;
    event.preventDefault();
    event.stopPropagation();
    return updateGdtDragAt(event.clientX, event.clientY);
  };
  const commitGdtDrag = (drag, next) => {
    if (gdtPersistTimerRef.current !== null) {
      clearTimeout(gdtPersistTimerRef.current);
      gdtPersistTimerRef.current = null;
    }
    gdtDragRef.current = null;
    void Promise.resolve(onMoveGdtGroup(drag.intentIds, next)).then(() => {
      setGdtDragPositions((current) => {
        const updated = { ...current };
        delete updated[drag.groupId];
        return updated;
      });
    }).catch(() => setGdtDragPositions((current) => {
      const updated = { ...current };
      delete updated[drag.groupId];
      return updated;
    }));
  };
  const finishGdtDrag = (event) => {
    const drag = gdtDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = updateGdtDrag(event) ?? drag.currentPosition;
    commitGdtDrag(drag, next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { className: "vai-gdt-overlay", "data-preview-held": previewHeld ? "true" : void 0, children: [
    datumVisible && draft.datums.map((datum) => {
      const target = resolveAnchor(geometry.get(String(datum.geometryId)), datum.anchor);
      if (!target) return null;
      const marker = datumDragPositions[datum.id] ?? datum.labelPosition ?? [target[0], bounds.minY - defaultDatumGap(bounds)];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "g",
        {
          className: `vai-datum-marker vai-datum-marker--${datum.status}`,
          "data-datum-id": datum.id,
          pointerEvents: "all",
          onMouseDown: (event) => {
            event.preventDefault();
            event.stopPropagation();
          },
          onClick: (event) => event.stopPropagation(),
          onDoubleClick: (event) => event.stopPropagation(),
          onPointerDown: (event) => {
            if (event.button !== 0 || previewHeld) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            datumDragRef.current = {
              datumId: datum.id,
              pointerId: event.pointerId,
              startClient: [event.clientX, event.clientY],
              startPosition: marker,
              currentPosition: marker
            };
          },
          onPointerMove: updateDatumDrag,
          onPointerUp: finishDatumDrag,
          onLostPointerCapture: (event) => {
            const drag = datumDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            commitDatumDrag(drag, drag.currentPosition);
          },
          onPointerCancel: (event) => {
            const drag = datumDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (datumPersistTimerRef.current !== null) {
              clearTimeout(datumPersistTimerRef.current);
              datumPersistTimerRef.current = null;
            }
            datumDragRef.current = null;
            setDatumDragPositions((current) => {
              const updated = { ...current };
              delete updated[drag.datumId];
              return updated;
            });
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("path", { className: "vai-datum-leader", pointerEvents: "none", d: datumLeaderPath(target, marker) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { transform: screenSpaceTransform(marker, safeScale), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { className: "vai-datum-marker__hit", x: -14, y: -10, width: 28, height: 40, rx: 4 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M -5 0 L 5 0 L 0 -8 Z" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M 0 0 L 0 8" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: -10, y: 8, width: 20, height: 20, rx: 2 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: 0, y: 18, dominantBaseline: "middle", textAnchor: "middle", fontSize: 11, children: datum.name })
            ] })
          ]
        },
        datum.id
      );
    }),
    gdtVisible && groups.map((sourceGroup) => {
      const group = gdtDragPositions[sourceGroup.id] ? { ...sourceGroup, origin: gdtDragPositions[sourceGroup.id] } : sourceGroup;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "g",
        {
          className: "vai-gdt-frame-group",
          "data-gdt-group": group.id,
          pointerEvents: "all",
          onMouseDown: (event) => {
            var _a2;
            event.preventDefault();
            event.stopPropagation();
            if (event.button !== 0 || previewHeld) return;
            if (!gdtDragRef.current) {
              gdtDragRef.current = {
                groupId: group.id,
                intentIds: group.intentIds,
                pointerId: -1,
                startClient: [event.clientX, event.clientY],
                startPosition: group.origin,
                currentPosition: group.origin
              };
            }
            (_a2 = gdtMouseCleanupRef.current) == null ? void 0 : _a2.call(gdtMouseCleanupRef);
            const handleMouseMove = (moveEvent) => {
              moveEvent.preventDefault();
              moveEvent.stopPropagation();
              updateGdtDragAt(moveEvent.clientX, moveEvent.clientY);
            };
            const handleMouseUp = (upEvent) => {
              var _a3;
              upEvent.preventDefault();
              upEvent.stopPropagation();
              const drag = gdtDragRef.current;
              if (drag) commitGdtDrag(drag, updateGdtDragAt(upEvent.clientX, upEvent.clientY) ?? drag.currentPosition);
              (_a3 = gdtMouseCleanupRef.current) == null ? void 0 : _a3.call(gdtMouseCleanupRef);
            };
            const cleanup = () => {
              window.removeEventListener("mousemove", handleMouseMove, true);
              window.removeEventListener("mouseup", handleMouseUp, true);
              if (gdtMouseCleanupRef.current === cleanup) gdtMouseCleanupRef.current = null;
            };
            gdtMouseCleanupRef.current = cleanup;
            window.addEventListener("mousemove", handleMouseMove, true);
            window.addEventListener("mouseup", handleMouseUp, true);
          },
          onPointerDown: (event) => {
            if (event.button !== 0 || previewHeld) return;
            event.preventDefault();
            event.stopPropagation();
            suppressGdtClickRef.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            gdtDragRef.current = {
              groupId: group.id,
              intentIds: group.intentIds,
              pointerId: event.pointerId,
              startClient: [event.clientX, event.clientY],
              startPosition: group.origin,
              currentPosition: group.origin
            };
          },
          onPointerMove: updateGdtDrag,
          onPointerUp: finishGdtDrag,
          onLostPointerCapture: (event) => {
            const drag = gdtDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            commitGdtDrag(drag, drag.currentPosition);
          },
          onPointerCancel: (event) => {
            const drag = gdtDragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (gdtPersistTimerRef.current !== null) clearTimeout(gdtPersistTimerRef.current);
            gdtPersistTimerRef.current = null;
            gdtDragRef.current = null;
            setGdtDragPositions((current) => {
              const updated = { ...current };
              delete updated[drag.groupId];
              return updated;
            });
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("path", { className: "vai-gdt-leader", pointerEvents: "none", d: orthogonalLeaderPath(group) }),
            group.rows.map(({ intent, cells, widths }, rowIndex) => {
              const totalWidth = widths.reduce((sum, width) => sum + width, 0);
              const rowOrigin = [group.origin[0], group.origin[1] - rowIndex * ROW_HEIGHT * group.frameScale];
              let cursor = 0;
              return /* @__PURE__ */ jsxRuntimeExports.jsx(
                "g",
                {
                  className: `vai-gdt-frame${selectedIntentId === intent.id ? " is-selected" : ""}${intent.override ? " is-overridden" : ""}`,
                  "data-gdt-id": intent.id,
                  onClick: (event) => {
                    event.stopPropagation();
                    if (suppressGdtClickRef.current) {
                      suppressGdtClickRef.current = false;
                      return;
                    }
                    if (!previewHeld) onSelectIntent(intent.id);
                  },
                  children: /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { transform: `translate(${rowOrigin[0]} ${rowOrigin[1]}) scale(${group.frameScale} ${-group.frameScale})`, children: [
                    cells.map((cell, cellIndex) => {
                      const width = widths[cellIndex];
                      const cellX = cursor;
                      cursor += width;
                      return /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: cellX, y: 0, width, height: ROW_HEIGHT }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: cellX + width / 2, y: ROW_HEIGHT / 2, dominantBaseline: "middle", textAnchor: "middle", fontSize: 11, children: cell })
                      ] }, `${intent.id}:${cellIndex}`);
                    }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { className: "vai-gdt-frame__hit", x: 0, y: 0, width: totalWidth, height: ROW_HEIGHT })
                  ] })
                },
                intent.id
              );
            })
          ]
        },
        group.id
      );
    })
  ] });
}
function defaultDatumGap(bounds) {
  return Math.max(4, Math.min(12, Math.abs(bounds.maxY - bounds.minY) * 0.12));
}
function datumLeaderPath(target, marker) {
  return `M ${target[0]} ${target[1]} L ${target[0]} ${marker[1]} L ${marker[0]} ${marker[1]}`;
}
function layoutGroups(draft, geometry, datums, bounds, _viewport, scale) {
  var _a2;
  const grouped = /* @__PURE__ */ new Map();
  for (const intent of draft.geometricTolerances) {
    const target = intent.controlledTargets[0];
    const point3 = target ? resolveAnchor(geometry.get(String(target.geometryId)), target.anchor) : null;
    if (!target || !point3) continue;
    const value = ((_a2 = intent.override) == null ? void 0 : _a2.value) ?? intent.computed.value;
    const cells = [
      characteristicSymbol(intent.characteristic),
      value === void 0 ? "—" : `${intent.toleranceZone.shape === "diametrical" ? "⌀" : ""}${value} mm`,
      ...intent.datumReferenceFrame.map((reference) => {
        var _a3;
        const name = ((_a3 = datums.get(reference.datumId)) == null ? void 0 : _a3.name) ?? "?";
        return `${name}${reference.materialCondition ? `(${reference.materialCondition.toUpperCase()})` : ""}`;
      })
    ];
    const widths = cells.map((cell, index) => Math.max(index === 0 ? 26 : 44, estimateScreenTextWidth(cell, 11) + 16));
    const key = String(target.geometryId);
    const existing = grouped.get(key) ?? { id: key, target: point3, rows: [] };
    existing.rows.push({ intent, cells, widths });
    grouped.set(key, existing);
  }
  const ordered = [...grouped.values()].sort((left, right) => left.target[0] - right.target[0]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const drawingWidth = Math.max(1, Math.abs(bounds.maxX - bounds.minX));
  const drawingHeight = Math.max(1, Math.abs(bounds.maxY - bounds.minY));
  const frameScale = Math.min(1, 1 / scale);
  return ordered.map(({ id, target, rows }, groupIndex) => {
    var _a3;
    const width = Math.max(...rows.map(({ widths }) => widths.reduce((sum, value) => sum + value, 0)));
    const bearingStack = rows.length >= 3;
    const stored = (_a3 = rows.find(({ intent }) => intent.framePosition !== void 0)) == null ? void 0 : _a3.intent.framePosition;
    const automaticSide = !bearingStack && target[0] >= centerX ? "bottom" : "top";
    const side = stored ? stored[1] >= target[1] ? "top" : "bottom" : automaticSide;
    const laneDistance = Math.max(6, drawingHeight * (0.22 + groupIndex * 0.12));
    const x = (stored == null ? void 0 : stored[0]) ?? (bearingStack ? target[0] < centerX ? bounds.minX - drawingWidth * 0.18 : bounds.maxX + drawingWidth * 0.04 : target[0] - drawingWidth * 0.06);
    const y = (stored == null ? void 0 : stored[1]) ?? (side === "top" ? bounds.maxY + laneDistance : bounds.minY - laneDistance);
    return {
      id,
      intentIds: rows.map(({ intent }) => intent.id),
      target,
      rows,
      width,
      side,
      lane: groupIndex,
      frameScale,
      origin: [x, y]
    };
  });
}
function orthogonalLeaderPath(group) {
  const frameLeft = group.origin[0];
  const frameRight = frameLeft + group.width * group.frameScale;
  const frameTop = group.origin[1];
  const frameBottom = frameTop - group.rows.length * ROW_HEIGHT * group.frameScale;
  const attachX = Math.max(frameLeft, Math.min(group.target[0], frameRight));
  const laneGap = Math.min(DRAWING_GAP - 4, 10 + group.lane * 4) * group.frameScale;
  const laneY = group.side === "top" ? frameBottom - laneGap : frameTop + laneGap;
  const attachY = group.side === "top" ? frameBottom : frameTop;
  return `M ${group.target[0]} ${group.target[1]} L ${group.target[0]} ${laneY} L ${attachX} ${laneY} L ${attachX} ${attachY}`;
}
function characteristicSymbol(value) {
  return {
    straightness: "—",
    flatness: "▱",
    circularity: "○",
    cylindricity: "⌭",
    "profile-line": "⌒",
    "profile-surface": "⌓",
    parallelism: "∥",
    perpendicularity: "⊥",
    angularity: "∠",
    position: "⌖",
    coaxiality: "◎",
    symmetry: "⌯",
    "circular-runout": "↗",
    "total-runout": "↗↗"
  }[value];
}
function resolveAnchor(node, anchor) {
  var _a2, _b, _c;
  if (anchor.kind === "nearest") {
    const [x, y] = anchor.point;
    return typeof x === "number" && typeof y === "number" ? [x, y] : null;
  }
  if (!node) return null;
  if (anchor.kind === "center") return "center" in node ? node.center : node.type === "point" ? [node.x, node.y] : null;
  if (anchor.kind === "start") return node.type === "line" ? node.start : node.type === "polyline" ? ((_a2 = node.vertices[0]) == null ? void 0 : _a2.point) ?? null : null;
  if (anchor.kind === "end") return node.type === "line" ? node.end : node.type === "polyline" ? ((_b = node.vertices.at(-1)) == null ? void 0 : _b.point) ?? null : null;
  if (anchor.kind === "vertex" && node.type === "polyline") return ((_c = node.vertices[anchor.index]) == null ? void 0 : _c.point) ?? null;
  return null;
}
const CHARACTERISTICS = [
  "straightness",
  "flatness",
  "circularity",
  "cylindricity",
  "profile-line",
  "profile-surface",
  "parallelism",
  "perpendicularity",
  "angularity",
  "position",
  "coaxiality",
  "symmetry",
  "circular-runout",
  "total-runout"
];
function GdtInspector({ draft, selectedIntentId, selectedGeometryIds, controller, onSelectIntent }) {
  var _a2, _b, _c;
  const intent = draft.geometricTolerances.find(({ id }) => id === selectedIntentId) ?? draft.geometricTolerances[0];
  if (!intent) return null;
  const effective = ((_a2 = intent.override) == null ? void 0 : _a2.value) ?? intent.computed.value;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "vai-gdt-inspector", "aria-label": "形位公差编辑", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "基准与形位公差" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        draft.geometricTolerances.length,
        " 项"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
      "标注",
      /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: intent.id, onChange: (event) => onSelectIntent(event.target.value), children: draft.geometricTolerances.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: item.id, children: item.id }, item.id)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
      "公差类型",
      /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: intent.characteristic, onChange: (event) => void controller.actions.edit({ type: "characteristic.set", intentId: intent.id, characteristic: event.target.value }), children: CHARACTERISTICS.map((value) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value, children: characteristicLabel(value) }, value)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
      "公差带",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: intent.toleranceZone.shape, onChange: (event) => void controller.actions.edit({ type: "zone.set", intentId: intent.id, zone: { ...intent.toleranceZone, shape: event.target.value } }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "linear", children: "线性" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "diametrical", children: "直径" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "spherical", children: "球形" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
      "人工修订值（mm）",
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "number",
          min: "0",
          step: "0.001",
          value: ((_b = intent.override) == null ? void 0 : _b.value) ?? "",
          placeholder: ((_c = intent.computed.value) == null ? void 0 : _c.toString()) ?? "等待算法计算",
          onChange: (event) => {
            const value = Number(event.target.value);
            if (value > 0) void controller.actions.setOverride(intent.id, value);
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-gdt-inspector__value", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "算法值" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: intent.computed.value ?? "待计算" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-gdt-inspector__value", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "当前值" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: effective ?? "待计算" })
    ] }),
    intent.override && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => void controller.actions.clearOverride(intent.id), children: "恢复算法值" }),
    selectedGeometryIds.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => void controller.actions.edit({
      type: "controlled-targets.set",
      intentId: intent.id,
      targets: selectedGeometryIds.map((geometryId) => {
        var _a3;
        return { geometryId, anchor: { kind: "nearest", point: ((_a3 = intent.controlledTargets[0]) == null ? void 0 : _a3.anchor.kind) === "nearest" ? intent.controlledTargets[0].anchor.point : [0, 0] } };
      })
    }), children: "使用画布当前选中图元" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-gdt-inspector__datums", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "基准顺序" }),
      intent.datumReferenceFrame.map((reference, index) => /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value: reference.datumId, onChange: (event) => {
        const references = intent.datumReferenceFrame.map((item, itemIndex) => itemIndex === index ? { ...item, datumId: event.target.value } : item);
        void controller.actions.edit({ type: "datum-frame.set", intentId: intent.id, references });
      }, children: draft.datums.map((datum) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: datum.id, children: datum.name }, datum.id)) }, `${intent.id}:${index}`))
    ] })
  ] });
}
function characteristicLabel(value) {
  return {
    straightness: "直线度",
    flatness: "平面度",
    circularity: "圆度",
    cylindricity: "圆柱度",
    "profile-line": "线轮廓度",
    "profile-surface": "面轮廓度",
    parallelism: "平行度",
    perpendicularity: "垂直度",
    angularity: "倾斜度",
    position: "位置度",
    coaxiality: "同轴度",
    symmetry: "对称度",
    "circular-runout": "圆跳动",
    "total-runout": "全跳动"
  }[value];
}
function ConfirmedPartitionInspector({
  revision,
  busy,
  mode,
  onModeChange,
  onReopen
}) {
  const bands = partitionBands(revision, mode);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-inspector vai-confirmed-partition", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-confirmed-partition__heading", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: mode === "functional" ? "功能分区" : "连续轴段" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "已确认" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "vai-confirmed-partition__actions", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "aria-label": "重新编辑分区", disabled: busy, onClick: () => void onReopen().catch(() => void 0), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(PencilLine, { size: 14, "aria-hidden": "true" }),
        "重新编辑"
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionViewSwitch, { mode, onChange: onModeChange }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { className: "vai-confirmed-partition__meta", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "版本" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: revision.id }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "确认时间" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: formatConfirmedAt(revision.confirmedAt) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { children: bands.map((band, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: band.name ?? band.semanticType ?? `轴段 S${index + 1}` }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("small", { children: [
        band.zStart.toFixed(2),
        " – ",
        band.zEnd.toFixed(2),
        " · ⌀",
        (Math.max(...band.segments.map(({ profile }) => profile.maxRadius)) * 2).toFixed(2)
      ] }),
      band.semanticType && /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: band.semanticType })
    ] }, band.id)) })
  ] });
}
function formatConfirmedAt(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
const ENGINEERING_IMPORT_LIMITS = Object.freeze({
  maxDxfBytes: 20 * 1024 * 1024,
  maxDocumentBytes: 20 * 1024 * 1024,
  maxDocumentTotalBytes: 50 * 1024 * 1024,
  maxDocuments: 16
});
const SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS = Object.freeze([
  "txt",
  "md",
  "csv",
  "tsv",
  "json",
  "yaml",
  "yml",
  "ini",
  "xml",
  "html",
  "htm",
  "log",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "epub"
]);
const LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS = Object.freeze(["doc", "xls", "ppt"]);
function extensionOf(name) {
  const dot2 = name.lastIndexOf(".");
  return dot2 < 0 ? "" : name.slice(dot2 + 1).toLowerCase();
}
function validateEngineeringDocumentFiles(files) {
  if (files.length > ENGINEERING_IMPORT_LIMITS.maxDocuments) {
    throw new Error("ENGINEERING_DOCUMENT_COUNT_LIMIT");
  }
  if (files.some((file) => file.size > ENGINEERING_IMPORT_LIMITS.maxDocumentBytes)) {
    throw new Error("ENGINEERING_DOCUMENT_SIZE_LIMIT");
  }
  if (files.reduce((total, file) => total + file.size, 0) > ENGINEERING_IMPORT_LIMITS.maxDocumentTotalBytes) {
    throw new Error("ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT");
  }
}
const supported = new Set(SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS);
const legacy = new Set(LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS);
function classifyEngineeringDrop(files) {
  const dxfs = files.filter((file) => extensionOf(file.name) === "dxf");
  if (dxfs.length === 0) {
    if (files.length === 0 || files.some((file) => !supported.has(extensionOf(file.name)) && !legacy.has(extensionOf(file.name)))) return { kind: "pass" };
    const rejected2 = validateDocuments(files);
    return rejected2 ?? { kind: "documents", documents: [...files] };
  }
  if (dxfs.length > 1) {
    return { kind: "reject", code: "ENGINEERING_DROP_MULTIPLE_DXF", filenames: dxfs.map(({ name }) => name) };
  }
  const rest = files.filter((file) => extensionOf(file.name) !== "dxf");
  const supportedDocuments = rest.filter((file) => supported.has(extensionOf(file.name)));
  const legacyDocuments = rest.filter((file) => legacy.has(extensionOf(file.name)));
  if (legacyDocuments.length > 0) {
    return { kind: "reject", code: "DOCUMENT_LEGACY_FORMAT_UNSUPPORTED", filenames: legacyDocuments.map(({ name }) => name) };
  }
  const unsupported = rest.filter((file) => !supported.has(extensionOf(file.name)));
  if (unsupported.length > 0) {
    return { kind: "reject", code: "ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED", filenames: unsupported.map(({ name }) => name) };
  }
  if (dxfs[0] && dxfs[0].size > ENGINEERING_IMPORT_LIMITS.maxDxfBytes) {
    return { kind: "reject", code: "DXF_SIZE_LIMIT", filenames: [dxfs[0].name] };
  }
  const rejected = validateDocuments(supportedDocuments);
  if (rejected) return rejected;
  return { kind: "import", dxf: dxfs[0], documents: supportedDocuments };
}
function validateDocuments(documents) {
  const legacyDocuments = documents.filter((file) => legacy.has(extensionOf(file.name)));
  if (legacyDocuments.length > 0) return { kind: "reject", code: "DOCUMENT_LEGACY_FORMAT_UNSUPPORTED", filenames: legacyDocuments.map(({ name }) => name) };
  if (documents.length > ENGINEERING_IMPORT_LIMITS.maxDocuments) return { kind: "reject", code: "ENGINEERING_DOCUMENT_COUNT_LIMIT", filenames: documents.map(({ name }) => name) };
  const oversized = documents.filter((file) => file.size > ENGINEERING_IMPORT_LIMITS.maxDocumentBytes);
  if (oversized.length > 0) return { kind: "reject", code: "ENGINEERING_DOCUMENT_SIZE_LIMIT", filenames: oversized.map(({ name }) => name) };
  if (documents.reduce((total, file) => total + file.size, 0) > ENGINEERING_IMPORT_LIMITS.maxDocumentTotalBytes) return { kind: "reject", code: "ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT", filenames: documents.map(({ name }) => name) };
  const byName = /* @__PURE__ */ new Map();
  for (const file of documents) {
    const key = file.name.toLocaleLowerCase();
    byName.set(key, [...byName.get(key) ?? [], file]);
  }
  const duplicates = [...byName.values()].filter((group) => group.length > 1).flat();
  if (duplicates.length > 0) return { kind: "reject", code: "ENGINEERING_DOCUMENT_DUPLICATE_NAME", filenames: duplicates.map(({ name }) => name) };
  return null;
}
function engineeringImportErrorText(code, filenames = []) {
  const names = filenames.length === 0 ? "" : `（${filenames.join("、")}）`;
  if (code == null ? void 0 : code.startsWith("DOCUMENT_PARSE_TIMEOUT")) return `文档本地解析超时${names}`;
  if (code == null ? void 0 : code.startsWith("DOCUMENT_PARSE_FAILED")) return `文档解析失败${names}`;
  if (code == null ? void 0 : code.startsWith("DOCUMENT_TEXT_EMPTY")) return `文档中没有可提取的文字；扫描件暂不支持 OCR${names}`;
  if (code == null ? void 0 : code.startsWith("DOCUMENT_LEGACY_FORMAT_UNSUPPORTED")) return `旧版 DOC/XLS/PPT 暂不支持，请另存为新版 Office、PDF 或文本格式${names}`;
  if (code === "ENGINEERING_DROP_MULTIPLE_DXF") return `一次只能导入一张 DXF 图纸${names}`;
  if (code == null ? void 0 : code.startsWith("ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED")) return `包含暂不支持的工程资料格式${names}`;
  if (code === "ENGINEERING_DOCUMENT_DUPLICATE_NAME") return `工程资料存在重名文件${names}`;
  if ((code == null ? void 0 : code.includes("SIZE_LIMIT")) || (code == null ? void 0 : code.includes("COUNT_LIMIT"))) return `工程文件超过本地导入限制${names}`;
  return `工程文件导入失败：${code ?? "UNKNOWN"}`;
}
const ANNOTATION_PARTITION_LAYER_ID = "vectorai.annotation.partition";
const ANNOTATION_OPENING_ANGLE_LAYER_ID = "vectorai.annotation.opening-angle";
const ANNOTATION_DIAMETER_LAYER_ID = "vectorai.annotation.diameter";
const ANNOTATION_DIMENSION_CHAIN_LAYER_ID = "vectorai.annotation.dimension-chain";
const ANNOTATION_DATUM_LAYER_ID = "vectorai.annotation.datum";
const ANNOTATION_GDT_LAYER_ID = "vectorai.annotation.gdt";
const ANNOTATION_PARTITION_LAYER = {
  id: ANNOTATION_PARTITION_LAYER_ID,
  label: "智能分区",
  category: "engineering",
  icon: "partition",
  order: 100,
  defaultVisible: true
};
const ANNOTATION_OPENING_ANGLE_LAYER = {
  id: ANNOTATION_OPENING_ANGLE_LAYER_ID,
  label: "开角标注",
  category: "engineering",
  icon: "angle",
  order: 110,
  defaultVisible: true
};
const ANNOTATION_DIAMETER_LAYER = {
  id: ANNOTATION_DIAMETER_LAYER_ID,
  label: "直径标注",
  category: "engineering",
  icon: "dimension",
  order: 115,
  defaultVisible: true
};
const ANNOTATION_DIMENSION_CHAIN_LAYER = {
  id: ANNOTATION_DIMENSION_CHAIN_LAYER_ID,
  label: "尺寸链",
  category: "engineering",
  icon: "dimension",
  order: 120,
  defaultVisible: true
};
const ANNOTATION_DATUM_LAYER = {
  id: ANNOTATION_DATUM_LAYER_ID,
  label: "基准",
  category: "engineering",
  icon: "dimension",
  order: 125,
  defaultVisible: true
};
const ANNOTATION_GDT_LAYER = {
  id: ANNOTATION_GDT_LAYER_ID,
  label: "形位公差",
  category: "engineering",
  icon: "dimension",
  order: 130,
  defaultVisible: true
};
function layerVisibilityStorageKey(sessionId) {
  return `vectorai:annotation:layer-visibility:${sessionId}`;
}
function legacyPartitionVisibilityKey(sessionId) {
  return `vectorai:annotation:partition-overlay:${sessionId}`;
}
function readLayerVisibility(sessionId, definitions, storage) {
  const saved = readSavedMap(sessionId, storage);
  const result = {};
  for (const definition of definitions) {
    const savedValue = saved[definition.id];
    if (typeof savedValue === "boolean") {
      result[definition.id] = savedValue;
      continue;
    }
    if (definition.id === ANNOTATION_PARTITION_LAYER_ID) {
      const legacy2 = readLegacyPartitionVisibility(sessionId, storage);
      if (legacy2 !== null) {
        result[definition.id] = legacy2;
        continue;
      }
    }
    result[definition.id] = definition.defaultVisible;
  }
  return result;
}
function writeLayerVisibility(sessionId, values, storage) {
  if (storage === null || storage === void 0) return;
  try {
    storage.setItem(layerVisibilityStorageKey(sessionId), JSON.stringify(values));
  } catch {
  }
}
function readSavedMap(sessionId, storage) {
  if (storage === null || storage === void 0) return {};
  try {
    const raw = storage.getItem(layerVisibilityStorageKey(sessionId));
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function readLegacyPartitionVisibility(sessionId, storage) {
  if (storage === null || storage === void 0) return null;
  try {
    const value = storage.getItem(legacyPartitionVisibilityKey(sessionId));
    if (value === "hidden") return false;
    if (value === "visible") return true;
    return null;
  } catch {
    return null;
  }
}
const ENGINEERING_DOCUMENT_ACCEPT = SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");
const ANNOTATION_UPLOAD_ACCEPT = `.dxf,application/dxf,${ENGINEERING_DOCUMENT_ACCEPT}`;
const PARTITION_HYDRATION_INTERVAL_MS = 500;
const PARTITION_HYDRATION_MAX_ATTEMPTS = 1200;
const dimensionChainLayerId = (chainId) => `${ANNOTATION_DIMENSION_CHAIN_LAYER_ID}:${chainId}`;
const FALLBACK_LAYER_DEFINITIONS = [ANNOTATION_PARTITION_LAYER, ANNOTATION_OPENING_ANGLE_LAYER, ANNOTATION_DIAMETER_LAYER, ANNOTATION_DIMENSION_CHAIN_LAYER, ANNOTATION_DATUM_LAYER, ANNOTATION_GDT_LAYER];
const subscribeToNoLayers = () => () => void 0;
const readFallbackLayers = () => FALLBACK_LAYER_DEFINITIONS;
const EMPTY_DIMENSION_STATE = {
  plan: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 },
  busy: false,
  previewHeld: false,
  error: null
};
const EMPTY_DIMENSION_CONTROLLER = {
  state: {
    getSnapshot: () => EMPTY_DIMENSION_STATE,
    subscribe: () => () => void 0
  },
  actions: {
    refresh: async () => void 0,
    setDisplayed: async () => void 0,
    chooseClosure: async () => void 0,
    moveChain: async () => void 0,
    moveCandidate: async () => void 0,
    confirm: async () => void 0,
    cancel: async () => void 0,
    undo: async () => void 0,
    redo: async () => void 0,
    setPreviewHeld: () => void 0
  },
  dispose: () => void 0
};
const EMPTY_GDT_STATE = {
  plan: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 },
  busy: false,
  previewHeld: false,
  error: null
};
const EMPTY_GDT_CONTROLLER = {
  state: { getSnapshot: () => EMPTY_GDT_STATE, subscribe: () => () => void 0 },
  actions: {
    refresh: async () => void 0,
    edit: async () => void 0,
    moveDatum: async () => void 0,
    moveFrame: async () => void 0,
    setOverride: async () => void 0,
    clearOverride: async () => void 0,
    confirm: async () => void 0,
    cancel: async () => void 0,
    undo: async () => void 0,
    redo: async () => void 0,
    setPreviewHeld: () => void 0
  },
  dispose: () => void 0
};
function AnnotationWorkspace({ sessionId, namespace, runtime, state, partition, dimensionChain: suppliedDimensionChain, gdt: suppliedGdt, dimensionPlan, layerRegistry }) {
  var _a2, _b, _c, _d;
  const dimensionChain = suppliedDimensionChain ?? EMPTY_DIMENSION_CONTROLLER;
  const gdt = suppliedGdt ?? EMPTY_GDT_CONTROLLER;
  const snapshot = useObservable(runtime.snapshot);
  const viewport = useObservable(runtime.viewport);
  const selectedIds = useObservable(runtime.selection);
  const presentation = useObservable(runtime.presentation);
  const annotationState = useObservable(state);
  const partitionState = useObservable(partition.state);
  const dimensionState = useObservable(dimensionChain.state);
  const gdtState = useObservable(gdt.state);
  const displaySnapshot = presentation.displaySnapshot ?? snapshot;
  const [importError, setImportError] = reactExports.useState(null);
  const [stagedDocumentNames, setStagedDocumentNames] = reactExports.useState([]);
  const [activePanel, setActivePanel] = reactExports.useState(null);
  const [panelWidth, setPanelWidth] = reactExports.useState(260);
  const [partitionView, setPartitionView] = reactExports.useState("functional");
  const [selectedGdtIntentId, setSelectedGdtIntentId] = reactExports.useState(null);
  const registeredLayers = reactExports.useSyncExternalStore(
    (layerRegistry == null ? void 0 : layerRegistry.subscribeLayers) ?? subscribeToNoLayers,
    (layerRegistry == null ? void 0 : layerRegistry.getLayers) ?? readFallbackLayers,
    (layerRegistry == null ? void 0 : layerRegistry.getLayers) ?? readFallbackLayers
  );
  const [layerVisibility, setLayerVisibility] = reactExports.useState(() => readLayerVisibility(
    sessionId,
    registeredLayers,
    typeof sessionStorage === "undefined" ? null : sessionStorage
  ));
  const displayedDrawingRef = reactExports.useRef(null);
  const initializedViewportDrawingId = reactExports.useRef(null);
  const openingAngleVisible = layerVisibility[ANNOTATION_OPENING_ANGLE_LAYER_ID] ?? ANNOTATION_OPENING_ANGLE_LAYER.defaultVisible;
  const diameterVisible = layerVisibility[ANNOTATION_DIAMETER_LAYER_ID] ?? ANNOTATION_DIAMETER_LAYER.defaultVisible;
  const datumVisible = layerVisibility[ANNOTATION_DATUM_LAYER_ID] ?? ANNOTATION_DATUM_LAYER.defaultVisible;
  const gdtVisible = layerVisibility[ANNOTATION_GDT_LAYER_ID] ?? ANNOTATION_GDT_LAYER.defaultVisible;
  const hasOpeningAngle = (displaySnapshot == null ? void 0 : displaySnapshot.document.annotations.some((annotation) => annotation.type === "dimension" && annotation.dimensionKind === "angular")) ?? false;
  const hasDiameter = (displaySnapshot == null ? void 0 : displaySnapshot.document.annotations.some((annotation) => annotation.type === "dimension" && annotation.dimensionKind === "diameter")) ?? false;
  const surfaceSnapshot = reactExports.useMemo(() => displaySnapshot === null ? null : {
    ...displaySnapshot,
    document: {
      ...displaySnapshot.document,
      // Keep imported hatches and generated engineering dimensions. Source DXF
      // text remains hidden so the clean engineering canvas does not regress.
      annotations: displaySnapshot.document.annotations.filter((annotation) => annotation.type === "section-hatch" || annotation.type === "dimension" && ((annotation.dimensionKind !== "angular" || openingAngleVisible) && (annotation.dimensionKind !== "diameter" || diameterVisible))),
      relations: []
    }
  }, [diameterVisible, displaySnapshot, openingAngleVisible]);
  const draft = partitionState.partition.draft;
  const confirmed = partitionState.partition.confirmed;
  const dimensionRadialExtent = Math.max(0, ...((_a2 = draft ?? confirmed) == null ? void 0 : _a2.segments.map(({ profile }) => profile.maxRadius)) ?? []);
  reactExports.useEffect(() => {
    setLayerVisibility(readLayerVisibility(
      sessionId,
      registeredLayers,
      typeof sessionStorage === "undefined" ? null : sessionStorage
    ));
  }, [registeredLayers, sessionId]);
  const updateLayerVisibility = (id, visible) => {
    setLayerVisibility((current) => {
      const next = { ...current, [id]: visible };
      writeLayerVisibility(sessionId, next, typeof sessionStorage === "undefined" ? null : sessionStorage);
      return next;
    });
  };
  const partitionOverlayVisible = layerVisibility[ANNOTATION_PARTITION_LAYER_ID] ?? ANNOTATION_PARTITION_LAYER.defaultVisible;
  const dimensionChainVisible = layerVisibility[ANNOTATION_DIMENSION_CHAIN_LAYER_ID] ?? ANNOTATION_DIMENSION_CHAIN_LAYER.defaultVisible;
  const dimensionScheme = ((_b = dimensionState.plan.draft) == null ? void 0 : _b.axialScheme) ?? ((_c = dimensionState.plan.confirmed) == null ? void 0 : _c.axialScheme);
  const gdtPlan = gdtState.plan.draft ?? gdtState.plan.confirmed;
  const hasGdt = ((gdtPlan == null ? void 0 : gdtPlan.geometricTolerances.length) ?? 0) > 0;
  const hasDatums = ((gdtPlan == null ? void 0 : gdtPlan.datums.length) ?? 0) > 0;
  const dimensionChainLayers = reactExports.useMemo(() => (dimensionScheme == null ? void 0 : dimensionScheme.chains.map((chain, index) => ({
    id: dimensionChainLayerId(chain.id),
    label: `尺寸链 ${index + 1}`,
    category: "engineering",
    icon: "dimension",
    order: ANNOTATION_DIMENSION_CHAIN_LAYER.order + index + 1,
    defaultVisible: true
  }))) ?? [], [dimensionScheme]);
  const visibleDimensionChainIds = reactExports.useMemo(() => new Set(
    (dimensionScheme == null ? void 0 : dimensionScheme.chains.filter((chain) => layerVisibility[dimensionChainLayerId(chain.id)] ?? true).map(({ id }) => id)) ?? []
  ), [dimensionScheme, layerVisibility]);
  const fitPadding = reactExports.useMemo(() => {
    if (!dimensionScheme || !dimensionChainVisible || !surfaceSnapshot) return 1.2;
    const fitSize = { width: viewport.width, height: viewport.height };
    let padding = 1.2;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const fitted = fitViewportToDrawing(surfaceSnapshot.document, fitSize, padding);
      const next = dimensionChainFitPadding({
        scheme: dimensionScheme,
        radialExtent: dimensionRadialExtent,
        scale: fitted.scale,
        viewport: fitSize
      });
      if (Math.abs(next - padding) < 1e-3) return next;
      padding = next;
    }
    return padding;
  }, [dimensionChainVisible, dimensionRadialExtent, dimensionScheme, surfaceSnapshot, viewport.height, viewport.width]);
  const fitPaddingRef = reactExports.useRef(fitPadding);
  fitPaddingRef.current = fitPadding;
  const previousViewportSize = reactExports.useRef(null);
  const dimensionHistoryActive = dimensionState.plan.drawingRef !== void 0 && (dimensionState.plan.phase !== "idle" || dimensionState.plan.canUndo || dimensionState.plan.canRedo);
  const gdtHistoryActive = hasGdt && gdtState.plan.drawingRef !== void 0 && (gdtState.plan.phase !== "idle" || gdtState.plan.canUndo || gdtState.plan.canRedo);
  reactExports.useEffect(() => {
    let active = true;
    let timer;
    let attempts = 0;
    const hydrate = async () => {
      attempts += 1;
      await partition.actions.refresh().catch(() => void 0);
      if (!active || attempts >= PARTITION_HYDRATION_MAX_ATTEMPTS) return;
      if (partition.state.getSnapshot().partition.phase !== "analyzing") return;
      const workflowStatus = state.getSnapshot().workflow.status;
      if (workflowStatus !== "running" && workflowStatus !== "reviewing") return;
      timer = setTimeout(() => {
        void hydrate();
      }, PARTITION_HYDRATION_INTERVAL_MS);
    };
    void hydrate();
    return () => {
      active = false;
      if (timer !== void 0) clearTimeout(timer);
    };
  }, [annotationState.activationEpoch, partition, state]);
  reactExports.useEffect(() => {
    const release = () => {
      partition.actions.setPreviewHeld(false);
      dimensionChain.actions.setPreviewHeld(false);
      gdt.actions.setPreviewHeld(false);
    };
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("blur", release);
      release();
    };
  }, [dimensionChain, gdt, partition]);
  reactExports.useEffect(() => {
    if (!partitionState.busy) {
      void runtime.actions.refresh();
      return;
    }
    void runtime.actions.refresh();
    const timer = window.setInterval(() => {
      void runtime.actions.refresh();
    }, 500);
    return () => window.clearInterval(timer);
  }, [partitionState.busy, runtime]);
  reactExports.useEffect(() => {
    if (displaySnapshot === null || viewport.width <= 0 || viewport.height <= 0) return;
    const drawingId = displaySnapshot.ref.drawingId;
    if (initializedViewportDrawingId.current === drawingId) return;
    initializedViewportDrawingId.current = drawingId;
    const stored = readStoredViewport(drawingId);
    runtime.actions.setViewport(stored === null ? fitViewportForSnapshot(displaySnapshot, viewport, fitPaddingRef.current) : { ...stored, width: viewport.width, height: viewport.height });
  }, [displaySnapshot, runtime, viewport.height, viewport.width]);
  reactExports.useEffect(() => {
    const previous = previousViewportSize.current;
    previousViewportSize.current = { width: viewport.width, height: viewport.height };
    if (previous === null || previous.width === viewport.width && previous.height === viewport.height) return;
    runtime.actions.setViewport({ ...viewport, width: viewport.width, height: viewport.height });
  }, [runtime, viewport]);
  reactExports.useEffect(() => {
    const drawingId = displaySnapshot == null ? void 0 : displaySnapshot.ref.drawingId;
    if (!drawingId || initializedViewportDrawingId.current !== drawingId || viewport.width <= 0 || viewport.height <= 0) return;
    writeStoredViewport(drawingId, viewport);
  }, [displaySnapshot == null ? void 0 : displaySnapshot.ref.drawingId, viewport]);
  reactExports.useEffect(() => {
    if (displaySnapshot === null) return;
    const key = `${displaySnapshot.ref.drawingId}@${displaySnapshot.ref.revision}`;
    const previous = displayedDrawingRef.current;
    displayedDrawingRef.current = key;
    if (previous !== null && previous !== key) void partition.actions.refresh().catch(() => void 0);
    if (previous !== null && previous !== key) void dimensionChain.actions.refresh().catch(() => void 0);
    if (previous !== null && previous !== key) void gdt.actions.refresh().catch(() => void 0);
  }, [dimensionChain, displaySnapshot, gdt, partition]);
  reactExports.useEffect(() => {
    void dimensionChain.actions.refresh().catch(() => void 0);
    void gdt.actions.refresh().catch(() => void 0);
  }, [annotationState.activationEpoch, dimensionChain, gdt]);
  const beginImport = (drawing, documents) => {
    setImportError(null);
    void partition.actions.importFiles(drawing, documents).then(() => setActivePanel(null)).catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
  };
  const handleToolbarUpload = (files) => {
    const decision = classifyEngineeringDrop(files);
    if (decision.kind === "import") {
      beginImport(decision.dxf, decision.documents);
      return;
    }
    if (decision.kind === "documents") {
      setImportError(null);
      void partition.actions.stageDocuments(decision.documents).then(() => setStagedDocumentNames((current) => [...current, ...decision.documents.map(({ name }) => name)])).catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
      return;
    }
    setImportError(decision.kind === "reject" ? engineeringImportErrorText(decision.code, decision.filenames) : "请选择 DXF 图纸或受支持的工程文档");
  };
  const structurePanel = /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-annotation-panel", children: [
    draft && !partitionState.previewHeld && /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionInspector, { draft, controller: partition, mode: partitionView, onModeChange: setPartitionView }, partitionState.partition.updatedAt),
    !draft && confirmed && /* @__PURE__ */ jsxRuntimeExports.jsx(ConfirmedPartitionInspector, { revision: confirmed, busy: partitionState.busy, mode: partitionView, onModeChange: setPartitionView, onReopen: partition.actions.reopen }),
    dimensionPlan && /* @__PURE__ */ jsxRuntimeExports.jsx(DimensionPlanInspector, { draft: dimensionPlan.draft, generationOrder: dimensionPlan.generationOrder }),
    dimensionScheme && /* @__PURE__ */ jsxRuntimeExports.jsx(
      DimensionChainInspector,
      {
        scheme: dimensionScheme,
        controller: dimensionChain,
        editable: dimensionState.plan.phase === "editing"
      }
    ),
    gdtPlan && hasGdt && /* @__PURE__ */ jsxRuntimeExports.jsx(
      GdtInspector,
      {
        draft: gdtPlan,
        selectedIntentId: selectedGdtIntentId,
        selectedGeometryIds: selectedIds,
        controller: gdt,
        onSelectIntent: setSelectedGdtIntentId
      }
    ),
    !draft && !confirmed && !dimensionPlan && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "标注检查" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "流程" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: workflowLabel(annotationState.workflow.status) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "候选" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: ((_d = presentation.preview) == null ? void 0 : _d.diff.createdNodeIds.length) ?? 0 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { children: "选中" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { children: selectedIds.length })
      ] })
    ] })
  ] });
  const panels = [
    { id: "structure", label: "图纸结构", icon: ListTree, render: () => structurePanel }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "section",
    {
      className: "vai-annotation-workspace",
      "data-annotation-workspace": "true",
      "data-drawing-surface-namespace": namespace,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "vai-annotation-workspace__header", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "工程图自动标注" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: displaySnapshot === null ? "等待图纸" : `${displaySnapshot.ref.drawingId} · R${displaySnapshot.ref.revision}` }),
            (displaySnapshot == null ? void 0 : displaySnapshot.provisional) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-annotation-provisional", children: "候选图纸" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-annotation-workflow": annotationState.workflow.status, children: partitionProgressLabel(partitionState.partition.phase, partitionState.busy, annotationState.workflow.status) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-annotation-workspace__body", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            WorkspaceActivityBar,
            {
              overlay: true,
              activePanel,
              panelWidth,
              onActivePanelChange: (panel) => setActivePanel(panel),
              onPanelWidthChange: setPanelWidth,
              panels
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "vai-annotation-workspace__canvas", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              DrawingLayerManager,
              {
                layers: [...registeredLayers.filter(({ id }) => id === ANNOTATION_PARTITION_LAYER_ID && Boolean(draft || confirmed) || id === ANNOTATION_OPENING_ANGLE_LAYER_ID && hasOpeningAngle || id === ANNOTATION_DIAMETER_LAYER_ID && hasDiameter || id === ANNOTATION_DIMENSION_CHAIN_LAYER_ID && Boolean(dimensionScheme) || id === ANNOTATION_DATUM_LAYER_ID && hasDatums || id === ANNOTATION_GDT_LAYER_ID && hasGdt).map((definition) => ({
                  definition,
                  visible: layerVisibility[definition.id] ?? definition.defaultVisible,
                  ...definition.id === ANNOTATION_DIMENSION_CHAIN_LAYER_ID && dimensionChainLayers.length > 0 ? {
                    children: dimensionChainLayers.map((childDefinition) => ({
                      definition: childDefinition,
                      visible: layerVisibility[childDefinition.id] ?? childDefinition.defaultVisible
                    }))
                  } : {}
                }))],
                onVisibilityChange: updateLayerVisibility
              }
            ),
            (partitionState.busy || stagedDocumentNames.length > 0 || importError !== null || partitionState.error !== null || dimensionState.error !== null || gdtState.error !== null) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-annotation-status-stack", "data-annotation-status-stack": "true", children: [
              partitionState.busy && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-partition-progress", "data-partition-progress": partitionState.partition.phase, role: "status", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "vai-partition-progress__pulse", "aria-hidden": "true" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: partitionProgressLabel(partitionState.partition.phase, true, annotationState.workflow.status) })
              ] }),
              stagedDocumentNames.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "vai-engineering-documents-status", role: "status", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  "已添加 ",
                  stagedDocumentNames.length,
                  " 份工程资料；请描述任务后再开始分区"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": "清除已添加的工程资料", onClick: () => {
                  setImportError(null);
                  void partition.actions.clearDocuments().then(() => setStagedDocumentNames([])).catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
                }, children: "清除" })
              ] }),
              (importError ?? partitionState.error) && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "vai-partition-error", role: "alert", children: importError ?? `边界未保存：${partitionState.error}` }),
              dimensionState.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "vai-partition-error", role: "alert", children: `尺寸位置未保存：${dimensionState.error}；请重新拖动后再试` }),
              gdtState.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "vai-partition-error", role: "alert", children: `形位公差未保存：${gdtState.error}` })
            ] }),
            surfaceSnapshot !== null && /* @__PURE__ */ jsxRuntimeExports.jsx(
              DrawingSurface,
              {
                snapshot: surfaceSnapshot,
                viewport,
                selectedIds,
                display: presentation.display,
                sourceUrl: presentation.sourceUrl,
                className: "vai-canvas vai-annotation-workspace__surface",
                fitToDrawingOnResize: false,
                fitPadding,
                onViewportChange: runtime.actions.setViewport,
                onSelectionChange: runtime.actions.setSelection,
                worldLayers: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("g", { "data-annotation-candidate-layer": "true", "data-preview-active": presentation.preview === null ? void 0 : "true", pointerEvents: "none" }),
                  partitionOverlayVisible && draft && /* @__PURE__ */ jsxRuntimeExports.jsx(
                    PartitionOverlay,
                    {
                      draft,
                      mode: partitionView,
                      previewHeld: partitionState.previewHeld,
                      scale: viewport.scale,
                      onMoveBoundary: (index, z) => partition.actions.moveBoundary(index, z, Math.max(draft.axis.zMax * 3e-3, 0.05)),
                      onMoveSemanticRange: (groupId, edge, z) => partition.actions.moveSemanticRange(groupId, edge, z, Math.max(draft.axis.zMax * 3e-3, 0.05)),
                      onRenameBand: (band, name) => partitionView === "functional" ? partition.actions.renameSemanticGroup(band.id, name) : partition.actions.updateSegment(band.segmentIds[0], { name })
                    }
                  ),
                  partitionOverlayVisible && !draft && confirmed && /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionOverlay, { draft: confirmed, mode: partitionView, previewHeld: true, scale: viewport.scale }),
                  dimensionScheme && /* @__PURE__ */ jsxRuntimeExports.jsx(
                    DimensionChainOverlay,
                    {
                      scheme: dimensionScheme,
                      scale: viewport.scale,
                      radialExtent: dimensionRadialExtent,
                      visible: dimensionChainVisible,
                      visibleChainIds: visibleDimensionChainIds,
                      previewHeld: dimensionState.previewHeld,
                      onMoveChain: (chainId, normalOffset) => dimensionChain.actions.moveChain(chainId, normalOffset),
                      onMoveCandidate: (candidateId, normalOffset) => dimensionChain.actions.moveCandidate(candidateId, normalOffset),
                      onChooseClosure: (chainId, candidateId) => dimensionChain.actions.chooseClosure(chainId, candidateId)
                    }
                  ),
                  gdtPlan && (hasDatums || hasGdt) && /* @__PURE__ */ jsxRuntimeExports.jsx(
                    GdtOverlay,
                    {
                      draft: gdtPlan,
                      document: surfaceSnapshot.document,
                      scale: viewport.scale,
                      viewport,
                      datumVisible,
                      gdtVisible,
                      previewHeld: gdtState.previewHeld,
                      selectedIntentId: selectedGdtIntentId,
                      onSelectIntent: setSelectedGdtIntentId,
                      onMoveDatum: (datumId, position) => gdt.actions.moveDatum(datumId, position),
                      onMoveGdtGroup: (intentIds, position) => gdt.actions.moveFrame(intentIds, position)
                    }
                  )
                ] })
              }
            ),
            gdtState.plan.phase === "editing" && hasGdt ? /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionActionToolbar, { controller: gdt, previewHeld: gdtState.previewHeld, subject: "形位公差" }) : dimensionState.plan.phase === "editing" ? /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionActionToolbar, { controller: dimensionChain, previewHeld: dimensionState.previewHeld, subject: "尺寸链" }) : partitionState.partition.phase === "editing" && /* @__PURE__ */ jsxRuntimeExports.jsx(PartitionActionToolbar, { controller: partition, previewHeld: partitionState.previewHeld }),
            displaySnapshot && /* @__PURE__ */ jsxRuntimeExports.jsx(
              WorkspaceToolbarView,
              {
                snapshot: displaySnapshot,
                viewport,
                unavailable: partitionState.busy,
                fitPadding: 1.12,
                canUndo: gdtHistoryActive ? gdtState.plan.canUndo : dimensionHistoryActive ? dimensionState.plan.canUndo : partitionState.partition.canUndo,
                canRedo: gdtHistoryActive ? gdtState.plan.canRedo : dimensionHistoryActive ? dimensionState.plan.canRedo : partitionState.partition.canRedo,
                onFit: (nextViewport) => runtime.actions.setViewport(fitViewportForSnapshot(displaySnapshot, nextViewport, 1.12)),
                onUndo: () => gdtHistoryActive || dimensionHistoryActive ? runSharedAnnotationHistory(
                  gdtHistoryActive ? () => gdt.actions.undo() : () => dimensionChain.actions.undo(),
                  [() => gdt.actions.refresh(), () => dimensionChain.actions.refresh()]
                ) : partition.actions.undo(),
                onRedo: () => gdtHistoryActive || dimensionHistoryActive ? runSharedAnnotationHistory(
                  gdtHistoryActive ? () => gdt.actions.redo() : () => dimensionChain.actions.redo(),
                  [() => gdt.actions.refresh(), () => dimensionChain.actions.refresh()]
                ) : partition.actions.redo(),
                onUploadFiles: handleToolbarUpload,
                uploadAccept: ANNOTATION_UPLOAD_ACCEPT,
                uploadMultiple: true
              }
            )
          ] })
        ] })
      ]
    }
  );
}
function fitViewportForSnapshot(snapshot, viewport, padding) {
  return fitViewportToDrawing({
    ...snapshot.document,
    annotations: snapshot.document.annotations.filter(({ type }) => type === "section-hatch" || type === "dimension")
  }, viewport, padding);
}
function viewportStorageKey(drawingId) {
  return `vectorai:annotation:viewport:${drawingId}`;
}
function readStoredViewport(drawingId) {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(viewportStorageKey(drawingId)) ?? "null");
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.scale) || !(value.scale > 0)) return null;
    return { x: value.x, y: value.y, scale: value.scale };
  } catch {
    return null;
  }
}
function writeStoredViewport(drawingId, viewport) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(viewportStorageKey(drawingId), JSON.stringify({ x: viewport.x, y: viewport.y, scale: viewport.scale }));
  } catch {
  }
}
function useObservable(observable) {
  return reactExports.useSyncExternalStore(observable.subscribe, observable.getSnapshot, observable.getSnapshot);
}
function workflowLabel(status) {
  return {
    idle: "待开始",
    running: "分析中",
    reviewing: "检查中",
    completed: "已完成",
    canceled: "已取消",
    failed: "需要处理",
    "needs-rebase": "图纸已变化"
  }[status];
}
function partitionProgressLabel(phase, busy, workflowStatus) {
  if (busy || phase === "analyzing") return "正在识别轴段并进行 AI 语义复核";
  if (phase === "editing") return "分区草稿待确认";
  if (phase === "confirmed") return "分区已确认";
  if (phase === "needs-rebase") return "图纸已变化";
  if (phase === "failed") return "分区需要处理";
  return workflowLabel(workflowStatus);
}
function createAnnotationRemoteStateSource(remote, options = {}) {
  const entries = /* @__PURE__ */ new Map();
  const pollIntervalMs = options.pollIntervalMs ?? 1e3;
  const ensure = (sessionId) => {
    const current = entries.get(sessionId);
    if (current !== void 0) return current;
    const state = emptyState();
    const entry = {};
    entry.state = state;
    entry.claim = claimOf(state);
    entry.listeners = /* @__PURE__ */ new Set();
    const subscribe = (listener) => {
      entry.listeners.add(listener);
      if (entry.listeners.size === 1) {
        void refresh(sessionId);
        entry.timer = setInterval(() => {
          void refresh(sessionId);
        }, pollIntervalMs);
      }
      return () => {
        entry.listeners.delete(listener);
        if (entry.listeners.size === 0 && entry.timer !== void 0) {
          clearInterval(entry.timer);
          entry.timer = void 0;
        }
      };
    };
    entry.stateObservable = { getSnapshot: () => entry.state, subscribe };
    entry.claimObservable = { getSnapshot: () => entry.claim, subscribe };
    entries.set(sessionId, entry);
    return entry;
  };
  const refresh = async (sessionId) => {
    const entry = ensure(sessionId);
    if (entry.inFlight !== void 0) return entry.inFlight;
    entry.inFlight = (async () => {
      try {
        const result = await remote.getSessionState(sessionId);
        if (result.ok !== true) return;
        const next = structuredClone(result.value);
        if (JSON.stringify(next) === JSON.stringify(entry.state)) return;
        entry.state = next;
        entry.claim = claimOf(next);
        for (const listener of entry.listeners) listener();
      } finally {
        entry.inFlight = void 0;
      }
    })();
    return entry.inFlight;
  };
  return {
    claimSource: { observe: (sessionId) => ensure(sessionId).claimObservable },
    observeState: (sessionId) => ensure(sessionId).stateObservable,
    refresh,
    dispose() {
      for (const entry of entries.values()) {
        if (entry.timer !== void 0) clearInterval(entry.timer);
        entry.listeners.clear();
      }
      entries.clear();
    }
  };
}
function emptyState() {
  return {
    version: 1,
    workspaceClaimed: false,
    activationEpoch: 0,
    workflow: { status: "idle" }
  };
}
function claimOf(state) {
  return {
    active: state.workspaceClaimed,
    activationEpoch: state.activationEpoch
  };
}
var _a$1;
function $constructor(name, initializer2, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: /* @__PURE__ */ new Set()
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = (params == null ? void 0 : params.Parent) ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a2;
    const inst = (params == null ? void 0 : params.Parent) ? new Definition() : this;
    init(inst, def);
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      var _a2, _b;
      if ((params == null ? void 0 : params.Parent) && inst instanceof params.Parent)
        return true;
      return (_b = (_a2 = inst == null ? void 0 : inst._zod) == null ? void 0 : _a2.traits) == null ? void 0 : _b.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}
class $ZodEncodeError extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
}
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  return globalConfig;
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  return {
    get value() {
      {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
const EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__ */ cached(() => {
  var _a2;
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && ((_a2 = navigator == null ? void 0 : navigator.userAgent) == null ? void 0 : _a2.includes("Cloudflare"))) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || (params == null ? void 0 : params.parent))
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if ((params == null ? void 0 : params.message) !== void 0) {
    if ((params == null ? void 0 : params.error) !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
const NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b) {
  var _a2;
  if ((_a2 = a._zod.def.checks) == null ? void 0 : _a2.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  var _a2;
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (((_a2 = x.issues[i]) == null ? void 0 : _a2.continue) !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  var _a2;
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (((_a2 = x.issues[i]) == null ? void 0 : _a2.continue) === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a2;
    (_a2 = iss).path ?? (_a2.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message == null ? void 0 : message.message;
}
function finalizeIssue(iss, ctx, config2) {
  var _a2, _b, _c, _d, _e, _f;
  const message = iss.message ? iss.message : unwrapMessage((_c = (_b = (_a2 = iss.inst) == null ? void 0 : _a2._zod.def) == null ? void 0 : _b.error) == null ? void 0 : _c.call(_b, iss)) ?? unwrapMessage((_d = ctx == null ? void 0 : ctx.error) == null ? void 0 : _d.call(ctx, iss)) ?? unwrapMessage((_e = config2.customError) == null ? void 0 : _e.call(config2, iss)) ?? unwrapMessage((_f = config2.localeError) == null ? void 0 : _f.call(config2, iss)) ?? "Invalid input";
  const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx == null ? void 0 : ctx.reportInput) {
    rest.input = _input;
  }
  return rest;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
const initializer$1 = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error2, path = []) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
const _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new ((_params == null ? void 0 : _params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params == null ? void 0 : _params.callee);
    throw e;
  }
  return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new ((params == null ? void 0 : params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params == null ? void 0 : params.callee);
    throw e;
  }
  return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
  return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64$1 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time$1(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
  const regex = params ? `[\\s\\S]{${(params == null ? void 0 : params.minimum) ?? 0},${(params == null ? void 0 : params.maximum) ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a2;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
});
const numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a2;
    (_a2 = inst2._zod.bag).multipleOf ?? (_a2.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = (_a2 = def.format) == null ? void 0 : _a2.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a2, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this == null ? void 0 : this.args;
    const content = (this == null ? void 0 : this.content) ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join("\n"));
  }
}
const version = {
  major: 4,
  minor: 4,
  patch: 3
};
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a3;
  var _a2;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    (_a3 = inst._zod.deferred) == null ? void 0 : _a3.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && (ctx == null ? void 0 : ctx.async) === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      var _a4;
      try {
        const r = safeParse$1(inst, value);
        return r.success ? { value: r.data } : { issues: (_a4 = r.error) == null ? void 0 : _a4.issues };
      } catch (_) {
        return safeParseAsync$1(inst, value).then((r) => {
          var _a5;
          return r.success ? { value: r.data } : { issues: (_a5 = r.error) == null ? void 0 : _a5.issues };
        });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  var _a2;
  $ZodType.init(inst, def);
  inst._zod.pattern = [...((_a2 = inst == null ? void 0 : inst._zod.bag) == null ? void 0 : _a2.patterns) ?? []].pop() ?? string$1(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    var _a2;
    try {
      const trimmed = payload.value.trim();
      if (!def.normalize && ((_a2 = def.protocol) == null ? void 0 : _a2.source) === httpProtocol.source) {
        if (!/^https?:\/\//i.test(trimmed)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
      }
      const url = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  def.pattern ?? (def.pattern = nanoid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    try {
      new URL(`http://[${payload.value}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    const parts = payload.value.split("/");
    try {
      if (parts.length !== 2)
        throw new Error();
      const [address, prefix] = parts;
      if (!prefix)
        throw new Error();
      const prefixNum = Number(prefix);
      if (`${prefixNum}` !== prefix)
        throw new Error();
      if (prefixNum < 0 || prefixNum > 128)
        throw new Error();
      new URL(`http://[${address}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64$1);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && (parsedHeader == null ? void 0 : parsedHeader.typ) !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
const $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
  const isPresent = key in input;
  if (result.issues.length) {
    if (isOptionalIn && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && !isOptionalIn) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  var _a2, _b, _c, _d;
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!((_d = (_c = (_b = (_a2 = def.shape) == null ? void 0 : _a2[k]) == null ? void 0 : _b._zod) == null ? void 0 : _c.traits) == null ? void 0 : _d.has("$ZodType"))) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalIn = _catchall.optin === "optional";
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input) {
    if (key === "__proto__")
      continue;
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!(desc == null ? void 0 : desc.get)) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject$1 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const isOptionalIn = el._zod.optin === "optional";
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const generateFastpass = (shape) => {
    var _a2, _b;
    const doc = new Doc(["shape", "payload", "ctx"]);
    const normalized2 = _normalized.value;
    const parseStr = (key) => {
      const k = esc(key);
      return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    };
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized2.keys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(`const newResult = {};`);
    for (const key of normalized2.keys) {
      const id = ids[key];
      const k = esc(key);
      const schema = shape[key];
      const isOptionalIn = ((_a2 = schema == null ? void 0 : schema._zod) == null ? void 0 : _a2.optin) === "optional";
      const isOptionalOut = ((_b = schema == null ? void 0 : schema._zod) == null ? void 0 : _b.optout) === "optional";
      doc.write(`const ${id} = ${parseStr(key)};`);
      if (isOptionalIn && isOptionalOut) {
        doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    const fn = doc.compile();
    return (payload, ctx) => fn(shape, payload, ctx);
  };
  let fastpass;
  const isObject$1 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval$1 = allowsEval;
  const fastEnabled = jit && allowsEval$1.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && (ctx == null ? void 0 : ctx.async) === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
const $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
  def.inclusive = false;
  $ZodUnion.init(inst, def);
  const _super = inst._zod.parse;
  defineLazy(inst._zod, "propValues", () => {
    const propValues = {};
    for (const option of def.options) {
      const pv = option._zod.propValues;
      if (!pv || Object.keys(pv).length === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const [k, v] of Object.entries(pv)) {
        if (!propValues[k])
          propValues[k] = /* @__PURE__ */ new Set();
        for (const val of v) {
          propValues[k].add(val);
        }
      }
    }
    return propValues;
  });
  const disc = cached(() => {
    var _a2;
    const opts = def.options;
    const map = /* @__PURE__ */ new Map();
    for (const o of opts) {
      const values = (_a2 = o._zod.propValues) == null ? void 0 : _a2[def.discriminator];
      if (!values || values.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values) {
        if (map.has(v)) {
          throw new Error(`Duplicate discriminator value "${String(v)}"`);
        }
        map.set(v, o);
      }
    }
    return map;
  });
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isObject(input)) {
      payload.issues.push({
        code: "invalid_type",
        expected: "object",
        input,
        inst
      });
      return payload;
    }
    const opt = disc.value.get(input == null ? void 0 : input[def.discriminator]);
    if (opt) {
      return opt._zod.run(payload, ctx);
    }
    if (def.unionFallback || ctx.direction === "backward") {
      return _super(payload, ctx);
    }
    payload.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: def.discriminator,
      options: Array.from(disc.value.keys()),
      input,
      path: [def.discriminator],
      inst
    });
    return payload;
  };
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  for (const iss of left.issues) {
    if (iss.code === "unrecognized_keys") {
      unrecIssue ?? (unrecIssue = iss);
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).l = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  for (const iss of right.issues) {
    if (iss.code === "unrecognized_keys") {
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).r = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length && unrecIssue) {
    result.issues.push({ ...unrecIssue, keys: bothKeys });
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
const $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
  $ZodType.init(inst, def);
  const items = def.items;
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        input,
        inst,
        expected: "tuple",
        code: "invalid_type"
      });
      return payload;
    }
    payload.value = [];
    const proms = [];
    const optinStart = getTupleOptStart(items, "optin");
    const optoutStart = getTupleOptStart(items, "optout");
    if (!def.rest) {
      if (input.length < optinStart) {
        payload.issues.push({
          code: "too_small",
          minimum: optinStart,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
        return payload;
      }
      if (input.length > items.length) {
        payload.issues.push({
          code: "too_big",
          maximum: items.length,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
      }
    }
    const itemResults = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const r = items[i]._zod.run({ value: input[i], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((rr) => {
          itemResults[i] = rr;
        }));
      } else {
        itemResults[i] = r;
      }
    }
    if (def.rest) {
      let i = items.length - 1;
      const rest = input.slice(items.length);
      for (const el of rest) {
        i++;
        const result = def.rest._zod.run({ value: el, issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((r) => handleTupleResult(r, payload, i)));
        } else {
          handleTupleResult(result, payload, i);
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
    }
    return handleTupleResults(itemResults, payload, items, input, optoutStart);
  };
});
function getTupleOptStart(items, key) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]._zod[key] !== "optional")
      return i + 1;
  }
  return 0;
}
function handleTupleResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input, optoutStart) {
  for (let i = 0; i < items.length; i++) {
    const r = itemResults[i];
    const isPresent = i < input.length;
    if (r.issues.length) {
      if (!isPresent && i >= optoutStart) {
        final.value.length = i;
        break;
      }
      final.issues.push(...prefixIssues(i, r.issues));
    }
    final.value[i] = r.value;
  }
  for (let i = final.value.length - 1; i >= input.length; i--) {
    if (items[i]._zod.optout === "optional" && final.value[i] === void 0) {
      final.value.length = i;
    } else {
      break;
    }
  }
  return final;
}
const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number$1.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values = new Set(def.values);
  inst._zod.values = values;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    payload.fallback = true;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (input === void 0 && (result.issues.length || result.fallback)) {
    return { issues: [], value: void 0 };
  }
  return result;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const input = payload.value;
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, input));
      return handleOptionalResult(result, input);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => {
    const v = def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
          payload.fallback = true;
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
      payload.fallback = true;
    }
    return payload;
  };
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
}
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "optin", () => {
    var _a2, _b;
    return (_b = (_a2 = def.innerType) == null ? void 0 : _a2._zod) == null ? void 0 : _b.optin;
  });
  defineLazy(inst._zod, "optout", () => {
    var _a2, _b;
    return (_b = (_a2 = def.innerType) == null ? void 0 : _a2._zod) == null ? void 0 : _b.optout;
  });
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var _a;
class $ZodRegistry {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
  return new Class({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
  return new Class({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
function initializeContext(params) {
  let target = (params == null ? void 0 : params.target) ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: (params == null ? void 0 : params.metadata) ?? globalRegistry,
    target,
    unrepresentable: (params == null ? void 0 : params.unrepresentable) ?? "throw",
    override: (params == null ? void 0 : params.override) ?? (() => {
    }),
    io: (params == null ? void 0 : params.io) ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: (params == null ? void 0 : params.cycles) ?? "ref",
    reused: (params == null ? void 0 : params.reused) ?? "inline",
    external: (params == null ? void 0 : params.external) ?? void 0
  };
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a3, _b;
  var _a2;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  const overrideSchema = (_b = (_a3 = schema._zod).toJSONSchema) == null ? void 0 : _b.call(_a3);
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process$1(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    Object.assign(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a2 = result.schema).default ?? (_a2.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function extractDefs(ctx, schema) {
  var _a2, _b, _c, _d;
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = (_a2 = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _a2.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    var _a3;
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = (_a3 = ctx.external.registry.get(entry[0])) == null ? void 0 : _a3.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
    }
    if (entry[1] === root) {
      return { ref: "#" };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + defId };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${(_b = seen.cycle) == null ? void 0 : _b.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = (_c = ctx.external.registry.get(entry[0])) == null ? void 0 : _c.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = (_d = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _d.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
}
function finalize(ctx, schema) {
  var _a2, _b, _c, _d;
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        Object.assign(schema2, refSchema);
      }
      Object.assign(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen == null ? void 0 : parentSeen.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  for (const entry of [...ctx.seen.entries()].reverse()) {
    flattenRef(entry[0]);
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") ;
  else ;
  if ((_a2 = ctx.external) == null ? void 0 : _a2.uri) {
    const id = (_b = ctx.external.registry.get(schema)) == null ? void 0 : _b.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  Object.assign(result, root.def ?? root.schema);
  const rootMetaId = (_c = ctx.metadataRegistry.get(schema)) == null ? void 0 : _c.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ((_d = ctx.external) == null ? void 0 : _d.defs) ?? {};
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (seen.def && seen.defId) {
      if (seen.def.id === seen.defId)
        delete seen.def.id;
      defs[seen.defId] = seen.def;
    }
  }
  if (ctx.external) ;
  else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
const stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time") {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const regexes = [...patterns];
    if (regexes.length === 1)
      json.pattern = regexes[0].source;
    else if (regexes.length > 1) {
      json.allOf = [
        ...regexes.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
const numberProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json.type = "integer";
  else
    json.type = "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy2 = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy2) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy2) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (typeof multipleOf === "number")
    json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
};
const enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
  const def = schema._zod.def;
  const vals = [];
  for (const val of def.values) {
    if (val === void 0) {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
      }
    } else if (typeof val === "bigint") {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      } else {
        vals.push(Number(val));
      }
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) ;
  else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
const customProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Custom types cannot be represented in JSON Schema");
  }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Transforms cannot be represented in JSON Schema");
  }
};
const arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = process$1(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
const objectProcessor = (schema, ctx, _json, params) => {
  var _a2;
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  json.properties = {};
  const shape = def.shape;
  for (const key in shape) {
    json.properties[key] = process$1(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    });
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const v = def.shape[key]._zod;
    if (ctx.io === "input") {
      return v.optin === void 0;
    } else {
      return v.optout === void 0;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (((_a2 = def.catchall) == null ? void 0 : _a2._zod.def.type) === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = process$1(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
const unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
const intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = process$1(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = process$1(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
};
const tupleProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "array";
  const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
  const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
  const prefixItems = def.items.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, prefixPath, i]
  }));
  const rest = def.rest ? process$1(def.rest, ctx, {
    ...params,
    path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
  }) : null;
  if (ctx.target === "draft-2020-12") {
    json.prefixItems = prefixItems;
    if (rest) {
      json.items = rest;
    }
  } else if (ctx.target === "openapi-3.0") {
    json.items = {
      anyOf: prefixItems
    };
    if (rest) {
      json.items.anyOf.push(rest);
    }
    json.minItems = prefixItems.length;
    if (!rest) {
      json.maxItems = prefixItems.length;
    }
  } else {
    json.items = prefixItems;
    if (rest) {
      json.additionalItems = rest;
    }
  }
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
};
const recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const keyBag = keyType._zod.bag;
  const patterns = keyBag == null ? void 0 : keyBag.patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      json.patternProperties[pattern.source] = valueSchema;
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = process$1(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
    }
    json.additionalProperties = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  if (keyValues) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues;
    }
  }
};
const nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io === "input")
    json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  process$1(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function datetime(params) {
  return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function date(params) {
  return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function time(params) {
  return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function duration(params) {
  return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
const initializer = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
      // enumerable: false,
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
      // enumerable: false,
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
      // enumerable: false,
    }
  });
};
const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, {
  Parent: Error
});
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
const _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
  const proto = Object.getPrototypeOf(inst);
  let installed = _installedGroups.get(proto);
  if (!installed) {
    installed = /* @__PURE__ */ new Set();
    _installedGroups.set(proto, installed);
  }
  if (installed.has(group))
    return;
  installed.add(group);
  for (const key in methods) {
    const fn = methods[key];
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      get() {
        const bound = fn.bind(this);
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: bound
        });
        return bound;
      },
      set(v) {
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: v
        });
      }
    });
  }
}
const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  $ZodType.init(inst, def);
  Object.assign(inst["~standard"], {
    jsonSchema: {
      input: createStandardJSONSchemaMethod(inst, "input"),
      output: createStandardJSONSchemaMethod(inst, "output")
    }
  });
  inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
  inst.def = def;
  inst.type = def.type;
  Object.defineProperty(inst, "_def", { value: def });
  inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
  inst.spa = inst.safeParseAsync;
  inst.encode = (data, params) => encode(inst, data, params);
  inst.decode = (data, params) => decode(inst, data, params);
  inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
  inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
  inst.safeEncode = (data, params) => safeEncode(inst, data, params);
  inst.safeDecode = (data, params) => safeDecode(inst, data, params);
  inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
  inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
  _installLazyMethods(inst, "ZodType", {
    check(...chks) {
      const def2 = this.def;
      return this.clone(mergeDefs(def2, {
        checks: [
          ...def2.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def2, params) {
      return clone(this, def2, params);
    },
    brand() {
      return this;
    },
    register(reg, meta) {
      reg.add(this, meta);
      return this;
    },
    refine(check, params) {
      return this.check(refine(check, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(/* @__PURE__ */ _overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(void 0).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn) {
      return fn(this);
    }
  });
  Object.defineProperty(inst, "description", {
    get() {
      var _a2;
      return (_a2 = globalRegistry.get(inst)) == null ? void 0 : _a2.description;
    },
    configurable: true
  });
  return inst;
});
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
  _installLazyMethods(inst, "_ZodString", {
    regex(...args) {
      return this.check(/* @__PURE__ */ _regex(...args));
    },
    includes(...args) {
      return this.check(/* @__PURE__ */ _includes(...args));
    },
    startsWith(...args) {
      return this.check(/* @__PURE__ */ _startsWith(...args));
    },
    endsWith(...args) {
      return this.check(/* @__PURE__ */ _endsWith(...args));
    },
    min(...args) {
      return this.check(/* @__PURE__ */ _minLength(...args));
    },
    max(...args) {
      return this.check(/* @__PURE__ */ _maxLength(...args));
    },
    length(...args) {
      return this.check(/* @__PURE__ */ _length(...args));
    },
    nonempty(...args) {
      return this.check(/* @__PURE__ */ _minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(/* @__PURE__ */ _lowercase(params));
    },
    uppercase(params) {
      return this.check(/* @__PURE__ */ _uppercase(params));
    },
    trim() {
      return this.check(/* @__PURE__ */ _trim());
    },
    normalize(...args) {
      return this.check(/* @__PURE__ */ _normalize(...args));
    },
    toLowerCase() {
      return this.check(/* @__PURE__ */ _toLowerCase());
    },
    toUpperCase() {
      return this.check(/* @__PURE__ */ _toUpperCase());
    },
    slugify() {
      return this.check(/* @__PURE__ */ _slugify());
    }
  });
});
const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
  inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
  inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
  inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
  inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
  inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
  inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
  inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
  inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
  inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
  inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
  inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
  inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
  inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
  inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
  inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
  inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
  inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
  inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
  inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
  inst.datetime = (params) => inst.check(datetime(params));
  inst.date = (params) => inst.check(date(params));
  inst.time = (params) => inst.check(time(params));
  inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
  return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
  _installLazyMethods(inst, "ZodNumber", {
    gt(value, params) {
      return this.check(/* @__PURE__ */ _gt(value, params));
    },
    gte(value, params) {
      return this.check(/* @__PURE__ */ _gte(value, params));
    },
    min(value, params) {
      return this.check(/* @__PURE__ */ _gte(value, params));
    },
    lt(value, params) {
      return this.check(/* @__PURE__ */ _lt(value, params));
    },
    lte(value, params) {
      return this.check(/* @__PURE__ */ _lte(value, params));
    },
    max(value, params) {
      return this.check(/* @__PURE__ */ _lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(/* @__PURE__ */ _gt(0, params));
    },
    nonnegative(params) {
      return this.check(/* @__PURE__ */ _gte(0, params));
    },
    negative(params) {
      return this.check(/* @__PURE__ */ _lt(0, params));
    },
    nonpositive(params) {
      return this.check(/* @__PURE__ */ _lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value, params));
    },
    step(value, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value, params));
    },
    finite() {
      return this;
    }
  });
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
});
function number(params) {
  return /* @__PURE__ */ _number(ZodNumber, params);
}
const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
});
function boolean(params) {
  return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
  return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
  return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
  _installLazyMethods(inst, "ZodArray", {
    min(n, params) {
      return this.check(/* @__PURE__ */ _minLength(n, params));
    },
    nonempty(params) {
      return this.check(/* @__PURE__ */ _minLength(1, params));
    },
    max(n, params) {
      return this.check(/* @__PURE__ */ _maxLength(n, params));
    },
    length(n, params) {
      return this.check(/* @__PURE__ */ _length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
});
function array(element, params) {
  return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  defineLazy(inst, "shape", () => {
    return def.shape;
  });
  _installLazyMethods(inst, "ZodObject", {
    keyof() {
      return _enum(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone({ ...this._zod.def, catchall });
    },
    passthrough() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    loose() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    strict() {
      return this.clone({ ...this._zod.def, catchall: never() });
    },
    strip() {
      return this.clone({ ...this._zod.def, catchall: void 0 });
    },
    extend(incoming) {
      return extend(this, incoming);
    },
    safeExtend(incoming) {
      return safeExtend(this, incoming);
    },
    merge(other) {
      return merge(this, other);
    },
    pick(mask) {
      return pick(this, mask);
    },
    omit(mask) {
      return omit(this, mask);
    },
    partial(...args) {
      return partial(ZodOptional, this, args[0]);
    },
    required(...args) {
      return required(ZodNonOptional, this, args[0]);
    }
  });
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
const ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
  ZodUnion.init(inst, def);
  $ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...normalizeParams(params)
  });
}
const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
const ZodTuple = /* @__PURE__ */ $constructor("ZodTuple", (inst, def) => {
  $ZodTuple.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
  inst.rest = (rest) => inst.clone({
    ...inst._zod.def,
    rest
  });
});
function tuple(items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new ZodTuple({
    type: "tuple",
    items,
    rest,
    ...normalizeParams(params)
  });
}
const ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string(),
      valueType: keyType,
      ...normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
const ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    payload.value = output;
    payload.fallback = true;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
});
function refine(fn, _params = {}) {
  return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return /* @__PURE__ */ _superRefine(fn, params);
}
function _instanceof(cls, params = {}) {
  const inst = new ZodCustom({
    type: "custom",
    check: "custom",
    fn: (data) => data instanceof cls,
    abort: true,
    ...normalizeParams(params)
  });
  inst._zod.bag.Class = cls;
  inst._zod.check = (payload) => {
    if (!(payload.value instanceof cls)) {
      payload.issues.push({
        code: "invalid_type",
        expected: cls.name,
        input: payload.value,
        inst,
        path: [...inst._zod.def.path ?? []]
      });
    }
  };
  return inst;
}
const ZodIssueCode = {
  custom: "custom"
};
const protocolIdSchema = string().trim().min(1).max(256);
const contentDigestSchema = string().trim().min(1).max(512);
const idSchema$3 = protocolIdSchema;
const digestSchema$1 = contentDigestSchema;
const drawingRefSchema = object({
  drawingId: idSchema$3,
  revision: number().int().nonnegative()
}).strict();
const editBasisSchema = discriminatedUnion("kind", [
  object({
    kind: literal("canonical"),
    ref: drawingRefSchema
  }).strict(),
  object({
    kind: literal("preview"),
    baseRef: drawingRefSchema,
    previewHandle: idSchema$3,
    previewDigest: digestSchema$1
  }).strict(),
  object({
    kind: literal("carried-candidate"),
    handoffId: idSchema$3,
    taskId: idSchema$3,
    originTaskId: idSchema$3,
    baseRef: drawingRefSchema,
    candidateDigest: digestSchema$1
  }).strict()
]);
const observationArtifactRefSchema = object({
  id: idSchema$3,
  contentDigest: digestSchema$1,
  mimeType: _enum(["image/png", "image/webp"]),
  basis: editBasisSchema
}).strict();
object({
  taskId: idSchema$3,
  rootUserMessageDigest: digestSchema$1,
  authoritativeObjectiveDigest: digestSchema$1,
  baseRef: drawingRefSchema,
  policy: _enum(["review", "auto-safe"]),
  stateEpoch: number().int().nonnegative()
}).strict();
object({
  observationId: idSchema$3,
  taskId: idSchema$3,
  basis: editBasisSchema,
  artifactRefs: array(observationArtifactRefSchema).max(16),
  selectionProjectionId: idSchema$3.optional(),
  observationDigest: digestSchema$1
}).strict();
object({
  contextId: idSchema$3,
  taskId: idSchema$3,
  observationId: idSchema$3,
  contextDigest: digestSchema$1
}).strict();
object({
  groundingId: idSchema$3,
  taskId: idSchema$3,
  contextId: idSchema$3,
  targetHandle: idSchema$3,
  targetNodeIds: array(idSchema$3).min(1).max(256),
  interfaces: array(object({
    interfaceId: idSchema$3,
    nodeId: idSchema$3,
    endpoint: _enum(["start", "end"])
  }).strict()).max(256),
  targetScopeDigest: digestSchema$1,
  protectedScopeDigest: digestSchema$1,
  evidenceDigest: digestSchema$1
}).strict();
object({
  previewHandle: idSchema$3,
  taskId: idSchema$3,
  groundingId: idSchema$3,
  groundingIds: array(idSchema$3).min(2).max(16).optional(),
  baseRef: drawingRefSchema,
  candidateDigest: digestSchema$1,
  effectDigest: digestSchema$1,
  finalizeOperationId: idSchema$3,
  finalizeOperationBindingDigest: digestSchema$1
}).strict().superRefine(({ groundingId, groundingIds }, context) => {
  if (groundingIds === void 0) return;
  if (groundingIds[0] !== groundingId || new Set(groundingIds).size !== groundingIds.length) {
    context.addIssue({ code: "custom", path: ["groundingIds"], message: "EDIT_GROUNDING_SET_INVALID" });
  }
});
object({
  evaluationId: idSchema$3,
  taskId: idSchema$3,
  previewHandle: idSchema$3,
  candidateDigest: digestSchema$1,
  evaluationDigest: digestSchema$1
}).strict();
const selectionProjectionRefSchema = object({
  selectionProjectionId: idSchema$3,
  drawingRef: drawingRefSchema,
  nodeIds: array(idSchema$3).min(1).max(256),
  projectionDigest: digestSchema$1,
  expiresAt: number().int().nonnegative()
}).strict();
const boundedTextSchema$1 = string().trim().min(1).max(2e3);
const boundsSchema$1 = object({
  minX: number().finite(),
  minY: number().finite(),
  maxX: number().finite(),
  maxY: number().finite()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY);
const diagnosticSchema = object({
  code: protocolIdSchema,
  severity: _enum(["info", "candidate", "warning", "decision_required", "error"]),
  message: boundedTextSchema$1,
  nodeIds: array(protocolIdSchema).max(256).optional(),
  action: boundedTextSchema$1.optional(),
  facts: record(string(), unknown()).optional(),
  scopeDigest: contentDigestSchema.optional(),
  hard: boolean().optional()
}).strict();
const authoritativeObjectiveSchema = object({
  text: string().trim().min(1).max(8e3),
  attachmentContentDigests: array(contentDigestSchema).max(16)
}).strict();
const resolvedDefectSchema = object({
  defectId: protocolIdSchema,
  scopeDigest: contentDigestSchema,
  evidenceDigests: array(contentDigestSchema).min(1).max(32)
}).strict();
const reviewEvidenceSchema = object({
  kind: literal("reviewer"),
  provider: protocolIdSchema,
  providerVersion: protocolIdSchema,
  authoritativeObjective: authoritativeObjectiveSchema,
  renderManifest: object({
    rendererVersion: protocolIdSchema,
    beforeContentDigest: contentDigestSchema,
    afterContentDigest: contentDigestSchema,
    artifactContentDigest: contentDigestSchema,
    comparisonLayout: literal("before | after"),
    worldToImage: tuple([
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite()
    ]),
    viewport: boundsSchema$1,
    width: number().int().positive().max(8192),
    height: number().int().positive().max(8192),
    overlays: array(protocolIdSchema).max(32)
  }).strict(),
  outcome: _enum(["satisfied", "needs_revision", "unavailable"]),
  defects: array(object({
    defectId: protocolIdSchema,
    code: protocolIdSchema,
    reason: boundedTextSchema$1,
    scopeDigest: contentDigestSchema
  }).strict()).max(64),
  resolvedDefects: array(resolvedDefectSchema).max(64)
}).strict();
const assessmentBase = {
  assessmentId: protocolIdSchema,
  taskId: protocolIdSchema,
  drawingId: protocolIdSchema,
  baseRef: drawingRefSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  evaluationDigest: contentDigestSchema,
  policyVersion: protocolIdSchema,
  evaluatorVersions: array(protocolIdSchema).min(1).max(64),
  effectDigest: contentDigestSchema,
  reasons: array(protocolIdSchema).max(64)
};
const assessmentSchema = discriminatedUnion("disposition", [
  object({
    ...assessmentBase,
    disposition: literal("blocked"),
    hardDeny: boolean(),
    nonOverridableProtected: boolean()
  }).strict(),
  object({
    ...assessmentBase,
    disposition: literal("confirmation_required"),
    requiredEffectDigest: contentDigestSchema
  }).strict(),
  object({
    ...assessmentBase,
    disposition: literal("auto_safe"),
    autoQualification: object({
      exactScope: literal(true),
      cleanDiagnostics: literal(true),
      sourceConfirmed: literal(true),
      reviewerSatisfied: literal(true),
      inverseVerified: literal(true)
    }).strict()
  }).strict()
]);
object({
  evaluationId: protocolIdSchema,
  taskId: protocolIdSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  diagnostics: array(diagnosticSchema).max(256),
  mandatoryEvaluatorVersions: array(protocolIdSchema).min(1).max(64),
  review: reviewEvidenceSchema,
  evaluationDigest: contentDigestSchema
}).strict();
const idSchema$2 = string().trim().min(1).max(256);
const digestSchema = string().trim().min(1).max(512);
object({
  previewHandle: idSchema$2,
  previewDigest: digestSchema,
  finalizeOperationId: idSchema$2,
  finalizeOperationBindingDigest: digestSchema,
  evaluationId: idSchema$2
}).strict();
const finalizePreviewResultSchema = discriminatedUnion("status", [
  object({
    status: literal("committed"),
    mode: _enum(["auto-safe", "confirmed"]),
    commitId: idSchema$2,
    ref: drawingRefSchema,
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict(),
  object({
    status: literal("already-satisfied"),
    ref: drawingRefSchema,
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict(),
  object({
    status: literal("root-required"),
    message: string().trim().min(1).max(2e3)
  }).strict(),
  object({
    status: literal("needs-revision"),
    evaluationId: idSchema$2,
    reasons: array(string().trim().min(1).max(1e3)).min(1).max(64)
  }).strict(),
  object({
    status: literal("discarded"),
    ref: drawingRefSchema
  }).strict(),
  object({
    status: literal("rejected"),
    disposition: _enum(["blocked", "confirmation_required"]),
    code: idSchema$2,
    message: string().trim().min(1).max(2e3)
  }).strict(),
  object({
    status: literal("outcome-unknown"),
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict()
]);
const idSchema$1 = string().trim().min(1).max(256);
const boundedTextSchema = string().trim().min(1).max(2e3);
const finiteSchema = number().finite();
const vec2Schema$1 = tuple([finiteSchema, finiteSchema]);
const boundsSchema = object({
  minX: finiteSchema,
  minY: finiteSchema,
  maxX: finiteSchema,
  maxY: finiteSchema
}).strict().refine(
  ({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY,
  { message: "INVALID_BOUNDS" }
);
const effectScopeRefSchema = discriminatedUnion("kind", [
  object({
    kind: literal("node-field"),
    nodeId: idSchema$1,
    fields: array(idSchema$1).min(1).max(64)
  }).strict(),
  object({
    kind: literal("source-span"),
    nodeId: idSchema$1,
    start: number().int().nonnegative(),
    end: number().int().positive()
  }).strict().refine(({ start, end }) => start < end, { message: "INVALID_SOURCE_SPAN" }),
  object({
    kind: literal("half-edge"),
    nodeId: idSchema$1,
    halfEdgeId: idSchema$1
  }).strict(),
  object({
    kind: literal("interface"),
    interfaceId: idSchema$1
  }).strict(),
  object({
    kind: literal("endpoint-slot"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"])
  }).strict(),
  object({
    kind: literal("creation"),
    plane: _enum(["geometry", "annotation", "relation", "feature"]),
    nodeType: idSchema$1,
    containerId: idSchema$1.optional(),
    maxCount: number().int().min(1).max(256)
  }).strict(),
  object({
    kind: literal("deletion"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict()
]);
const spatialOperationSchema = discriminatedUnion("kind", [
  object({
    kind: literal("rigid_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema,
    pivot: vec2Schema$1
  }).strict(),
  object({
    kind: literal("connected_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema.optional(),
    pivot: vec2Schema$1.optional(),
    interfaceIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("set_endpoint"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"]),
    point: vec2Schema$1
  }).strict(),
  object({
    kind: literal("create_path"),
    nodeId: idSchema$1,
    points: array(vec2Schema$1).min(2).max(4096),
    closed: boolean()
  }).strict(),
  object({
    kind: literal("delete_nodes"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("create_annotation_batch"),
    annotations: array(object({ id: idSchema$1, type: idSchema$1 }).catchall(unknown())).min(1).max(512),
    associations: array(object({ id: idSchema$1, type: literal("association") }).catchall(unknown())).max(512)
  }).strict()
]);
const spatialPostconditionSchema = discriminatedUnion("kind", [
  object({
    kind: literal("preserve_connectivity"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("within_bounds"),
    bounds: boundsSchema
  }).strict(),
  object({
    kind: literal("target_position"),
    targetHandle: idSchema$1,
    point: vec2Schema$1,
    tolerance: finiteSchema.positive()
  }).strict()
]);
const spatialEditProgramSchema = object({
  baseRef: drawingRefSchema,
  targetHandle: idSchema$1,
  summary: boundedTextSchema,
  objective: boundedTextSchema,
  operations: array(spatialOperationSchema).min(1).max(128),
  preserveScopes: array(effectScopeRefSchema).max(512),
  postconditions: array(spatialPostconditionSchema).max(128),
  evidenceRefs: array(idSchema$1).min(1).max(256)
}).strict();
const idSchema = string().min(1);
const vec2Schema = tuple([number(), number()]);
const qualitySchema = object({
  status: _enum(["confirmed", "candidate"]),
  confidence: number().optional(),
  evidenceRefs: array(idSchema)
}).strict();
const drawingNodeSourceRefSchema = object({
  sourceId: idSchema,
  objectId: idSchema.optional(),
  objectType: idSchema.optional(),
  layer: string().min(1).optional()
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: boolean(),
  quality: qualitySchema,
  sourceRef: drawingNodeSourceRefSchema.optional()
};
const geometrySchema = discriminatedUnion("type", [
  object({ ...baseNodeShape, type: literal("point"), x: number(), y: number() }).strict(),
  object({ ...baseNodeShape, type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("ray"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("xline"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("circle"), center: vec2Schema, radius: number() }).strict(),
  object({
    ...baseNodeShape,
    type: literal("arc"),
    center: vec2Schema,
    radius: number(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    ratio: number(),
    startParam: number().optional(),
    endParam: number().optional()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("polyline"),
    vertices: array(object({ point: vec2Schema, bulge: number().optional() }).strict()),
    closed: boolean()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("spline"),
    degree: number().int().nonnegative(),
    controlPoints: array(vec2Schema),
    knots: array(number()),
    weights: array(number()).optional(),
    closed: boolean(),
    periodic: boolean()
  }).strict()
]);
const entityAnchorSchema = discriminatedUnion("kind", [
  object({ kind: _enum(["start", "end", "center"]) }).strict(),
  object({ kind: literal("vertex"), index: number().int().nonnegative() }).strict(),
  object({ kind: literal("curve-parameter"), parameter: number() }).strict(),
  object({ kind: literal("nearest"), point: vec2Schema }).strict()
]);
const dimensionTargetSchema = object({
  geometryId: idSchema,
  anchor: entityAnchorSchema,
  labelPosition: vec2Schema.optional()
}).strict();
const dimensionCandidateSchema = object({
  targets: array(dimensionTargetSchema),
  score: number(),
  reasons: array(string())
}).strict();
const toleranceProjectionSchema = object({
  mode: _enum(["none", "bilateral", "unilateral", "limits", "fit"]),
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string().min(1).max(32).optional(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  status: _enum(["candidate", "resolved", "confirmed", "conflict"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object({
    id: idSchema,
    version: idSchema,
    inputDigest: idSchema
  }).strict().optional(),
  evidenceRefs: array(idSchema)
}).strict().superRefine((value, context) => {
  if (value.mode === "limits" && (value.lowerLimit === void 0 || value.upperLimit === void 0 || value.lowerLimit > value.upperLimit)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_LIMIT_ORDER" });
  }
  if (value.mode === "bilateral" && (value.upperDeviation === void 0 || value.lowerDeviation === void 0)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATIONS_REQUIRED" });
  }
  if (value.mode === "unilateral" && value.upperDeviation === void 0 && value.lowerDeviation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATION_REQUIRED" });
  }
  if (value.mode === "fit" && value.fitDesignation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_FIT_REQUIRED" });
  }
  if (value.status === "confirmed" && value.evidenceRefs.length === 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_EVIDENCE_REQUIRED" });
  }
});
const drawingDatumReferenceSchema = object({
  datumId: idSchema,
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  geometryId: idSchema,
  anchor: entityAnchorSchema
}).strict();
const hatchBoundaryEdgeSchema = discriminatedUnion("type", [
  object({ type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object({
    type: literal("arc"),
    center: vec2Schema,
    radius: number().positive(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    type: literal("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    axisRatio: number().positive(),
    startParameter: number(),
    endParameter: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    type: literal("spline"),
    degree: number().int().positive(),
    rational: boolean(),
    periodic: boolean(),
    knots: array(number()),
    controlPoints: array(vec2Schema),
    weights: array(number()).optional(),
    fitPoints: array(vec2Schema).optional()
  }).strict()
]);
const parametricHatchSchema = object({
  version: literal(1),
  style: _enum(["normal", "outer", "ignore"]),
  elevation: number(),
  extrusion: tuple([number(), number(), number()]),
  boundaryPaths: array(object({
    flags: number().int().nonnegative(),
    closed: boolean(),
    edges: array(hatchBoundaryEdgeSchema).min(1)
  }).strict()).min(1),
  patternLines: array(object({
    angle: number(),
    base: vec2Schema,
    offset: vec2Schema,
    dashLengths: array(number())
  }).strict()),
  patternAngle: number(),
  patternScale: number().positive(),
  double: boolean()
}).strict();
const annotationSchema = discriminatedUnion("type", [
  object({
    ...baseNodeShape,
    type: literal("text"),
    content: string(),
    position: vec2Schema,
    height: number(),
    rotation: number(),
    alignment: _enum(["left", "center", "right"]),
    verticalAlignment: _enum(["baseline", "bottom", "middle", "top"]),
    maxWidth: number().optional()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("dimension"),
    dimensionKind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
    associationStatus: _enum(["resolved", "ambiguous", "conflict"]),
    targets: array(dimensionTargetSchema),
    candidates: array(dimensionCandidateSchema).optional(),
    observedValue: number().optional(),
    computedValue: number().optional(),
    displayText: string().optional(),
    unit: _enum(["mm", "cm", "m", "deg"]).optional(),
    tolerance: object({ upper: number().optional(), lower: number().optional() }).strict().optional(),
    toleranceProjection: toleranceProjectionSchema.optional(),
    datumReferences: array(drawingDatumReferenceSchema).optional(),
    engineeringIntentId: idSchema.optional(),
    engineeringChainIds: array(idSchema).optional(),
    generationOrder: number().int().nonnegative().optional(),
    prefix: string().optional(),
    suffix: string().optional(),
    textPosition: vec2Schema,
    definitionPoints: array(vec2Schema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("leader"),
    target: dimensionTargetSchema,
    points: array(vec2Schema),
    content: string(),
    textHeight: number()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("centerline"),
    targets: array(idSchema),
    start: vec2Schema,
    end: vec2Schema,
    extension: number()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("section-hatch"),
    pattern: string(),
    angle: number(),
    spacing: number(),
    hatch: parametricHatchSchema.optional(),
    segments: array(object({ start: vec2Schema, end: vec2Schema }).strict()).optional()
  }).strict().refine((value) => value.hatch !== void 0 || value.segments !== void 0, {
    message: "SECTION_HATCH_REPRESENTATION_REQUIRED"
  })
]);
const relationSchema = discriminatedUnion("plane", [
  object({
    ...baseNodeShape,
    type: literal("topology"),
    plane: literal("topology"),
    kind: _enum(["connected", "closed", "contains", "intersects"]),
    nodeIds: array(idSchema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("constraint"),
    plane: literal("constraint"),
    kind: _enum(["horizontal", "vertical", "parallel", "perpendicular", "tangent", "concentric", "equal", "distance", "radius", "angle", "symmetry"]),
    geometryIds: array(idSchema),
    value: number().optional(),
    property: string().optional(),
    status: _enum(["defined", "satisfied", "violated", "unsolved"])
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("association"),
    plane: literal("association"),
    kind: literal("annotation-target"),
    annotationId: idSchema,
    geometryIds: array(idSchema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("semantic"),
    plane: literal("semantic"),
    kind: literal("feature-member"),
    featureId: idSchema,
    nodeIds: array(idSchema)
  }).strict()
]);
const featureSchema = object({
  ...baseNodeShape,
  type: literal("feature"),
  semanticType: string(),
  geometryIds: array(idSchema),
  annotationIds: array(idSchema),
  relationIds: array(idSchema),
  properties: record(string(), unknown())
}).strict();
const drawingDocumentSchema = object({
  protocol: literal("VectorAI-Drawing"),
  schemaVersion: literal("1.0"),
  id: idSchema,
  metadata: object({ createdAt: number(), updatedAt: number() }).strict(),
  unitSystem: object({ length: _enum(["mm", "cm", "m"]), angle: literal("deg") }).strict(),
  sources: array(object({
    id: idSchema,
    kind: _enum(["image", "dxf"]),
    mediaType: string().min(1),
    digest: idSchema,
    name: string().min(1).optional(),
    bytes: number().int().nonnegative().optional()
  }).strict()).optional(),
  coordinateFrames: array(object({
    id: idSchema,
    kind: _enum(["document", "source", "page", "view", "provisional"]),
    transform: tuple([number(), number(), number(), number(), number(), number()]),
    parentId: idSchema.optional()
  }).strict()),
  geometry: array(geometrySchema),
  annotations: array(annotationSchema),
  relations: array(relationSchema),
  features: array(featureSchema)
}).strict();
const bounds2DSchema = object({
  minX: number(),
  minY: number(),
  maxX: number(),
  maxY: number()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY, { message: "INVALID_QUERY_BOUNDS" });
const drawingPlaneSchema = _enum(["geometry", "annotation", "relation", "feature"]);
const drawingSpatialNodeSchema = discriminatedUnion("plane", [
  object({ plane: literal("geometry"), node: geometrySchema }).strict(),
  object({ plane: literal("annotation"), node: annotationSchema }).strict(),
  object({ plane: literal("relation"), node: relationSchema }).strict(),
  object({ plane: literal("feature"), node: featureSchema }).strict()
]);
discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema,
    bounds: bounds2DSchema,
    planes: array(drawingPlaneSchema).min(1).optional(),
    limit: number().int().min(1).max(200).optional()
  }).strict(),
  object({
    kind: literal("node"),
    ref: drawingRefSchema,
    id: idSchema
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema,
    nodeId: idSchema,
    limit: number().int().min(1).max(200).optional()
  }).strict()
]);
discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema,
    bounds: bounds2DSchema,
    nodes: array(drawingSpatialNodeSchema),
    totalByPlane: object({
      geometry: number().int().nonnegative(),
      annotation: number().int().nonnegative(),
      relation: number().int().nonnegative(),
      feature: number().int().nonnegative()
    }).strict(),
    truncated: boolean()
  }).strict(),
  object({
    kind: literal("node"),
    ref: drawingRefSchema,
    node: drawingSpatialNodeSchema.nullable()
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema,
    nodeId: idSchema,
    nodes: array(drawingSpatialNodeSchema),
    truncated: boolean()
  }).strict()
]);
const drawingSourceRefSchema = union([
  object({
    id: idSchema,
    mediaType: _enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    bytes: number().int().nonnegative().optional(),
    width: number().positive(),
    height: number().positive(),
    name: string().optional()
  }).strict(),
  object({
    id: idSchema,
    mediaType: literal("application/dxf"),
    bytes: number().int().nonnegative().optional(),
    name: string().optional()
  }).strict()
]);
const drawingWorkspaceSnapshotSchema = object({
  version: literal(1),
  ref: object({ drawingId: idSchema, revision: number().int().nonnegative() }).strict(),
  document: drawingDocumentSchema,
  source: drawingSourceRefSchema.optional(),
  capabilities: object({
    edit: boolean(),
    delete: boolean(),
    annotations: boolean(),
    sourceUnderlay: boolean()
  }).strict(),
  provisional: boolean().optional(),
  lastCommit: object({
    commitId: idSchema,
    mode: _enum(["auto-safe", "confirmed", "interactive", "undo", "redo"]),
    undoable: boolean(),
    redoable: boolean().optional()
  }).strict().optional()
}).strict().nullable();
const nodeCreateCommandSchema = object({
  type: literal("node.create"),
  plane: _enum(["geometry", "annotation", "relation", "feature"]),
  node: union([geometrySchema, annotationSchema, relationSchema, featureSchema])
}).strict().superRefine(({ plane, node }, context) => {
  const matches = plane === "geometry" ? geometrySchema.safeParse(node).success : plane === "annotation" ? annotationSchema.safeParse(node).success : plane === "relation" ? relationSchema.safeParse(node).success : featureSchema.safeParse(node).success;
  if (!matches) context.addIssue({ code: "custom", message: "NODE_PLANE_MISMATCH" });
});
const workspaceCommandSchema = union([
  nodeCreateCommandSchema,
  object({
    type: literal("node.update"),
    id: idSchema,
    changes: record(string(), unknown()),
    expected: record(string(), unknown())
  }).strict(),
  object({ type: literal("node.delete"), id: idSchema }).strict(),
  object({
    type: literal("annotation.move-text"),
    id: idSchema,
    position: vec2Schema,
    expectedPosition: vec2Schema
  }).strict()
]);
object({
  expectedRevision: number().int().nonnegative(),
  commands: array(workspaceCommandSchema).min(1)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("committed"), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    intentId: idSchema,
    intentDigest: idSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-apply-intent ")
  }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
object({
  targetCommitId: idSchema,
  expectedCurrentRef: drawingRefSchema
}).strict();
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-undo ")
  }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-redo ")
  }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
object({
  expectedRef: drawingRefSchema,
  nodeIds: array(idSchema).max(256)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("projected"), projection: selectionProjectionRefSchema }).strict(),
  object({ status: literal("cleared") }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
const drawingMotionRigConnectorSchema = object({
  nodeId: idSchema,
  movingEndpoint: _enum(["start", "end", "first", "last"]),
  fixedPoint: vec2Schema
}).strict();
const drawingMotionRigProjectionSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  state: _enum(["ready", "needs-correction"]),
  message: string().min(1).optional(),
  carrierNodeId: idSchema.optional(),
  controlBodyNodeIds: array(idSchema).min(1).max(256),
  connectors: array(drawingMotionRigConnectorSchema).min(1).max(256),
  anchor: vec2Schema,
  handle: vec2Schema,
  keepAnchorFixed: literal(true),
  keepControlBodyRigid: literal(true),
  preserveConnectivity: literal(true),
  allowControlRotation: literal(false)
}).strict();
object({
  ref: drawingRefSchema,
  nodeIds: array(idSchema).min(1).max(256)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("ready"), projection: drawingMotionRigProjectionSchema }).strict(),
  object({
    status: literal("needs-correction"),
    projection: drawingMotionRigProjectionSchema.optional(),
    message: string().min(1)
  }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
object({ ref: drawingRefSchema }).strict();
discriminatedUnion("status", [
  object({ status: literal("discarded") }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
const drawingGroundingOverlayInterfaceSchema = object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
const drawingGroundingOverlayGroupSchema = object({
  groundingId: idSchema,
  partKey: string().trim().min(1).max(64),
  label: string().trim().min(1).max(80),
  role: _enum(["target", "reference"]).optional(),
  colorIndex: number().int().nonnegative(),
  nodeIds: array(idSchema).min(1).max(256),
  interfaces: array(drawingGroundingOverlayInterfaceSchema).max(256)
}).strict();
object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  taskId: idSchema,
  stateEpoch: number().int().nonnegative(),
  disposition: _enum(["active", "committed", "discarded", "failed"]),
  groups: array(drawingGroundingOverlayGroupSchema).max(16)
}).strict().superRefine(({ disposition, groups }, context) => {
  if (disposition === "active" && groups.length === 0) {
    context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_ACTIVE_GROUP_REQUIRED" });
  }
  if (disposition !== "active" && groups.length > 0) {
    context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_TERMINAL_GROUP_FORBIDDEN" });
  }
  const groundingIds = /* @__PURE__ */ new Set();
  const partKeys = /* @__PURE__ */ new Set();
  for (const [index, group] of groups.entries()) {
    if (groundingIds.has(group.groundingId)) {
      context.addIssue({
        code: "custom",
        path: ["groups", index, "groundingId"],
        message: "GROUNDING_ID_DUPLICATE"
      });
    }
    if (partKeys.has(group.partKey)) {
      context.addIssue({
        code: "custom",
        path: ["groups", index, "partKey"],
        message: "GROUNDING_PART_KEY_DUPLICATE"
      });
    }
    groundingIds.add(group.groundingId);
    partKeys.add(group.partKey);
  }
});
object({
  ref: drawingRefSchema,
  commands: array(workspaceCommandSchema).min(1),
  summary: string().min(1).optional()
}).strict();
const drawingPreviewSchema = object({
  version: literal(1),
  handle: idSchema,
  baseRef: drawingRefSchema,
  commands: array(workspaceCommandSchema).min(1),
  candidate: drawingWorkspaceSnapshotSchema.unwrap(),
  diff: object({
    createdNodeIds: array(idSchema),
    updatedNodeIds: array(idSchema),
    deletedNodeIds: array(idSchema)
  }).strict(),
  createdAt: number(),
  summary: string().min(1).optional()
}).strict();
discriminatedUnion("status", [
  object({ status: literal("previewed"), preview: drawingPreviewSchema }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
object({ handle: idSchema }).strict();
discriminatedUnion("status", [
  object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
const extensionOwnershipShape = {
  extensionId: idSchema,
  workflowId: idSchema,
  ref: drawingRefSchema
};
const extensionInterfaceSchema = object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
object({
  ...extensionOwnershipShape,
  targetNodeIds: array(idSchema).min(1).max(256),
  interfaces: array(extensionInterfaceSchema).max(256).optional(),
  program: spatialEditProgramSchema
}).strict();
object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema
}).strict();
object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema,
  program: spatialEditProgramSchema
}).strict();
const extensionNeedsRebaseResultSchema = object({
  status: literal("needs-rebase"),
  currentRef: drawingRefSchema
}).strict();
const extensionRejectedResultSchema = object({
  status: literal("rejected"),
  code: idSchema,
  message: string().min(1)
}).strict();
const extensionPreviewReadyResultSchema = object({
  status: literal("previewed"),
  previewToken: idSchema,
  candidateDigest: idSchema,
  ref: drawingRefSchema,
  expiresAt: number().int().nonnegative()
}).strict();
discriminatedUnion("status", [
  extensionPreviewReadyResultSchema,
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({
    status: literal("assessed"),
    previewToken: idSchema,
    candidateDigest: idSchema,
    assessment: assessmentSchema
  }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({ status: literal("finalized"), result: finalizePreviewResultSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
const annotationSessionStateSchema = object({
  version: literal(1),
  workspaceClaimed: boolean(),
  activationEpoch: number().int().nonnegative(),
  workflow: object({
    status: _enum(["idle", "running", "reviewing", "completed", "canceled", "failed", "needs-rebase"]),
    workflowId: idSchema.optional(),
    message: string().min(1).optional()
  }).strict()
}).strict();
object({
  bytes: _instanceof(Uint8Array),
  digest: idSchema,
  name: string().trim().min(1).max(255).optional()
}).strict();
const drawingObservationOverlaySchema = object({
  id: idSchema,
  label: string().trim().min(1).max(80),
  polygon: array(vec2Schema).min(3).max(16)
}).strict();
object({
  ref: drawingRefSchema,
  overlays: array(drawingObservationOverlaySchema).max(128).optional()
}).strict();
discriminatedUnion("status", [
  object({
    status: literal("rendered"),
    png: _instanceof(Uint8Array),
    contentDigest: idSchema,
    width: number().int().positive(),
    height: number().int().positive()
  }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
const drawingSessionIdSchema = string().min(1);
const partitionEvidenceSchema = object({
  id: idSchema,
  origin: _enum(["document", "geometry", "fused", "ai", "manual"]),
  label: string(),
  sourceLines: array(number().int().positive()).optional(),
  geometryNodeIds: array(idSchema).optional()
}).strict();
const partitionDiagnosticSchema = object({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string(),
  segmentIds: array(idSchema).optional(),
  evidenceIds: array(idSchema).optional()
}).strict();
const shaftAxisSchema = object({
  origin: vec2Schema,
  direction: vec2Schema,
  normal: vec2Schema,
  zMin: number(),
  zMax: number(),
  orientation: _enum(["forward", "reversed"]),
  geometryNodeIds: array(idSchema).optional()
}).strict();
const stepCandidateSchema = object({
  id: idSchema,
  z: number(),
  score: number(),
  evidenceIds: array(idSchema),
  accepted: boolean()
}).strict();
const partitionSegmentSchema = object({
  id: idSchema,
  zStart: number(),
  zEnd: number(),
  profile: object({ minRadius: number(), maxRadius: number(), sampleCount: number().int().nonnegative() }).strict(),
  semanticType: string().optional(),
  name: string().optional(),
  boundaryConfidence: number(),
  semanticConfidence: number().optional(),
  geometryNodeIds: array(idSchema),
  boundaryEvidenceIds: array(idSchema),
  semanticEvidenceIds: array(idSchema),
  diagnosticIds: array(idSchema),
  profileSamples: array(object({ z: number(), radius: number().nonnegative(), geometryNodeId: idSchema }).strict()).optional()
}).strict();
const partitionGroupSchema = object({
  id: idSchema,
  segmentIds: array(idSchema),
  range: object({ zStart: number(), zEnd: number() }).strict().optional(),
  semanticType: string(),
  name: string().optional(),
  evidenceIds: array(idSchema)
}).strict();
const partitionDraftSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  axis: shaftAxisSchema,
  segments: array(partitionSegmentSchema),
  semanticGroups: array(partitionGroupSchema),
  stepCandidates: array(stepCandidateSchema),
  evidence: array(partitionEvidenceSchema),
  diagnostics: array(partitionDiagnosticSchema),
  basePartitionRevisionId: idSchema.optional()
}).strict();
const partitionRevisionSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  axis: shaftAxisSchema,
  segments: array(partitionSegmentSchema),
  semanticGroups: array(partitionGroupSchema),
  evidence: array(partitionEvidenceSchema),
  diagnostics: array(partitionDiagnosticSchema),
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  confirmedAt: number()
}).strict();
const partitionEditCommandSchema = discriminatedUnion("type", [
  object({ type: literal("boundary.move"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive(), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("semantic-range.move"), expectedDrawingRef: drawingRefSchema, groupId: idSchema, edge: _enum(["start", "end"]), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("semantic-group.rename"), expectedDrawingRef: drawingRefSchema, groupId: idSchema, name: string().trim().min(1).max(120) }).strict(),
  object({ type: literal("segment.split"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, z: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("boundary.merge"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive() }).strict(),
  object({ type: literal("segment.metadata"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, name: string().max(120).optional(), semanticType: string().max(80).optional() }).strict()
]);
const partitionSessionSnapshotSchema = object({
  version: literal(1),
  phase: _enum(["idle", "analyzing", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema.optional(),
  draft: partitionDraftSchema.optional(),
  confirmed: partitionRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string().optional(),
  updatedAt: number()
}).strict();
const sha256DigestSchema = string().regex(/^sha256:[a-f0-9]{64}$/u);
const engineeringDocumentInputSchema = object({
  name: string().trim().min(1).max(255),
  digest: sha256DigestSchema,
  mediaType: string().trim().min(1).max(127).optional(),
  base64: string().min(1).max(27962028)
}).strict();
const partitionImportRequestSchema = object({
  dxf: object({ name: string().min(1).max(255), digest: idSchema, base64: string().min(1).max(27962028) }).strict(),
  engineeringDocuments: array(engineeringDocumentInputSchema).max(16).optional(),
  engineeringDocument: object({ name: string().min(1).max(255), text: string() }).strict().optional()
}).strict().superRefine((request, context) => {
  if (request.engineeringDocuments !== void 0 && request.engineeringDocument !== void 0) {
    context.addIssue({ code: "custom", path: ["engineeringDocuments"], message: "ENGINEERING_DOCUMENT_INPUT_AMBIGUOUS" });
  }
});
const partitionDocumentSupplementRequestSchema = object({
  expectedDrawingRef: drawingRefSchema,
  engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
const engineeringDocumentStageRequestSchema = object({
  engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
const engineeringDiagnosticSchema = object({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string(),
  entityIds: array(idSchema).optional(),
  evidenceIds: array(idSchema).optional()
}).strict();
const engineeringStateSchema = _enum(["candidate", "resolved", "confirmed", "conflict", "stale"]);
const engineeringDatumSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: string().min(1).max(120),
  geometryId: idSchema,
  anchor: entityAnchorSchema,
  labelPosition: vec2Schema.optional(),
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: _enum(["candidate", "confirmed", "conflict", "stale"]),
  evidenceIds: array(idSchema)
}).strict();
const dimensionIntentSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  kind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
  targets: array(dimensionTargetSchema),
  datumIds: array(idSchema),
  nominalValue: number().finite(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  functionalRole: _enum(["datum", "overall", "functional", "assembly", "process", "inspection", "auxiliary", "closure"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema)
}).strict();
const resolvedToleranceSchema = object({
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string().min(1).max(32).optional(),
  inputDigest: idSchema,
  evaluatedAt: number().finite()
}).strict();
const toleranceSpecSchema = object({
  id: idSchema,
  dimensionIntentId: idSchema,
  mode: _enum(["bilateral", "unilateral", "limits", "fit", "formula"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object({ id: idSchema, version: idSchema }).strict().optional(),
  inputs: record(string(), union([number().finite(), string(), boolean()])),
  resolved: resolvedToleranceSchema.optional(),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema),
  diagnostics: array(engineeringDiagnosticSchema)
}).strict();
const geometricCharacteristicSchema = _enum([
  "straightness",
  "flatness",
  "circularity",
  "cylindricity",
  "profile-line",
  "profile-surface",
  "parallelism",
  "perpendicularity",
  "angularity",
  "position",
  "coaxiality",
  "symmetry",
  "circular-runout",
  "total-runout"
]);
const materialConditionSchema = _enum(["rfs", "mmc", "lmc"]);
const geometricDatumFrameReferenceSchema = object({
  datumId: idSchema,
  materialCondition: materialConditionSchema.optional()
}).strict();
const toleranceZoneSchema = object({
  shape: _enum(["linear", "diametrical", "spherical"]),
  materialCondition: materialConditionSchema.optional(),
  projectedZoneLength: number().finite().positive().optional()
}).strict();
const geometricToleranceIntentSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  characteristic: geometricCharacteristicSchema,
  controlledTargets: array(dimensionTargetSchema),
  toleranceZone: toleranceZoneSchema,
  datumReferenceFrame: array(geometricDatumFrameReferenceSchema),
  computed: object({
    status: _enum(["pending", "resolved", "conflict", "stale"]),
    value: number().finite().positive().optional(),
    unit: literal("mm"),
    ruleRef: object({ id: idSchema, version: idSchema }).strict().optional(),
    inputDigest: idSchema.optional(),
    diagnostics: array(engineeringDiagnosticSchema)
  }).strict(),
  override: object({ value: number().finite().positive() }).strict().optional(),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: _enum(["candidate", "pending-calculation", "resolved", "confirmed", "conflict", "stale"]),
  evidenceIds: array(idSchema),
  framePosition: vec2Schema.optional()
}).strict();
const dimensionChainSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: string().max(120).optional(),
  datumIds: array(idSchema),
  members: array(object({
    dimensionIntentId: idSchema,
    coefficient: union([literal(1), literal(-1)]),
    role: _enum(["functional", "component", "closure"]),
    sequenceHint: number().int().optional()
  }).strict()),
  equation: object({
    closureIntentId: idSchema,
    targetValue: number().finite().optional()
  }).strict(),
  analysisMode: _enum(["worst-case", "statistical", "reference-only"]),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema),
  diagnostics: array(engineeringDiagnosticSchema)
}).strict();
const annotationDependencySchema = object({
  beforeIntentId: idSchema,
  afterIntentId: idSchema,
  reason: _enum(["datum-before-dependent", "overall-before-functional", "functional-before-component", "component-before-closure", "explicit-document-order"]),
  evidenceIds: array(idSchema)
}).strict();
const axialStationSchema = object({
  id: idSchema,
  coordinate: number().finite(),
  sourceCoordinate: number().finite(),
  unit: _enum(["mm", "cm", "m"]),
  kinds: array(_enum(["drawing-end", "shoulder", "partition-boundary", "datum"])),
  geometryNodeIds: array(idSchema),
  evidenceIds: array(idSchema)
}).strict();
const axialElementarySpanSchema = object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  segmentIds: array(idSchema),
  evidenceIds: array(idSchema)
}).strict();
const dimensionEvidenceSchema = object({
  id: idSchema,
  origin: _enum(["geometry", "partition", "document", "manual", "ai"]),
  kind: _enum(["drawing-end", "elementary-span", "functional-region", "document-interval", "process-envelope", "manual-requirement"]),
  label: string(),
  required: boolean(),
  sourceIds: array(idSchema)
}).strict();
const axialDimensionCandidateSchema = object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  roles: array(_enum(["overall", "composite", "functional", "process", "local", "reference", "closure"])),
  evidenceIds: array(idSchema),
  required: boolean()
}).strict();
const dimensionDecisionTraceSchema = object({
  candidateId: idSchema,
  decision: _enum(["displayed", "closure", "rejected", "alternative"]),
  score: number().finite(),
  features: array(object({
    feature: _enum(["manual-required", "document-exact", "functional-region", "process-envelope", "composite-block", "overall-root", "elementary-span", "ordinary-residual", "terminal-residual"]),
    contribution: number().finite(),
    evidenceIds: array(idSchema)
  }).strict()),
  reasonCodes: array(idSchema)
}).strict();
const axialChainNodeSchema = object({
  id: idSchema,
  parentCandidateId: idSchema,
  childCandidateIds: array(idSchema),
  closureCandidateId: idSchema,
  alternativeClosureCandidateIds: array(idSchema),
  status: _enum(["resolved", "needs-review", "conflict"])
}).strict();
const axialDimensionSchemeSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  partitionRevisionId: idSchema.optional(),
  policy: object({
    id: _enum(["shaft-hierarchical-dimensioning-v1", "shaft-reference-terminal-closure-v1"]),
    version: literal("1")
  }).strict(),
  inputDigest: idSchema,
  topology: object({
    drawingRef: drawingRefSchema,
    axis: shaftAxisSchema,
    unit: _enum(["mm", "cm", "m"]),
    stations: array(axialStationSchema),
    elementarySpans: array(axialElementarySpanSchema)
  }).strict(),
  evidence: array(dimensionEvidenceSchema),
  candidates: array(axialDimensionCandidateSchema),
  displayedCandidateIds: array(idSchema),
  closureCandidateIds: array(idSchema),
  chains: array(axialChainNodeSchema),
  layout: object({
    chainNormalOffsets: array(object({
      chainId: idSchema,
      normalOffset: number().finite()
    }).strict()).default([]),
    candidateNormalOffsets: array(object({
      candidateId: idSchema,
      normalOffset: number().finite()
    }).strict())
  }).strict().optional(),
  decisions: array(dimensionDecisionTraceSchema),
  diagnostics: array(engineeringDiagnosticSchema),
  status: _enum(["resolved", "needs-review", "conflict", "stale"])
}).strict();
const dimensionSchemeEditCommandSchema = discriminatedUnion("type", [
  object({
    type: literal("candidate.display"),
    candidateId: idSchema,
    displayed: boolean(),
    expectedDrawingRef: drawingRefSchema
  }).strict(),
  object({
    type: literal("closure.choose"),
    chainId: idSchema,
    candidateId: idSchema,
    expectedDrawingRef: drawingRefSchema
  }).strict(),
  object({
    type: literal("candidate.layout"),
    candidateId: idSchema,
    normalOffset: number().finite(),
    expectedDrawingRef: drawingRefSchema
  }).strict(),
  object({
    type: literal("chain.layout"),
    chainId: idSchema,
    normalOffset: number().finite(),
    expectedDrawingRef: drawingRefSchema
  }).strict()
]);
const geometricToleranceEditCommandSchema = discriminatedUnion("type", [
  object({ type: literal("datum.layout"), datumId: idSchema, position: vec2Schema, expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("frame.layout"), intentIds: array(idSchema).min(1), position: vec2Schema, expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("characteristic.set"), intentId: idSchema, characteristic: geometricCharacteristicSchema, expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("controlled-targets.set"), intentId: idSchema, targets: array(dimensionTargetSchema), expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("datum-frame.set"), intentId: idSchema, references: array(geometricDatumFrameReferenceSchema), expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("zone.set"), intentId: idSchema, zone: toleranceZoneSchema, expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("override.set"), intentId: idSchema, value: number().finite().positive(), expectedDrawingRef: drawingRefSchema }).strict(),
  object({ type: literal("override.clear"), intentId: idSchema, expectedDrawingRef: drawingRefSchema }).strict()
]);
const engineeringAnnotationDraftSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  datums: array(engineeringDatumSchema),
  intents: array(dimensionIntentSchema),
  tolerances: array(toleranceSpecSchema),
  geometricTolerances: array(geometricToleranceIntentSchema).default([]),
  chains: array(dimensionChainSchema),
  dependencies: array(annotationDependencySchema),
  diagnostics: array(engineeringDiagnosticSchema),
  axialScheme: axialDimensionSchemeSchema.optional(),
  baseRevisionId: idSchema.optional()
}).strict();
const engineeringAnnotationRevisionSchema = engineeringAnnotationDraftSchema.omit({
  baseRevisionId: true
}).extend({
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  generationOrder: array(idSchema),
  confirmedAt: number().finite()
}).strict();
const dimensionPlanSessionSnapshotSchema = object({
  version: literal(1),
  phase: _enum(["idle", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema.optional(),
  draft: engineeringAnnotationDraftSchema.optional(),
  confirmed: engineeringAnnotationRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string().optional(),
  updatedAt: number().finite()
}).strict();
const agentParameter = {
  name: "agent",
  wire: "agentId",
  source: "lookup",
  lookup: "agent",
  codec: {
    mode: "strict",
    typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
    schema: drawingSessionIdSchema
  }
};
const ANNOTATION_REMOTE = {
  package: "@vectorai/plugin-dsh-annotation-host",
  descriptors: [{
    id: "@vectorai/plugin-dsh-annotation-host#drawingAnnotation/getSessionState",
    service: "drawingAnnotation",
    namespace: "drawingAnnotation",
    method: "getSessionState",
    invocation: { kind: "direct" },
    scope: { context: "agent", wire: "agentId" },
    parameters: [agentParameter],
    result: {
      mode: "strict",
      typeSymbol: "@vectorai/plugin-space-contracts#AnnotationSessionState",
      schema: annotationSessionStateSchema
    }
  }, ...partitionDescriptors(), ...dimensionDescriptors()]
};
function partitionDescriptors() {
  return [
    descriptor("importDrawing", [jsonParameter("request", "@vectorai/plugin-space-contracts#PartitionImportRequest.dxf", partitionImportRequestSchema.shape.dxf)]),
    descriptor("stageDocuments", [jsonParameter("request", "@vectorai/plugin-space-contracts#EngineeringDocumentStageRequest", engineeringDocumentStageRequestSchema)]),
    descriptor("clearDocuments", []),
    descriptor("importAndAnalyze", [jsonParameter("request", "@vectorai/plugin-space-contracts#PartitionImportRequest", partitionImportRequestSchema)]),
    descriptor("supplementDocuments", [jsonParameter("request", "@vectorai/plugin-space-contracts#PartitionDocumentSupplementRequest", partitionDocumentSupplementRequestSchema)]),
    descriptor("getPartitionState", []),
    descriptor("editPartition", [jsonParameter("command", "@vectorai/plugin-space-contracts#PartitionEditCommand", partitionEditCommandSchema)]),
    descriptor("confirmPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    descriptor("cancelPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    descriptor("reopenPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    descriptor("undoPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    descriptor("redoPartition", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)])
  ];
}
function dimensionDescriptors() {
  return [
    dimensionDescriptor("getDimensionPlan", []),
    dimensionDescriptor("editDimensionScheme", [jsonParameter("command", "@vectorai/plugin-space-contracts#DimensionSchemeEditCommand", dimensionSchemeEditCommandSchema)]),
    dimensionDescriptor("editGeometricTolerance", [jsonParameter("command", "@vectorai/plugin-space-contracts#GeometricToleranceEditCommand", geometricToleranceEditCommandSchema)]),
    dimensionDescriptor("confirmDimensionPlan", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    dimensionDescriptor("cancelDimensionPlan", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    dimensionDescriptor("undoDimensionPlan", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)]),
    dimensionDescriptor("redoDimensionPlan", [jsonParameter("expected", "@vectorai/drawing-edit-protocol#DrawingRef", drawingRefSchema)])
  ];
}
function dimensionDescriptor(method, parameters) {
  return {
    id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
    service: "drawingAnnotation",
    namespace: "drawingAnnotation",
    method,
    invocation: { kind: "direct" },
    scope: { context: "agent", wire: "agentId" },
    parameters: [agentParameter, ...parameters],
    result: {
      mode: "strict",
      typeSymbol: "@vectorai/plugin-space-contracts#DimensionPlanSessionSnapshot",
      schema: dimensionPlanSessionSnapshotSchema
    }
  };
}
function descriptor(method, parameters) {
  return {
    id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
    service: "drawingAnnotation",
    namespace: "drawingAnnotation",
    method,
    invocation: { kind: "direct" },
    scope: { context: "agent", wire: "agentId" },
    parameters: [agentParameter, ...parameters],
    result: { mode: "strict", typeSymbol: "@vectorai/plugin-space-contracts#PartitionSessionSnapshot", schema: partitionSessionSnapshotSchema }
  };
}
function jsonParameter(name, typeSymbol, schema) {
  return { name, wire: name, source: "json", codec: { mode: "strict", typeSymbol, schema } };
}
const DRAWING_SURFACE_REFRESH_EVENT = "vectorai:drawing-surface-refresh";
function createPartitionController(sessionId, remoteSource) {
  let current = { partition: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null };
  const listeners = /* @__PURE__ */ new Set();
  let queue = Promise.resolve();
  let disposed = false;
  const update = (changes) => {
    if (disposed) return;
    current = { ...current, ...changes };
    for (const listener of listeners) listener();
  };
  const run = (operation, pendingPartition) => {
    const task = queue.then(async () => {
      update({
        busy: true,
        error: null,
        ...pendingPartition === void 0 ? {} : { partition: pendingPartition }
      });
      try {
        update({ partition: unwrap(await operation()) });
      } catch (error) {
        update({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        update({ busy: false });
      }
    });
    queue = task.catch(() => void 0);
    return task;
  };
  const ref = () => {
    if (!current.partition.drawingRef) throw new Error("PARTITION_DRAWING_REQUIRED");
    return current.partition.drawingRef;
  };
  const remote = () => typeof remoteSource === "function" ? remoteSource() : remoteSource;
  const edit = (command) => run(() => remote().editPartition(sessionId, { ...command, expectedDrawingRef: ref() }));
  return {
    state: {
      getSnapshot: () => current,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    },
    actions: {
      refresh: () => run(() => remote().getPartitionState(sessionId)),
      async importDrawing(dxf) {
        const request = await serializeDxf(dxf);
        await run(() => remote().importDrawing(sessionId, request));
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(
          DRAWING_SURFACE_REFRESH_EVENT,
          { detail: { sessionId } }
        ));
      },
      async stageDocuments(engineeringDocuments) {
        if (engineeringDocuments.length === 0) throw new Error("ENGINEERING_DOCUMENT_REQUIRED");
        const documents = await serializeEngineeringDocuments(engineeringDocuments);
        await run(() => remote().stageDocuments(sessionId, {
          engineeringDocuments: documents
        }));
      },
      clearDocuments: () => run(() => remote().clearDocuments(sessionId)),
      async importFiles(dxf, engineeringDocuments = []) {
        const dxfRequest = await serializeDxf(dxf);
        const documents = await serializeEngineeringDocuments(engineeringDocuments);
        const request = {
          dxf: dxfRequest,
          engineeringDocuments: documents
        };
        await run(() => remote().importAndAnalyze(sessionId, request), {
          version: 1,
          phase: "analyzing",
          canUndo: false,
          canRedo: false,
          updatedAt: Date.now()
        });
      },
      async supplementDocuments(engineeringDocuments) {
        if (engineeringDocuments.length === 0) throw new Error("ENGINEERING_DOCUMENT_REQUIRED");
        const request = {
          expectedDrawingRef: ref(),
          engineeringDocuments: await serializeEngineeringDocuments(engineeringDocuments)
        };
        await run(() => remote().supplementDocuments(sessionId, request));
      },
      moveBoundary: (boundaryIndex, requestedZ, snapTolerance) => edit({ type: "boundary.move", boundaryIndex, requestedZ, snapTolerance }),
      moveSemanticRange: (groupId, edge, requestedZ, snapTolerance) => edit({ type: "semantic-range.move", groupId, edge, requestedZ, snapTolerance }),
      renameSemanticGroup: (groupId, name) => edit({ type: "semantic-group.rename", groupId, name }),
      splitSegment: (segmentId, z, snapTolerance) => edit({ type: "segment.split", segmentId, z, snapTolerance }),
      mergeBoundary: (boundaryIndex) => edit({ type: "boundary.merge", boundaryIndex }),
      updateSegment: (segmentId, value) => edit({ type: "segment.metadata", segmentId, ...value }),
      confirm: () => run(() => remote().confirmPartition(sessionId, ref())),
      cancel: () => run(() => remote().cancelPartition(sessionId, ref())),
      reopen: () => run(() => remote().reopenPartition(sessionId, ref())),
      undo: () => run(() => remote().undoPartition(sessionId, ref())),
      redo: () => run(() => remote().redoPartition(sessionId, ref())),
      setPreviewHeld: (previewHeld) => update({ previewHeld })
    },
    dispose() {
      disposed = true;
      listeners.clear();
    }
  };
}
function unwrap(result) {
  if (result.ok !== true) throw new Error(result.error.message);
  return structuredClone(result.value);
}
function hex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function base64(bytes) {
  let binary = "";
  const size = 32768;
  for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size));
  return btoa(binary);
}
async function serializeDxf(dxf) {
  if (dxf.size > ENGINEERING_IMPORT_LIMITS.maxDxfBytes) throw new Error("DXF_SIZE_LIMIT");
  const bytes = new Uint8Array(await dxf.arrayBuffer());
  return { name: dxf.name, digest: `sha256:${hex(await crypto.subtle.digest("SHA-256", bytes))}`, base64: base64(bytes) };
}
async function serializeEngineeringDocuments(files) {
  validateEngineeringDocumentFiles(files);
  return Promise.all(files.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      name: file.name,
      digest: `sha256:${hex(await crypto.subtle.digest("SHA-256", bytes))}`,
      ...file.type === "" ? {} : { mediaType: file.type },
      base64: base64(bytes)
    };
  }));
}
function apply() {
}
export {
  ANNOTATION_REMOTE,
  AnnotationWorkspace,
  DimensionPlanInspector,
  apply,
  createAnnotationRemoteStateSource,
  createPartitionController
};

import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _typeof from "@babel/runtime/helpers/typeof";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import { renderElementToContainer } from "./shadow";
import { syncUrlToWindow } from "./sync";
import { fixElementCtrSrcOrHref, isConstructable, anchorElementGenerator, isMatchSyncQueryById, warn, error, execHooks, getCurUrl, getAbsolutePath, setAttrsToElement, setTagToScript, getTagFromScript } from "./utils";
import { documentProxyProperties, rawAddEventListener, rawRemoveEventListener, rawDocumentQuerySelector, mainDocumentAddEventListenerEvents, mainAndAppAddEventListenerEvents, appDocumentAddEventListenerEvents, appDocumentOnEvents, appWindowAddEventListenerEvents, appWindowOnEvent, windowProxyProperties, windowRegWhiteList, rawWindowAddEventListener, rawWindowRemoveEventListener } from "./common";
import { getJsLoader } from "./plugin";
import { WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, WUJIE_DATA_FLAG } from "./constant";
/**
 * 修改window对象的事件监听，只有路由事件采用iframe的事件
 */
function patchIframeEvents(iframeWindow) {
  iframeWindow.__WUJIE_EVENTLISTENER__ = iframeWindow.__WUJIE_EVENTLISTENER__ || new Set();
  iframeWindow.addEventListener = function addEventListener(type, listener, options) {
    // 运行插件钩子函数
    execHooks(iframeWindow.__WUJIE.plugins, "windowAddEventListenerHook", iframeWindow, type, listener, options);
    // 相同参数多次调用 addEventListener 不会导致重复注册，所以用set。
    iframeWindow.__WUJIE_EVENTLISTENER__.add({
      type: type,
      listener: listener,
      options: options
    });
    if (appWindowAddEventListenerEvents.includes(type) || _typeof(options) === "object" && options.targetWindow) {
      var targetWindow = _typeof(options) === "object" && options.targetWindow ? options === null || options === void 0 ? void 0 : options.targetWindow : iframeWindow;
      return rawWindowAddEventListener.call(targetWindow, type, listener, options);
    }
    // 在子应用嵌套场景使用window.window获取真实window
    rawWindowAddEventListener.call(window.__WUJIE_RAW_WINDOW__ || window, type, listener, options);
  };
  iframeWindow.removeEventListener = function removeEventListener(type, listener, options) {
    // 运行插件钩子函数
    execHooks(iframeWindow.__WUJIE.plugins, "windowRemoveEventListenerHook", iframeWindow, type, listener, options);
    iframeWindow.__WUJIE_EVENTLISTENER__.forEach(function (o) {
      // 这里严格一点，确保子应用销毁的时候都能销毁
      if (o.listener === listener && o.type === type && options == o.options) {
        iframeWindow.__WUJIE_EVENTLISTENER__["delete"](o);
      }
    });
    if (appWindowAddEventListenerEvents.includes(type) || _typeof(options) === "object" && options.targetWindow) {
      var targetWindow = _typeof(options) === "object" && options.targetWindow ? options === null || options === void 0 ? void 0 : options.targetWindow : iframeWindow;
      return rawWindowRemoveEventListener.call(targetWindow, type, listener, options);
    }
    rawWindowRemoveEventListener.call(window.__WUJIE_RAW_WINDOW__ || window, type, listener, options);
  };
}
function patchIframeVariable(iframeWindow, wujie, appHostPath) {
  iframeWindow.__WUJIE = wujie;
  iframeWindow.__WUJIE_PUBLIC_PATH__ = appHostPath + "/";
  iframeWindow.$wujie = wujie.provide;
  iframeWindow.__WUJIE_RAW_WINDOW__ = iframeWindow;
}

/**
 * 对iframe的history的pushState和replaceState进行修改
 * 将从location劫持后的数据修改回来，防止跨域错误
 * 同步路由到主应用
 * @param iframeWindow
 * @param appHostPath 子应用的 host path
 * @param mainHostPath 主应用的 host path
 */
function patchIframeHistory(iframeWindow, appHostPath, mainHostPath) {
  var history = iframeWindow.history;
  var rawHistoryPushState = history.pushState;
  var rawHistoryReplaceState = history.replaceState;
  history.pushState = function (data, title, url) {
    var baseUrl = mainHostPath + iframeWindow.location.pathname + iframeWindow.location.search + iframeWindow.location.hash;
    var mainUrl = getAbsolutePath(url === null || url === void 0 ? void 0 : url.replace(appHostPath, ""), baseUrl);
    var ignoreFlag = url === undefined;
    rawHistoryPushState.call(history, data, title, ignoreFlag ? undefined : mainUrl);
    if (ignoreFlag) return;
    updateBase(iframeWindow, appHostPath, mainHostPath);
    syncUrlToWindow(iframeWindow);
  };
  history.replaceState = function (data, title, url) {
    var baseUrl = mainHostPath + iframeWindow.location.pathname + iframeWindow.location.search + iframeWindow.location.hash;
    var mainUrl = getAbsolutePath(url === null || url === void 0 ? void 0 : url.replace(appHostPath, ""), baseUrl);
    var ignoreFlag = url === undefined;
    rawHistoryReplaceState.call(history, data, title, ignoreFlag ? undefined : mainUrl);
    if (ignoreFlag) return;
    updateBase(iframeWindow, appHostPath, mainHostPath);
    syncUrlToWindow(iframeWindow);
  };
}

/**
 * 动态的修改iframe的base地址
 * @param iframeWindow
 * @param appHostPath
 * @param mainHostPath
 */
function updateBase(iframeWindow, appHostPath, mainHostPath) {
  var _iframeWindow$locatio;
  var baseUrl = new URL((_iframeWindow$locatio = iframeWindow.location.href) === null || _iframeWindow$locatio === void 0 ? void 0 : _iframeWindow$locatio.replace(mainHostPath, ""), appHostPath);
  var baseElement = rawDocumentQuerySelector.call(iframeWindow.document, "base");
  if (baseElement) baseElement.setAttribute("href", appHostPath + baseUrl.pathname);
}

/**
 * patch iframe window effect
 * @param iframeWindow
 */
// TODO 继续改进
function patchWindowEffect(iframeWindow) {
  // 属性处理函数
  function processWindowProperty(key) {
    var value = iframeWindow[key];
    try {
      if (typeof value === "function" && !isConstructable(value)) {
        iframeWindow[key] = window[key].bind(window);
      } else {
        iframeWindow[key] = window[key];
      }
      return true;
    } catch (e) {
      warn(e.message);
      return false;
    }
  }
  Object.getOwnPropertyNames(iframeWindow).forEach(function (key) {
    // 特殊处理
    if (key === "getSelection") {
      Object.defineProperty(iframeWindow, key, {
        get: function get() {
          return iframeWindow.document[key];
        }
      });
      return;
    }
    // 单独属性
    if (windowProxyProperties.includes(key)) {
      processWindowProperty(key);
      return;
    }
    // 正则匹配，可以一次处理多个
    windowRegWhiteList.some(function (reg) {
      if (reg.test(key) && key in iframeWindow.parent) {
        return processWindowProperty(key);
      }
      return false;
    });
  });
  // onEvent set
  var windowOnEvents = Object.getOwnPropertyNames(window).filter(function (p) {
    return /^on/.test(p);
  }).filter(function (e) {
    return !appWindowOnEvent.includes(e);
  });

  // 走主应用window
  windowOnEvents.forEach(function (e) {
    var descriptor = Object.getOwnPropertyDescriptor(iframeWindow, e) || {
      enumerable: true,
      writable: true
    };
    try {
      Object.defineProperty(iframeWindow, e, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: function get() {
          return window[e];
        },
        set: descriptor.writable || descriptor.set ? function (handler) {
          window[e] = typeof handler === "function" ? handler.bind(iframeWindow) : handler;
        } : undefined
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // 运行插件钩子函数
  execHooks(iframeWindow.__WUJIE.plugins, "windowPropertyOverride", iframeWindow);
}

/**
 * 记录节点的监听事件
 */
function recordEventListeners(iframeWindow) {
  var sandbox = iframeWindow.__WUJIE;
  iframeWindow.Node.prototype.addEventListener = function (type, handler, options) {
    // 添加事件缓存
    var elementListenerList = sandbox.elementEventCacheMap.get(this);
    if (elementListenerList) {
      if (!elementListenerList.find(function (listener) {
        return listener.type === type && listener.handler === handler;
      })) {
        elementListenerList.push({
          type: type,
          handler: handler,
          options: options
        });
      }
    } else sandbox.elementEventCacheMap.set(this, [{
      type: type,
      handler: handler,
      options: options
    }]);
    return rawAddEventListener.call(this, type, handler, options);
  };
  iframeWindow.Node.prototype.removeEventListener = function (type, handler, options) {
    // 清除缓存
    var elementListenerList = sandbox.elementEventCacheMap.get(this);
    if (elementListenerList) {
      var index = elementListenerList === null || elementListenerList === void 0 ? void 0 : elementListenerList.findIndex(function (ele) {
        return ele.type === type && ele.handler === handler;
      });
      elementListenerList.splice(index, 1);
    }
    if (!(elementListenerList !== null && elementListenerList !== void 0 && elementListenerList.length)) {
      sandbox.elementEventCacheMap["delete"](this);
    }
    return rawRemoveEventListener.call(this, type, handler, options);
  };
}

/**
 * 恢复节点的监听事件
 */
export function recoverEventListeners(rootElement, iframeWindow) {
  var sandbox = iframeWindow.__WUJIE;
  var elementEventCacheMap = new WeakMap();
  var ElementIterator = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, null, false);
  var nextElement = ElementIterator.currentNode;
  while (nextElement) {
    var elementListenerList = sandbox.elementEventCacheMap.get(nextElement);
    if (elementListenerList !== null && elementListenerList !== void 0 && elementListenerList.length) {
      elementEventCacheMap.set(nextElement, elementListenerList);
      elementListenerList.forEach(function (listener) {
        nextElement.addEventListener(listener.type, listener.handler, listener.options);
      });
    }
    nextElement = ElementIterator.nextNode();
  }
  sandbox.elementEventCacheMap = elementEventCacheMap;
}

/**
 * 恢复根节点的监听事件
 */
export function recoverDocumentListeners(oldRootElement, newRootElement, iframeWindow) {
  var sandbox = iframeWindow.__WUJIE;
  var elementEventCacheMap = new WeakMap();
  var elementListenerList = sandbox.elementEventCacheMap.get(oldRootElement);
  if (elementListenerList !== null && elementListenerList !== void 0 && elementListenerList.length) {
    elementEventCacheMap.set(newRootElement, elementListenerList);
    elementListenerList.forEach(function (listener) {
      newRootElement.addEventListener(listener.type, listener.handler, listener.options);
    });
  }
  sandbox.elementEventCacheMap = elementEventCacheMap;
}

/**
 * 修复vue绑定事件e.timeStamp < attachedTimestamp 的情况
 */
export function patchEventTimeStamp(targetWindow, iframeWindow) {
  Object.defineProperty(targetWindow.Event.prototype, "timeStamp", {
    get: function get() {
      return iframeWindow.document.createEvent("Event").timeStamp;
    }
  });
}

/**
 * patch document effect
 * @param iframeWindow
 */
// TODO 继续改进
function patchDocumentEffect(iframeWindow) {
  var sandbox = iframeWindow.__WUJIE;

  /**
   * 处理 addEventListener和removeEventListener
   * 由于这个劫持导致 handler 的this发生改变，所以需要handler.bind(document)
   * 但是这样会导致removeEventListener无法正常工作，因为handler => handler.bind(document)
   * 这个地方保存callback = handler.bind(document) 方便removeEventListener
   */
  var handlerCallbackMap = new WeakMap();
  var handlerTypeMap = new WeakMap();
  iframeWindow.Document.prototype.addEventListener = function (type, handler, options) {
    if (!handler) return;
    var callback = handlerCallbackMap.get(handler);
    var typeList = handlerTypeMap.get(handler);
    // 设置 handlerCallbackMap
    if (!callback) {
      callback = typeof handler === "function" ? handler.bind(this) : handler;
      handlerCallbackMap.set(handler, callback);
    }
    // 设置 handlerTypeMap
    if (typeList) {
      if (!typeList.includes(type)) typeList.push(type);
    } else {
      handlerTypeMap.set(handler, [type]);
    }

    // 运行插件钩子函数
    execHooks(iframeWindow.__WUJIE.plugins, "documentAddEventListenerHook", iframeWindow, type, callback, options);
    if (appDocumentAddEventListenerEvents.includes(type)) {
      return rawAddEventListener.call(this, type, callback, options);
    }
    // 降级统一走 sandbox.document
    if (sandbox.degrade) return sandbox.document.addEventListener(type, callback, options);
    if (mainDocumentAddEventListenerEvents.includes(type)) return window.document.addEventListener(type, callback, options);
    if (mainAndAppAddEventListenerEvents.includes(type)) {
      window.document.addEventListener(type, callback, options);
      sandbox.shadowRoot.addEventListener(type, callback, options);
      return;
    }
    sandbox.shadowRoot.addEventListener(type, callback, options);
  };
  iframeWindow.Document.prototype.removeEventListener = function (type, handler, options) {
    var callback = handlerCallbackMap.get(handler);
    var typeList = handlerTypeMap.get(handler);
    if (callback) {
      if (typeList !== null && typeList !== void 0 && typeList.includes(type)) {
        typeList.splice(typeList.indexOf(type), 1);
        if (!typeList.length) {
          handlerCallbackMap["delete"](handler);
          handlerTypeMap["delete"](handler);
        }
      }

      // 运行插件钩子函数
      execHooks(iframeWindow.__WUJIE.plugins, "documentRemoveEventListenerHook", iframeWindow, type, callback, options);
      if (appDocumentAddEventListenerEvents.includes(type)) {
        return rawRemoveEventListener.call(this, type, callback, options);
      }
      if (sandbox.degrade) return sandbox.document.removeEventListener(type, callback, options);
      if (mainDocumentAddEventListenerEvents.includes(type)) {
        return window.document.removeEventListener(type, callback, options);
      }
      if (mainAndAppAddEventListenerEvents.includes(type)) {
        window.document.removeEventListener(type, callback, options);
        sandbox.shadowRoot.removeEventListener(type, callback, options);
        return;
      }
      sandbox.shadowRoot.removeEventListener(type, callback, options);
    }
  };
  // 处理onEvent
  var elementOnEvents = Object.keys(iframeWindow.HTMLElement.prototype).filter(function (ele) {
    return /^on/.test(ele);
  });
  var documentOnEvent = Object.keys(iframeWindow.Document.prototype).filter(function (ele) {
    return /^on/.test(ele);
  }).filter(function (ele) {
    return !appDocumentOnEvents.includes(ele);
  });
  elementOnEvents.filter(function (e) {
    return documentOnEvent.includes(e);
  }).forEach(function (e) {
    var descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, e) || {
      enumerable: true,
      writable: true
    };
    try {
      Object.defineProperty(iframeWindow.Document.prototype, e, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: function get() {
          return sandbox.degrade ? sandbox.document[e] : sandbox.shadowRoot.firstElementChild[e];
        },
        set: descriptor.writable || descriptor.set ? function (handler) {
          var val = typeof handler === "function" ? handler.bind(iframeWindow.document) : handler;
          sandbox.degrade ? sandbox.document[e] = val : sandbox.shadowRoot.firstElementChild[e] = val;
        } : undefined
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // 处理属性get
  var ownerProperties = documentProxyProperties.ownerProperties,
    modifyProperties = documentProxyProperties.modifyProperties,
    shadowProperties = documentProxyProperties.shadowProperties,
    shadowMethods = documentProxyProperties.shadowMethods,
    documentProperties = documentProxyProperties.documentProperties,
    documentMethods = documentProxyProperties.documentMethods,
    documentEvents = documentProxyProperties.documentEvents;
  modifyProperties.concat(shadowProperties, shadowMethods, documentProperties, documentMethods).forEach(function (propKey) {
    var descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, propKey) || {
      enumerable: true,
      writable: true
    };
    try {
      Object.defineProperty(iframeWindow.Document.prototype, propKey, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: function get() {
          return sandbox.proxyDocument[propKey];
        },
        set: undefined
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // 处理document专属事件
  // TODO 内存泄露
  documentEvents.forEach(function (propKey) {
    var descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, propKey) || {
      enumerable: true,
      writable: true
    };
    try {
      Object.defineProperty(iframeWindow.Document.prototype, propKey, {
        enumerable: descriptor.enumerable,
        configurable: true,
        get: function get() {
          return (sandbox.degrade ? sandbox : window).document[propKey];
        },
        set: descriptor.writable || descriptor.set ? function (handler) {
          (sandbox.degrade ? sandbox : window).document[propKey] = typeof handler === "function" ? handler.bind(iframeWindow.document) : handler;
        } : undefined
      });
    } catch (e) {
      warn(e.message);
    }
  });
  // process owner property
  ownerProperties.forEach(function (propKey) {
    Object.defineProperty(iframeWindow.document, propKey, {
      enumerable: true,
      configurable: true,
      get: function get() {
        return sandbox.proxyDocument[propKey];
      },
      set: undefined
    });
  });
  // 运行插件钩子函数
  execHooks(iframeWindow.__WUJIE.plugins, "documentPropertyOverride", iframeWindow);
}

/**
 * patch Node effect
 * 1、处理 getRootNode
 * 2、处理 appendChild、insertBefore，当插入的节点为 svg 时，createElement 的 patch 会被去除，需要重新 patch
 * @param iframeWindow
 */
function patchNodeEffect(iframeWindow) {
  var rawGetRootNode = iframeWindow.Node.prototype.getRootNode;
  var rawAppendChild = iframeWindow.Node.prototype.appendChild;
  var rawInsertRule = iframeWindow.Node.prototype.insertBefore;
  iframeWindow.Node.prototype.getRootNode = function (options) {
    var rootNode = rawGetRootNode.call(this, options);
    if (rootNode === iframeWindow.__WUJIE.shadowRoot) return iframeWindow.document;else return rootNode;
  };
  iframeWindow.Node.prototype.appendChild = function (node) {
    var res = rawAppendChild.call(this, node);
    patchElementEffect(node, iframeWindow);
    return res;
  };
  iframeWindow.Node.prototype.insertBefore = function (node, child) {
    var res = rawInsertRule.call(this, node, child);
    patchElementEffect(node, iframeWindow);
    return res;
  };
}

/**
 * 修复资源元素的相对路径问题
 * @param iframeWindow
 */
function patchRelativeUrlEffect(iframeWindow) {
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLImageElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLAnchorElement, "href");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLSourceElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLLinkElement, "href");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLScriptElement, "src");
  fixElementCtrSrcOrHref(iframeWindow, iframeWindow.HTMLMediaElement, "src");
}

/**
 * 初始化base标签
 */
export function initBase(iframeWindow, url) {
  var iframeDocument = iframeWindow.document;
  var baseElement = iframeDocument.createElement("base");
  var iframeUrlElement = anchorElementGenerator(iframeWindow.location.href);
  var appUrlElement = anchorElementGenerator(url);
  baseElement.setAttribute("href", appUrlElement.protocol + "//" + appUrlElement.host + iframeUrlElement.pathname);
  iframeDocument.head.appendChild(baseElement);
}

/**
 * 初始化iframe的dom结构
 * @param iframeWindow
 * @param wujie
 * @param mainHostPath
 * @param appHostPath
 */
function initIframeDom(iframeWindow, wujie, mainHostPath, appHostPath) {
  var iframeDocument = iframeWindow.document;
  var newDoc = window.document.implementation.createHTMLDocument("");
  var newDocumentElement = iframeDocument.importNode(newDoc.documentElement, true);
  iframeDocument.documentElement ? iframeDocument.replaceChild(newDocumentElement, iframeDocument.documentElement) : iframeDocument.appendChild(newDocumentElement);
  iframeWindow.__WUJIE_RAW_DOCUMENT_HEAD__ = iframeDocument.head;
  iframeWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__ = iframeWindow.Document.prototype.querySelector;
  iframeWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__ = iframeWindow.Document.prototype.querySelectorAll;
  iframeWindow.__WUJIE_RAW_DOCUMENT_CREATE_ELEMENT__ = iframeWindow.Document.prototype.createElement;
  iframeWindow.__WUJIE_RAW_DOCUMENT_CREATE_TEXT_NODE__ = iframeWindow.Document.prototype.createTextNode;
  initBase(iframeWindow, wujie.url);
  patchIframeHistory(iframeWindow, appHostPath, mainHostPath);
  patchIframeEvents(iframeWindow);
  if (wujie.degrade) recordEventListeners(iframeWindow);
  syncIframeUrlToWindow(iframeWindow);
  patchWindowEffect(iframeWindow);
  patchDocumentEffect(iframeWindow);
  patchNodeEffect(iframeWindow);
  patchRelativeUrlEffect(iframeWindow);
}

/**
 * 防止运行主应用的js代码，给子应用带来很多副作用
 */
// TODO 更加准确抓取停止时机
function stopIframeLoading(iframeWindow) {
  var oldDoc = iframeWindow.document;
  return new Promise(function (resolve) {
    function loop() {
      setTimeout(function () {
        var newDoc;
        try {
          newDoc = iframeWindow.document;
        } catch (err) {
          newDoc = null;
        }
        // wait for document ready
        if (!newDoc || newDoc == oldDoc) {
          loop();
        } else {
          iframeWindow.stop ? iframeWindow.stop() : iframeWindow.document.execCommand("Stop");
          resolve();
        }
      }, 1);
    }
    loop();
  });
}
export function patchElementEffect(element, iframeWindow) {
  var proxyLocation = iframeWindow.__WUJIE.proxyLocation;
  if (element._hasPatch) return;
  try {
    Object.defineProperties(element, {
      baseURI: {
        configurable: true,
        get: function get() {
          return proxyLocation.protocol + "//" + proxyLocation.host + proxyLocation.pathname;
        },
        set: undefined
      },
      ownerDocument: {
        configurable: true,
        get: function get() {
          return iframeWindow.document;
        }
      },
      _hasPatch: {
        get: function get() {
          return true;
        }
      }
    });
  } catch (error) {
    console.warn(error);
  }
  execHooks(iframeWindow.__WUJIE.plugins, "patchElementHook", element, iframeWindow);
}

/**
 * 子应用前进后退，同步路由到主应用
 * @param iframeWindow
 */
export function syncIframeUrlToWindow(iframeWindow) {
  iframeWindow.addEventListener("hashchange", function () {
    return syncUrlToWindow(iframeWindow);
  });
  iframeWindow.addEventListener("popstate", function () {
    syncUrlToWindow(iframeWindow);
  });
}

/**
 * iframe插入脚本
 * @param scriptResult script请求结果
 * @param iframeWindow
 * @param rawElement 原始的脚本
 */
export function insertScriptToIframe(scriptResult, iframeWindow, rawElement) {
  var _ref = scriptResult,
    src = _ref.src,
    module = _ref.module,
    content = _ref.content,
    crossorigin = _ref.crossorigin,
    crossoriginType = _ref.crossoriginType,
    async = _ref.async,
    attrs = _ref.attrs,
    callback = _ref.callback,
    onload = _ref.onload;
  var scriptElement = iframeWindow.document.createElement("script");
  var nextScriptElement = iframeWindow.document.createElement("script");
  var _iframeWindow$__WUJIE = iframeWindow.__WUJIE,
    replace = _iframeWindow$__WUJIE.replace,
    plugins = _iframeWindow$__WUJIE.plugins,
    proxyLocation = _iframeWindow$__WUJIE.proxyLocation;
  var jsLoader = getJsLoader({
    plugins: plugins,
    replace: replace
  });
  var code = jsLoader(content, src, getCurUrl(proxyLocation));
  // 添加属性
  attrs && Object.keys(attrs).filter(function (key) {
    return !Object.keys(scriptResult).includes(key);
  }).forEach(function (key) {
    return scriptElement.setAttribute(key, String(attrs[key]));
  });

  // 内联脚本
  if (content) {
    // patch location
    if (!iframeWindow.__WUJIE.degrade && !module) {
      code = "(function(window, self, global, location) {\n      ".concat(code, "\n}).bind(window.__WUJIE.proxy)(\n  window.__WUJIE.proxy,\n  window.__WUJIE.proxy,\n  window.__WUJIE.proxy,\n  window.__WUJIE.proxyLocation,\n);");
    }
    var descriptor = Object.getOwnPropertyDescriptor(scriptElement, "src");
    // 部分浏览器 src 不可配置 取不到descriptor表示无该属性，可写
    if (descriptor !== null && descriptor !== void 0 && descriptor.configurable || !descriptor) {
      // 解决 webpack publicPath 为 auto 无法加载资源的问题
      try {
        Object.defineProperty(scriptElement, "src", {
          get: function get() {
            return src || "";
          }
        });
      } catch (error) {
        console.warn(error);
      }
    }
  } else {
    src && scriptElement.setAttribute("src", src);
    crossorigin && scriptElement.setAttribute("crossorigin", crossoriginType);
  }
  module && scriptElement.setAttribute("type", "module");
  scriptElement.textContent = code || "";
  nextScriptElement.textContent = "if(window.__WUJIE.execQueue && window.__WUJIE.execQueue.length){ window.__WUJIE.execQueue.shift()()}";
  var container = rawDocumentQuerySelector.call(iframeWindow.document, "head");
  var execNextScript = function execNextScript() {
    return !async && container.appendChild(nextScriptElement);
  };
  var afterExecScript = function afterExecScript() {
    onload === null || onload === void 0 || onload();
    execNextScript();
  };

  // 错误情况处理
  if (/^<!DOCTYPE html/i.test(code)) {
    error(WUJIE_TIPS_SCRIPT_ERROR_REQUESTED, scriptResult);
    return execNextScript();
  }

  // 打标记
  if (rawElement) {
    setTagToScript(scriptElement, getTagFromScript(rawElement));
  }
  // 外联脚本执行后的处理
  var isOutlineScript = !content && src;
  if (isOutlineScript) {
    scriptElement.onload = afterExecScript;
    scriptElement.onerror = afterExecScript;
  }
  container.appendChild(scriptElement);

  // 调用回调
  callback === null || callback === void 0 || callback(iframeWindow);
  // 执行 hooks
  execHooks(plugins, "appendOrInsertElementHook", scriptElement, iframeWindow, rawElement);
  // 内联脚本执行后的处理
  !isOutlineScript && afterExecScript();
}

/**
 * 加载iframe替换子应用
 * @param src 地址
 * @param element
 * @param degradeAttrs
 */
export function renderIframeReplaceApp(src, element) {
  var degradeAttrs = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var iframe = window.document.createElement("iframe");
  var defaultStyle = "height:100%;width:100%";
  setAttrsToElement(iframe, _objectSpread(_objectSpread({}, degradeAttrs), {}, {
    src: src,
    style: [defaultStyle, degradeAttrs.style].join(";")
  }));
  renderElementToContainer(iframe, element);
}

/**
 * js沙箱
 * 创建和主应用同源的iframe，路径携带了子路由的路由信息
 * iframe必须禁止加载html，防止进入主应用的路由逻辑
 */
export function iframeGenerator(sandbox, attrs, mainHostPath, appHostPath, appRoutePath) {
  var iframe = window.document.createElement("iframe");
  var attrsMerge = _objectSpread(_objectSpread({
    src: mainHostPath,
    style: "display: none"
  }, attrs), {}, _defineProperty({
    name: sandbox.id
  }, WUJIE_DATA_FLAG, ""));
  setAttrsToElement(iframe, attrsMerge);
  window.document.body.appendChild(iframe);
  var iframeWindow = iframe.contentWindow;
  // 变量需要提前注入，在入口函数通过变量防止死循环
  patchIframeVariable(iframeWindow, sandbox, appHostPath);
  sandbox.iframeReady = stopIframeLoading(iframeWindow).then(function () {
    if (!iframeWindow.__WUJIE) {
      patchIframeVariable(iframeWindow, sandbox, appHostPath);
    }
    initIframeDom(iframeWindow, sandbox, mainHostPath, appHostPath);
    /**
     * 如果有同步优先同步，非同步从url读取
     */
    if (!isMatchSyncQueryById(iframeWindow.__WUJIE.id)) {
      iframeWindow.history.replaceState(null, "", mainHostPath + appRoutePath);
    }
  });
  return iframe;
}
//# sourceMappingURL=iframe.js.map
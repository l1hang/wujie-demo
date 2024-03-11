import _toConsumableArray from "@babel/runtime/helpers/toConsumableArray";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _slicedToArray from "@babel/runtime/helpers/slicedToArray";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import { getExternalStyleSheets, getExternalScripts } from "./entry";
import { getWujieById, rawAppendChild, rawElementContains, rawElementRemoveChild, rawHeadInsertBefore, rawBodyInsertBefore, rawDocumentQuerySelector, rawAddEventListener, rawRemoveEventListener } from "./common";
import { isFunction, isHijackingTag, warn, nextTick, getCurUrl, execHooks, isScriptElement, setTagToScript, getTagFromScript, setAttrsToElement } from "./utils";
import { insertScriptToIframe, patchElementEffect } from "./iframe";
import { getPatchStyleElements } from "./shadow";
import { getCssLoader, getEffectLoaders, isMatchUrl } from "./plugin";
import { WUJIE_SCRIPT_ID, WUJIE_DATA_FLAG, WUJIE_TIPS_REPEAT_RENDER, WUJIE_TIPS_NO_SCRIPT } from "./constant";
import { parseTagAttributes } from "./template";
function patchCustomEvent(e, elementGetter) {
  Object.defineProperties(e, {
    srcElement: {
      get: elementGetter
    },
    target: {
      get: elementGetter
    }
  });
  return e;
}

/**
 * 手动触发事件回调
 */
function manualInvokeElementEvent(element, event) {
  var customEvent = new CustomEvent(event);
  var patchedEvent = patchCustomEvent(customEvent, function () {
    return element;
  });
  if (isFunction(element["on".concat(event)])) {
    element["on".concat(event)](patchedEvent);
  } else {
    element.dispatchEvent(patchedEvent);
  }
}

/**
 * 样式元素的css变量处理，每个stylesheetElement单独节流
 */
function handleStylesheetElementPatch(stylesheetElement, sandbox) {
  if (!stylesheetElement.innerHTML || sandbox.degrade) return;
  var patcher = function patcher() {
    var _getPatchStyleElement = getPatchStyleElements([stylesheetElement.sheet]),
      _getPatchStyleElement2 = _slicedToArray(_getPatchStyleElement, 2),
      hostStyleSheetElement = _getPatchStyleElement2[0],
      fontStyleSheetElement = _getPatchStyleElement2[1];
    if (hostStyleSheetElement) {
      sandbox.shadowRoot.head.appendChild(hostStyleSheetElement);
    }
    if (fontStyleSheetElement) {
      sandbox.shadowRoot.host.appendChild(fontStyleSheetElement);
    }
    stylesheetElement._patcher = undefined;
  };
  if (stylesheetElement._patcher) {
    clearTimeout(stylesheetElement._patcher);
  }
  stylesheetElement._patcher = setTimeout(patcher, 50);
}

/**
 * 劫持处理样式元素的属性
 */
function patchStylesheetElement(stylesheetElement, cssLoader, sandbox, curUrl) {
  var _stylesheetElement$sh;
  if (stylesheetElement._hasPatchStyle) return;
  var innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  var innerTextDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "innerText");
  var textContentDesc = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  var RawInsertRule = (_stylesheetElement$sh = stylesheetElement.sheet) === null || _stylesheetElement$sh === void 0 ? void 0 : _stylesheetElement$sh.insertRule;
  // 这个地方将cssRule加到innerHTML中去，防止子应用切换之后丢失
  function patchSheetInsertRule() {
    if (!RawInsertRule) return;
    stylesheetElement.sheet.insertRule = function (rule, index) {
      innerHTMLDesc ? stylesheetElement.innerHTML += rule : stylesheetElement.innerText += rule;
      return RawInsertRule.call(stylesheetElement.sheet, rule, index);
    };
  }
  patchSheetInsertRule();
  if (innerHTMLDesc) {
    Object.defineProperties(stylesheetElement, {
      innerHTML: {
        get: function get() {
          return innerHTMLDesc.get.call(stylesheetElement);
        },
        set: function set(code) {
          var _this = this;
          innerHTMLDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
          nextTick(function () {
            return handleStylesheetElementPatch(_this, sandbox);
          });
        }
      }
    });
  }
  Object.defineProperties(stylesheetElement, {
    innerText: {
      get: function get() {
        return innerTextDesc.get.call(stylesheetElement);
      },
      set: function set(code) {
        var _this2 = this;
        innerTextDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
        nextTick(function () {
          return handleStylesheetElementPatch(_this2, sandbox);
        });
      }
    },
    textContent: {
      get: function get() {
        return textContentDesc.get.call(stylesheetElement);
      },
      set: function set(code) {
        var _this3 = this;
        textContentDesc.set.call(stylesheetElement, cssLoader(code, "", curUrl));
        nextTick(function () {
          return handleStylesheetElementPatch(_this3, sandbox);
        });
      }
    },
    appendChild: {
      value: function value(node) {
        var _this4 = this;
        nextTick(function () {
          return handleStylesheetElementPatch(_this4, sandbox);
        });
        if (node.nodeType === Node.TEXT_NODE) {
          var res = rawAppendChild.call(stylesheetElement, stylesheetElement.ownerDocument.createTextNode(cssLoader(node.textContent, "", curUrl)));
          // 当appendChild之后，样式元素的sheet对象发生改变，要重新patch
          patchSheetInsertRule();
          return res;
        } else return rawAppendChild(node);
      }
    },
    _hasPatchStyle: {
      get: function get() {
        return true;
      }
    }
  });
}
var dynamicScriptExecStack = Promise.resolve();
function rewriteAppendOrInsertChild(opts) {
  return function appendChildOrInsertBefore(newChild, refChild) {
    var _this5 = this;
    var element = newChild;
    var rawDOMAppendOrInsertBefore = opts.rawDOMAppendOrInsertBefore,
      wujieId = opts.wujieId;
    var sandbox = getWujieById(wujieId);
    var styleSheetElements = sandbox.styleSheetElements,
      replace = sandbox.replace,
      fetch = sandbox.fetch,
      plugins = sandbox.plugins,
      iframe = sandbox.iframe,
      lifecycles = sandbox.lifecycles,
      proxyLocation = sandbox.proxyLocation,
      fiber = sandbox.fiber;
    if (!isHijackingTag(element.tagName) || !wujieId) {
      var res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
      patchElementEffect(element, iframe.contentWindow);
      execHooks(plugins, "appendOrInsertElementHook", element, iframe.contentWindow);
      return res;
    }
    var iframeDocument = iframe.contentDocument;
    var curUrl = getCurUrl(proxyLocation);

    // TODO 过滤可以开放
    if (element.tagName) {
      var _element$tagName;
      switch ((_element$tagName = element.tagName) === null || _element$tagName === void 0 ? void 0 : _element$tagName.toUpperCase()) {
        case "LINK":
          {
            var _ref = element,
              href = _ref.href,
              rel = _ref.rel,
              type = _ref.type;
            var styleFlag = rel === "stylesheet" || type === "text/css" || href.endsWith(".css");
            // 非 stylesheet 不做处理
            if (!styleFlag) {
              var _res = rawDOMAppendOrInsertBefore.call(this, element, refChild);
              execHooks(plugins, "appendOrInsertElementHook", element, iframe.contentWindow);
              return _res;
            }
            // 排除css
            if (href && !isMatchUrl(href, getEffectLoaders("cssExcludes", plugins))) {
              getExternalStyleSheets([{
                src: href,
                ignore: isMatchUrl(href, getEffectLoaders("cssIgnores", plugins))
              }], fetch, lifecycles.loadError).forEach(function (_ref2) {
                var src = _ref2.src,
                  ignore = _ref2.ignore,
                  contentPromise = _ref2.contentPromise;
                return contentPromise.then(function (content) {
                  // 处理 ignore 样式
                  var rawAttrs = parseTagAttributes(element.outerHTML);
                  if (ignore && src) {
                    // const stylesheetElement = iframeDocument.createElement("link");
                    // const attrs = {
                    //   ...rawAttrs,
                    //   type: "text/css",
                    //   rel: "stylesheet",
                    //   href: src,
                    // };
                    // setAttrsToElement(stylesheetElement, attrs);
                    // rawDOMAppendOrInsertBefore.call(this, stylesheetElement, refChild);
                    // manualInvokeElementEvent(element, "load");
                    // 忽略的元素应该直接把对应元素插入，而不是用新的 link 标签进行替代插入，保证 element 的上下文正常
                    rawDOMAppendOrInsertBefore.call(_this5, element, refChild);
                  } else {
                    // 记录js插入样式，子应用重新激活时恢复
                    var stylesheetElement = iframeDocument.createElement("style");
                    // 处理css-loader插件
                    var cssLoader = getCssLoader({
                      plugins: plugins,
                      replace: replace
                    });
                    stylesheetElement.innerHTML = cssLoader(content, src, curUrl);
                    styleSheetElements.push(stylesheetElement);
                    setAttrsToElement(stylesheetElement, rawAttrs);
                    rawDOMAppendOrInsertBefore.call(_this5, stylesheetElement, refChild);
                    // 处理样式补丁
                    handleStylesheetElementPatch(stylesheetElement, sandbox);
                    manualInvokeElementEvent(element, "load");
                  }
                  element = null;
                }, function () {
                  manualInvokeElementEvent(element, "error");
                  element = null;
                });
              });
            }
            var comment = iframeDocument.createComment("dynamic link ".concat(href, " replaced by wujie"));
            return rawDOMAppendOrInsertBefore.call(this, comment, refChild);
          }
        case "STYLE":
          {
            var stylesheetElement = newChild;
            styleSheetElements.push(stylesheetElement);
            var content = stylesheetElement.innerHTML;
            var cssLoader = getCssLoader({
              plugins: plugins,
              replace: replace
            });
            content && (stylesheetElement.innerHTML = cssLoader(content, "", curUrl));
            var _res2 = rawDOMAppendOrInsertBefore.call(this, element, refChild);
            // 处理样式补丁
            patchStylesheetElement(stylesheetElement, cssLoader, sandbox, curUrl);
            handleStylesheetElementPatch(stylesheetElement, sandbox);
            execHooks(plugins, "appendOrInsertElementHook", element, iframe.contentWindow);
            return _res2;
          }
        case "SCRIPT":
          {
            setTagToScript(element);
            var _ref3 = element,
              src = _ref3.src,
              text = _ref3.text,
              _type = _ref3.type,
              crossOrigin = _ref3.crossOrigin;
            // 排除js
            if (src && !isMatchUrl(src, getEffectLoaders("jsExcludes", plugins))) {
              var execScript = function execScript(scriptResult) {
                // 假如子应用被连续渲染两次，两次渲染会导致处理流程的交叉污染
                if (sandbox.iframe === null) return warn(WUJIE_TIPS_REPEAT_RENDER);
                var onload = function onload() {
                  manualInvokeElementEvent(element, "load");
                  element = null;
                };
                insertScriptToIframe(_objectSpread(_objectSpread({}, scriptResult), {}, {
                  onload: onload
                }), sandbox.iframe.contentWindow, element);
              };
              var scriptOptions = {
                src: src,
                module: _type === "module",
                crossorigin: crossOrigin !== null,
                crossoriginType: crossOrigin || "",
                ignore: isMatchUrl(src, getEffectLoaders("jsIgnores", plugins)),
                attrs: parseTagAttributes(element.outerHTML)
              };
              getExternalScripts([scriptOptions], fetch, lifecycles.loadError, fiber).forEach(function (scriptResult) {
                dynamicScriptExecStack = dynamicScriptExecStack.then(function () {
                  return scriptResult.contentPromise.then(function (content) {
                    var _sandbox$execQueue;
                    if (sandbox.execQueue === null) return warn(WUJIE_TIPS_REPEAT_RENDER);
                    var execQueueLength = (_sandbox$execQueue = sandbox.execQueue) === null || _sandbox$execQueue === void 0 ? void 0 : _sandbox$execQueue.length;
                    sandbox.execQueue.push(function () {
                      return fiber ? sandbox.requestIdleCallback(function () {
                        execScript(_objectSpread(_objectSpread({}, scriptResult), {}, {
                          content: content
                        }));
                      }) : execScript(_objectSpread(_objectSpread({}, scriptResult), {}, {
                        content: content
                      }));
                    });
                    // 同步脚本如果都执行完了，需要手动触发执行
                    if (!execQueueLength) sandbox.execQueue.shift()();
                  }, function () {
                    manualInvokeElementEvent(element, "error");
                    element = null;
                  });
                });
              });
            } else {
              var _sandbox$execQueue2;
              var execQueueLength = (_sandbox$execQueue2 = sandbox.execQueue) === null || _sandbox$execQueue2 === void 0 ? void 0 : _sandbox$execQueue2.length;
              sandbox.execQueue.push(function () {
                return fiber ? sandbox.requestIdleCallback(function () {
                  insertScriptToIframe({
                    src: null,
                    content: text,
                    attrs: parseTagAttributes(element.outerHTML)
                  }, sandbox.iframe.contentWindow, element);
                }) : insertScriptToIframe({
                  src: null,
                  content: text,
                  attrs: parseTagAttributes(element.outerHTML)
                }, sandbox.iframe.contentWindow, element);
              });
              if (!execQueueLength) sandbox.execQueue.shift()();
            }
            // inline script never trigger the onload and onerror event
            var _comment = iframeDocument.createComment("dynamic script ".concat(src, " replaced by wujie"));
            return rawDOMAppendOrInsertBefore.call(this, _comment, refChild);
          }
        // 修正子应用内部iframe的window.parent指向
        case "IFRAME":
          {
            // 嵌套的子应用的js-iframe需要插入子应用的js-iframe内部
            if (element.getAttribute(WUJIE_DATA_FLAG) === "") {
              return rawAppendChild.call(rawDocumentQuerySelector.call(this.ownerDocument, "html"), element);
            }
            var _res3 = rawDOMAppendOrInsertBefore.call(this, element, refChild);
            execHooks(plugins, "appendOrInsertElementHook", element, iframe.contentWindow);
            return _res3;
          }
        default:
      }
    }
  };
}
function findScriptElementFromIframe(rawElement, wujieId) {
  var wujieTag = getTagFromScript(rawElement);
  var sandbox = getWujieById(wujieId);
  var iframe = sandbox.iframe;
  var targetScript = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_HEAD__.querySelector("script[".concat(WUJIE_SCRIPT_ID, "='").concat(wujieTag, "']"));
  if (targetScript === null) {
    warn(WUJIE_TIPS_NO_SCRIPT, "<script ".concat(WUJIE_SCRIPT_ID, "='").concat(wujieTag, "'/>"));
  }
  return {
    targetScript: targetScript,
    iframe: iframe
  };
}
function rewriteContains(opts) {
  return function contains(other) {
    var element = other;
    var rawElementContains = opts.rawElementContains,
      wujieId = opts.wujieId;
    if (element && isScriptElement(element)) {
      var _findScriptElementFro = findScriptElementFromIframe(element, wujieId),
        targetScript = _findScriptElementFro.targetScript;
      return targetScript !== null;
    }
    return rawElementContains(element);
  };
}
function rewriteRemoveChild(opts) {
  return function removeChild(child) {
    var element = child;
    var rawElementRemoveChild = opts.rawElementRemoveChild,
      wujieId = opts.wujieId;
    if (element && isScriptElement(element)) {
      var _findScriptElementFro2 = findScriptElementFromIframe(element, wujieId),
        targetScript = _findScriptElementFro2.targetScript,
        iframe = _findScriptElementFro2.iframe;
      if (targetScript !== null) {
        return iframe.contentWindow.__WUJIE_RAW_DOCUMENT_HEAD__.removeChild(targetScript);
      }
      return null;
    }
    return rawElementRemoveChild(element);
  };
}

/**
 * 记录head和body的事件，等重新渲染复用head和body时需要清空事件
 */
function patchEventListener(element) {
  var listenerMap = new Map();
  element._cacheListeners = listenerMap;
  element.addEventListener = function (type, listener, options) {
    var listeners = listenerMap.get(type) || [];
    listenerMap.set(type, [].concat(_toConsumableArray(listeners), [listener]));
    return rawAddEventListener.call(element, type, listener, options);
  };
  element.removeEventListener = function (type, listener, options) {
    var typeListeners = listenerMap.get(type);
    var index = typeListeners === null || typeListeners === void 0 ? void 0 : typeListeners.indexOf(listener);
    if (typeListeners !== null && typeListeners !== void 0 && typeListeners.length && index !== -1) {
      typeListeners.splice(index, 1);
    }
    return rawRemoveEventListener.call(element, type, listener, options);
  };
}

/**
 * 清空head和body的绑定的事件
 */
export function removeEventListener(element) {
  var listenerMap = element._cacheListeners;
  _toConsumableArray(listenerMap.entries()).forEach(function (_ref4) {
    var _ref5 = _slicedToArray(_ref4, 2),
      type = _ref5[0],
      listeners = _ref5[1];
    listeners.forEach(function (listener) {
      return rawRemoveEventListener.call(element, type, listener);
    });
  });
}

/**
 * patch head and body in render
 * intercept appendChild and insertBefore
 */
export function patchRenderEffect(render, id, degrade) {
  // 降级场景dom渲染在iframe中，iframe移动后事件自动销毁，不需要记录
  if (!degrade) {
    patchEventListener(render.head);
    patchEventListener(render.body);
  }
  render.head.appendChild = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawAppendChild,
    wujieId: id
  });
  render.head.insertBefore = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawHeadInsertBefore,
    wujieId: id
  });
  render.head.removeChild = rewriteRemoveChild({
    rawElementRemoveChild: rawElementRemoveChild.bind(render.head),
    wujieId: id
  });
  render.head.contains = rewriteContains({
    rawElementContains: rawElementContains.bind(render.head),
    wujieId: id
  });
  render.contains = rewriteContains({
    rawElementContains: rawElementContains.bind(render),
    wujieId: id
  });
  render.body.appendChild = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawAppendChild,
    wujieId: id
  });
  render.body.insertBefore = rewriteAppendOrInsertChild({
    rawDOMAppendOrInsertBefore: rawBodyInsertBefore,
    wujieId: id
  });
}
//# sourceMappingURL=effect.js.map
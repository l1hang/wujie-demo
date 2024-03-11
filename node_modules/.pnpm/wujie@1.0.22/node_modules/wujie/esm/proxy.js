import { patchElementEffect, renderIframeReplaceApp } from "./iframe";
import { renderElementToContainer } from "./shadow";
import { pushUrlToWindow } from "./sync";
import { documentProxyProperties, rawDocumentQuerySelector } from "./common";
import { WUJIE_TIPS_RELOAD_DISABLED, WUJIE_TIPS_GET_ELEMENT_BY_ID } from "./constant";
import { getTargetValue, anchorElementGenerator, getDegradeIframe, isCallable, checkProxyFunction, warn, stopMainAppRun } from "./utils";

/**
 * location href 的set劫持操作
 */
function locationHrefSet(iframe, value, appHostPath) {
  var _iframe$contentWindow = iframe.contentWindow.__WUJIE,
    shadowRoot = _iframe$contentWindow.shadowRoot,
    id = _iframe$contentWindow.id,
    degrade = _iframe$contentWindow.degrade,
    document = _iframe$contentWindow.document,
    degradeAttrs = _iframe$contentWindow.degradeAttrs;
  var url = value;
  if (!/^http/.test(url)) {
    var hrefElement = anchorElementGenerator(url);
    url = appHostPath + hrefElement.pathname + hrefElement.search + hrefElement.hash;
    hrefElement = null;
  }
  iframe.contentWindow.__WUJIE.hrefFlag = true;
  if (degrade) {
    var iframeBody = rawDocumentQuerySelector.call(iframe.contentDocument, "body");
    renderElementToContainer(document.documentElement, iframeBody);
    renderIframeReplaceApp(window.decodeURIComponent(url), getDegradeIframe(id).parentElement, degradeAttrs);
  } else renderIframeReplaceApp(url, shadowRoot.host.parentElement, degradeAttrs);
  pushUrlToWindow(id, url);
  return true;
}

/**
 * 非降级情况下window、document、location代理
 */
export function proxyGenerator(iframe, urlElement, mainHostPath, appHostPath) {
  var proxyWindow = new Proxy(iframe.contentWindow, {
    get: function get(target, p) {
      // location进行劫持
      if (p === "location") {
        return target.__WUJIE.proxyLocation;
      }
      // 判断自身
      if (p === "self" || p === "window" && Object.getOwnPropertyDescriptor(window, "window").get) {
        return target.__WUJIE.proxy;
      }
      // 不要绑定this
      if (p === "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__" || p === "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__") {
        return target[p];
      }
      // https://262.ecma-international.org/8.0/#sec-proxy-object-internal-methods-and-internal-slots-get-p-receiver
      var descriptor = Object.getOwnPropertyDescriptor(target, p);
      if ((descriptor === null || descriptor === void 0 ? void 0 : descriptor.configurable) === false && (descriptor === null || descriptor === void 0 ? void 0 : descriptor.writable) === false) {
        return target[p];
      }
      // 修正this指针指向
      return getTargetValue(target, p);
    },
    set: function set(target, p, value) {
      checkProxyFunction(value);
      target[p] = value;
      return true;
    },
    has: function has(target, p) {
      return p in target;
    }
  });

  // proxy document
  var proxyDocument = new Proxy({}, {
    get: function get(_fakeDocument, propKey) {
      var document = window.document;
      var _iframe$contentWindow2 = iframe.contentWindow.__WUJIE,
        shadowRoot = _iframe$contentWindow2.shadowRoot,
        proxyLocation = _iframe$contentWindow2.proxyLocation;
      // iframe初始化完成后，webcomponent还未挂在上去，此时运行了主应用代码，必须中止
      if (!shadowRoot) stopMainAppRun();
      var rawCreateElement = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_ELEMENT__;
      var rawCreateTextNode = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_TEXT_NODE__;
      // need fix
      if (propKey === "createElement" || propKey === "createTextNode") {
        return new Proxy(document[propKey], {
          apply: function apply(_createElement, _ctx, args) {
            var rawCreateMethod = propKey === "createElement" ? rawCreateElement : rawCreateTextNode;
            var element = rawCreateMethod.apply(iframe.contentDocument, args);
            patchElementEffect(element, iframe.contentWindow);
            return element;
          }
        });
      }
      if (propKey === "documentURI" || propKey === "URL") {
        return proxyLocation.href;
      }

      // from shadowRoot
      if (propKey === "getElementsByTagName" || propKey === "getElementsByClassName" || propKey === "getElementsByName") {
        return new Proxy(shadowRoot.querySelectorAll, {
          apply: function apply(querySelectorAll, _ctx, args) {
            var arg = args[0];
            if (_ctx !== iframe.contentDocument) {
              return _ctx[propKey].apply(_ctx, args);
            }
            if (propKey === "getElementsByTagName" && arg === "script") {
              return iframe.contentDocument.scripts;
            }
            if (propKey === "getElementsByClassName") arg = "." + arg;
            if (propKey === "getElementsByName") arg = "[name=\"".concat(arg, "\"]");

            // FIXME: This string must be a valid CSS selector string; if it's not, a SyntaxError exception is thrown;
            // so we should ensure that the program can execute normally in case of exceptions.
            // reference: https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll

            var res;
            try {
              res = querySelectorAll.call(shadowRoot, arg);
            } catch (error) {
              res = [];
            }
            return res;
          }
        });
      }
      if (propKey === "getElementById") {
        return new Proxy(shadowRoot.querySelector, {
          // case document.querySelector.call
          apply: function apply(target, ctx, args) {
            if (ctx !== iframe.contentDocument) {
              var _ctx$propKey;
              return (_ctx$propKey = ctx[propKey]) === null || _ctx$propKey === void 0 ? void 0 : _ctx$propKey.apply(ctx, args);
            }
            try {
              return target.call(shadowRoot, "[id=\"".concat(args[0], "\"]")) || iframe.contentWindow.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__.call(iframe.contentWindow.document, "#".concat(args[0]));
            } catch (error) {
              warn(WUJIE_TIPS_GET_ELEMENT_BY_ID);
              return null;
            }
          }
        });
      }
      if (propKey === "querySelector" || propKey === "querySelectorAll") {
        var rawPropMap = {
          querySelector: "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__",
          querySelectorAll: "__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__"
        };
        return new Proxy(shadowRoot[propKey], {
          apply: function apply(target, ctx, args) {
            if (ctx !== iframe.contentDocument) {
              var _ctx$propKey2;
              return (_ctx$propKey2 = ctx[propKey]) === null || _ctx$propKey2 === void 0 ? void 0 : _ctx$propKey2.apply(ctx, args);
            }
            // 二选一，优先shadowDom，除非采用array合并，排除base，防止对router造成影响
            return target.apply(shadowRoot, args) || (args[0] === "base" ? null : iframe.contentWindow[rawPropMap[propKey]].call(iframe.contentWindow.document, args[0]));
          }
        });
      }
      if (propKey === "documentElement" || propKey === "scrollingElement") return shadowRoot.firstElementChild;
      if (propKey === "forms") return shadowRoot.querySelectorAll("form");
      if (propKey === "images") return shadowRoot.querySelectorAll("img");
      if (propKey === "links") return shadowRoot.querySelectorAll("a");
      var ownerProperties = documentProxyProperties.ownerProperties,
        shadowProperties = documentProxyProperties.shadowProperties,
        shadowMethods = documentProxyProperties.shadowMethods,
        documentProperties = documentProxyProperties.documentProperties,
        documentMethods = documentProxyProperties.documentMethods;
      if (ownerProperties.concat(shadowProperties).includes(propKey.toString())) {
        if (propKey === "activeElement" && shadowRoot.activeElement === null) return shadowRoot.body;
        return shadowRoot[propKey];
      }
      if (shadowMethods.includes(propKey.toString())) {
        var _getTargetValue;
        return (_getTargetValue = getTargetValue(shadowRoot, propKey)) !== null && _getTargetValue !== void 0 ? _getTargetValue : getTargetValue(document, propKey);
      }
      // from window.document
      if (documentProperties.includes(propKey.toString())) {
        return document[propKey];
      }
      if (documentMethods.includes(propKey.toString())) {
        return getTargetValue(document, propKey);
      }
    }
  });

  // proxy location
  var proxyLocation = new Proxy({}, {
    get: function get(_fakeLocation, propKey) {
      var location = iframe.contentWindow.location;
      if (propKey === "host" || propKey === "hostname" || propKey === "protocol" || propKey === "port" || propKey === "origin") {
        return urlElement[propKey];
      }
      if (propKey === "href") {
        return location[propKey].replace(mainHostPath, appHostPath);
      }
      if (propKey === "reload") {
        warn(WUJIE_TIPS_RELOAD_DISABLED);
        return function () {
          return null;
        };
      }
      if (propKey === "replace") {
        return new Proxy(location[propKey], {
          apply: function apply(replace, _ctx, args) {
            var _args$;
            return replace.call(location, (_args$ = args[0]) === null || _args$ === void 0 ? void 0 : _args$.replace(appHostPath, mainHostPath));
          }
        });
      }
      return getTargetValue(location, propKey);
    },
    set: function set(_fakeLocation, propKey, value) {
      // 如果是跳转链接的话重开一个iframe
      if (propKey === "href") {
        return locationHrefSet(iframe, value, appHostPath);
      }
      iframe.contentWindow.location[propKey] = value;
      return true;
    },
    ownKeys: function ownKeys() {
      return Object.keys(iframe.contentWindow.location).filter(function (key) {
        return key !== "reload";
      });
    },
    getOwnPropertyDescriptor: function getOwnPropertyDescriptor(_target, key) {
      return {
        enumerable: true,
        configurable: true,
        value: this[key]
      };
    }
  });
  return {
    proxyWindow: proxyWindow,
    proxyDocument: proxyDocument,
    proxyLocation: proxyLocation
  };
}

/**
 * 降级情况下document、location代理处理
 */
export function localGenerator(iframe, urlElement, mainHostPath, appHostPath) {
  // 代理 document
  var proxyDocument = {};
  var sandbox = iframe.contentWindow.__WUJIE;
  // 特殊处理
  Object.defineProperties(proxyDocument, {
    createElement: {
      get: function get() {
        return function () {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          var element = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_ELEMENT__.apply(iframe.contentDocument, args);
          patchElementEffect(element, iframe.contentWindow);
          return element;
        };
      }
    },
    createTextNode: {
      get: function get() {
        return function () {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          var element = iframe.contentWindow.__WUJIE_RAW_DOCUMENT_CREATE_TEXT_NODE__.apply(iframe.contentDocument, args);
          patchElementEffect(element, iframe.contentWindow);
          return element;
        };
      }
    },
    documentURI: {
      get: function get() {
        return sandbox.proxyLocation.href;
      }
    },
    URL: {
      get: function get() {
        return sandbox.proxyLocation.href;
      }
    },
    getElementsByTagName: {
      get: function get() {
        return function () {
          var tagName = arguments.length <= 0 ? undefined : arguments[0];
          if (tagName === "script") {
            return iframe.contentDocument.scripts;
          }
          return sandbox.document.getElementsByTagName(tagName);
        };
      }
    }
  });
  // 普通处理
  var modifyLocalProperties = documentProxyProperties.modifyLocalProperties,
    modifyProperties = documentProxyProperties.modifyProperties,
    ownerProperties = documentProxyProperties.ownerProperties,
    shadowProperties = documentProxyProperties.shadowProperties,
    shadowMethods = documentProxyProperties.shadowMethods,
    documentProperties = documentProxyProperties.documentProperties,
    documentMethods = documentProxyProperties.documentMethods;
  modifyProperties.filter(function (key) {
    return !modifyLocalProperties.includes(key);
  }).concat(ownerProperties, shadowProperties, shadowMethods, documentProperties, documentMethods).forEach(function (key) {
    Object.defineProperty(proxyDocument, key, {
      get: function get() {
        var _sandbox$document;
        var value = (_sandbox$document = sandbox.document) === null || _sandbox$document === void 0 ? void 0 : _sandbox$document[key];
        return isCallable(value) ? value.bind(sandbox.document) : value;
      }
    });
  });

  // 代理 location
  var proxyLocation = {};
  var location = iframe.contentWindow.location;
  var locationKeys = Object.keys(location);
  var constantKey = ["host", "hostname", "port", "protocol", "port"];
  constantKey.forEach(function (key) {
    proxyLocation[key] = urlElement[key];
  });
  Object.defineProperties(proxyLocation, {
    href: {
      get: function get() {
        return location.href.replace(mainHostPath, appHostPath);
      },
      set: function set(value) {
        locationHrefSet(iframe, value, appHostPath);
      }
    },
    reload: {
      get: function get() {
        warn(WUJIE_TIPS_RELOAD_DISABLED);
        return function () {
          return null;
        };
      }
    }
  });
  locationKeys.filter(function (key) {
    return !constantKey.concat(["href", "reload"]).includes(key);
  }).forEach(function (key) {
    Object.defineProperty(proxyLocation, key, {
      get: function get() {
        return isCallable(location[key]) ? location[key].bind(location) : location[key];
      }
    });
  });
  return {
    proxyDocument: proxyDocument,
    proxyLocation: proxyLocation
  };
}
//# sourceMappingURL=proxy.js.map
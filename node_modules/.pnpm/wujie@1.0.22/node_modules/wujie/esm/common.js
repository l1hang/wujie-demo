import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
// 全部无界实例和配置存储map
export var idToSandboxCacheMap = window.__POWERED_BY_WUJIE__ ? window.__WUJIE.inject.idToSandboxMap : new Map();
export function getWujieById(id) {
  var _idToSandboxCacheMap$;
  return ((_idToSandboxCacheMap$ = idToSandboxCacheMap.get(id)) === null || _idToSandboxCacheMap$ === void 0 ? void 0 : _idToSandboxCacheMap$.wujie) || null;
}
export function getOptionsById(id) {
  var _idToSandboxCacheMap$2;
  return ((_idToSandboxCacheMap$2 = idToSandboxCacheMap.get(id)) === null || _idToSandboxCacheMap$2 === void 0 ? void 0 : _idToSandboxCacheMap$2.options) || null;
}
export function addSandboxCacheWithWujie(id, sandbox) {
  var wujieCache = idToSandboxCacheMap.get(id);
  if (wujieCache) idToSandboxCacheMap.set(id, _objectSpread(_objectSpread({}, wujieCache), {}, {
    wujie: sandbox
  }));else idToSandboxCacheMap.set(id, {
    wujie: sandbox
  });
}
export function deleteWujieById(id) {
  var wujieCache = idToSandboxCacheMap.get(id);
  if (wujieCache !== null && wujieCache !== void 0 && wujieCache.options) idToSandboxCacheMap.set(id, {
    options: wujieCache.options
  });
  idToSandboxCacheMap["delete"](id);
}
export function addSandboxCacheWithOptions(id, options) {
  var wujieCache = idToSandboxCacheMap.get(id);
  if (wujieCache) idToSandboxCacheMap.set(id, _objectSpread(_objectSpread({}, wujieCache), {}, {
    options: options
  }));else idToSandboxCacheMap.set(id, {
    options: options
  });
}

// 分类document上需要处理的属性，不同类型会进入不同的处理逻辑
export var documentProxyProperties = {
  // 降级场景下需要本地特殊处理的属性
  modifyLocalProperties: ["createElement", "createTextNode", "documentURI", "URL", "getElementsByTagName"],
  // 子应用需要手动修正的属性方法
  modifyProperties: ["createElement", "createTextNode", "documentURI", "URL", "getElementsByTagName", "getElementsByClassName", "getElementsByName", "getElementById", "querySelector", "querySelectorAll", "documentElement", "scrollingElement", "forms", "images", "links"],
  // 需要从shadowRoot中获取的属性
  shadowProperties: ["activeElement", "childElementCount", "children", "firstElementChild", "firstChild", "fullscreenElement", "lastElementChild", "pictureInPictureElement", "pointerLockElement", "styleSheets"],
  // 需要从shadowRoot中获取的方法
  shadowMethods: ["append", "contains", "getSelection", "elementFromPoint", "elementsFromPoint", "getAnimations", "replaceChildren"],
  // 需要从主应用document中获取的属性
  documentProperties: ["characterSet", "compatMode", "contentType", "designMode", "dir", "doctype", "embeds", "fullscreenEnabled", "hidden", "implementation", "lastModified", "pictureInPictureEnabled", "plugins", "readyState", "referrer", "visibilityState", "fonts"],
  // 需要从主应用document中获取的方法
  documentMethods: ["execCommand", "caretPositionFromPoint", "createRange", "exitFullscreen", "exitPictureInPicture", "getElementsByTagNameNS", "hasFocus", "prepend"],
  // 需要从主应用document中获取的事件
  documentEvents: ["onpointerlockchange", "onpointerlockerror", "onbeforecopy", "onbeforecut", "onbeforepaste", "onfreeze", "onresume", "onsearch", "onfullscreenchange", "onfullscreenerror", "onsecuritypolicyviolation", "onvisibilitychange"],
  // 无需修改原型的属性
  ownerProperties: ["head", "body"]
};

// 需要挂载到子应用iframe document上的事件
export var appDocumentAddEventListenerEvents = ["DOMContentLoaded", "readystatechange"];
export var appDocumentOnEvents = ["onreadystatechange"];
// 需要挂载到主应用document上的事件
export var mainDocumentAddEventListenerEvents = ["fullscreenchange", "fullscreenerror", "selectionchange", "visibilitychange", "wheel", "keydown", "keypress", "keyup"];

// 需要同时挂载到主应用document和shadow上的事件（互斥）
export var mainAndAppAddEventListenerEvents = ["gotpointercapture", "lostpointercapture"];

// 子应用window监听需要挂载到iframe沙箱上的事件
export var appWindowAddEventListenerEvents = ["hashchange", "popstate", "DOMContentLoaded", "load", "beforeunload", "unload", "message", "error", "unhandledrejection"];

// 子应用window.onXXX需要挂载到iframe沙箱上的事件
export var appWindowOnEvent = ["onload", "onbeforeunload", "onunload"];

// 相对路径问题元素的tag和attr的map
export var relativeElementTagAttrMap = {
  IMG: "src",
  A: "href",
  SOURCE: "src"
};

// 需要单独处理的window属性
export var windowProxyProperties = ["getComputedStyle", "visualViewport", "matchMedia", "DOMParser"];

// window白名单
export var windowRegWhiteList = [/animationFrame$/i, /resizeObserver$|mutationObserver$|intersectionObserver$/i, /height$|width$|left$/i, /^screen/i, /X$|Y$/];

// 保存原型方法
// 子应用的Document.prototype已经被改写了
export var rawElementAppendChild = HTMLElement.prototype.appendChild;
export var rawElementRemoveChild = HTMLElement.prototype.removeChild;
export var rawElementContains = HTMLElement.prototype.contains;
export var rawHeadInsertBefore = HTMLHeadElement.prototype.insertBefore;
export var rawBodyInsertBefore = HTMLBodyElement.prototype.insertBefore;
export var rawAddEventListener = Node.prototype.addEventListener;
export var rawRemoveEventListener = Node.prototype.removeEventListener;
export var rawWindowAddEventListener = window.addEventListener;
export var rawWindowRemoveEventListener = window.removeEventListener;
export var rawAppendChild = Node.prototype.appendChild;
export var rawDocumentQuerySelector = window.__POWERED_BY_WUJIE__ ? window.__WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__ : Document.prototype.querySelector;
//# sourceMappingURL=common.js.map
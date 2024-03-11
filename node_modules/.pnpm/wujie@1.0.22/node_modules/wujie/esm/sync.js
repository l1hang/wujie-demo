import { anchorElementGenerator, getAnchorElementQueryMap, getSyncUrl, appRouteParse, getDegradeIframe } from "./utils";
import { renderIframeReplaceApp, patchEventTimeStamp } from "./iframe";
import { renderElementToContainer, initRenderIframeAndContainer } from "./shadow";
import { getWujieById, rawDocumentQuerySelector } from "./common";

/**
 * 同步子应用路由到主应用路由
 */
export function syncUrlToWindow(iframeWindow) {
  var _iframeWindow$__WUJIE = iframeWindow.__WUJIE,
    sync = _iframeWindow$__WUJIE.sync,
    id = _iframeWindow$__WUJIE.id,
    prefix = _iframeWindow$__WUJIE.prefix;
  var winUrlElement = anchorElementGenerator(window.location.href);
  var queryMap = getAnchorElementQueryMap(winUrlElement);
  // 非同步且url上没有当前id的查询参数，否则就要同步参数或者清理参数
  if (!sync && !queryMap[id]) return winUrlElement = null;
  var curUrl = iframeWindow.location.pathname + iframeWindow.location.search + iframeWindow.location.hash;
  var validShortPath = "";
  // 处理短路径
  if (prefix) {
    Object.keys(prefix).forEach(function (shortPath) {
      var longPath = prefix[shortPath];
      // 找出最长匹配路径
      if (curUrl.startsWith(longPath) && (!validShortPath || longPath.length > prefix[validShortPath].length)) {
        validShortPath = shortPath;
      }
    });
  }
  // 同步
  if (sync) {
    queryMap[id] = window.encodeURIComponent(validShortPath ? curUrl.replace(prefix[validShortPath], "{".concat(validShortPath, "}")) : curUrl);
    // 清理
  } else {
    delete queryMap[id];
  }
  var newQuery = "?" + Object.keys(queryMap).map(function (key) {
    return key + "=" + queryMap[key];
  }).join("&");
  winUrlElement.search = newQuery;
  if (winUrlElement.href !== window.location.href) {
    window.history.replaceState(null, "", winUrlElement.href);
  }
  winUrlElement = null;
}

/**
 * 同步主应用路由到子应用
 */
export function syncUrlToIframe(iframeWindow) {
  // 获取当前路由路径
  var _iframeWindow$locatio = iframeWindow.location,
    pathname = _iframeWindow$locatio.pathname,
    search = _iframeWindow$locatio.search,
    hash = _iframeWindow$locatio.hash;
  var _iframeWindow$__WUJIE2 = iframeWindow.__WUJIE,
    id = _iframeWindow$__WUJIE2.id,
    url = _iframeWindow$__WUJIE2.url,
    sync = _iframeWindow$__WUJIE2.sync,
    execFlag = _iframeWindow$__WUJIE2.execFlag,
    prefix = _iframeWindow$__WUJIE2.prefix,
    inject = _iframeWindow$__WUJIE2.inject;

  // 只在浏览器刷新或者第一次渲染时同步
  var idUrl = sync && !execFlag ? getSyncUrl(id, prefix) : url;
  // 排除href跳转情况
  var syncUrl = (/^http/.test(idUrl) ? null : idUrl) || url;
  var _appRouteParse = appRouteParse(syncUrl),
    appRoutePath = _appRouteParse.appRoutePath;
  var preAppRoutePath = pathname + search + hash;
  if (preAppRoutePath !== appRoutePath) {
    iframeWindow.history.replaceState(null, "", inject.mainHostPath + appRoutePath);
  }
}

/**
 * 清理非激活态的子应用同步参数
 * 主应用采用hash模式时，切换子应用后已销毁的子应用同步参数还存在需要手动清理
 */
export function clearInactiveAppUrl() {
  var winUrlElement = anchorElementGenerator(window.location.href);
  var queryMap = getAnchorElementQueryMap(winUrlElement);
  Object.keys(queryMap).forEach(function (id) {
    var sandbox = getWujieById(id);
    if (!sandbox) return;
    // 子应用执行过并且已经失活才需要清除
    if (sandbox.execFlag && sandbox.sync && !sandbox.hrefFlag && !sandbox.activeFlag) {
      delete queryMap[id];
    }
  });
  var newQuery = "?" + Object.keys(queryMap).map(function (key) {
    return key + "=" + queryMap[key];
  }).join("&");
  winUrlElement.search = newQuery;
  if (winUrlElement.href !== window.location.href) {
    window.history.replaceState(null, "", winUrlElement.href);
  }
  winUrlElement = null;
}

/**
 * 推送指定url到主应用路由
 */
export function pushUrlToWindow(id, url) {
  var winUrlElement = anchorElementGenerator(window.location.href);
  var queryMap = getAnchorElementQueryMap(winUrlElement);
  queryMap[id] = window.encodeURIComponent(url);
  var newQuery = "?" + Object.keys(queryMap).map(function (key) {
    return key + "=" + queryMap[key];
  }).join("&");
  winUrlElement.search = newQuery;
  window.history.pushState(null, "", winUrlElement.href);
  winUrlElement = null;
}

/**
 * 应用跳转(window.location.href)情况路由处理
 */
export function processAppForHrefJump() {
  window.addEventListener("popstate", function () {
    var winUrlElement = anchorElementGenerator(window.location.href);
    var queryMap = getAnchorElementQueryMap(winUrlElement);
    winUrlElement = null;
    Object.keys(queryMap).map(function (id) {
      return getWujieById(id);
    }).filter(function (sandbox) {
      return sandbox;
    }).forEach(function (sandbox) {
      var url = queryMap[sandbox.id];
      var iframeBody = rawDocumentQuerySelector.call(sandbox.iframe.contentDocument, "body");
      // 前进href
      if (/http/.test(url)) {
        if (sandbox.degrade) {
          renderElementToContainer(sandbox.document.documentElement, iframeBody);
          renderIframeReplaceApp(window.decodeURIComponent(url), getDegradeIframe(sandbox.id).parentElement, sandbox.degradeAttrs);
        } else renderIframeReplaceApp(window.decodeURIComponent(url), sandbox.shadowRoot.host.parentElement, sandbox.degradeAttrs);
        sandbox.hrefFlag = true;
        // href后退
      } else if (sandbox.hrefFlag) {
        if (sandbox.degrade) {
          // 走全套流程，但是事件恢复不需要
          var _initRenderIframeAndC = initRenderIframeAndContainer(sandbox.id, sandbox.el, sandbox.degradeAttrs),
            iframe = _initRenderIframeAndC.iframe;
          patchEventTimeStamp(iframe.contentWindow, sandbox.iframe.contentWindow);
          iframe.contentWindow.onunload = function () {
            sandbox.unmount();
          };
          iframe.contentDocument.appendChild(iframeBody.firstElementChild);
          sandbox.document = iframe.contentDocument;
        } else renderElementToContainer(sandbox.shadowRoot.host, sandbox.el);
        sandbox.hrefFlag = false;
      }
    });
  });
}
//# sourceMappingURL=sync.js.map
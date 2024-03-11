import WuJie from "./sandbox";
import { ScriptObject } from "./template";
import { ScriptObjectLoader } from "./index";
declare global {
    interface Window {
        __POWERED_BY_WUJIE__?: boolean;
        __WUJIE_PUBLIC_PATH__: string;
        __WUJIE_RAW_DOCUMENT_QUERY_SELECTOR__: typeof Document.prototype.querySelector;
        __WUJIE_RAW_DOCUMENT_CREATE_ELEMENT__: typeof Document.prototype.createElement;
        __WUJIE_RAW_DOCUMENT_CREATE_TEXT_NODE__: typeof Document.prototype.createTextNode;
        __WUJIE_RAW_DOCUMENT_HEAD__: typeof Document.prototype.head;
        __WUJIE_RAW_DOCUMENT_QUERY_SELECTOR_ALL__: typeof Document.prototype.querySelectorAll;
        __WUJIE_RAW_WINDOW__: Window;
        __WUJIE: WuJie;
        __WUJIE_EVENTLISTENER__: Set<{
            listener: EventListenerOrEventListenerObject;
            type: string;
            options: any;
        }>;
        __WUJIE_MOUNT: () => void;
        __WUJIE_UNMOUNT: () => void;
        Document: typeof Document;
        HTMLImageElement: typeof HTMLImageElement;
        Node: typeof Node;
        Element: typeof Element;
        HTMLElement: typeof HTMLElement;
        HTMLAnchorElement: typeof HTMLAnchorElement;
        HTMLSourceElement: typeof HTMLSourceElement;
        HTMLLinkElement: typeof HTMLLinkElement;
        HTMLScriptElement: typeof HTMLScriptElement;
        HTMLMediaElement: typeof HTMLMediaElement;
        EventTarget: typeof EventTarget;
        Event: typeof Event;
        ShadowRoot: typeof ShadowRoot;
        $wujie: {
            [key: string]: any;
        };
    }
    interface HTMLHeadElement {
        _cacheListeners: Map<string, EventListenerOrEventListenerObject[]>;
    }
    interface HTMLBodyElement {
        _cacheListeners: Map<string, EventListenerOrEventListenerObject[]>;
    }
    interface Document {
        createTreeWalker(root: Node, whatToShow?: number, filter?: NodeFilter | null, entityReferenceExpansion?: boolean): TreeWalker;
    }
}
/**
 * 恢复节点的监听事件
 */
export declare function recoverEventListeners(rootElement: Element | ChildNode, iframeWindow: Window): void;
/**
 * 恢复根节点的监听事件
 */
export declare function recoverDocumentListeners(oldRootElement: Element | ChildNode, newRootElement: Element | ChildNode, iframeWindow: Window): void;
/**
 * 修复vue绑定事件e.timeStamp < attachedTimestamp 的情况
 */
export declare function patchEventTimeStamp(targetWindow: Window, iframeWindow: Window): void;
/**
 * 初始化base标签
 */
export declare function initBase(iframeWindow: Window, url: string): void;
export declare function patchElementEffect(element: (HTMLElement | Node | ShadowRoot) & {
    _hasPatch?: boolean;
}, iframeWindow: Window): void;
/**
 * 子应用前进后退，同步路由到主应用
 * @param iframeWindow
 */
export declare function syncIframeUrlToWindow(iframeWindow: Window): void;
/**
 * iframe插入脚本
 * @param scriptResult script请求结果
 * @param iframeWindow
 * @param rawElement 原始的脚本
 */
export declare function insertScriptToIframe(scriptResult: ScriptObject | ScriptObjectLoader, iframeWindow: Window, rawElement?: HTMLScriptElement): any;
/**
 * 加载iframe替换子应用
 * @param src 地址
 * @param element
 * @param degradeAttrs
 */
export declare function renderIframeReplaceApp(src: string, element: HTMLElement, degradeAttrs?: {
    [key: string]: any;
}): void;
/**
 * js沙箱
 * 创建和主应用同源的iframe，路径携带了子路由的路由信息
 * iframe必须禁止加载html，防止进入主应用的路由逻辑
 */
export declare function iframeGenerator(sandbox: WuJie, attrs: {
    [key: string]: any;
}, mainHostPath: string, appHostPath: string, appRoutePath: string): HTMLIFrameElement;

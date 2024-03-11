/**
 * 清空head和body的绑定的事件
 */
export declare function removeEventListener(element: HTMLHeadElement | HTMLBodyElement): void;
/**
 * patch head and body in render
 * intercept appendChild and insertBefore
 */
export declare function patchRenderEffect(render: ShadowRoot | Document, id: string, degrade: boolean): void;

export type EventObj = {
    [event: string]: Array<Function>;
};
export declare const appEventObjMap: Map<String, EventObj>;
export declare class EventBus {
    private id;
    private eventObj;
    constructor(id: string);
    $on(event: string, fn: Function): EventBus;
    /** 任何$emit都会导致监听函数触发，第一个参数为事件名，后续的参数为$emit的参数 */
    $onAll(fn: (event: string, ...args: Array<any>) => any): EventBus;
    $once(event: string, fn: Function): void;
    $off(event: string, fn: Function): EventBus;
    $offAll(fn: Function): EventBus;
    $emit(event: string, ...args: Array<any>): EventBus;
    $clear(): EventBus;
}

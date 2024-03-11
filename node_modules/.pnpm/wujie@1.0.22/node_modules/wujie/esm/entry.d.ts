import { ScriptObject, ScriptBaseObject, StyleObject } from "./template";
import Wujie from "./sandbox";
import { plugin, loadErrorHandler } from "./index";
export type ScriptResultList = (ScriptBaseObject & {
    contentPromise: Promise<string>;
})[];
export type StyleResultList = {
    src: string;
    contentPromise: Promise<string>;
    ignore?: boolean;
}[];
interface htmlParseResult {
    template: string;
    assetPublicPath: string;
    getExternalScripts(): ScriptResultList;
    getExternalStyleSheets(): StyleResultList;
}
type ImportEntryOpts = {
    fetch?: typeof window.fetch;
    fiber?: boolean;
    plugins?: Array<plugin>;
    loadError?: loadErrorHandler;
};
/**
 * 处理css-loader
 */
export declare function processCssLoader(sandbox: Wujie, template: string, getExternalStyleSheets: () => StyleResultList): Promise<string>;
export declare function getExternalStyleSheets(styles: StyleObject[], fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>, loadError: loadErrorHandler): StyleResultList;
export declare function getExternalScripts(scripts: ScriptObject[], fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>, loadError: loadErrorHandler, fiber: boolean): ScriptResultList;
export default function importHTML(params: {
    url: string;
    html?: string;
    opts: ImportEntryOpts;
}): Promise<htmlParseResult>;
export {};

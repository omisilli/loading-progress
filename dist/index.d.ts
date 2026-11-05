export type LoadingTiming = {
    delay?: number;
    duration?: number;
    easing?: string;
    finish?: number;
};
export declare function startLoading(timing?: LoadingTiming): () => void;
export declare function doneLoading(): void;
export declare function initLoadingProgress(): () => void;

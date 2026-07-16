import { MouseEvent, useCallback, useEffect, useState } from 'react';

const fullScreenControls = {
    exit: ['exitFullscreen', 'webkitExitFullscreen', 'mozCancelFullScreen', 'msExitFullscreen'],
    request: ['requestFullscreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'],
    screenChange: ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'],
    screenElement: ['fullscreenElement', 'webkitFullscreenElement', 'mozFullScreenElement', 'msFullscreenElement'],
} as const;

const useFullScreen = () => {
    const [isInFullScreenMode, setFullScreenMode] = useState(false);
    const { exit, request, screenChange, screenElement } = fullScreenControls;

    const onFullScreen = useCallback(() => {
        setFullScreenMode(screenElement.some(element => document[element as keyof Document]));
    }, [screenElement]);

    useEffect(() => {
        screenChange.forEach(event => {
            document.addEventListener(event, onFullScreen, false);
        });

        return () => {
            screenChange.forEach(event => {
                document.removeEventListener(event, onFullScreen, false);
            });
        };
    }, [onFullScreen, screenChange]);

    useEffect(() => {
        // The Fullscreen API's viewport change doesn't reliably trigger a window 'resize'
        // event across browsers, so anything that measures its own size imperatively (charts,
        // Blockly's workspace, tab active-line positioning, etc.) is left showing a stale
        // layout until something else forces a resize — visible as content clipped/pushed off
        // screen, worst after repeated fullscreen toggles since each one can leave a different
        // stale snapshot behind. A fixed delay (rAF/setTimeout) can't be trusted here: the
        // OS/browser's own fullscreen transition (and its duration) isn't something we control,
        // so a guessed delay can fire before the transition has actually settled — especially
        // exiting fullscreen, which tends to be slower than entering it. ResizeObserver instead
        // fires exactly when the viewport's real size finishes changing, regardless of how long
        // that takes, so we dispatch a real resize event only once it's actually safe to
        // re-measure.
        let raf_id = 0;
        const resize_observer = new ResizeObserver(() => {
            cancelAnimationFrame(raf_id);
            raf_id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        });
        resize_observer.observe(document.documentElement);

        return () => {
            cancelAnimationFrame(raf_id);
            resize_observer.disconnect();
        };
    }, []);

    const toggleFullScreenMode = (event?: MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();

        const exitFullScreen = exit.find(method => document[method as keyof Document]);
        const requestFullScreen = request.find(method => document.documentElement[method as keyof HTMLElement]);

        if (isInFullScreenMode && exitFullScreen) {
            (document[exitFullScreen as keyof Document] as Document['exitFullscreen'])();
        } else if (requestFullScreen) {
            (document.documentElement[requestFullScreen as keyof HTMLElement] as HTMLElement['requestFullscreen'])();
        } else {
            setFullScreenMode(false); // fullscreen API is not enabled
        }
    };

    return { toggleFullScreenMode };
};

export default useFullScreen;

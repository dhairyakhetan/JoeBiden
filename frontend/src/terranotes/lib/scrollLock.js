// Stops the page behind a full-screen popup from scrolling. Counted, so popups can overlap.
let locks = 0;
export const lockScroll = () => { if (locks++ === 0) document.documentElement.style.overflow = 'hidden'; };
export const unlockScroll = () => { if (locks > 0 && --locks === 0) document.documentElement.style.overflow = ''; };

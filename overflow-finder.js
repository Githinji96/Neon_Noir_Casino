/**
 * Paste this into the browser DevTools console while on the home page.
 * It finds every element that is scrollable (has scrollHeight > clientHeight)
 * and logs them with their overflow CSS values.
 */
(function findScrollableElements() {
  const all = document.querySelectorAll('*');
  const scrollable = [];

  all.forEach(el => {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const hasVertScroll = (overflowY === 'scroll' || overflowY === 'auto') && el.scrollHeight > el.clientHeight;
    const hasHorizScroll = (overflowX === 'scroll' || overflowX === 'auto') && el.scrollWidth > el.clientWidth;

    if (hasVertScroll || hasHorizScroll) {
      scrollable.push({
        el,
        tag: el.tagName,
        id: el.id,
        classes: el.className?.toString().slice(0, 80),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        overflowY,
        overflowX,
      });
    }
  });

  console.group('%c Scrollable Elements Found: ' + scrollable.length, 'color: #FFD700; font-weight: bold');
  scrollable.forEach((s, i) => {
    console.group(`${i + 1}. <${s.tag}> id="${s.id}" overflow-y="${s.overflowY}" overflow-x="${s.overflowX}"`);
    console.log('classes:', s.classes);
    console.log(`scrollH=${s.scrollH} clientH=${s.clientH} | scrollW=${s.scrollW} clientW=${s.clientW}`);
    console.log('element:', s.el);
    console.groupEnd();
  });
  console.groupEnd();

  // Also check for horizontal overflow on body
  const bodyStyle = window.getComputedStyle(document.body);
  console.log('%c Body overflow:', 'color: cyan', bodyStyle.overflow, bodyStyle.overflowX, bodyStyle.overflowY);
  console.log('%c HTML overflow:', 'color: cyan', window.getComputedStyle(document.documentElement).overflow);
  console.log('%c document.body.scrollWidth:', 'color: yellow', document.body.scrollWidth, '| window.innerWidth:', window.innerWidth);
  console.log('%c document.documentElement.scrollWidth:', 'color: yellow', document.documentElement.scrollWidth);

  if (document.body.scrollWidth > window.innerWidth) {
    console.warn('⚠️  HORIZONTAL OVERFLOW DETECTED on body! Something is wider than the viewport.');
    // Find the widest element
    let widest = null, maxW = 0;
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > maxW) { maxW = r.right; widest = el; }
    });
    console.warn('Widest element (right edge at ' + maxW + 'px):', widest);
  }
})();

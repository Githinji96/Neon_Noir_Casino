// Paste this in browser console on the jackpots page to find overflowing elements
const all = document.querySelectorAll('*');
const overflowing = [];
all.forEach(el => {
  if (el.scrollWidth > document.documentElement.clientWidth) {
    overflowing.push({
      tag: el.tagName,
      id: el.id,
      classes: el.className.toString().substring(0, 80),
      scrollW: el.scrollWidth,
      offsetW: el.offsetWidth,
      clientW: document.documentElement.clientWidth
    });
  }
});
console.table(overflowing.slice(0, 20));

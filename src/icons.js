/**
 * 线性图标 —— 内联 SVG，零依赖、零请求。
 * 统一 24×24 视框、1.7 描边、圆头圆角，继承 currentColor。
 * 不用 emoji：emoji 在不同系统上字形差异极大，且会破坏整体的克制感。
 */

const wrap = (d, extra = '') =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"${extra}>${d}</svg>`;

export const icons = {
  /** 喇叭：发音 */
  speaker: (extra) => wrap(
    '<path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18.4 6.4a8 8 0 0 1 0 11.2"/>',
    extra),

  /** 对勾：完成态 */
  check: (extra) => wrap('<path d="m5 12.5 4.5 4.5L19 7"/>', extra),

  /** 右箭头：下一步 */
  arrow: (extra) => wrap('<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>', extra),

  /** 刷新：重来一组 */
  refresh: (extra) => wrap(
    '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>', extra),

  /** 下载：导出 */
  download: (extra) => wrap(
    '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19h14"/>', extra),

  /** 上传：导入 */
  upload: (extra) => wrap(
    '<path d="M12 20V9"/><path d="m7.5 13.5 4.5-4.5 4.5 4.5"/><path d="M5 5h14"/>', extra),

  /** 星：品牌标记 */
  spark: (extra) => wrap(
    '<path d="M12 3.5 13.9 9l5.6.3-4.4 3.5 1.5 5.4L12 15.2 7.4 18.2l1.5-5.4L4.5 9.3 10.1 9 12 3.5Z"/>',
    extra),

  /** 书：词库 */
  book: (extra) => wrap(
    '<path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 0-2 2v-17Z"/><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2v-17Z"/>',
    extra),

  /** 时钟：到期 */
  clock: (extra) => wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', extra),

  /** 铅笔：语法 */
  pen: (extra) => wrap(
    '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>', extra),
};

/** 把 data-ico="speaker" 的元素批量替换成内联 SVG（含 aria-label 时给 svg 加 title） */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-ico]').forEach((el) => {
    const fn = icons[el.getAttribute('data-ico')];
    if (fn) el.innerHTML = fn();
  });
}

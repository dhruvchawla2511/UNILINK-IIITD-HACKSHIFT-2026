/** Prints the page with its own paper size (a global @page rule would apply to every printout). */
export function printWithPageStyle(css: string, delayMs = 0): void {
  const style = document.createElement('style');
  style.id = 'unilink-print-page';
  style.textContent = `@media print { @page { ${css} } }`;
  document.head.appendChild(style);
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => window.print(), delayMs);
}

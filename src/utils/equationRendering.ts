import { MathJaxBase64 } from "../lib/mathjax/mathjax-asset";

/** Strip only a matching outer math delimiter; preserve TeX environments and labels. */
export function normalizeEquation(source: string): string {
  return source.trim()
    .replace(/^\$\$([\s\S]*)\$\$$/, "$1")
    .replace(/^\$([\s\S]*)\$$/, "$1")
    .replace(/^\\\[([\s\S]*)\\\]$/, "$1")
    .replace(/^\\\(([\s\S]*)\\\)$/, "$1")
    .trim();
}

// Both the editor and PNG export run this exact renderer, using the bundled engine offline.
export function getEquationEngineScript(): string {
  return `
window.MathJax = {
  tex: { packages: {'[+]': ['ams']}, tags: 'ams' },
  svg: { fontCache: 'local' },
  options: { enableMenu: false },
  startup: { typeset: false }
};
${atob(MathJaxBase64)}
window.renderEquationSvg = async function(source, host, fontSize, color) {
  await MathJax.startup.promise;
  // Every edit is a new document: don't accumulate equation numbers or duplicate labels.
  MathJax.texReset();
  var node = await MathJax.tex2svgPromise(source, {
    display: true, em: fontSize, ex: fontSize / 2, containerWidth: 600
  });
  host.replaceChildren(node);
  var error = node.querySelector('[data-mml-node="merror"]');
  if (error) throw new Error(error.getAttribute('data-mjx-error') || error.textContent || 'LaTeX inválido');
  var svg = node.querySelector('svg');
  if (!svg) throw new Error('Não foi possível renderizar a equação.');
  // tex2svg also produces assistive MathML. Without MathJax's document stylesheet
  // that becomes a second, visible formula. Keep one accessible SVG instead.
  node.querySelectorAll('mjx-assistive-mml').forEach(function(item) { item.remove(); });
  svg.removeAttribute('aria-hidden');
  svg.setAttribute('aria-label', source);
  // AMS tags use nested SVG viewports with percentage sizes. Freeze their actual
  // transforms before changing the outer viewport, otherwise resizing moves the tag.
  Array.from(svg.querySelectorAll('svg')).reverse().forEach(function(nested) {
    var parentMatrix = nested.parentNode.getScreenCTM();
    var nestedMatrix = nested.getScreenCTM();
    if (!parentMatrix || !nestedMatrix) return;
    var transform = parentMatrix.inverse().multiply(nestedMatrix);
    var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', 'matrix(' + [transform.a, transform.b, transform.c,
      transform.d, transform.e, transform.f].join(' ') + ')');
    while (nested.firstChild) group.appendChild(nested.firstChild);
    nested.replaceWith(group);
  });
  // Numbered AMS output has a percentage width. Measure it while attached, including
  // the tag, then freeze a self-contained viewport before scaling or rasterizing it.
  var bounds = svg.getBBox();
  var matrix = svg.getScreenCTM();
  if (bounds.width > 0 && bounds.height > 0 && matrix) {
    var padding = 2;
    svg.setAttribute('viewBox', [bounds.x - padding, bounds.y - padding,
      bounds.width + padding * 2, bounds.height + padding * 2].join(' '));
    svg.setAttribute('width', (bounds.width + padding * 2) * Math.abs(matrix.a) + 'px');
    svg.setAttribute('height', (bounds.height + padding * 2) * Math.abs(matrix.d) + 'px');
    svg.style.minWidth = '';
    svg.style.maxWidth = 'none';
  }
  svg.style.color = color;
  svg.style.display = 'block';
  svg.style.overflow = 'hidden';
  node.style.width = 'max-content';
  node.style.minWidth = '0';
  node.style.margin = '0';
  host.style.width = svg.getBoundingClientRect().width + 'px';
  return svg;
};`;
}

/** JSON embedded in an HTML script must not be able to terminate the script element. */
export function equationScriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

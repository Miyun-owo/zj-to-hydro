const { JSDOM } = require('jsdom');

export function htmlToOJMarkdown(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  return walk(document.body)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(\$\$[^\$]*\$\$)/g, '$1\n')
    .trim();
}

function walk(node) {
  if (node.nodeType === node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType === node.ELEMENT_NODE) {
    const el = node;
    const children = Array.from(el.childNodes).map(walk).join('');

    switch (el.tagName.toLowerCase()) {
      case 'h1': return `<h1> ${children}</h1>\n\n`;
      case 'h2': return `<h2> ${children}</h2>\n\n`;
      case 'h3': return `<h3> ${children}</h3>\n\n`;
      case 'h4': return `<h4> ${children}</h4>\n\n`;
      case 'h5': return `<h5> ${children}</h5>\n\n`;
      case 'h6': return `<h6> ${children}</h6>\n\n`;
      case 'p': return `${children}\n\n`;
      case 'strong': return `<strong>${children}</strong>`;
      case 'em': return `<em>${children}</em>`;
      case 'sup': return `<sup>${children}</sup>`;
      case 'sub': return `<sub>${children}</sub>`;
      case 'code':
        return el.parentElement?.tagName.toLowerCase() === 'pre'
          ? children
          : `<code>${children}</code>`;
      case 'pre':
        return `\n\`\`\`\n${children}\n\`\`\`\n`;
      case 'ul':
        return `\n${children}`;
      case 'ol':
        return `\n${renderOrderedList(el)}`;
      case 'li':
        return `- ${children}\n`;
      case 'img':
        return renderImage(el);
      case 'span':
        return renderSpan(el);
      case 'table':
        return renderTable(el);
      case 'hr':
        return `\n---\n\n`;
      case 'br':
        return `\n`;
      case 'div':
        return `${children}\n`;
      default:
        return children;
    }
  }

  return '';
}

function renderSpan(el) {
  const cls = el.className;
  const children = Array.from(el.childNodes).map(walk).join('');

  // Math spans
  if (cls.includes('math-inline') || cls.includes('MathJax')) {
    return `$${extractMath(el)}$`;
  }
  if (cls.includes('math-display')) {
    return `\n$$\n${extractMath(el)}\n$$\n`;
  }

  // Style-based decorations
  const dec = (el.style && typeof el.style.textDecoration === 'string')
    ? el.style.textDecoration.toLowerCase()
    : '';
  if (dec.includes('underline')) {
    return `<u>${children}</u>`;
  }
  if (dec.includes('line-through')) {
    return `~~${children}~~`;
  }

  // Fallback to raw style attribute parsing
  const styleAttr = (el.getAttribute('style') || '').toLowerCase();
  if (styleAttr.includes('text-decoration') && styleAttr.includes('underline')) {
    return `<u>${children}</u>`;
  }
  if (styleAttr.includes('text-decoration') && styleAttr.includes('line-through')) {
    return `~~${children}~~`;
  }

  return children;
}

function extractMath(el) {
  return normalizeMath(el.textContent ?? '');
}

// LaTeX command to Unicode symbol mapping
const LATEX_TO_UNICODE = {
  // Comparison operators
  '\\leq': '≤', '\\le': '≤',
  '\\geq': '≥', '\\ge': '≥',
  '\\neq': '≠', '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  
  // Arithmetic operators
  '\\times': '×',
  '\\cdot': '·',
  '\\div': '÷',
  '\\pm': '±',
  '\\mp': '∓',
  
  // Arrows
  '\\to': '→', '\\rightarrow': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔',
  
  // Greek letters (lowercase)
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  
  // Greek letters (uppercase)
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
  '\\Psi': 'Ψ', '\\Omega': 'Ω',
  
  // Logic symbols
  '\\forall': '∀', '\\exists': '∃',
  '\\wedge': '∧', '\\vee': '∨', '\\neg': '¬',
  '\\land': '∧', '\\lor': '∨',
  
  // Set theory
  '\\in': '∈', '\\notin': '∉',
  '\\subset': '⊂', '\\subseteq': '⊆',
  '\\supset': '⊃', '\\supseteq': '⊇',
  '\\cup': '∪', '\\cap': '∩',
  '\\emptyset': '∅',
  
  // Misc
  '\\infty': '∞', '\\partial': '∂',
  '\\nabla': '∇', '\\sum': '∑',
  '\\prod': '∏', '\\int': '∫',
};

function normalizeMath(s) {
  // Normalize whitespace first
  s = s.replace(/\s+/g, ' ');
  
  // Replace all known LaTeX commands with Unicode equivalents
  // Sort by length (descending) to match longer commands first
  const commands = Object.keys(LATEX_TO_UNICODE).sort((a, b) => b.length - a.length);
  for (const cmd of commands) {
    s = s.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), LATEX_TO_UNICODE[cmd]);
  }
  
  // Remove any remaining unrecognized LaTeX commands
  s = s.replace(/\\[a-zA-Z]+/g, '');
  
  // Remove any remaining backslashes
  s = s.replace(/\\/g, '');
  
  return s.trim();
}

function renderImage(el) {
  const src = el.getAttribute('src') ?? '';
  const alt = el.getAttribute('alt') ?? '';
  return `![${alt}](${src})`;
}

function renderOrderedList(el) {
  let counter = 1;
  return Array.from(el.childNodes)
    .filter(node => node.nodeType === node.ELEMENT_NODE && node.tagName.toLowerCase() === 'li')
    .map(li => {
      const content = Array.from(li.childNodes).map(walk).join('');
      return `${counter++}. ${content}\n`;
    })
    .join('');
}

function renderTable(el) {
  const rows = Array.from(el.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  let table = '\n| ';
  
  // Process header row
  const headerCells = rows[0].querySelectorAll('td, th');
  table += Array.from(headerCells)
    .map(cell => Array.from(cell.childNodes).map(walk).join('').trim())
    .join(' | ');
  table += ' |\n|';
  
  // Add separator
  for (let i = 0; i < headerCells.length; i++) {
    table += ' --- |';
  }
  table += '\n';
  
  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    table += '| ';
    const cells = rows[i].querySelectorAll('td, th');
    table += Array.from(cells)
      .map(cell => Array.from(cell.childNodes).map(walk).join('').trim() || '&nbsp;')
      .join(' | ');
    table += ' |\n';
  }
  
  return table + '\n';
}
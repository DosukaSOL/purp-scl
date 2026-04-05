// ============================================================================
// Purp Formatter v0.2.0 — The Solana Coding Language
// Consistent code formatting for .purp files
// ============================================================================

export interface FormatOptions {
  indentSize: number;
  maxLineWidth: number;
  trailingComma: boolean;
  singleQuotes: boolean;
}

const DEFAULT_OPTIONS: FormatOptions = {
  indentSize: 2,
  maxLineWidth: 100,
  trailingComma: true,
  singleQuotes: false,
};

export class PurpFormatter {
  private options: FormatOptions;

  constructor(options?: Partial<FormatOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  format(source: string): string {
    const lines = source.split('\n');
    const formatted: string[] = [];
    let indent = 0;
    let inMultiLineComment = false;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      // Track multi-line comments
      if (inMultiLineComment) {
        formatted.push(this.indentStr(indent) + trimmed);
        if (trimmed.includes('*/')) inMultiLineComment = false;
        continue;
      }
      if (trimmed.startsWith('/*')) {
        inMultiLineComment = !trimmed.includes('*/');
        formatted.push(this.indentStr(indent) + trimmed);
        continue;
      }

      // Empty lines
      if (trimmed === '') {
        formatted.push('');
        continue;
      }

      // Comments
      if (trimmed.startsWith('//')) {
        formatted.push(this.indentStr(indent) + trimmed);
        continue;
      }

      // Closing braces decrease indent first
      if (trimmed.startsWith('}') || trimmed.startsWith(')') || trimmed.startsWith(']')) {
        indent = Math.max(0, indent - 1);
      }

      // Format the line
      let formattedLine = this.formatLine(trimmed);
      formatted.push(this.indentStr(indent) + formattedLine);

      // Opening braces increase indent
      const opens = (formattedLine.match(/[{(\[]/g) ?? []).length;
      const closes = (formattedLine.match(/[})\]]/g) ?? []).length;
      indent += opens - closes;
      if (indent < 0) indent = 0;
    }

    // Clean up multiple blank lines
    let result = formatted.join('\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    // Ensure trailing newline
    if (!result.endsWith('\n')) result += '\n';
    return result;
  }

  private formatLine(line: string): string {
    // Normalize whitespace around operators
    line = line.replace(/\s*([=+\-*/<>!&|^%]+=?)\s*/g, ' $1 ');
    // Fix double spaces
    line = line.replace(/  +/g, ' ');
    // Fix spaces around colons in type annotations
    line = line.replace(/\s*:\s*/g, ': ');
    // Fix spaces after commas
    line = line.replace(/,\s*/g, ', ');
    // Fix arrow spacing
    line = line.replace(/\s*->\s*/g, ' -> ');
    line = line.replace(/\s*=>\s*/g, ' => ');
    // Trim
    return line.trim();
  }

  private indentStr(level: number): string {
    return ' '.repeat(level * this.options.indentSize);
  }
}

export function formatPurpFile(source: string, options?: Partial<FormatOptions>): string {
  const formatter = new PurpFormatter(options);
  return formatter.format(source);
}

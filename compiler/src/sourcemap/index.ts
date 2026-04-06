// ============================================================================
// Purp Source Map Generator v1.0.0 — The Solana Coding Language
// Maps source locations to generated output locations
// ============================================================================

export interface SourceMapping {
  sourceLine: number;
  sourceColumn: number;
  generatedLine: number;
  generatedColumn: number;
  sourceFile: string;
  name?: string;
}

export class SourceMap {
  private mappings: SourceMapping[] = [];
  private sourceFile: string;

  constructor(sourceFile: string) {
    this.sourceFile = sourceFile;
  }

  addMapping(mapping: SourceMapping): void {
    this.mappings.push(mapping);
  }

  addSimpleMapping(sourceLine: number, generatedLine: number, name?: string): void {
    this.mappings.push({
      sourceLine,
      sourceColumn: 0,
      generatedLine,
      generatedColumn: 0,
      sourceFile: this.sourceFile,
      name,
    });
  }

  getMappings(): SourceMapping[] {
    return [...this.mappings];
  }

  findSourceLocation(generatedLine: number): { line: number; column: number; file: string } | null {
    // Find closest mapping
    let closest: SourceMapping | null = null;
    let closestDist = Infinity;

    for (const m of this.mappings) {
      const dist = Math.abs(m.generatedLine - generatedLine);
      if (dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    }

    if (closest) {
      return { line: closest.sourceLine, column: closest.sourceColumn, file: closest.sourceFile };
    }
    return null;
  }

  findGeneratedLocation(sourceLine: number): { line: number; column: number } | null {
    for (const m of this.mappings) {
      if (m.sourceLine === sourceLine) {
        return { line: m.generatedLine, column: m.generatedColumn };
      }
    }
    return null;
  }

  // Generate source map in V3 JSON format
  toJSON(): object {
    return {
      version: 3,
      file: this.sourceFile.replace('.purp', '.rs'),
      sourceRoot: '',
      sources: [this.sourceFile],
      names: [...new Set(this.mappings.filter(m => m.name).map(m => m.name!))],
      mappings: this.encodeVLQ(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  // Base64 VLQ encoding for source map V3 format
  private encodeVLQ(): string {
    if (this.mappings.length === 0) return '';

    const sorted = [...this.mappings].sort((a, b) =>
      a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn
    );

    const names = [...new Set(this.mappings.filter(m => m.name).map(m => m.name!))];
    const nameIndex = new Map(names.map((n, i) => [n, i]));

    const lines: string[][] = [];
    let currentLine = 1;
    let prevGenCol = 0;
    let prevSourceIdx = 0;
    let prevSourceLine = 0;
    let prevSourceCol = 0;
    let prevNameIdx = 0;

    for (const mapping of sorted) {
      // Pad empty lines
      while (currentLine < mapping.generatedLine) {
        lines.push([]);
        currentLine++;
        prevGenCol = 0; // reset column per line
      }

      if (!lines[lines.length - 1]) lines.push([]);

      // Each segment: genCol, sourceIdx, sourceLine, sourceCol [, nameIdx]
      const segments: number[] = [
        mapping.generatedColumn - prevGenCol,
        0 - prevSourceIdx, // only one source file (index 0)
        mapping.sourceLine - prevSourceLine,
        mapping.sourceColumn - prevSourceCol,
      ];

      if (mapping.name) {
        const nIdx = nameIndex.get(mapping.name) ?? 0;
        segments.push(nIdx - prevNameIdx);
        prevNameIdx = nIdx;
      }

      prevGenCol = mapping.generatedColumn;
      prevSourceIdx = 0;
      prevSourceLine = mapping.sourceLine;
      prevSourceCol = mapping.sourceColumn;

      lines[lines.length - 1].push(segments.map(v => encodeVLQValue(v)).join(''));
    }

    return lines.map(l => l.join(',')).join(';');
  }
}

export class SourceMapBuilder {
  private sourceMap: SourceMap;
  private currentGeneratedLine: number = 1;

  constructor(sourceFile: string) {
    this.sourceMap = new SourceMap(sourceFile);
  }

  trackLine(sourceLine: number, name?: string): void {
    this.sourceMap.addSimpleMapping(sourceLine, this.currentGeneratedLine, name);
  }

  nextLine(): void {
    this.currentGeneratedLine++;
  }

  advanceLines(count: number): void {
    this.currentGeneratedLine += count;
  }

  build(): SourceMap {
    return this.sourceMap;
  }
}

// ============================================================================
// VLQ Encoding — Standard Base64 VLQ for Source Map V3
// ============================================================================

const VLQ_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT; // 32
const VLQ_BASE_MASK = VLQ_BASE - 1;   // 31
const VLQ_CONTINUATION_BIT = VLQ_BASE; // 32

function encodeVLQValue(value: number): string {
  let result = '';
  let vlq = value < 0 ? ((-value) << 1) + 1 : (value << 1);

  do {
    let digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) digit |= VLQ_CONTINUATION_BIT;
    result += VLQ_BASE64[digit];
  } while (vlq > 0);

  return result;
}

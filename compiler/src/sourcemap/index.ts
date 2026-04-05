// ============================================================================
// Purp Source Map Generator v0.2.0 — The Solana Coding Language
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

  // Simplified VLQ encoding for source map V3 format
  private encodeVLQ(): string {
    if (this.mappings.length === 0) return '';

    const sorted = [...this.mappings].sort((a, b) => a.generatedLine - b.generatedLine);
    const lines: string[][] = [];
    let currentLine = 1;

    for (const mapping of sorted) {
      while (currentLine < mapping.generatedLine) {
        lines.push([]);
        currentLine++;
      }
      // Simplified: just mark that a mapping exists
      if (!lines[lines.length - 1]) lines.push([]);
      lines[lines.length - 1].push('AAAA');
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

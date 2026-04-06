// Purp SCL — Source Map Tests

import { SourceMap, SourceMapBuilder } from '../compiler/src/sourcemap/index.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('\n=== Source Map Tests ===\n');

test('create source map', () => {
  const sm = new SourceMap('test.purp');
  assert(sm !== undefined, 'Should create SourceMap');
});

test('add and retrieve mappings', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 1, sourceColumn: 0,
    generatedLine: 5, generatedColumn: 0,
    sourceFile: 'test.purp',
  });
  const mappings = sm.getMappings();
  assert(mappings.length === 1, 'Should have 1 mapping');
  assert(mappings[0].sourceLine === 1, 'Source line should be 1');
  assert(mappings[0].generatedLine === 5, 'Generated line should be 5');
});

test('add simple mapping', () => {
  const sm = new SourceMap('test.purp');
  sm.addSimpleMapping(10, 20, 'test_fn');
  const mappings = sm.getMappings();
  assert(mappings.length === 1, 'Should have 1 mapping');
  assert(mappings[0].sourceLine === 10, 'Source line should be 10');
  assert(mappings[0].generatedLine === 20, 'Generated line should be 20');
  assert(mappings[0].name === 'test_fn', 'Name should be test_fn');
});

test('find source location from generated line', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 5, sourceColumn: 3,
    generatedLine: 15, generatedColumn: 0,
    sourceFile: 'test.purp',
  });
  const loc = sm.findSourceLocation(15);
  assert(loc !== null, 'Should find location');
  assert(loc!.line === 5, 'Should map back to source line 5');
  assert(loc!.column === 3, 'Should map back to source column 3');
});

test('find generated location from source line', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 5, sourceColumn: 0,
    generatedLine: 15, generatedColumn: 4,
    sourceFile: 'test.purp',
  });
  const loc = sm.findGeneratedLocation(5);
  assert(loc !== null, 'Should find location');
  assert(loc!.line === 15, 'Should map to generated line 15');
  assert(loc!.column === 4, 'Should map to generated column 4');
});

test('find closest source location', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 10, sourceColumn: 0,
    generatedLine: 20, generatedColumn: 0,
    sourceFile: 'test.purp',
  });
  const loc = sm.findSourceLocation(21); // close to 20
  assert(loc !== null, 'Should find closest mapping');
  assert(loc!.line === 10, 'Should return closest source line');
});

test('return null for empty source map lookup', () => {
  const sm = new SourceMap('test.purp');
  const loc = sm.findSourceLocation(10);
  assert(loc === null, 'Should return null for empty source map');
});

test('return null for unmatched generated location', () => {
  const sm = new SourceMap('test.purp');
  const loc = sm.findGeneratedLocation(999);
  assert(loc === null, 'Should return null for unmatched source line');
});

test('toJSON produces V3 format', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 1, sourceColumn: 0,
    generatedLine: 1, generatedColumn: 0,
    sourceFile: 'test.purp',
  });
  const json = sm.toJSON() as any;
  assert(json.version === 3, 'Version should be 3');
  assert(json.sources[0] === 'test.purp', 'Source should be test.purp');
  assert(json.file === 'test.rs', 'Output file should be test.rs');
  assert(typeof json.mappings === 'string', 'Mappings should be a string');
});

test('toJSON mappings are VLQ-encoded strings', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({
    sourceLine: 0, sourceColumn: 0,
    generatedLine: 1, generatedColumn: 0,
    sourceFile: 'test.purp',
  });
  const json = sm.toJSON() as any;
  // VLQ encoding of (0,0,0,0) should be 'AAAA'
  assert(json.mappings.includes('AAAA'), `Mappings should contain valid VLQ, got: ${json.mappings}`);
});

test('toString produces valid JSON string', () => {
  const sm = new SourceMap('test.purp');
  const str = sm.toString();
  const parsed = JSON.parse(str);
  assert(parsed.version === 3, 'Should parse as valid V3 source map');
});

test('multiple mappings across lines', () => {
  const sm = new SourceMap('test.purp');
  sm.addMapping({ sourceLine: 1, sourceColumn: 0, generatedLine: 1, generatedColumn: 0, sourceFile: 'test.purp', name: 'fn1' });
  sm.addMapping({ sourceLine: 5, sourceColumn: 0, generatedLine: 10, generatedColumn: 0, sourceFile: 'test.purp', name: 'fn2' });
  sm.addMapping({ sourceLine: 10, sourceColumn: 0, generatedLine: 20, generatedColumn: 0, sourceFile: 'test.purp' });
  
  const mappings = sm.getMappings();
  assert(mappings.length === 3, 'Should have 3 mappings');
  
  const json = sm.toJSON() as any;
  assert(json.names.includes('fn1'), 'Names should contain fn1');
  assert(json.names.includes('fn2'), 'Names should contain fn2');
  assert(json.mappings.includes(';'), 'Mappings should have line separators');
});

test('SourceMapBuilder tracks lines', () => {
  const builder = new SourceMapBuilder('test.purp');
  builder.trackLine(1, 'program');
  builder.nextLine();
  builder.trackLine(2, 'account');
  builder.nextLine();
  builder.nextLine();
  builder.trackLine(5, 'instruction');
  
  const sm = builder.build();
  const mappings = sm.getMappings();
  assert(mappings.length === 3, 'Should have 3 tracked mappings');
});

test('SourceMapBuilder advanceLines', () => {
  const builder = new SourceMapBuilder('test.purp');
  builder.trackLine(1);
  builder.advanceLines(10);
  builder.trackLine(5);
  
  const sm = builder.build();
  const mappings = sm.getMappings();
  assert(mappings.length === 2, 'Should have 2 mappings');
  assert(mappings[0].generatedLine === 1, 'First should be at line 1');
  assert(mappings[1].generatedLine === 11, 'Second should be at line 11');
});

console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
if (failed > 0) process.exit(1);

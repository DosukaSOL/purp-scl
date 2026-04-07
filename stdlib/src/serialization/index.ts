// Purp Standard Library — Serialization Module
// Borsh-compatible serialization helpers with complex type support

export class BorshWriter {
  private buffer: number[] = [];

  writeU8(value: number): void { this.buffer.push(value & 0xff); }
  writeU16(value: number): void { this.writeU8(value); this.writeU8(value >> 8); }
  writeU32(value: number): void { this.writeU16(value); this.writeU16(value >> 16); }
  writeU64(value: bigint): void {
    for (let i = 0; i < 8; i++) { this.writeU8(Number(value & 0xffn)); value >>= 8n; }
  }
  writeI8(value: number): void { this.writeU8(value < 0 ? value + 256 : value); }
  writeI16(value: number): void { this.writeU16(value < 0 ? value + 65536 : value); }
  writeI32(value: number): void { this.writeU32(value < 0 ? value + 4294967296 : value); }
  writeI64(value: bigint): void { this.writeU64(value < 0n ? value + (1n << 64n) : value); }
  writeI128(value: bigint): void {
    const unsigned = value < 0n ? value + (1n << 128n) : value;
    this.writeU64(unsigned & 0xffffffffffffffffn);
    this.writeU64(unsigned >> 64n);
  }
  writeU128(value: bigint): void {
    this.writeU64(value & 0xffffffffffffffffn);
    this.writeU64(value >> 64n);
  }
  writeF32(value: number): void {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    const bytes = new Uint8Array(buf);
    for (const b of bytes) this.writeU8(b);
  }
  writeF64(value: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    const bytes = new Uint8Array(buf);
    for (const b of bytes) this.writeU8(b);
  }
  writeBool(value: boolean): void { this.writeU8(value ? 1 : 0); }
  writeString(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.writeU32(encoded.length);
    for (const byte of encoded) this.writeU8(byte);
  }
  writeBytes(value: Uint8Array): void {
    this.writeU32(value.length);
    for (const byte of value) this.writeU8(byte);
  }
  writeFixedBytes(value: Uint8Array): void {
    for (const byte of value) this.writeU8(byte);
  }
  writePubkey(value: string): void {
    // Placeholder: In real impl, decode base58 to 32 bytes
    const bytes = new TextEncoder().encode(value.padEnd(32, '\0').slice(0, 32));
    for (const byte of bytes) this.writeU8(byte);
  }

  // === Complex Types ===

  writeOption<T>(value: T | null | undefined, writeFn: (writer: BorshWriter, v: T) => void): void {
    if (value === null || value === undefined) {
      this.writeU8(0); // None
    } else {
      this.writeU8(1); // Some
      writeFn(this, value);
    }
  }

  writeVec<T>(items: T[], writeFn: (writer: BorshWriter, item: T) => void): void {
    this.writeU32(items.length);
    for (const item of items) writeFn(this, item);
  }

  writeMap<K, V>(
    map: Map<K, V>,
    writeKey: (writer: BorshWriter, key: K) => void,
    writeValue: (writer: BorshWriter, val: V) => void,
  ): void {
    this.writeU32(map.size);
    for (const [key, value] of map) {
      writeKey(this, key);
      writeValue(this, value);
    }
  }

  writeEnum(variantIndex: number, writeData?: (writer: BorshWriter) => void): void {
    this.writeU8(variantIndex);
    if (writeData) writeData(this);
  }

  writeStruct(writeFn: (writer: BorshWriter) => void): void {
    writeFn(this);
  }

  toBuffer(): Uint8Array { return new Uint8Array(this.buffer); }
}

export class BorshReader {
  private view: DataView;
  private offset: number = 0;

  constructor(data: Uint8Array) { this.view = new DataView(data.buffer, data.byteOffset, data.byteLength); }

  get remaining(): number { return this.view.byteLength - this.offset; }

  readU8(): number { return this.view.getUint8(this.offset++); }
  readU16(): number { const v = this.view.getUint16(this.offset, true); this.offset += 2; return v; }
  readU32(): number { const v = this.view.getUint32(this.offset, true); this.offset += 4; return v; }
  readU64(): bigint { const v = this.view.getBigUint64(this.offset, true); this.offset += 8; return v; }
  readI8(): number { return this.view.getInt8(this.offset++); }
  readI16(): number { const v = this.view.getInt16(this.offset, true); this.offset += 2; return v; }
  readI32(): number { const v = this.view.getInt32(this.offset, true); this.offset += 4; return v; }
  readI64(): bigint { const v = this.view.getBigInt64(this.offset, true); this.offset += 8; return v; }
  readI128(): bigint {
    const low = this.readU64();
    const high = this.readI64();
    return (high << 64n) | low;
  }
  readU128(): bigint {
    const low = this.readU64();
    const high = this.readU64();
    return (high << 64n) | low;
  }
  readF32(): number { const v = this.view.getFloat32(this.offset, true); this.offset += 4; return v; }
  readF64(): number { const v = this.view.getFloat64(this.offset, true); this.offset += 8; return v; }
  readBool(): boolean { return this.readU8() !== 0; }
  readString(): string {
    const len = this.readU32();
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }
  readBytes(): Uint8Array {
    const len = this.readU32();
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return bytes;
  }
  readFixedBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
    this.offset += length;
    return bytes;
  }
  readPubkey(): Uint8Array {
    return this.readFixedBytes(32);
  }

  // === Complex Types ===

  readOption<T>(readFn: (reader: BorshReader) => T): T | null {
    const tag = this.readU8();
    if (tag === 0) return null;
    return readFn(this);
  }

  readVec<T>(readFn: (reader: BorshReader) => T): T[] {
    const len = this.readU32();
    const items: T[] = [];
    for (let i = 0; i < len; i++) items.push(readFn(this));
    return items;
  }

  readMap<K, V>(
    readKey: (reader: BorshReader) => K,
    readValue: (reader: BorshReader) => V,
  ): Map<K, V> {
    const len = this.readU32();
    const map = new Map<K, V>();
    for (let i = 0; i < len; i++) {
      map.set(readKey(this), readValue(this));
    }
    return map;
  }

  readEnum<T>(readers: ((reader: BorshReader) => T)[]): T {
    const variantIndex = this.readU8();
    if (variantIndex >= readers.length) throw new Error(`Unknown enum variant: ${variantIndex}`);
    return readers[variantIndex](this);
  }
}

// Purp Standard Library — Serialization Module
// Borsh-compatible serialization helpers

export class BorshWriter {
  private buffer: number[] = [];

  writeU8(value: number): void { this.buffer.push(value & 0xff); }
  writeU16(value: number): void { this.writeU8(value); this.writeU8(value >> 8); }
  writeU32(value: number): void { this.writeU16(value); this.writeU16(value >> 16); }
  writeU64(value: bigint): void {
    for (let i = 0; i < 8; i++) { this.writeU8(Number(value & 0xffn)); value >>= 8n; }
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
  writePubkey(value: string): void {
    // Placeholder: In real impl, decode base58 to 32 bytes
    const bytes = new TextEncoder().encode(value.padEnd(32, '\0').slice(0, 32));
    for (const byte of bytes) this.writeU8(byte);
  }
  toBuffer(): Uint8Array { return new Uint8Array(this.buffer); }
}

export class BorshReader {
  private view: DataView;
  private offset: number = 0;

  constructor(data: Uint8Array) { this.view = new DataView(data.buffer, data.byteOffset, data.byteLength); }
  readU8(): number { return this.view.getUint8(this.offset++); }
  readU16(): number { const v = this.view.getUint16(this.offset, true); this.offset += 2; return v; }
  readU32(): number { const v = this.view.getUint32(this.offset, true); this.offset += 4; return v; }
  readU64(): bigint { const v = this.view.getBigUint64(this.offset, true); this.offset += 8; return v; }
  readBool(): boolean { return this.readU8() !== 0; }
  readString(): string {
    const len = this.readU32();
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }
}

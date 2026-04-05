// Purp Runtime — Account Serialization

import { BorshWriter, BorshReader } from '../../stdlib/src/serialization/index.js';

export interface FieldSchema {
  name: string;
  type: 'u8' | 'u16' | 'u32' | 'u64' | 'bool' | 'string' | 'pubkey' | 'bytes';
}

export class AccountSerializer {
  static serialize(schema: FieldSchema[], data: Record<string, any>): Uint8Array {
    const writer = new BorshWriter();
    for (const field of schema) {
      const value = data[field.name];
      switch (field.type) {
        case 'u8': writer.writeU8(value); break;
        case 'u16': writer.writeU16(value); break;
        case 'u32': writer.writeU32(value); break;
        case 'u64': writer.writeU64(BigInt(value)); break;
        case 'bool': writer.writeBool(value); break;
        case 'string': writer.writeString(value); break;
        case 'pubkey': writer.writePubkey(value); break;
        case 'bytes': writer.writeBytes(value); break;
      }
    }
    return writer.toBuffer();
  }
}

export class AccountDeserializer {
  static deserialize(schema: FieldSchema[], data: Uint8Array): Record<string, any> {
    const reader = new BorshReader(data);
    const result: Record<string, any> = {};
    for (const field of schema) {
      switch (field.type) {
        case 'u8': result[field.name] = reader.readU8(); break;
        case 'u16': result[field.name] = reader.readU16(); break;
        case 'u32': result[field.name] = reader.readU32(); break;
        case 'u64': result[field.name] = reader.readU64(); break;
        case 'bool': result[field.name] = reader.readBool(); break;
        case 'string': result[field.name] = reader.readString(); break;
        default: break;
      }
    }
    return result;
  }
}

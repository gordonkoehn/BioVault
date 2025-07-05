import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-32-character-key-here';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

export class BiometricEncryption {
  private static generateKey(password: string, salt: string): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 1000
    });
  }

  static encrypt(data: string, userKey?: string): EncryptedData {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = this.generateKey(ENCRYPTION_KEY + (userKey || ''), salt.toString());
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC
    });

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
      salt: salt.toString()
    };
  }

  static decrypt(encryptedData: EncryptedData, userKey?: string): string {
    const key = this.generateKey(ENCRYPTION_KEY + (userKey || ''), encryptedData.salt);
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, key, {
      iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  static generateHash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  static generateFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(hash);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
} 
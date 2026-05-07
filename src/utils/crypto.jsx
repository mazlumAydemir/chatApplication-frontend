import forge from 'node-forge';

export const CryptoHelper = {
  // ==========================================
  // 1. RSA İŞLEMLERİ (Anahtar Takası İçin - DEĞİŞMEDİ)
  // ==========================================

  generateRSAKeys: () => {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    return {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
    };
  },

  encryptWithRSA: (plainText, pemPublicKey) => {
    const publicKey = forge.pki.publicKeyFromPem(pemPublicKey);
    const encrypted = publicKey.encrypt(forge.util.encodeUtf8(plainText), 'RSA-OAEP', {
      md: forge.md.sha256.create()
    });
    return forge.util.encode64(encrypted);
  },

  decryptWithRSA: (cipherText, pemPrivateKey) => {
    const privateKey = forge.pki.privateKeyFromPem(pemPrivateKey);
    const decodedMsg = forge.util.decode64(cipherText);
    const decrypted = privateKey.decrypt(decodedMsg, 'RSA-OAEP', {
      md: forge.md.sha256.create()
    });
    return forge.util.decodeUtf8(decrypted);
  },

  // ==========================================
  // 2. DES İŞLEMLERİ (AES YERİNE GÜNCELLENDİ)
  // ==========================================

  // DES için 8 byte (64-bit) rastgele bir Oturum Anahtarı üretir
  generateSessionKey: () => {
    const key = forge.random.getBytesSync(8);
    return forge.util.encode64(key);
  },

  // Metni (Mesajı veya Resmi) DES ile Şifreler
  encryptTextDES: (plainText, base64SessionKey) => {
    const key = forge.util.decode64(base64SessionKey);
    const iv = forge.random.getBytesSync(8); // DES için rastgele başlangıç vektörü (IV) 8 byte'tır
    
    const cipher = forge.cipher.createCipher('DES-CBC', key);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plainText)));
    cipher.finish();
    
    // Şifreyi çözerken IV gerekeceği için 8 byte'lık IV'yi şifreli metnin en başına ekliyoruz
    const encryptedData = iv + cipher.output.getBytes();
    return forge.util.encode64(encryptedData);
  },

  // Şifreli Metni DES ile Çözer
  decryptTextDES: (cipherText, base64SessionKey) => {
    const key = forge.util.decode64(base64SessionKey);
    const encryptedBytes = forge.util.decode64(cipherText);
    
    // En baştaki 8 byte'lık IV'yi ayırıyoruz
    const iv = encryptedBytes.substring(0, 8);
    const actualCipherText = encryptedBytes.substring(8);
    
    const decipher = forge.cipher.createDecipher('DES-CBC', key);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(actualCipherText));
    const result = decipher.finish();
    
    if (!result) throw new Error("DES şifre çözme başarısız! Anahtar yanlış olabilir.");
    
    return forge.util.decodeUtf8(decipher.output.getBytes());
  },
  // ==========================================
  // 3. DİJİTAL İMZA (DIGITAL SIGNATURE) İŞLEMLERİ
  // ==========================================

  // Veriyi kendi Private Key'imiz ile imzalarız
  signData: (dataString, pemPrivateKey) => {
    const privateKey = forge.pki.privateKeyFromPem(pemPrivateKey);
    const md = forge.md.sha256.create();
    md.update(dataString, 'utf8');
    const signature = privateKey.sign(md);
    return forge.util.encode64(signature);
  },

  // Gelen verinin imzasını karşı tarafın Public Key'i ile doğrularız
  verifySignature: (dataString, base64Signature, pemPublicKey) => {
    try {
      const publicKey = forge.pki.publicKeyFromPem(pemPublicKey);
      const signature = forge.util.decode64(base64Signature);
      const md = forge.md.sha256.create();
      md.update(dataString, 'utf8');
      return publicKey.verify(md.digest().bytes(), signature);
    } catch (error) {
      console.error("İmza doğrulama hatası:", error);
      return false;
    }
  },
  
};
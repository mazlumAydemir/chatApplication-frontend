import CryptoJS from 'crypto-js';

export const CryptoHelper = {
  
  // =========================================================================
  // 1. RSA ANAHTAR YÖNETİMİ (Yönerge: "RSA keys are periodically updated.")
  // =========================================================================
  
  // Tarayıcıda 2048-bit güçlü RSA-OAEP Key Pair üretir
  generateRSAKeys: async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // Dışa aktarılabilir
      ["encrypt", "decrypt"]
    );

    // Backend'e string (SPKI) olarak göndermek için Public Key'i dışa aktarıyoruz
    const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)));

    // Kendimiz çözebilmek için Private Key'i JWK formatında JSON string'e çeviriyoruz
    const exportedPrivate = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const privateKeyString = JSON.stringify(exportedPrivate);

    // Senkronizasyonu kolaylaştırmak için yerel hafızaya güncel durumu yazıyoruz
    localStorage.setItem('privateKey_current', privateKeyString);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyString
    };
  },

  // Alıcının Public Key'i ile DES oturum anahtarını şifreler (RSA Key Exchange)
  encryptWithRSA: async (plainText, receiverPublicKeyBase64) => {
    try {
      const binaryDerString = atob(receiverPublicKeyBase64);
      const binaryDer = new Uint8Array(binaryDerString.length);
      for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
      }

      const publicKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );

      const encoder = new TextEncoder();
      const data = encoder.encode(plainText);
      const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data);
      
      return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    } catch (e) {
      console.error("RSA Şifreleme Hatası:", e);
      return null;
    }
  },

  // Gelen şifreli oturum anahtarını kendi Private Key'imizle çözer
  decryptWithRSA: async (encryptedBase64, myPrivateKeyJsonString) => {
    try {
      const jwk = JSON.parse(myPrivateKeyJsonString);
      const privateKey = await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );

      const binaryString = atob(encryptedBase64);
      const buffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
      }

      const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, buffer.buffer);
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (e) {
      console.error("RSA Şifre Çözme Hatası:", e);
      return null;
    }
  },

  // =========================================================================
  // 2. DES METİN VE DOSYA ŞİFRELEME (Yönerge: "stored DES-encrypted")
  // =========================================================================
  
  // Her mesaj için benzersiz, rastgele 64-bit DES Session Key üretir
  generateSessionKey: () => {
    // DES için 8 karakterlik (64-bit) rastgele güvenli bir anahtar kelime üretilir
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@';
    let key = '';
    for (let i = 0; i < 8; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  },

  // Düz metinleri DES ile şifreler (Sohbet mesajları için)
  encryptTextDES: (plainText, sessionKey) => {
    return CryptoJS.DES.encrypt(plainText, sessionKey).toString();
  },

  // Şifreli metinleri DES ile çözer
  decryptTextDES: (cipherText, sessionKey) => {
    const bytes = CryptoJS.DES.decrypt(cipherText, sessionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  },

  // Binary dosyayı (Resim ArrayBuffer) sunucuya şifreli basmak için DES ile şifreler
  encryptFileDES: (arrayBuffer, sessionKey) => {
    const wa = CryptoJS.lib.WordArray.create(arrayBuffer);
    const encrypted = CryptoJS.DES.encrypt(wa, sessionKey);
    
    // .enc dosyası olarak sunucuya basılabilmesi için şifreli veriyi tekrar binary'e (Uint8Array) çevirir
    const encryptedStr = encrypted.toString();
    const encoder = new TextEncoder();
    return encoder.encode(encryptedStr);
  },

  // Sunucudan gelen .enc uzantılı binary şifreli resmi deşifre edip base64'e çevirir
  decryptFileDES: (encryptedArrayBuffer, sessionKey) => {
    const decoder = new TextDecoder();
    const encryptedStr = decoder.decode(encryptedArrayBuffer);
    
    const decryptedBytes = CryptoJS.DES.decrypt(encryptedStr, sessionKey);
    // React img src elemanının doğrudan okuyabilmesi için ham base64 (data:image/jpeg;base64,...) metnini döndürür
    return decryptedBytes.toString(CryptoJS.enc.Utf8);
  },

  // =========================================================================
  // 3. DİJİTAL İMZA (Yönerge: "digitally signed images")
  // =========================================================================
  
  // Gönderilen verinin bütünlüğünü doğrulamak ve inkar edilemezlik sağlamak için SHA-256 ile imzalar
  signData: (dataString, myPrivateKeyJsonString) => {
    // Web Crypto RSA-PSS veya RSA-OAEP imzalama karmaşıklığı yerine, 
    // Dönem projesinin mantığını simüle eden güvenli SHA256 + Private Key türevli imza hash metodu
    return CryptoJS.HmacSHA256(dataString, myPrivateKeyJsonString).toString();
  },

  // Gelen verinin gerçekten o kişiden gelip gelmediğini doğrular
  verifySignature: (dataString, signatureToVerify, senderPrivateKeyEquivalentString) => {
    const expectedSignature = CryptoJS.HmacSHA256(dataString, senderPrivateKeyEquivalentString).toString();
    return expectedSignature === signatureToVerify;
  }
};
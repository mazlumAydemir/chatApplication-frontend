import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Web Crypto API kullanarak tarayıcıda RSA Anahtar Çifti Üreten Fonksiyon
  const generateRSAKeyPair = async (phoneNumber) => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048, // Güvenlik standardı 2048-bit
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // Dışa aktarılabilir (exportable)
      ["encrypt", "decrypt"]
    );

    // 1. Private Key'i (Gizli Anahtar) çözme işlemleri için kullanıcının tarayıcısında (localStorage) saklıyoruz.
    const exportedPrivateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
    localStorage.setItem(`privateKey_${phoneNumber}`, JSON.stringify(exportedPrivateKey));

    // 2. Public Key'i (Açık Anahtar) .NET API'ye gönderebilmek için SPKI/String formatına çeviriyoruz.
    const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));
    
    return publicKeyBase64;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Kayıt esnasında arka planda asimetrik anahtar çiftini üretiyoruz
      const generatedPublicKey = await generateRSAKeyPair(formData.phoneNumber);

      // 2. Bizim .NET 8 API'deki RegisterDto modeline uygun yapıyı hazırlıyoruz
      const requestData = {
        phoneNumber: formData.phoneNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password: formData.password,
        publicKey: generatedPublicKey // Üretilen açık anahtar sunucuya gidiyor
      };

      // Kendi API adresine veya localhost portuna göre güncelleyebilirsin
      await axios.post('http://localhost:7220/api/Auth/register', requestData);
      
      alert('Kayıt başarılı ve güvenli RSA anahtarlarınız üretildi! Şimdi giriş yapabilirsiniz.');
      navigate('/'); // Giriş sayfasına yönlendirme
      
    } catch (error) {
      console.error("Kayıt Hatası:", error);
      alert(error.response?.data?.message || error.response?.data || 'Kayıt olurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Hesap Oluştur</h2>
        <p className="auth-subtitle">Güvenli ve şifreli IEA paneline katılmak için kayıt olun.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input 
            className="auth-input" 
            type="text" 
            name="firstName" 
            placeholder="Adınız" 
            required 
            onChange={handleChange} 
            disabled={isLoading}
          />
          <input 
            className="auth-input" 
            type="text" 
            name="lastName" 
            placeholder="Soyadınız" 
            required 
            onChange={handleChange} 
            disabled={isLoading}
          />
          <input 
            className="auth-input" 
            type="tel" 
            name="phoneNumber" 
            placeholder="Telefon Numarası" 
            required 
            onChange={handleChange} 
            disabled={isLoading}
          />
          <input 
            className="auth-input" 
            type="password" 
            name="password" 
            placeholder="Şifre" 
            required 
            onChange={handleChange} 
            disabled={isLoading}
          />

          <button className="auth-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Güvenli Anahtarlar Üretiliyor...' : 'Kayıt Ol'}
          </button>
        </form>
        
        <p className="auth-link-text">
          Zaten hesabın var mı? <Link className="auth-link" to="/">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}
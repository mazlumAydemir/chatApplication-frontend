import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Login.css'; // Projenin şık arayüz teması

export default function Login() {
  const navigate = useNavigate();
  
  // Backend AuthController.cs giriş endpoint'i phoneNumber ve password bekliyor
  const [formData, setFormData] = useState({ phoneNumber: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMessage(''); // Kullanıcı yazmaya başlayınca hatayı temizle
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Kendi API adresinize göre endpoint'i tetikliyoruz
      const response = await axios.post('http://localhost:7220/api/Auth/login', formData);
      const token = response.data.token;
      
      if (!token) throw new Error("Giriş başarısız: Token üretilemedi.");

      // 1. JWT Token'ı yerel depolamaya (localStorage) güvenle yazıyoruz
      localStorage.setItem('jwtToken', token);
      
      // 2. JWT yapısının ortasındaki Payload (Claim) verisini atob ile çözüyoruz
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // 3. .NET Core ClaimTypes.Role karşılığını güvenli şekilde yakalıyoruz
      const userRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] 
                    || payload["role"] 
                    || payload["Role"];

      // 4. Katmanlı mimaride yazdığımız Sysadmin ve Client ayrımı aktör kontrolü
      if (typeof userRole === 'string' && userRole.toLowerCase() === "sysadmin") {
        // Yönergedeki "Sysadmin is responsible for monitoring IEA server" kuralı izleme paneli
        navigate('/admin'); 
      } else {
        // Güvenli mesajlaşma ve şifreli resim transferi yapacak istemci paneli
        navigate('/chat');  
      }

    } catch (error) {
      console.error("Giriş Hatası:", error);
      
      // Backend'den nesne ({ message: "..." }) veya düz metin gelse de kullanıcıya gösteriyoruz
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else if (typeof error.response?.data === 'string') {
        setErrorMessage(error.response.data);
      } else {
        setErrorMessage('Giriş başarısız. Lütfen bilgilerinizi kontrol edin!');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">IEA Giriş Paneli</h2>
        <p className="auth-subtitle">Sisteme erişmek için telefon numaranızı ve şifrenizi girin.</p>
        
        {/* Hata kutusu */}
        {errorMessage && <div className="auth-error">{errorMessage}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <input 
            className="auth-input" 
            type="tel" 
            name="phoneNumber" 
            placeholder="Telefon Numarası (Örn: 555...)" 
            required 
            onChange={handleChange} 
            value={formData.phoneNumber}
          />
          <input 
            className="auth-input" 
            type="password" 
            name="password" 
            placeholder="Şifre" 
            required 
            onChange={handleChange} 
            value={formData.password}
          />
          <button className="auth-button" type="submit">Giriş Yap</button>
        </form>
        
        <p className="auth-link-text">
          Hesabınız yok mu? <Link className="auth-link" to="/register">Kayıt Olun</Link>
        </p>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://localhost:7220/api/Auth/login', formData);
      const token = response.data.token;
      
      // 1. Token'ı tarayıcıya kaydet
      localStorage.setItem('jwtToken', token);
      
      // 2. JWT içindeki payload (veri) kısmını çöz
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Hata takibi için konsola yazdırıyoruz (İstersen silebilirsin)
      console.log("Token İçeriği (Payload):", payload);
      
      // 3. Güvenli Rol Okuma (Olası tüm isimlendirmeleri kontrol eder)
      const userRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] 
                    || payload["role"] 
                    || payload["Role"];

      console.log("Token'dan Gelen Rol Değeri:", userRole);

      // 4. KESİN YÖNLENDİRME MANTIĞI (Sysadmin ve 1 Kontrolü)
      // Eğer rol değeri 1 ise veya string olarak "Sysadmin" ise Admin paneline git
      if (
        userRole == 1 || 
        userRole === "1" || 
        (typeof userRole === 'string' && userRole.toLowerCase() === "sysadmin") ||
        (typeof userRole === 'string' && userRole.toLowerCase() === "admin")
      ) {
        alert('Yönetici (Sysadmin) girişi başarılı!');
        navigate('/admin'); // Yönetici paneline yönlendir
      } else {
        alert('Giriş başarılı!');
        navigate('/chat');  // Normal sohbet sayfasına yönlendir
      }

    } catch (error) {
      console.error("Giriş Hatası:", error);
      alert(error.response?.data || 'Hatalı e-posta veya şifre!');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Hoş Geldiniz</h2>
        <p className="auth-subtitle">Devam etmek için hesabınıza giriş yapın.</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <input 
            className="auth-input" 
            type="email" 
            name="email" 
            placeholder="E-posta" 
            required 
            onChange={handleChange} 
            value={formData.email}
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
          Hesabın yok mu? <Link className="auth-link" to="/register">Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}
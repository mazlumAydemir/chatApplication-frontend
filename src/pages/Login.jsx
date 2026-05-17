import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Login.css'; // MÜKEMMEL SARI TEMA BURADAN GELİYOR

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorMessage, setErrorMessage] = useState(''); // Hataları UI'da göstermek için eklendi

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMessage(''); // Kullanıcı yeni bir şey yazmaya başladığında hatayı gizle
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://158.220.105.185:7220/api/Auth/login', formData);
      const token = response.data.token;
      
      if (!token) throw new Error("Token alınamadı.");

      // 1. Token'ı tarayıcıya kaydet
      localStorage.setItem('jwtToken', token);
      
      // 2. JWT içindeki payload (veri) kısmını çöz
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // 3. Güvenli Rol Okuma
      const userRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] 
                    || payload["role"] 
                    || payload["Role"];

      // 4. Alert'ler kaldırıldı! Doğrudan Yönlendirme Mantığı
      if (
        userRole == 1 || 
        userRole === "1" || 
        (typeof userRole === 'string' && userRole.toLowerCase() === "sysadmin") ||
        (typeof userRole === 'string' && userRole.toLowerCase() === "admin")
      ) {
        navigate('/admin'); 
      } else {
        navigate('/chat');  
      }

    } catch (error) {
      console.error("Giriş Hatası:", error);
      // Çirkin Alert yerine hatayı State'e atıyoruz, ekranda şıkça görünecek
      setErrorMessage(error.response?.data || 'Hatalı e-posta veya şifre!');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Hoş Geldiniz</h2>
        <p className="auth-subtitle">Devam etmek için hesabınıza giriş yapın.</p>
        
        {/* Hata varsa burada kutu içinde gösterilecek */}
        {errorMessage && <div className="auth-error">{errorMessage}</div>}
        
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
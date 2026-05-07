import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://localhost:7220/api/Auth/verify-email', { email, code });
      alert('E-posta başarıyla doğrulandı! Artık giriş yapabilirsiniz.');
      navigate('/');
    } catch (error) {
      alert(error.response?.data || 'Doğrulama hatası!');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">E-posta Doğrulama</h2>
        <p className="auth-subtitle">Lütfen e-posta adresinize gönderilen 6 haneli kodu giriniz.</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresiniz" required />
          <input className="auth-input" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Doğrulama Kodu (Örn: 123456)" required maxLength="6" />
          
          <button className="auth-button" type="submit">Doğrula</button>
        </form>
      </div>
    </div>
  );
}
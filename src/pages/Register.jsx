import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: 2
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://158.220.105.185:7220/api/Auth/register', {
        ...formData,
        roleId: parseInt(formData.roleId)
      });
      alert('Kayıt başarılı! Lütfen e-postanıza gelen kodu doğrulayın.');
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (error) {
      alert(error.response?.data || 'Kayıt olurken bir hata oluştu.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Hesap Oluştur</h2>
        <p className="auth-subtitle">Güvenli mesajlaşmaya başlamak için kayıt olun.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input className="auth-input" type="text" name="firstName" placeholder="Adınız" required onChange={handleChange} />
          <input className="auth-input" type="text" name="lastName" placeholder="Soyadınız" required onChange={handleChange} />
          <input className="auth-input" type="email" name="email" placeholder="E-posta" required onChange={handleChange} />
          <input className="auth-input" type="password" name="password" placeholder="Şifre" required onChange={handleChange} />
          
          <select className="auth-select" name="roleId" onChange={handleChange} value={formData.roleId}>
            <option value={1}>Sistem Yöneticisi (Sysadmin)</option>
            <option value={2}>Müşteri (Client)</option>
          </select>

          <button className="auth-button" type="submit">Kayıt Ol</button>
        </form>
        
        <p className="auth-link-text">
          Zaten hesabın var mı? <Link className="auth-link" to="/">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}
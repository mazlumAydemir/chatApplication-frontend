import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, MessageSquare, Activity, UserX, UserCheck, Search } from 'lucide-react';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); // EKSİK 3: Arama state'i

  const token = localStorage.getItem('jwtToken');

  const loadData = async (showLoading = true) => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        navigate('/'); 
        return;
    }
    
    if(showLoading) setLoading(true);
    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get('https://localhost:7220/api/Admin/stats', config),
        axios.get('https://localhost:7220/api/Admin/users', config)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error("Yönetim Paneli Hatası:", error.response); // Konsoldan detayları görebilirsin
      
      // EĞER HATA 403 (FORBIDDEN) İSE: Kullanıcı Sysadmin değil demektir.
      if (error.response && error.response.status === 403) {
          alert("Yetki Hatası: Hesabınız 'Sysadmin' rolüne sahip değil!");
          navigate('/chat');
      } 
      // EĞER HATA 401 (UNAUTHORIZED) İSE: Token geçersiz demektir.
      else if (error.response && error.response.status === 401) {
          navigate('/');
      }
    } finally {
      if(showLoading) setLoading(false);
    }
  };

  useEffect(() => { 
      loadData(true); 

      // EKSİK 1: Gerçek Zamanlı İzleme (Her 10 saniyede bir verileri sessizce yenile)
      const intervalId = setInterval(() => {
          loadData(false); // false -> yükleniyor ekranı çıkarmadan arka planda güncelle
      }, 10000);

      return () => clearInterval(intervalId);
  }, []);

  const handleToggleBan = async (userId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(`https://localhost:7220/api/Admin/toggle-ban/${userId}`, {}, config);
      loadData(false); // İşlem sonrası tabloyu sessizce yenile
    } catch (error) {
      alert("İşlem başarısız!");
    }
  };

  // EKSİK 3: Arama terimine göre kullanıcıları filtrele
  const filteredUsers = users.filter(user => 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading-screen">Veriler Yükleniyor...</div>;

  return (
    <div className="admin-dashboard">
      <h1 className="admin-title">Sistem Yönetim Paneli</h1>

      <div className="stats-grid">
        <StatCard 
          icon={<Users size={28} color="#007bff" />} 
          title="Toplam Kullanıcı" 
          value={stats?.totalUsers || 0} 
        />
        <StatCard 
          icon={<Activity size={28} color="#28a745" />} 
          title="Çevrimiçi (Aktif)" 
          value={stats?.onlineUsers || 0} 
        />
        <StatCard 
          icon={<MessageSquare size={28} color="#6f42c1" />} 
          title="Şifreli Toplam Mesaj" 
          value={stats?.totalMessages || 0} 
        />
      </div>

      <div className="table-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 className="table-header" style={{margin: 0}}>Kullanıcı Denetimi</h3>
            
            {/* ARAMA ÇUBUĞU */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input, #222)', padding: '8px 15px', borderRadius: '20px' }}>
                <Search size={18} color="#888" style={{marginRight: '10px'}} />
                <input 
                    type="text" 
                    placeholder="İsim veya E-posta ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', color: '#fff' }}
                />
            </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>E-posta</th>
              <th>Kayıt Tarihi</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                <tr key={user.id}>
                    <td><strong>{user.firstName} {user.lastName}</strong></td>
                    <td>{user.email}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td>
                    <span className={`status-badge ${user.isActive ? 'status-active' : 'status-banned'}`}>
                        {user.isActive ? 'Aktif' : 'Yasaklı'}
                    </span>
                    </td>
                    <td>
                    <button 
                        onClick={() => handleToggleBan(user.id)}
                        className={`action-btn ${user.isActive ? 'btn-ban' : 'btn-unban'}`}
                    >
                        {user.isActive ? <><UserX size={16} /> Yasakla</> : <><UserCheck size={16} /> Yasağı Kaldır</>}
                    </button>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                    <td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#888'}}>Aradığınız kriterlere uygun kullanıcı bulunamadı.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon-wrapper">{icon}</div>
      <div className="stat-info">
        <p className="stat-title">{title}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}
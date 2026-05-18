import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, MessageSquare, Activity, Shield, Search, RefreshCw } from 'lucide-react';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); 

  const loadData = async (showLoading = true) => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        navigate('/'); 
        return;
    }
    
    if (showLoading) setLoading(true);
    const config = { headers: { Authorization: `Bearer ${token}` } };

    try {
      // Katmanlı mimarideki AdminController.cs /monitoring ucunu tetikliyoruz
      const response = await axios.get('http://localhost:7220/api/Admin/monitoring', config);
      setStats(response.data);
    } catch (error) {
      console.error("Yönetim Paneli Hatası:", error.response);
      
      // Yetki Hatası (Forbidden) durumunda kullanıcı Sysadmin değil demektir
      if (error.response && error.response.status === 403) {
          alert("Yetki Hatası: Bu panele erişim hakkınız yok! Sadece 'Sysadmin' aktörleri girebilir.");
          navigate('/chat');
      } 
      // Token geçersiz veya süresi dolmuşsa
      else if (error.response && error.response.status === 401) {
          navigate('/');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { 
      loadData(true); 

      // Yönergede istenen sunucu gerçek zamanlı izleme (monitoring) mekanizması (10 saniyede bir)
      const intervalId = setInterval(() => {
          loadData(false); // Kullanıcıyı rahatsız etmeden arka planda verileri tazeler
      }, 10000);

      return () => clearInterval(intervalId);
  }, []);

  if (loading) return <div className="loading-screen">IEA Sunucu Durumu Sorgulanıyor...</div>;

  return (
    <div className="admin-dashboard">
      <div className="admin-header-area">
        <h1 className="admin-title">IEA Server Monitoring Panel</h1>
        <div className="server-badge-status">
            <span className="pulse-indicator"></span>
            Sunucu Durumu: {stats?.serverStatus || "Bilinmiyor"}
        </div>
      </div>

      {/* ÜST ÜÇLÜ İSTATİSTİK KARTLARI */}
      <div className="stats-grid">
        <StatCard 
          icon={<Users size={28} color="#f5c518" />} 
          title="Toplam Kayıtlı Kullanıcı" 
          value={stats?.totalUsers || 0} 
        />
        <StatCard 
          icon={<Activity size={28} color="#00a884" />} 
          title="Müşteri (Client) Sayısı" 
          value={stats?.clientUsers || 0} 
        />
        <StatCard 
          icon={<MessageSquare size={28} color="#6f42c1" />} 
          title="Şifreli Toplam Trafik (Mesaj)" 
          value={stats?.totalMessagesExchanged || 0} 
        />
      </div>

      {/* SUNUCU DETAY KUTUSU */}
      <div className="table-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #2a2a2a' }}>
            <h3 style={{margin: 0, color: 'var(--accent-yellow)', display:'flex', alignItems:'center', gap:'10px'}}>
                <Shield size={22}/> Sunucu Güvenlik ve Aktivite Logları
            </h3>
            <button onClick={() => loadData(true)} className="refresh-panel-btn">
                <RefreshCw size={16}/> Yenile
            </button>
        </div>

        <div className="admin-info-box-content">
            <p><strong>Aktif Yönetici (Sysadmin) Sayısı:</strong> {stats?.sysadminUsers || 0}</p>
            <p><strong>Son Ağ Aktivitesi Zaman Damgası:</strong> {stats?.latestActivity ? new Date(stats.latestActivity).toLocaleString('tr-TR') : "Aktivite Yok"}</p>
            <div className="sysadmin-security-note">
                <strong>🛡️ Güvenlik Notu:</strong> İstemciler arası resim transferleri sunucuya ulaşmadan önce istemci işlemcisinde <strong>DES</strong> ile şifrelenir ve asimetrik anahtarlar <strong>RSA</strong> ile korunur. Sunucu yöneticisi (Sysadmin) olarak, sistem üzerindeki verilerin güvenliği gereği ham mesaj içeriklerini veya resim piksellerini göremezsiniz. Sistem mimarisi uçtan uca koruma altındadır.
            </div>
        </div>
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
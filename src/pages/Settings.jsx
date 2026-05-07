import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Camera, Save } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ firstName: '', lastName: '', phoneNumber: '', bio: '', profilePictureUrl: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  // 1. Sayfa açıldığında mevcut verileri API'den çek
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('jwtToken');
        const res = await axios.get('https://localhost:7220/api/Profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser({
          firstName: res.data.firstName || '',
          lastName: res.data.lastName || '',
          phoneNumber: res.data.phoneNumber || '',
          bio: res.data.bio || '',
          profilePictureUrl: res.data.profilePictureUrl || ''
        });
      } catch (err) {
        console.error("Profil yüklenemedi:", err);
      }
    };
    fetchProfile();
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const token = localStorage.getItem('jwtToken');
      const res = await axios.post('https://localhost:7220/api/File/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
      });
      alert("Profil fotoğrafı güncellendi!");
      setUser({ ...user, profilePictureUrl: res.data.url });
    } catch (err) { console.error(err); }
  };

  // 2. Metin verilerini güncelle (PUT İsteği)
  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('jwtToken');
      await axios.put('https://localhost:7220/api/Profile', user, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Profil bilgileri başarıyla kaydedildi!");
    } catch (err) {
      alert("Güncelleme başarısız oldu.");
      console.error(err);
    }
  };

  return (
    <div className="settings-container" style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <button onClick={() => navigate('/chat')} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', color: '#54656f', fontWeight: 'bold' }}>
        <ArrowLeft size={24} /> Geri Dön
      </button>

      <h2 style={{ marginBottom: '30px', color: '#111b21' }}>Profil Ayarları</h2>

   {/* PROFİL FOTOĞRAFI ALANI */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        
        {/* Resmi ve İkonu Saran Özel Kutu (inline-block sayesinde resmin boyutunu alır) */}
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <img 
            src={user.profilePictureUrl ? `https://localhost:7220${user.profilePictureUrl}` : 'https://ui-avatars.com/api/?name=' + user.firstName + '+' + user.lastName + '&background=random'} 
            style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #00a884' }}
            alt="Avatar"
          />
          
          {/* Klas Kamera İkonu */}
          <label htmlFor="avatar-upload" 
            style={{ 
              position: 'absolute', 
              bottom: '5px', 
              right: '5px', 
              background: '#00a884', 
              color: 'white', 
              borderRadius: '50%', 
              padding: '8px', 
              cursor: 'pointer', 
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              border: '3px solid white', /* İşte o class görünümü veren detay */
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Camera size={22} />
          </label>
        </div>

        <input id="avatar-upload" type="file" style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />
        
        {selectedFile && (
          <button onClick={handleUploadAvatar} style={{ marginTop: '15px', display: 'block', margin: '15px auto', background: '#2d3748', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            Fotoğrafı Kaydet
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" placeholder="Ad" value={user.firstName} onChange={(e) => setUser({...user, firstName: e.target.value})} className="modern-input" />
        <input type="text" placeholder="Soyad" value={user.lastName} onChange={(e) => setUser({...user, lastName: e.target.value})} className="modern-input" />
        <input type="text" placeholder="Telefon (Örn: 0555...)" value={user.phoneNumber} onChange={(e) => setUser({...user, phoneNumber: e.target.value})} className="modern-input" />
        <textarea placeholder="Hakkımda / Bio (Örn: Hey there! I am using ChatApp)" value={user.bio} onChange={(e) => setUser({...user, bio: e.target.value})} className="modern-input" style={{ height: '100px', resize: 'none' }} />
        
        <button onClick={handleUpdateProfile} className="save-button"><Save size={20} /> Güncelle</button>
      </div>
    </div>
  );
}
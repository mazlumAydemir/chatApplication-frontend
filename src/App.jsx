import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import VerifyEmail from './pages/VerifyEmail';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const isAuthenticated = () => !!localStorage.getItem('jwtToken');
  
  // GÜNCELLENMİŞ ROL KONTROLÜ (Sysadmin ve 1 mantığına tam uyumlu)
  const isAdmin = () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Olası tüm anahtarları (key) kontrol et
      const userRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] 
                    || payload["role"] 
                    || payload["Role"];
      
      // Eğer rol 1 ise, "Sysadmin" ise veya "Admin" ise TRUE dön, onu içeri al!
      return userRole == 1 || 
             userRole === "1" || 
             (typeof userRole === 'string' && userRole.toLowerCase() === "sysadmin") ||
             (typeof userRole === 'string' && userRole.toLowerCase() === "admin");
    } catch { 
      return false; 
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        <Route 
          path="/chat" 
          element={isAuthenticated() ? <Chat /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/settings" 
          element={isAuthenticated() ? <Settings /> : <Navigate to="/" />} 
        />

        {/* ADMİN PANELİ YÖNLENDİRMESİ */}
        <Route 
          path="/admin" 
          element={isAuthenticated() && isAdmin() ? <AdminDashboard /> : <Navigate to="/chat" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';

// ========================================================
// 1. KORUMALI ROTA BİLEŞENİ (Giriş Yapmayanları Kesin Engeller)
// ========================================================
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('jwtToken');
  
  // Eğer token yoksa, kullanıcıyı anında giriş sayfasına ("/") fırlatır
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  // Token varsa sayfayı güvenle açar
  return children;
};

// ========================================================
// 2. ADMİN KORUMALI ROTA BİLEŞENİ (Sadece Adminleri İçeri Alır)
// ========================================================
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('jwtToken');
  
  if (!token) {
    return <Navigate to="/" replace />;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userRole = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] 
                  || payload["role"] 
                  || payload["Role"];
    
    const isAdmin = userRole == 1 || 
                    userRole === "1" || 
                    (typeof userRole === 'string' && userRole.toLowerCase() === "sysadmin") ||
                    (typeof userRole === 'string' && userRole.toLowerCase() === "admin");

    // Giriş yapmış ama admin değilse chat sayfasına postala
    if (!isAdmin) {
      return <Navigate to="/chat" replace />;
    }
  } catch {
    return <Navigate to="/" replace />;
  }

  return children;
};

// ========================================================
// MAIN APP COMPONENT
// ========================================================
function App() {
  const isAuthenticated = () => !!localStorage.getItem('jwtToken');

  return (
    <Router>
      <Routes>
        {/* Herkese Açık Rotalar */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Giriş Şartı Olan Korumalı Rotalar (ProtectedRoute ile Sarmalandı) */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />

        {/* Sadece Adminlerin Girebileceği Rota (AdminRoute ile Sarmalandı) */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />

        {/* Tanımlanmayan Eksik Rotalarda Otomatik Yönlendirme */}
        <Route path="*" element={<Navigate to={isAuthenticated() ? "/chat" : "/"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
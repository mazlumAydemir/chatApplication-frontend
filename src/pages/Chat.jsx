import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { CryptoHelper } from '../utils/crypto'; // Projedeki şifreleme sınıfın
import { Settings as SettingsIcon, LogOut, UserPlus, Image as ImageIcon, ArrowUp, Loader2, Video, Phone, PhoneOff, X, ChevronLeft, ChevronRight, Menu, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; 
import "./chat.css";

// --- ŞİFRELİ TEKLİ RESİM BİLEŞENİ ---
const EncryptedImage = ({ fileUrl, sessionKey, onClick, onLoaded }) => {
  const [imgSrc, setImgSrc] = useState(null);
  useEffect(() => {
    const fetchAndDecrypt = async () => {
      try {
        // Sunucudan şifreli .enc dosyasını çekiyoruz
        const response = await axios.get(`http://localhost:7220${fileUrl}`, { responseType: 'arraybuffer' });
        // DES şifreli binary veriyi, RSA ile çözülmüş sessionKey ile deşifre ediyoruz
        const decryptedBase64 = CryptoHelper.decryptFileDES(response.data, sessionKey);
        setImgSrc(decryptedBase64);
        if (onLoaded) setTimeout(onLoaded, 100);
      } catch (error) { console.error("Resim şifresi çözülemedi:", error); }
    };
    fetchAndDecrypt();
  }, [fileUrl, sessionKey]);

  if (!imgSrc) return <div style={{padding:'20px', background:'#2a2a2a', color:'#f5c518', borderRadius:'8px', fontSize:'14px'}}>📷 Görüntü DES ile Çözülüyor...</div>;
  
  return (
    <img 
      src={imgSrc} 
      alt="Şifreli Görsel" 
      onClick={() => onClick([imgSrc], 0)} 
      style={{ maxWidth: '100%', height: 'auto', maxHeight: '350px', objectFit: 'contain', cursor: 'pointer', borderRadius: '8px', display: 'block' }} 
    />
  );
};

export default function Chat() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [newContactPhone, setNewContactPhone] = useState('');

  // Mobil Menü ve Popup Stateleri
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false); 
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [connection, setConnection] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const myPrivateKeyRef = useRef(null); 
  const myPublicKeyRef = useRef(null); 
  const myUserIdRef = useRef(null); 
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // WEBRTC ARAMA ALTYAPISI
  const [callStatus, setCallStatus] = useState('idle'); 
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) { navigate('/'); return; }
    
    // JWT Payload'undan kendi kullanıcı ID'mizi öğreniyoruz
    const payload = JSON.parse(atob(token.split('.')[1]));
    myUserIdRef.current = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier"] || payload["sub"];

    // Yönergedeki periyodik RSA Anahtar Güncelleme mekanizması (5 dakikada bir)
    const updateRSAKeys = async () => {
        try {
            console.log("🔒 RSA Anahtar çifti periyodik olarak yenileniyor...");
            const keys = await CryptoHelper.generateRSAKeys(); // JavaScript Web Crypto API tetiklenir
            
            myPrivateKeyRef.current = keys.privateKey; 
            myPublicKeyRef.current = keys.publicKey;

            // Yenilenen Public Key backend'e basılır
            await axios.put('http://localhost:7220/api/Auth/update-public-key', 
                keys.publicKey, 
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
        } catch (error) { console.error("RSA Yenileme Başarısız:", error); }
    };

    const fetchInitialData = async () => {
        // Tarayıcı hafızasından mevcut anahtarları yükle, yoksa hemen yenisini üret
        const savedPriv = localStorage.getItem(`privateKey_current`);
        if (!savedPriv) {
            await updateRSAKeys();
        } else {
            myPrivateKeyRef.current = savedPriv;
        }

        // Rehber listesini backend'den çekiyoruz
        try {
            const res = await axios.get('http://localhost:7220/api/Contact/list', { headers: { Authorization: `Bearer ${token}` } });
            setContacts(res.data);
        } catch (e) { console.error("Rehber yüklenemedi", e); }
    };

    // Hub ve Bağlantı Yönetimi
    const startSignalR = async () => {
        const newConnection = new HubConnectionBuilder()
          .withUrl('http://localhost:7220/chathub', { accessTokenFactory: () => token })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Information)
          .build();

        // Backend'deki ChatHub ReceiveMessage metodunu dinlemeye başlıyoruz
        newConnection.on("ReceiveMessage", async (messageDto) => {
            try {
                // 1. Gelen oturum anahtarını (Session Key) kendi RSA Private Key'imizle çözüyoruz
                const decryptedSessionKey = CryptoHelper.decryptWithRSA(messageDto.encryptedSessionKey, myPrivateKeyRef.current);
                
                // 2. Eğer dijital imza varsa imza doğrulaması yapıyoruz
                let isSignatureValid = false;
                if (messageDto.digitalSignature && messageDto.textContent) {
                    // Mesajı atan kişinin Public Key'ini rehber bilgisinden alıp doğrula
                    const targetContact = contacts.find(c => c.contactId === messageDto.senderId);
                    if (targetContact?.publicKey) {
                        isSignatureValid = CryptoHelper.verifySignature(messageDto.textContent, messageDto.digitalSignature, targetContact.publicKey);
                    }
                }

                setMessages(prev => [...prev, {
                    id: messageDto.messageId,
                    senderId: messageDto.senderId,
                    textContent: messageDto.textContent,
                    encryptedImageUrl: messageDto.encryptedImageUrl,
                    sessionKey: decryptedSessionKey,
                    isVerified: isSignatureValid,
                    sentAt: messageDto.sentAt
                }]);
                
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
            } catch (err) { console.error("Gelen şifreli mesaj çözülemedi:", err); }
        });

        await newConnection.start();
        setConnection(newConnection);
    };

    fetchInitialData();
    startSignalR();

    // Periyodik yenileme tetikleyicisi (5 dakikada bir)
    const interval = setInterval(updateRSAKeys, 5 * 60 * 1000);

    return () => {
        clearInterval(interval);
        if (newConnection) newConnection.stop();
    };
  }, [contacts.length]);

  // Sohbet geçmişini getiren fonksiyon
  useEffect(() => {
    if (!selectedUser) return;
    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('jwtToken');
            const res = await axios.get(`http://localhost:7220/api/Message/history/${selectedUser.contactId}`, { headers: { Authorization: `Bearer ${token}` } });
            
            // Gelen geçmiş verilerindeki asimetrik şifreleri tek tek çözüyoruz
            const decryptedHistory = res.data.map(msg => {
                const isMe = msg.senderId == myUserIdRef.current;
                return {
                    id: msg.id,
                    senderId: msg.senderId,
                    textContent: msg.textContent,
                    encryptedImageUrl: msg.encryptedImageUrl,
                    sessionKey: isMe ? msg.senderSessionKey : msg.receiverSessionKey, // .NET tarafında çözülen key'ler
                    sentAt: msg.sentAt
                };
            });
            setMessages(decryptedHistory);
        } catch (e) { console.error("Geçmiş mesajlar getirilemedi:", e); }
    };
    fetchHistory();
  }, [selectedUser]);

  // Rehbere Yeni Kişi Ekleme
  const handleAddContact = async (e) => {
      e.preventDefault();
      if (!newContactPhone.trim()) return;
      try {
          const token = localStorage.getItem('jwtToken');
          await axios.post('http://localhost:7220/api/Contact/add', { phoneNumber: newContactPhone }, { headers: { Authorization: `Bearer ${token}` } });
          setNewContactPhone('');
          const res = await axios.get('http://localhost:7220/api/Contact/list', { headers: { Authorization: `Bearer={token}` } });
          setContacts(res.data);
          alert("Kişi rehbere başarıyla eklendi.");
      } catch (err) { alert(err.response?.data?.message || "Kullanıcı bulunamadı."); }
  };

  // Resim Seçimi
  const handleImageSelect = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      const newPreviews = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
      setSelectedFiles(prev => [...prev, ...newPreviews]);
  };

  // ANA GÖNDERME METODU (YÖNERGEDEKİ TÜM KRİPTOLOJİ BURADA AKIYOR)
  const handleSendMessage = async (e) => {
      e?.preventDefault();
      if (!selectedUser || !connection || (!messageText.trim() && selectedFiles.length === 0)) return;

      setIsUploading(true);
      try {
          const token = localStorage.getItem('jwtToken');
          let finalImageUrl = null;
          
          // 1. Rastgele Güvenli Bir DES Session Key (Oturum Anahtarı) üretiyoruz
          const sessionKey = CryptoHelper.generateSessionKey();

          // 2. Eğer resim seçildiyse önce DES ile şifreleyip sunucuya (.enc) olarak basıyoruz
          if (selectedFiles.length > 0) {
              const fileObj = selectedFiles[0].file;
              
              // Resmi binary arraybuffer olarak okuyoruz (DES patlamasın diye en doğrusu)
              const fileBuffer = await fileObj.arrayBuffer();
              const encryptedBytes = CryptoHelper.encryptFileDES(fileBuffer, sessionKey);
              
              const encryptedFile = new File([encryptedBytes], `${Guid.NewGuid()}.enc`, { type: 'application/octet-stream' });
              const uploadFormData = new FormData();
              uploadFormData.append('file', encryptedFile);

              // Az önce yazdığımız ImageController.cs'e yükleme yapıyoruz
              const uploadRes = await axios.post('http://localhost:7220/api/Image/upload', uploadFormData, {
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
              });
              finalImageUrl = uploadRes.data.encryptedImageUrl;
          }

          // 3. Mesaj metnini kendi Private Key'imizle imzalıyoruz (Dijital İmza Kuralı)
          const digitalSignature = CryptoHelper.signData(messageText.trim(), myPrivateKeyRef.current);

          // 4. Session anahtarını alıcının Public Key'i ile şifreliyoruz (RSA Key Exchange)
          const encryptedSessionKeyForReceiver = CryptoHelper.encryptWithRSA(sessionKey, selectedUser.publicKey);

          // 5. SignalR üzerinden Hub metodumuzu tam parametreleriyle tetikliyoruz
          await connection.invoke("SendMessage", 
              parseInt(selectedUser.contactId), 
              messageText.trim(), 
              finalImageUrl, 
              encryptedSessionKeyForReceiver, 
              digitalSignature
          );

          // Arayüzü temizle
          setMessageText('');
          setSelectedFiles([]);
          setIsUploading(false);
          
      } catch (error) {
          console.error("Mesaj gönderim hatası:", error);
          alert("Kriptolama veya gönderim sırasında hata oluştu!");
          setIsUploading(false);
      }
  };

  const handleTyping = (e) => {
      setMessageText(e.target.value);
  };

  const openLightbox = (images, index) => {
      setLightboxImages(images);
      setLightboxIndex(index);
  };

  return (
    <div className="app-chat-layout">
      
      {/* SOL PANEL (ÖNCEKİ SOHBETLER) */}
      <aside className={`app-left-sidebar ${isLeftMenuOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-yellow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>IEA Güvenli Sohbet</span>
            <button onClick={() => { localStorage.clear(); navigate('/'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Çıkış Yap"><LogOut size={20} /></button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {contacts.map(user => ( 
              <div 
                key={`chat-${user.contactId}`} 
                className="contact-item"
                onClick={() => { setSelectedUser(user); setIsLeftMenuOpen(false); }} 
                style={{ padding: '15px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bg-dark)', backgroundColor: selectedUser?.contactId === user.contactId ? 'var(--bg-input)' : 'transparent' }}
              >
                <img src={'https://ui-avatars.com/api/?name=' + user.savedName + '&background=random'} alt="avatar" style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight:'15px' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: '600' }}>{user.savedName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{user.phoneNumber}</div>
                </div>
              </div>
          ))}
        </div>
      </aside>

      {/* ORTA PANEL (MESAJLAŞMA ALANI) */}
      <main className="app-main-panel">
        {selectedUser ? (
          <>
            {/* Üst Bilgi Barı */}
            <div style={{ padding: '15px 20px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="hamburger-btn" onClick={() => setIsLeftMenuOpen(!isLeftMenuOpen)}><Menu size={28} /></button>
                    <div style={{ fontWeight: 'bold' }}>{selectedUser.savedName} ile Güvenli Kanaldan Sohbet Ucu 🔒</div>
                </div>
            </div>
            
            {/* Mesaj Listesi */}
            <div className="chat-messages-container" ref={messagesContainerRef}>
              <AnimatePresence>
                {messages.map(msg => {
                  const isMe = msg.senderId == myUserIdRef.current;
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', width: '100%', justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      <div className="message-bubble-base" style={{
                          backgroundColor: isMe ? 'var(--accent-yellow)' : 'var(--bg-input)',
                          color: isMe ? '#000' : '#fff',
                          padding: '10px 15px',
                          borderRadius: '12px'
                      }}>
                        {/* Şifreli resim varsa DES çözücü bileşeni çağırıyoruz */}
                        {msg.encryptedImageUrl && <EncryptedImage fileUrl={msg.encryptedImageUrl} sessionKey={msg.sessionKey} onClick={openLightbox} />}
                        
                        {msg.textContent && <div style={{ marginTop: msg.encryptedImageUrl ? '8px' : '0' }}>{msg.textContent}</div>}
                        
                        {/* Dijital İmza Doğrulama Rozeti */}
                        {!isMe && msg.isVerified && (
                            <div style={{fontSize:'9px', color:'var(--whatsapp-green)', marginTop:'3px', fontWeight:'bold'}}>✓ Dijital İmza Doğrulandı (Gönderen Güvenli)</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Dosya Önizleme ve Giriş Alanı */}
            {selectedFiles.length > 0 && (
                <div style={{padding:'10px', background:'var(--bg-panel)', display:'flex', gap:'10px', alignItems:'center'}}>
                    <img src={selectedFiles[0].previewUrl} style={{width:'60px', height:'60px', borderRadius:'6px', objectFit:'cover'}} />
                    <span style={{fontSize:'12px', color:'var(--accent-yellow)'}}>DES ile şifrelenip sunucuya .enc uzantısıyla yüklenecek dosya seçildi.</span>
                    <button onClick={() => setSelectedFiles([])} style={{background:'none', border:'none', color:'#dc3545', cursor:'pointer'}}><X/></button>
                </div>
            )}

            {/* Alt Mesaj İnput Alanı */}
            <form onSubmit={handleSendMessage} style={{ padding: '20px', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '30px', padding: '8px 15px', gap: '10px' }}>
                    <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageSelect} />
                    <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Şifreli Resim Yükle"><ImageIcon size={22} /></button>

                    <input 
                        type="text" 
                        placeholder="Uçtan uca şifreli bir mesaj yazın..." 
                        value={messageText} 
                        onChange={handleTyping}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none' }} 
                    />

                    <button type="submit" disabled={isUploading} style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                        {isUploading ? <Loader2 className="lucide-spin" size={22} /> : <ArrowUp size={22} strokeWidth={3} />}
                    </button>
                </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
             Sohbete başlamak için listeden bir güvenli kanal seçin veya sağdan rehbere ekleyin.
          </div>
        )}
      </main>

      {/* SAĞ PANEL (REHBER EKLEME VE LİSTELEME) */}
      <aside className="app-right-sidebar">
          <div style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-yellow)' }}>Rehber Düzeni</div>
          <div style={{ padding: '15px' }}>
              <form onSubmit={handleAddContact} style={{display:'flex', gap:'10px'}}>
                  <input type="tel" placeholder="Telefon no ile ekle..." value={newContactPhone} onChange={(e)=>setNewContactPhone(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'20px', border:'none', backgroundColor:'var(--bg-input)', color:'#fff', fontSize:'13px'}} />
                  <button type="submit" style={{padding:'10px', background:'var(--accent-yellow)', border:'none', borderRadius:'50%', cursor:'pointer'}}><UserPlus size={18} /></button>
              </form>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
              {contacts.map(user => (
                  <div key={`contact-${user.contactId}`} style={{ padding: '15px 20px', borderBottom: '1px solid var(--bg-dark)' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{user.savedName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.phoneNumber}</div>
                  </div>
              ))}
          </div>
      </aside>

      {/* TAM EKRAN LIGHTBOX POPUP */}
      {lightboxImages.length > 0 && (
          <div className="lightbox-overlay" onClick={() => setLightboxImages([])}>
              <button className="lightbox-close"><X size={40}/></button>
              <img src={lightboxImages[lightboxIndex]} alt="Büyük Görsel" className="lightbox-content" />
          </div>
      )}

    </div>
  );
}
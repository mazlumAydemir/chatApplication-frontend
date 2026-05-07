import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { CryptoHelper } from '../utils/crypto';
import { Settings as SettingsIcon, LogOut, UserPlus, Image as ImageIcon, ArrowUp, Loader2, Video, PhoneCall, Phone, PhoneOff, X, ChevronLeft, ChevronRight, CheckCheck, Menu, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'; 
import './Chat.css';

// --- ŞİFRELİ TEKLİ RESİM BİLEŞENİ ---
const EncryptedImage = ({ fileUrl, sessionKey, onClick, onLoaded }) => {
  const [imgSrc, setImgSrc] = useState(null);
  useEffect(() => {
    const fetchAndDecrypt = async () => {
      try {
        const response = await axios.get(`https://localhost:7220${fileUrl}`);
        // AES yerine DES kullanılıyor
        const decryptedBase64 = CryptoHelper.decryptTextDES(response.data, sessionKey);
        setImgSrc(decryptedBase64);
        if (onLoaded) setTimeout(onLoaded, 100);
      } catch (error) { console.error("Resim çözme hatası:", error); }
    };
    fetchAndDecrypt();
  }, [fileUrl, sessionKey]);

  if (!imgSrc) return <div style={{padding:'20px', background:'#2a2a2a', color:'#f5c518', borderRadius:'8px', fontSize:'14px'}}>📷 Şifre çözülüyor...</div>;
  
  return (
    <img 
      src={imgSrc} 
      alt="Gizli Görsel" 
      onClick={() => onClick([imgSrc], 0)} 
      style={{ maxWidth: '100%', height: 'auto', maxHeight: '350px', objectFit: 'contain', cursor: 'pointer', borderRadius: '8px', display: 'block' }} 
    />
  );
};

// --- ŞİFRELİ ÇOKLU RESİM GALERİ BİLEŞENİ ---
const MessageGallery = ({ urls, sessionKey, onImageClick, onLoaded }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const urlsString = urls.join('|');

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      const decryptedArr = [];
      for(let url of urls) {
         try {
           const res = await axios.get(`https://localhost:7220${url}`);
           // AES yerine DES kullanılıyor
           const decryptedBase64 = CryptoHelper.decryptTextDES(res.data, sessionKey);
           decryptedArr.push(decryptedBase64);
         } catch(e) { console.error("Galeri resmi çözülemedi:", e); }
      }
      setImages(decryptedArr);
      setLoading(false);
      if (onLoaded) setTimeout(onLoaded, 100);
    };
    fetchImages();
  }, [urlsString, sessionKey]); 

  if(loading) return <div style={{padding:'20px', background:'#2a2a2a', color:'#f5c518', borderRadius:'8px', fontSize:'13px'}}>📷 Şifreler çözülüyor ({urls.length} dosya)...</div>;

  const displayCount = Math.min(images.length, 4);
  
  return (
     <div className={`gallery-grid grid-${displayCount}`}>
        {images.slice(0, 4).map((src, idx) => (
           <div key={idx} className="gallery-item" onClick={() => onImageClick(images, idx)}>
              <img src={src} alt={`gallery-${idx}`} />
              {idx === 3 && images.length > 4 && (
                  <div className="more-overlay">+{images.length - 4}</div>
              )}
           </div>
        ))}
     </div>
  );
};

export default function Chat() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [newContactEmail, setNewContactEmail] = useState('');

  // Mobil Menü Stateleri
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);

  // Dosya/Galeri Stateleri
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false); 
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [connection, setConnection] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const myPrivateKeyRef = useRef(null); 
  const myPublicKeyRef = useRef(null); 
  const myUserIdRef = useRef(null); 
  const fileInputRef = useRef(null);
  
  // Kaydırma Refleri
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isUserScrollingRef = useRef(false);

  const [callStatus, setCallStatus] = useState('idle'); 
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  const targetIdRef = useRef(null); 
  
  const callStatusRef = useRef('idle');
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  useEffect(() => {
    targetIdRef.current = selectedUser?.id;
    if (selectedUser && connection) {
        connection.invoke("MarkMessagesAsRead", selectedUser.id).catch(err => console.error(err));
    }
  }, [selectedUser, connection]);

 useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) { navigate('/'); return; }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        myUserIdRef.current = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    } catch (e) {}

    // YENİ: RSA Anahtarlarını Üreten ve Sunucuya Yükleyen Yardımcı Fonksiyon
    const updateRSAKeys = async () => {
        try {
            console.log("🔒 RSA Anahtarları yenileniyor...");
            const keys = CryptoHelper.generateRSAKeys();
            const privKey = keys.privateKey; 
            const pubKey = keys.publicKey;
            
            // LocalStorage'ı Güncelle
            localStorage.setItem('rsaPrivateKey', privKey); 
            localStorage.setItem('rsaPublicKey', pubKey);
            
            // React Ref'lerini Güncelle (Anlık kullanım için)
            myPrivateKeyRef.current = privKey; 
            myPublicKeyRef.current = pubKey;

            // Sunucudaki Public Key'imizi Güncelle
            await axios.post('https://localhost:7220/api/RsaKey/upload-public-key', 
                { publicKey: pubKey }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log("✅ Yeni RSA Public Key sunucuya başarıyla yüklendi.");
        } catch (error) {
            console.error("RSA Güncelleme Hatası:", error);
        }
    };

    const fetchContacts = async () => {
      try {
        const response = await axios.get('https://localhost:7220/api/Contact/list', { headers: { Authorization: `Bearer ${token}` } });
        setContacts(response.data);
      } catch (error) {}
    };

    let rsaIntervalId; // Zamanlayıcı ID'sini tutmak için

    const initializeChat = async () => {
      try {
        let privKey = localStorage.getItem('rsaPrivateKey');
        let pubKey = localStorage.getItem('rsaPublicKey');
        
        // Eğer ilk defa giriyorsa anahtarları üret ve sunucuya at
        if (!privKey || !pubKey) {
            await updateRSAKeys();
        } else {
            myPrivateKeyRef.current = privKey; 
            myPublicKeyRef.current = pubKey;
            // Var olanı başlangıçta sunucuya bildir
            await axios.post('https://localhost:7220/api/RsaKey/upload-public-key', 
              { publicKey: pubKey }, { headers: { Authorization: `Bearer ${token}` } }
            );
        }

        // YENİ: PERİYODİK GÜNCELLEME (Timer)
        // Her 5 dakikada bir (5 * 60 * 1000 ms) arka planda yeni RSA anahtarı üretip sunucuya atar
        rsaIntervalId = setInterval(() => {
            updateRSAKeys();
        }, 5 * 60 * 1000);

        const newConnection = new HubConnectionBuilder()
          .withUrl('https://localhost:7220/chathub', { accessTokenFactory: () => token })
          .configureLogging(LogLevel.Information)
          .withAutomaticReconnect()
          .build();

        newConnection.on("ReceivePayload", async (payloadString) => {
          try {
            const payload = JSON.parse(payloadString);
            
            // Dijital İmza Doğrulama
            let isSignatureValid = false;
            if (payload.signature && payload.senderId) {
                try {
                    const res = await axios.get(`https://localhost:7220/api/RsaKey/get-public-key/${payload.senderId}`, { headers: { Authorization: `Bearer ${token}` } });
                    const senderPublicKey = res.data.publicKey;
                    isSignatureValid = CryptoHelper.verifySignature(payload.encryptedData, payload.signature, senderPublicKey);
                } catch (e) { console.error("İmza doğrulanamadı", e); }
            }

            const decryptedSessionKey = CryptoHelper.decryptWithRSA(payload.encryptedSessionKey, myPrivateKeyRef.current);
            // AES yerine DES
            const decryptedMessage = CryptoHelper.decryptTextDES(payload.encryptedData, decryptedSessionKey);
            
            setMessages((prev) => [...prev, { 
                id: Date.now() + Math.random(), 
                text: decryptedMessage, 
                sender: "other", 
                sessionKey: decryptedSessionKey, 
                isRead: false, 
                animate: true, 
                createdAt: new Date(),
                isVerified: isSignatureValid
            }]);
            scrollToBottom(true);

            if (targetIdRef.current) {
                newConnection.invoke("MarkMessagesAsRead", targetIdRef.current).catch(err => console.error(err));
            }
          } catch (error) { console.error(error); }
        });

        newConnection.on("MessagesRead", (readerId) => {
            if (targetIdRef.current === readerId) {
                setMessages((prev) => prev.map(msg => msg.sender === "me" ? { ...msg, isRead: true } : msg));
            }
        });

        newConnection.on("ReceiveTyping", (senderId, isTyping) => setTypingUsers((prev) => ({ ...prev, [senderId]: isTyping })));
        newConnection.on("UserStatusChanged", (userId, isOnline, lastSeen) => {
            setContacts((prev) => prev.map(u => u.id === userId ? { ...u, isOnline, lastSeen } : u));
            setSelectedUser((prev) => prev?.id === userId ? { ...prev, isOnline, lastSeen } : prev);
        });

        newConnection.on("IncomingCall", (callerId, payloadString) => {
            if (callStatusRef.current !== 'idle') return;
            try {
                let offer;
                let withVideo = true; 
                if (payloadString.startsWith('{')) {
                    const data = JSON.parse(payloadString);
                    if (data.type === 'offer') {
                        offer = data.offer;
                        withVideo = data.withVideo;
                    } else { offer = data; }
                } else { offer = JSON.parse(payloadString); }
                
                setIncomingCallData({ callerId, offer, withVideo });
                setCallStatus('receiving');
            } catch(e) { console.error(e); }
        });
        
        newConnection.on("CallAnswered", async (receiverId, payloadString) => {
            if (peerConnectionRef.current) {
                try {
                    const data = JSON.parse(payloadString);
                    const answer = data.type === 'answer' ? data.answer : data;
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                    setCallStatus('connected');
                } catch(e) { console.error("Arama cevaplama hatası:", e); }
            }
        });
        
        newConnection.on("CallRejected", () => { 
            stopMediaTracks(); setCallStatus('idle'); alert("Karşı taraf aramayı reddetti veya yanıt vermiyor."); 
        });
        
        newConnection.on("CallEnded", () => { stopMediaTracks(); setCallStatus('idle'); });
        
        newConnection.on("ReceiveIceCandidate", async (senderId, candidateString) => {
            if (peerConnectionRef.current) {
                try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateString))); } catch (e) { console.error("ICE Hatası:", e); }
            }
        });

        await newConnection.start();
        setConnection(newConnection);
      } catch (error) {}
    };

    fetchContacts(); 
    initializeChat();

    // Cleanup fonksiyonu: Sayfadan çıkıldığında dinlemeyi ve sayacı durdur
    return () => { 
        if (connection) connection.stop(); 
        if (rsaIntervalId) clearInterval(rsaIntervalId);
    };
  }, []);

  useEffect(() => {
      setMessages([]); 
      setSkip(0); 
      setHasMore(true);
      if (selectedUser) {
          fetchHistory(0, selectedUser);
      }
  }, [selectedUser]);

  const scrollToBottom = (force = false) => {
    if (force || !isUserScrollingRef.current) {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: force ? "auto" : "smooth" });
            } else if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        }, 50);
    }
  };

  const handleScroll = (e) => {
      const container = e.target;
      isUserScrollingRef.current = container.scrollHeight - container.scrollTop - container.clientHeight > 150;

      if (container.scrollTop === 0 && hasMore && !isLoadingHistory) {
          const nextSkip = skip + 20;
          setSkip(nextSkip); fetchHistory(nextSkip, selectedUser);
      }
  };

  const fetchHistory = async (currentSkip, targetUser = selectedUser) => {
    if (!targetUser || isLoadingHistory || (currentSkip > 0 && !hasMore)) return;
    setIsLoadingHistory(true);
    const token = localStorage.getItem('jwtToken');
    try {
        const container = messagesContainerRef.current;
        const previousScrollHeight = container ? container.scrollHeight : 0;
        
        const response = await axios.get(`https://localhost:7220/api/Message/history/${targetUser.id}?skip=${currentSkip}&take=20`, { headers: { Authorization: `Bearer ${token}` } });

        const newMessages = response.data.map(msg => {
            const isMe = msg.senderId === myUserIdRef.current;
            const encryptedSessionKey = isMe ? msg.senderEncryptedSessionKey : msg.receiverEncryptedSessionKey;
            try {
                const decryptedSessionKey = CryptoHelper.decryptWithRSA(encryptedSessionKey, myPrivateKeyRef.current);
                // AES yerine DES kullanılıyor
                const decryptedText = CryptoHelper.decryptTextDES(msg.encryptedContent, decryptedSessionKey);
                return { id: msg.id, text: decryptedText, sender: isMe ? "me" : "other", sessionKey: decryptedSessionKey, isRead: msg.isRead, animate: false, createdAt: msg.createdAt, isVerified: msg.isSignatureValid || false };
            } catch(e) { return { id: msg.id, text: "🔒 Şifre çözülemedi.", sender: isMe ? "me" : "other", isRead: msg.isRead, animate: false, createdAt: msg.createdAt }; }
        });

        if (newMessages.length < 20) setHasMore(false);
        setMessages(prev => currentSkip === 0 ? newMessages : [...newMessages, ...prev]);

        setTimeout(() => {
            if (container) {
                if (currentSkip === 0) {
                    isUserScrollingRef.current = false;
                    scrollToBottom(true);
                    setTimeout(() => scrollToBottom(true), 800);
                } else {
                    container.scrollTop = container.scrollHeight - previousScrollHeight;
                }
            }
        }, 50);
    } catch (error) { console.error(error); } 
    finally { setIsLoadingHistory(false); }
  };
  
  const handleAddContact = async (e) => {
      e.preventDefault();
      try {
          await axios.post('https://localhost:7220/api/Contact/add', { email: newContactEmail }, { headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` } });
          setNewContactEmail('');
          const response = await axios.get('https://localhost:7220/api/Contact/list', { headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` } });
          setContacts(response.data);
      } catch(error) { alert("Hata!"); }
  };

  const handleImageSelect = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const newPreviews = files.map(file => ({
          file: file,
          previewUrl: URL.createObjectURL(file) 
      }));

      setSelectedFiles(prev => {
          const updated = [...prev, ...newPreviews];
          if (prev.length === 0) setActivePreviewIndex(0);
          return updated;
      });
      e.target.value = null; 
  };

  const removeSelectedFile = (indexToRemove, e) => {
      if (e) e.stopPropagation();
      setSelectedFiles(prev => {
          const updated = prev.filter((_, idx) => idx !== indexToRemove);
          if (updated.length === 0) return [];
          
          if (indexToRemove === activePreviewIndex) {
              setActivePreviewIndex(Math.max(0, indexToRemove - 1));
          } else if (indexToRemove < activePreviewIndex) {
              setActivePreviewIndex(activePreviewIndex - 1);
          }
          return updated;
      });
  };

  const nextPreviewImage = (e) => {
      e.stopPropagation();
      setActivePreviewIndex(prev => prev === selectedFiles.length - 1 ? 0 : prev + 1);
  };
  const prevPreviewImage = (e) => {
      e.stopPropagation();
      setActivePreviewIndex(prev => prev === 0 ? selectedFiles.length - 1 : prev - 1);
  };

  const sendEncryptedData = async (dataString, isImage = false, customSessionKey = null) => {
      if (!selectedUser || !connection) return;
      try {
          const response = await axios.get(`https://localhost:7220/api/RsaKey/get-public-key/${selectedUser.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` } });
          const sessionKey = customSessionKey || CryptoHelper.generateSessionKey();
          
          let contentToEncrypt = dataString;
          if (isImage && !dataString.includes('[GALLERY]')) { 
              contentToEncrypt = `[IMAGE]${dataString}`; 
          }

          // Veriyi DES ile şifrele
          const encryptedData = CryptoHelper.encryptTextDES(contentToEncrypt, sessionKey);
          
          // Şifreli veriyi KENDİ PRIVATE KEY'imiz ile imzalıyoruz
          const digitalSignature = CryptoHelper.signData(encryptedData, myPrivateKeyRef.current);

          const payload = {
            type: "content", 
            senderId: myUserIdRef.current, // Karşı tarafın Public Key'imizi alabilmesi için
            encryptedSessionKey: CryptoHelper.encryptWithRSA(sessionKey, response.data.publicKey),
            senderEncryptedSessionKey: CryptoHelper.encryptWithRSA(sessionKey, myPublicKeyRef.current),
            encryptedData: encryptedData,
            signature: digitalSignature // İmzayı payload'a dahil ettik
          };

          setMessages((prev) => [...prev, { id: Date.now() + Math.random(), text: contentToEncrypt, sender: "me", sessionKey: sessionKey, isRead: false, animate: true, createdAt: new Date() }]);
          scrollToBottom(true); 
          
          await connection.invoke("SendEncryptedPayload", selectedUser.id, JSON.stringify(payload));
      } catch (error) { alert("Gönderilemedi!"); }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() && selectedFiles.length === 0) return;
    
    setIsUploading(true); 
    let uploadedUrls = [];
    let gallerySessionKey = CryptoHelper.generateSessionKey();
    
    if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
            const fileObj = selectedFiles[i].file;
            const reader = new FileReader();
            
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(fileObj);
            });
            
            const base64Data = await base64Promise;
            // AES yerine DES kullanılıyor
            const encryptedData = CryptoHelper.encryptTextDES(base64Data, gallerySessionKey);
            
            const encryptedFile = new File([encryptedData], `gizli_resim_${Date.now()}_${i}.enc`, { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append('file', encryptedFile); 
            
            try {
                const uploadRes = await axios.post('https://localhost:7220/api/File/upload', formData, { headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` } });
                const finalUrl = uploadRes.data.url || uploadRes.data;
                uploadedUrls.push(finalUrl);
            } catch (error) { console.error("Resim yükleme hatası:", error); }
        }
    }

    let contentToSend = "";
    if (uploadedUrls.length > 0) {
        contentToSend += `[GALLERY]${uploadedUrls.join('|')}`;
    }
    if (messageText.trim()) {
        if(uploadedUrls.length > 0) contentToSend += `[TEXT]${messageText.trim()}`;
        else contentToSend = messageText.trim();
    }
    
    if(contentToSend) {
        await sendEncryptedData(contentToSend, false, uploadedUrls.length > 0 ? gallerySessionKey : null);
    }
    
    setMessageText('');
    setSelectedFiles([]);
    setActivePreviewIndex(0);
    setIsUploading(false);
    
    if (connection && selectedUser) {
        connection.invoke("SendTyping", selectedUser.id, false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (connection && selectedUser) {
        if (!typingTimeoutRef.current) {
            connection.invoke("SendTyping", selectedUser.id, true).catch(()=>{});
        }
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            connection.invoke("SendTyping", selectedUser.id, false).catch(()=>{});
            typingTimeoutRef.current = null;
        }, 2000);
    }
  };

  const openLightbox = (decryptedImagesArray, startIndex) => {
      setLightboxImages(decryptedImagesArray);
      setLightboxIndex(startIndex);
  };
  const nextLightboxImage = (e) => {
      e.stopPropagation();
      setLightboxIndex(prev => prev === lightboxImages.length - 1 ? 0 : prev + 1);
  };
  const prevLightboxImage = (e) => {
      e.stopPropagation();
      setLightboxIndex(prev => prev === 0 ? lightboxImages.length - 1 : prev - 1);
  };

  const stopMediaTracks = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
      }
      setIncomingCallData(null);
  };

  const createPeerConnection = (targetId) => {
      const pc = new RTCPeerConnection(rtcConfig);
      pc.onicecandidate = (event) => { if (event.candidate && connection) connection.invoke("SendIceCandidate", targetId, JSON.stringify(event.candidate)); };
      pc.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; };
      peerConnectionRef.current = pc;
      return pc;
  };

  const initiateCall = async (withVideo = true) => {
      if (!selectedUser || !connection) return;
      setIsCameraOn(withVideo); setCallStatus('calling');
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          
          const pc = createPeerConnection(selectedUser.id);
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          const payload = JSON.stringify({ type: 'offer', offer: offer, withVideo: withVideo });
          await connection.invoke("CallUser", selectedUser.id, payload);
          
      } catch (error) { 
          setCallStatus('idle'); 
          console.error("Kamera Hatası:", error);
          alert("Kamera veya mikrofon izni alınamadı!"); 
      }
  };

  const acceptCall = async () => {
      if (!incomingCallData || !connection) return;
      setCallStatus('connected');
      
      try {
          let stream;
          try {
              stream = await navigator.mediaDevices.getUserMedia({ 
                  video: incomingCallData.withVideo ? true : false, 
                  audio: true 
              });
          } catch(err) {
              console.warn("Görüntülü cihaz bulunamadı, ses deneniyor...");
              stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          }

          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          
          const pc = createPeerConnection(incomingCallData.callerId);
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
          
          await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          const answerPayload = JSON.stringify({ type: 'answer', answer: answer });
          await connection.invoke("AnswerCall", incomingCallData.callerId, answerPayload);
      } catch (error) { 
          console.error("Donanım izni hatası:", error);
          alert("Kamera veya mikrofonunuza kesinlikle ulaşılamadı.");
          rejectCall(); 
      }
  };

  const rejectCall = async () => {
      if (connection && incomingCallData) await connection.invoke("RejectCall", incomingCallData.callerId);
      stopMediaTracks(); setCallStatus('idle');
  };

  const endCall = async () => {
      const target = targetIdRef.current || incomingCallData?.callerId;
      if (connection && target) await connection.invoke("EndCall", target);
      stopMediaTracks(); setCallStatus('idle');
  };

  return (
    <div className="app-chat-layout">
      
      {/* 1. SÜTUN: SOL PANEL */}
      <aside className={`app-left-sidebar ${isLeftMenuOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-yellow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Önceki Sohbetler</span>
            <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={() => navigate('/settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><SettingsIcon size={20} /></button>
                <button onClick={() => { localStorage.removeItem('jwtToken'); navigate('/'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><LogOut size={20} /></button>
            </div>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {contacts.map(user => ( 
              <div 
                key={`chat-${user.id}`} 
                className="contact-item"
                onClick={() => { setSelectedUser(user); setIsLeftMenuOpen(false); }} 
                style={{ padding: '15px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bg-dark)', backgroundColor: selectedUser?.id === user.id ? 'var(--bg-input)' : 'transparent', transition: 'background 0.2s' }}
              >
                <div style={{ position: 'relative', marginRight: '15px', flexShrink: 0 }}>
                    <img src={user.profilePictureUrl ? `https://localhost:7220${user.profilePictureUrl}` : 'https://ui-avatars.com/api/?name=' + user.firstName + '+' + user.lastName + '&background=random'} alt="avatar" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                    {user.isOnline && <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '10px', height: '10px', backgroundColor: 'var(--accent-yellow)', borderRadius: '50%', border: '2px solid var(--bg-panel)' }}></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow:'hidden' }}>{user.firstName} {user.lastName}</div>
                    <div style={{ color: typingUsers[user.id] ? 'var(--accent-yellow)' : 'var(--text-muted)', fontSize: '13px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow:'hidden' }}>
                        {typingUsers[user.id] ? 'yazıyor...' : "Mesajlaşmaya başla"}
                    </div>
                </div>
              </div>
          ))}
        </div>
      </aside>

      {/* Mobilde Menüler Açıkken Arkaplanı Karart */}
      {(isLeftMenuOpen || isRightMenuOpen) && (
          <div className="mobile-overlay active" onClick={() => { setIsLeftMenuOpen(false); setIsRightMenuOpen(false); }}></div>
      )}

      {/* 2. SÜTUN: ORTA PANEL */}
      <main className="app-main-panel">
        
        {/* WEBRTC EKRANI (Video/Arama) */}
        {callStatus !== 'idle' && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, display: callStatus === 'connected' ? 'block' : 'none' }} />
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '150px', height: '200px', objectFit: 'cover', position: 'absolute', bottom: '100px', right: '20px', borderRadius: '12px', border: '2px solid var(--accent-yellow)', display: isCameraOn ? 'block' : 'none', zIndex: 10 }} />
                
                <div style={{ zIndex: 10, textAlign: 'center', marginBottom: '30px' }}>
                    {callStatus === 'calling' && <h2 style={{color: 'var(--accent-yellow)'}}>Aranıyor...</h2>}
                    {callStatus === 'receiving' && (
                        <h2 style={{color: 'var(--accent-yellow)'}}>
                            {incomingCallData?.withVideo ? '📹 Gelen Görüntülü Arama!' : '📞 Gelen Sesli Arama!'}
                        </h2>
                    )}
                    {callStatus === 'connected' && <div style={{ position: 'absolute', top: '20px', left: '20px', background: 'var(--accent-yellow)', color: '#000', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>Bağlanıldı 🔒</div>}
                </div>

                <div style={{ zIndex: 10, display: 'flex', gap: '20px', position: 'absolute', bottom: '40px' }}>
                    {callStatus === 'receiving' && (
                        <button onClick={acceptCall} style={{ padding: '15px 30px', borderRadius: '30px', border: 'none', backgroundColor: '#00a884', color: 'white', cursor: 'pointer', display: 'flex', gap: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                            <PhoneCall /> Cevapla
                        </button>
                    )}
                    {callStatus === 'receiving' ? (
                        <button onClick={rejectCall} style={{ padding: '15px 30px', borderRadius: '30px', border: 'none', backgroundColor: '#dc3545', color: 'white', cursor: 'pointer', display: 'flex', gap: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                            <PhoneOff /> Reddet
                        </button>
                    ) : (
                        <button onClick={endCall} style={{ padding: '15px 40px', borderRadius: '30px', border: 'none', backgroundColor: '#dc3545', color: 'white', cursor: 'pointer', display: 'flex', gap: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                            <PhoneOff /> {callStatus === 'calling' ? 'Kapat' : 'Görüşmeyi Bitir'}
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* --- RESİM SEÇİLİNCE ÇIKAN POP-UP (MODAL) --- */}
        {selectedFiles.length > 0 && (
          <div className="send-modal-overlay">
             <div className="send-modal-header">
                 <button className="send-modal-close-btn" onClick={() => setSelectedFiles([])} title="İptal">
                   <X size={30} />
                 </button>
             </div>

             <div className="send-modal-body">
                {selectedFiles.length > 1 && (
                    <button className="send-modal-nav-btn send-modal-nav-left" onClick={prevPreviewImage}>
                        <ChevronLeft size={24}/>
                    </button>
                )}
                
                <img src={selectedFiles[activePreviewIndex]?.previewUrl} alt="Büyük Önizleme" className="send-modal-main-img" />
                
                {selectedFiles.length > 1 && (
                    <button className="send-modal-nav-btn send-modal-nav-right" onClick={nextPreviewImage}>
                        <ChevronRight size={24}/>
                    </button>
                )}
             </div>

             <div className="send-modal-footer">
                 <div className="send-modal-thumbnails">
                   {selectedFiles.map((item, idx) => (
                     <div key={idx} className={`send-modal-thumb ${idx === activePreviewIndex ? 'active' : ''}`} onClick={() => setActivePreviewIndex(idx)}>
                       <img src={item.previewUrl} alt={`thumb-${idx}`} />
                       <button type="button" className="thumb-remove-badge" onClick={(e) => removeSelectedFile(idx, e)}>
                          <X size={12} strokeWidth={4} />
                       </button>
                     </div>
                   ))}
                 </div>

                 <div style={{ display: 'flex', width: '100%', maxWidth: '800px', gap: '10px', alignItems: 'center', backgroundColor: 'var(--bg-input)', padding: '10px 15px', borderRadius: '30px' }}>
                    <input 
                        type="text" 
                        placeholder="Resimlere bir not ekleyin..." 
                        value={messageText} 
                        onChange={handleTyping}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleSendMessage(e) }}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }} 
                        autoFocus
                    />
                    <button type="button" onClick={handleSendMessage} disabled={isUploading} style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justify: 'center', cursor: 'pointer', padding: '10px', borderRadius: '50%', transition: 'transform 0.2s', opacity: isUploading ? 0.7 : 1 }}>
                        {isUploading ? <Loader2 className="lucide-spin" size={22} /> : <ArrowUp size={22} strokeWidth={3} />}
                    </button>
                 </div>
             </div>
          </div>
        )}

        {/* --- TAM EKRAN GALERİ (SOHBETTEKİ RESME TIKLAYINCA AÇILAN) --- */}
        {lightboxImages.length > 0 && (
            <div className="lightbox-overlay" onClick={() => setLightboxImages([])}>
                <button className="lightbox-close" onClick={() => setLightboxImages([])}><X size={40}/></button>
                {lightboxImages.length > 1 && <button className="lightbox-nav lightbox-prev" onClick={prevLightboxImage}><ChevronLeft size={30}/></button>}
                
                <img src={lightboxImages[lightboxIndex]} alt="Fullscreen" className="lightbox-content" onClick={(e) => e.stopPropagation()} />
                
                {lightboxImages.length > 1 && <button className="lightbox-nav lightbox-next" onClick={nextLightboxImage}><ChevronRight size={30}/></button>}
            </div>
        )}

        {selectedUser ? (
          <>
            <div style={{ padding: '15px 20px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="hamburger-btn" onClick={() => setIsLeftMenuOpen(!isLeftMenuOpen)}>
                        <Menu size={28} />
                    </button>
                    <img src={selectedUser.profilePictureUrl ? `https://localhost:7220${selectedUser.profilePictureUrl}` : 'https://ui-avatars.com/api/?name=' + selectedUser.firstName + '+' + selectedUser.lastName + '&background=random'} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                        <div style={{ fontWeight: 'bold' }}>{selectedUser.firstName} {selectedUser.lastName}</div>
                        <div style={{ fontSize: '12px', color: typingUsers[selectedUser.id] ? 'var(--accent-yellow)' : (selectedUser.isOnline ? 'var(--accent-yellow)' : 'var(--text-muted)') }}>
                            {typingUsers[selectedUser.id] ? 'yazıyor...' : selectedUser.isOnline ? 'Çevrimiçi' : selectedUser.lastSeen ? `Son görülme: ${new Date(selectedUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Çevrimdışı'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <button onClick={() => initiateCall(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-yellow)' }} title="Sesli Ara"><Phone size={22} /></button>
                    <button onClick={() => initiateCall(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-yellow)' }} title="Görüntülü Ara"><Video size={24} /></button>
                    <button className="contacts-btn" onClick={() => setIsRightMenuOpen(!isRightMenuOpen)}>
                        <Users size={24} />
                    </button>
                </div>
            </div>
            
            <div className="chat-messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
              {isLoadingHistory && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}><Loader2 className="lucide-spin" size={24} color="var(--accent-yellow)" /></div>
              )}
              
              <AnimatePresence>
                {messages.map(msg => {
                  const isMe = msg.sender === 'me';
                  
                  let isGallery = msg.text.startsWith('[GALLERY]');
                  let isOldSingleImage = msg.text.startsWith('[IMAGE]');
                  let urls = [];
                  let textContent = msg.text;

                  if (isGallery) {
                      const parts = msg.text.split('[TEXT]');
                      urls = parts[0].replace('[GALLERY]', '').split('|').filter(u => u);
                      textContent = parts.length > 1 ? parts[1] : '';
                  } else if (isOldSingleImage) {
                      urls = [msg.text.replace('[IMAGE]', '')];
                      textContent = '';
                      isGallery = true; 
                  }

                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={msg.animate ? { opacity: 0, y: 50, scale: 0.9, x: isMe ? 50 : -50 } : { opacity: 1, y: 0, scale: 1, x: 0 }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 120, damping: 18 }} 
                      style={{ display: 'flex', width: '100%', justifyContent: isMe ? 'flex-end' : 'flex-start', transformOrigin: isMe ? 'bottom right' : 'bottom left' }}
                    >
                      <div className="message-bubble-base" style={{
                          backgroundColor: isMe ? (msg.isRead ? 'var(--accent-yellow)' : '#4a4a4a') : 'var(--bg-input)',
                          color: isMe ? (msg.isRead ? '#000' : '#fff') : 'var(--text-main)',
                          borderBottomRightRadius: isMe ? '4px' : '15px',
                          borderBottomLeftRadius: isMe ? '15px' : '4px',
                          padding: isGallery && urls.length > 1 ? '4px' : '10px 15px' 
                      }}>
                        
                        {isGallery && urls.length === 1 && <EncryptedImage fileUrl={urls[0]} sessionKey={msg.sessionKey} onClick={openLightbox} onLoaded={() => scrollToBottom(false)} />}
                        {isGallery && urls.length > 1 && <MessageGallery urls={urls} sessionKey={msg.sessionKey} onImageClick={openLightbox} onLoaded={() => scrollToBottom(false)} />}
                        
                        {textContent && (
                            <div style={{ marginTop: isGallery ? '8px' : '0', padding: isGallery ? '0 8px 0px 8px' : '0' }}>
                                {textContent}
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', marginTop: '4px', paddingRight: isGallery ? '8px' : '0' }}>
                           
                            <span style={{ fontSize: '10px', color: isMe ? (msg.isRead ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)') : 'var(--text-muted)' }}>
                                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                         
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* NORMAL SOHBET İNPUT ALANI */}
            {!selectedFiles.length > 0 && (
                <form style={{ padding: '20px', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-input)', borderRadius: '30px', padding: '8px 15px', gap: '10px' }}>
                    
                    <input type="file" multiple accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageSelect} />
                    <button type="button" onClick={() => fileInputRef.current.click()} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Resim Ekle">
                        <ImageIcon size={22} />
                    </button>

                    <input 
                        type="text" 
                        placeholder="Bir mesaj yazın..." 
                        value={messageText} 
                        onChange={handleTyping}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleSendMessage(e) }}
                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '15px', padding: '10px 5px', outline: 'none' }} 
                        autoComplete="off" 
                    />

                    <button type="button" onClick={handleSendMessage} style={{ backgroundColor: 'var(--accent-yellow)', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justify: 'center', cursor: 'pointer', padding: '10px', borderRadius: '50%', transition: 'transform 0.2s' }} title="Gönder">
                        <ArrowUp size={22} strokeWidth={3} />
                    </button>
                </div>
                </form>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontSize: '18px', flexDirection: 'column', gap: '15px', position: 'relative' }}>
             <button className="hamburger-btn" onClick={() => setIsLeftMenuOpen(true)} style={{ position: 'absolute', top: '20px', left: '20px' }}>
                 <Menu size={32} />
             </button>
             
             <div style={{ padding: '20px', backgroundColor: 'var(--bg-panel)', borderRadius: '50%' }}>
                <ImageIcon size={48} color="var(--accent-yellow)" />
             </div>
             Sohbete başlamak için soldan veya sağdan bir kişi seçin.
          </div>
        )}
      </main>

      {/* 3. SÜTUN: SAĞ PANEL (Mobil Uyumlu) */}
      <aside className={`app-right-sidebar ${isRightMenuOpen ? 'open' : ''}`}>
          <div style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-yellow)' }}>
              Rehber
          </div>
          
          <div style={{ padding: '15px', borderBottom: '1px solid var(--bg-dark)' }}>
              <form onSubmit={handleAddContact} style={{display:'flex', gap:'10px', alignItems: 'center'}}>
                  <input type="email" placeholder="E-posta ile ekle..." value={newContactEmail} onChange={(e)=>setNewContactEmail(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'20px', border:'none', backgroundColor:'var(--bg-input)', color: 'var(--text-main)', fontSize:'13px', outline:'none'}} />
                  <button type="submit" style={{padding:'10px', background:'var(--accent-yellow)', color:'#000', border:'none', borderRadius:'50%', cursor:'pointer', display:'flex'}}><UserPlus size={18} /></button>
              </form>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
              {contacts.map(user => (
                  <div 
                    key={`contact-${user.id}`} 
                    className="contact-item"
                    onClick={() => { setSelectedUser(user); setIsRightMenuOpen(false); setIsLeftMenuOpen(false); }} 
                    style={{ padding: '15px 20px', cursor: 'pointer', borderBottom: '1px solid var(--bg-dark)', transition: 'background 0.2s' }}
                  >
                      <div style={{ position: 'relative', flexShrink: 0, marginRight: '15px' }}>
                          <img src={user.profilePictureUrl ? `https://localhost:7220${user.profilePictureUrl}` : 'https://ui-avatars.com/api/?name=' + user.firstName + '+' + user.lastName + '&background=random'} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                          {user.isOnline && <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '10px', height: '10px', backgroundColor: 'var(--accent-yellow)', borderRadius: '50%', border: '2px solid var(--bg-panel)' }}></div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow:'hidden', color: 'var(--text-main)' }}>{user.firstName} {user.lastName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow:'hidden' }}>{user.email}</div>
                      </div>
                  </div>
              ))}
          </div>
      </aside>

    </div>
  );
}
# IEA (Online Image Encryption Application) - Frontend Client

Bu depo, IEA sisteminin React / Vite tabanlı kullanıcı arayüzünü (Önyüz) içerir. 

⚠️ **ÖNEMLİ NOT:** Tüm projeyi (Veritabanı, Backend, Redis ve bu arayüzü) tek tuşla çalıştırmak için lütfen **Ana Backend Reposundaki Docker talimatlarını** okuyun
Backend Reposu:https://github.com/mazlumAydemir/chatApplication-backend/

## 💻 Geliştiriciler İçin Sadece Arayüzü Çalıştırma

Eğer Docker kullanmadan sadece React projesini yerelinizde çalıştırmak isterseniz:

1. Bilgisayarınızda Node.js yüklü olduğundan emin olun.
2. Terminalde proje klasörüne gidin ve paketleri yükleyin:
   ```bash
   npm install
Projeyi başlatın:

Bash
npm run dev
Uygulama http://localhost:5173 adresinde çalışacaktır. (Bağlantıların sağlanması için Backend API'nin de çalışıyor olması gerekir).


### Nasıl Yükleyeceksin?
Dosyaları kendi klasörlerine oluşturduktan sonra, her iki terminalde de ayrı ayrı şu standart Git komutlarını girerek değişiklikleri GitHub'a gönderebilirsin:
```bash
git add README.md
git commit -m "docs: README eklendi"
git push

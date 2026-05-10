# Node.js'in hafif bir sürümünü kullan
FROM node:20-alpine
WORKDIR /app

# Önce paket dosyalarını kopyala ve kur (npm install)
COPY package*.json ./
RUN npm install

# Kalan tüm React kodlarını kopyala
COPY . .

# Vite'in standart portunu aç
EXPOSE 5173

# Projeyi dışa açık şekilde başlat
CMD ["npm", "run", "dev", "--", "--host"]
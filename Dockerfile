# 1. Aşama: Build (Node.js kullanarak React'i derliyoruz)
FROM node:20-alpine as build
WORKDIR /app

# Paketleri yükle
COPY package*.json ./
RUN npm install

# Tüm kodları kopyala ve derle
COPY . ./
RUN npm run build

# 2. Aşama: Çalıştırma (Nginx ile hızlı sunum)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html 
# NOT: Eğer Vite kullanıyorsan klasör adı 'dist' olur. Create React App kullanıyorsan 'build' yapmalısın.

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
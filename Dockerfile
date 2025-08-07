# Usa una imagen oficial de Node.js
FROM node:20-alpine
# Crea el directorio de la aplicación
WORKDIR /usr/src/app

# Copia el package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto que usa la aplicación
EXPOSE 3000

# Comando para correr la aplicación
CMD [ "node", "app.js" ]
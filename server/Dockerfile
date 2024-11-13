# Stap 1: Gebruik een official Node.js image als basis
FROM node:18

# Stap 2: Werkdir instellen
WORKDIR /app

# Stap 3: Kopieer package.json en package-lock.json (of yarn.lock) naar de container
COPY package*.json ./

# Stap 4: Installeer dependencies
RUN npm install

# Stap 5: Kopieer de rest van de applicatie naar de container
COPY . .

# Stap 6: Exposeer de poort waarop de app draait
EXPOSE 3000

# Stap 7: Definieer het commando om de applicatie te starten
CMD ["npm", "start"]

# Using the default Node.js 23.9.0 image
FROM node:23.9.0


# RUN apt-get update && apt-get upgrade -y && apt-get clean

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001
 
CMD ["node", "index.js"]
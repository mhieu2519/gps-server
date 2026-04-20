FROM node:24-alpine

WORKDIR /app

# Copy package.json trước để tận dụng Docker cache
COPY package*.json ./
RUN npm install

# Copy toàn bộ code còn lại
COPY . .

# Build dự án Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
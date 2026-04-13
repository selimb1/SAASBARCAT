FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Expose port and start development server
EXPOSE 3000
CMD ["npm", "run", "dev"]

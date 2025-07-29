# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Install Docker CLI tools inside the container
# This allows the Node.js application to run 'docker' and 'docker compose' commands
RUN apk add --no-cache docker-cli

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port where your wizard application listens
EXPOSE 3000

# Command to run the application
CMD [ "node", "server.js" ]

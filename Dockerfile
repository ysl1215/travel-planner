# Use the official Node.js image as a base
FROM node:16 AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Use the official Python image for the production environment
FROM python:3.8-slim

# Set the working directory
WORKDIR /app

# Copy the built Next.js application from the previous stage
COPY --from=build /app .

# Install fast-flights dependency
RUN pip install fast-flights

# Expose internal port 3000
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "start"]
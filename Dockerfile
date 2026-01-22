FROM debian:latest

# Install necessary packages
RUN apt-get update && apt-get install -y \
    curl \
    # Add other necessary packages here
    && rm -rf /var/lib/apt/lists/*

# Copy application files
COPY . /app

# Set working directory
WORKDIR /app

# Run the application
CMD ["npm", "start"]
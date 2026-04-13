# Use a lightweight base image
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    openjdk-17-jdk \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js explicitly (standard repo might be old, but functional for basic algo)
# For better version control, we could use nvm or setup_18.x script, 
# but apt's nodejs is usually sufficient for competitive programming (v12+).
# Let's double check nodejs version later if needed.

# Set working directory for execution
WORKDIR /app

# Create a non-root user for security (sandboxing basics)
RUN useradd -m -s /bin/bash coder
USER coder

# Default command (can be overridden)
CMD ["/bin/bash"]

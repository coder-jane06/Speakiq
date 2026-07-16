FROM python:3.11-slim

# Install system dependencies (including libgomp1 for ctranslate2/faster-whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libsndfile1 \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with user ID 1000
RUN useradd -m -u 1000 user

# Switch to the "user" user
USER user

# Set home to the user's home directory
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set the working directory to the user's home directory
WORKDIR $HOME/app

# Copy requirements first (for Docker layer caching)
COPY --chown=user requirements.txt .

# Upgrade pip first
RUN pip install --upgrade pip

# Install numpy first (required by many packages)
RUN pip install --prefer-binary "numpy>=1.26.4,<2.0"

# Install heavy ML packages with binary preference (avoids compilation failures)
RUN pip install --prefer-binary "librosa>=0.10.1"
RUN pip install --prefer-binary "faster-whisper>=1.0.0"
RUN pip install --prefer-binary "spacy>=3.7.0,<3.8.0"

# Install remaining requirements
RUN pip install --prefer-binary -r requirements.txt

# Download spacy English model
RUN python -m spacy download en_core_web_sm

# Copy the rest of the application code
COPY --chown=user . .

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# The production API is maintained in backend/. Running it from that directory
# keeps the Hugging Face Space aligned with the Render deployment.
CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]

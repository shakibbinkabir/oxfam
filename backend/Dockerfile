FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: Tell the Python installer where GDAL is
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Copy lock file too! If it's missing, Poetry might try to resolve 
# new versions that are incompatible with your system libs.
COPY pyproject.toml poetry.lock* README.md* ./

RUN touch README.md && \
    pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    # We add a specific 'poetry lock' check to ensure the environment is sane
    poetry install --no-root --no-interaction --no-ansi

COPY . .

# Non-root user for production security
RUN addgroup --system app && adduser --system --ingroup app app && \
    chown -R app:app /app

EXPOSE 8000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER app

CMD ["/entrypoint.sh"]


FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user and group
RUN groupadd -r mlforge && useradd -r -g mlforge mlforge

COPY . .
RUN chown -R mlforge:mlforge /app

USER mlforge

CMD ["python", "-m", "app.main"]

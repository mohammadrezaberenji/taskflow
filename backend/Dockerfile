## Stage 1 : builder
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .

## After copying the requirements le'ts activate the virtual env , then install the package 
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN python -m venv "$VIRTUAL_ENV"
RUN pip install -r requirements.txt

## Stage 2 : runtime 
FROM python:3.12-slim AS runtime 
WORKDIR /app

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY --from=builder /opt/venv /opt/venv
COPY Back ./Back

## first checkup backend then run 
HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=15s \
    --retries=3 \
    CMD curl --fail --silent http://localhost:8000/health/live || exit 1

##  add non root user and run the program

RUN useradd --uid 10001 --user-group --system --create-home --no-log-init app
RUN chown -R app:app /app
USER 10001
CMD ["uvicorn", "Back.main:app" , "--host" , "0.0.0.0", "--port" , "8000"]

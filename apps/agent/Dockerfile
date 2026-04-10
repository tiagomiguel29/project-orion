# syntax=docker/dockerfile:1

FROM golang:1.25-bookworm AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/orion-agent ./cmd/agent

FROM gcr.io/distroless/static-debian12
WORKDIR /app

COPY --from=build /out/orion-agent /usr/local/bin/orion-agent

ENV AGENT_INTERVAL_SEC=5 \
    AGENT_DISK_PATH=/

ENTRYPOINT ["/usr/local/bin/orion-agent"]

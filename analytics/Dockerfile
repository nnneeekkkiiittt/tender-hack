# Этап 1: Сборка
FROM golang:alpine AS builder

WORKDIR /analytics

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# Явно собираем бинарный файл с именем "analytics" в директории /src
RUN CGO_ENABLED=0 GOOS=linux go build -o /analytics/analytics ./cmd/main.go

# Этап 2: Финальный образ
FROM alpine:latest

WORKDIR /app

# Копируем бинарник /src/analytics из builder в текущую директорию /app
COPY --from=builder /analytics/analytics .

EXPOSE 8080

CMD ["./analytics"]
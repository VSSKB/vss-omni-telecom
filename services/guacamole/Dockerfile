FROM guacamole/guacamole:1.5.0

# Custom Guacamole with RabbitMQ integration
# This is a placeholder - in production, you would build a custom image
# with RabbitMQ event publishing capabilities

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/guacamole/ || exit 1


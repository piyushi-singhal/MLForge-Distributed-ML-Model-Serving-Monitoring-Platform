#!/bin/bash
echo "Simulating RabbitMQ Message Broker Outage..."
docker stop mlforge-rabbitmq
echo "RabbitMQ down. Training service should fail gracefully via 503."
sleep 10
echo "Restarting RabbitMQ..."
docker start mlforge-rabbitmq
echo "RabbitMQ restarted."

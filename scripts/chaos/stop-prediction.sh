#!/bin/bash
# Note: Requires docker-compose scale prediction-service=3 first to test load balancer
echo "Simulating Prediction Instance 1 Crash..."
docker stop mlforge-prediction-service-1
echo "Instance 1 down. Nginx should route to instance 2 & 3."
sleep 10
echo "Restarting Instance 1..."
docker start mlforge-prediction-service-1
echo "Instance 1 restarted."

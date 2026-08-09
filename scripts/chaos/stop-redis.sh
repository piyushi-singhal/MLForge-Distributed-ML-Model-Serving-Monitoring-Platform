#!/bin/bash
echo "Simulating Redis Cache Outage..."
docker stop mlforge-redis
echo "Redis down. Prediction service should fallback gracefully."
sleep 10
echo "Restarting Redis..."
docker start mlforge-redis
echo "Redis restarted."

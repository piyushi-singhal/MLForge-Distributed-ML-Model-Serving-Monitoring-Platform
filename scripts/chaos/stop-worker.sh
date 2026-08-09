#!/bin/bash
echo "Simulating Training Worker Crash (SIGKILL)..."
docker kill mlforge-training-worker
echo "Worker crashed. Sleeping for 10 seconds..."
sleep 10
echo "Restarting Worker..."
docker start mlforge-training-worker
echo "Worker restarted."

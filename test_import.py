import sys, os
service_path = os.path.abspath('services/training-worker')
sys.path.insert(0, service_path)
print("SYS.PATH:", sys.path)
import app.worker
print(app.worker)

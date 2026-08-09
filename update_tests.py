import os
import glob

test_files = glob.glob("tests/unit/**/*.py", recursive=True)

for test_file in test_files:
    if not test_file.endswith(".py"): continue
    
    # Extract service name from path (e.g. tests/unit/auth-service/test_auth.py -> auth-service)
    parts = test_file.split("/")
    if len(parts) < 4: continue
    service_name = parts[2]
    
    with open(test_file, "r") as f:
        content = f.read()
        
    # Replace old *_app with app
    content = content.replace(f"from {service_name.replace('-', '_')}", "from app")
    content = content.replace("from auth_app", "from app")
    content = content.replace("from model_app", "from app")
    content = content.replace("from prediction_app", "from app")
    content = content.replace("from training_app", "from app")
    content = content.replace("from worker_app", "from app")
    
    # Inject path setup at the top
    injection = f"""import sys
import os
# Clear cached app modules to avoid conflicts during pytest collection
for key in list(sys.modules.keys()):
    if key == 'app' or key.startswith('app.'):
        del sys.modules[key]
        
service_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/{service_name}'))
if service_path not in sys.path:
    sys.path.insert(0, service_path)

"""
    if "sys.modules.keys()" not in content:
        content = injection + content
        
    with open(test_file, "w") as f:
        f.write(content)

print("Tests updated successfully.")

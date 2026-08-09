import sys
import os
# Clear cached app modules to avoid conflicts during pytest collection
for key in list(sys.modules.keys()):
    if key == 'app' or key.startswith('app.'):
        del sys.modules[key]
        
service_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/auth'))
if service_path not in sys.path:
    sys.path.insert(0, service_path)

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../services/auth-service')))
from app.main import app
def test_auth():
    assert app.title == "MLForge Auth Service"

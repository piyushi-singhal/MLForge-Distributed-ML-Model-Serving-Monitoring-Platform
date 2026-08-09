import sys
sys.modules['app'] = "FakeApp1"

app1 = sys.modules['app']

del sys.modules['app']
sys.modules['app'] = "FakeApp2"

app2 = sys.modules['app']

print("app1:", app1)
print("app2:", app2)

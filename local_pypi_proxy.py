import http.server
import socketserver
import subprocess
import os
import sys

PORT = 8888

class PyPIProxyHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silence verbose logging to keep terminal output clean
        pass

    def do_GET(self):
        # 1. Determine target URL
        if self.path.startswith("/packages/"):
            url = "https://files.pythonhosted.org" + self.path
        else:
            url = "https://pypi.org" + self.path

        # 2. Fetch using curl (handles HTTP/2 and SSL inspection natively)
        headers_file = "headers_tmp.txt"
        body_file = "body_tmp.bin"
        if os.path.exists(headers_file): os.remove(headers_file)
        if os.path.exists(body_file): os.remove(body_file)

        cmd = ["curl", "-s", "-L", "-D", headers_file, "-o", body_file, url]
        res = subprocess.run(cmd)

        if not os.path.exists(headers_file) or not os.path.exists(body_file):
            self.send_response(502)
            self.end_headers()
            self.wfile.write(b"Bad Gateway: curl failed to retrieve " + url.encode())
            return

        # 3. Parse headers
        with open(headers_file, "rb") as f:
            header_lines = f.read().split(b"\r\n")

        status_line = b"HTTP/1.1 200 OK"
        headers_to_send = []
        for line in header_lines:
            if line.startswith(b"HTTP/"):
                status_line = line
            elif b":" in line:
                name, val = line.split(b":", 1)
                name_l = name.lower().strip()
                # Skip length/encoding headers since we modify the content and set length manually
                if name_l not in (b"content-length", b"content-encoding", b"transfer-encoding", b"content-security-policy"):
                    headers_to_send.append((name.decode().strip(), val.decode().strip()))

        # Parse status code
        parts = status_line.split(b" ")
        status_code = 200
        if len(parts) > 1:
            try:
                status_code = int(parts[1])
            except ValueError:
                pass

        # 4. Read body and rewrite URLs to point to local proxy
        with open(body_file, "rb") as f:
            body = f.read()

        # If it's a simple package page (HTML), rewrite the links
        if b"html" in self.headers.get("Accept", "").encode() or b"html" in self.path.encode() or self.path.startswith("/simple/"):
            body = body.replace(b"https://files.pythonhosted.org/", f"http://127.0.0.1:{PORT}/".encode())
            body = body.replace(b"https://pypi.org/", f"http://127.0.0.1:{PORT}/".encode())

        # Clean up temp files
        if os.path.exists(headers_file): os.remove(headers_file)
        if os.path.exists(body_file): os.remove(body_file)

        # 5. Send response
        try:
            self.send_response(status_code)
            for name, val in headers_to_send:
                self.send_header(name, val)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            pass

def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), PyPIProxyHandler) as httpd:
        print(f"Local PyPI HTTP/1.1 Proxy started on http://127.0.0.1:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("Stopping proxy...")
            sys.exit(0)

if __name__ == "__main__":
    main()

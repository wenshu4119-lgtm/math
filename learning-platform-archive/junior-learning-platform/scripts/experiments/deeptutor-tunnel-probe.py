"""Run the Node read-only adapter over an ephemeral loopback SSH tunnel."""
import sys
sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding='utf-8')
import argparse, socketserver, select, threading, subprocess
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--private-tools',required=True)
parser.add_argument('--node',required=True)
args=parser.parse_args()
sys.path.insert(0,str(Path(args.private_tools).resolve()))
from ssh_task import connect
class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        channel=None
        try:
            channel=self.server.transport.open_channel('direct-tcpip',('127.0.0.1',8001),self.request.getpeername(),timeout=10)
            while True:
                ready,_,_=select.select([self.request,channel],[],[],15)
                if not ready:return
                for source in ready:
                    data=source.recv(65536)
                    if not data:return
                    (channel if source is self.request else self.request).sendall(data)
        except Exception:return
        finally:
            if channel is not None:channel.close()
class Server(socketserver.ThreadingTCPServer):
    daemon_threads=True
    def handle_error(self,request,address):pass
try:
    with connect() as ssh,Server(('127.0.0.1',0),Handler) as server:
        server.transport=ssh.get_transport()
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            root=Path(__file__).resolve().parents[2]
            result=subprocess.run([args.node,str(root/'scripts/experiments/deeptutor-readonly-http.mjs'),'--origin',f'http://127.0.0.1:{server.server_address[1]}'],cwd=root,capture_output=True,text=True,timeout=25,encoding='utf-8')
            if result.returncode:raise RuntimeError('read adapter failed')
            print(result.stdout.strip())
        finally:server.shutdown()
except Exception:
    raise SystemExit('Read-only tunnel probe failed; raw connection data is not printed.')

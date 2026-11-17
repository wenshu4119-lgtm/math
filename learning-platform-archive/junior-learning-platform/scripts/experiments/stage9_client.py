"""Private authenticated HTTP through pinned SSH. Never logs credentials."""
import sys
sys.dont_write_bytecode=True
import socketserver,select,threading,urllib.request,urllib.error,http.cookiejar,json
sys.path.insert(0,'C:/Users/Administrator/HostodoProxy')
from ssh_task import connect
from secure_store import load
class Handler(socketserver.BaseRequestHandler):
 def handle(self):
  channel=None
  try:
   channel=self.server.transport.open_channel('direct-tcpip',('127.0.0.1',8001),self.request.getpeername(),timeout=15)
   while True:
    ready,_,_=select.select([self.request,channel],[],[],180)
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
class Client:
 def __enter__(self):
  self.ssh=connect();self.server=Server(('127.0.0.1',0),Handler);self.server.transport=self.ssh.get_transport();self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
  self.origin=f'http://127.0.0.1:{self.server.server_address[1]}'
  self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(self.jar))
  creds=load('deeptutor-login');self.request('/api/auth/login','POST',{'username':creds['username'],'password':creds['password']});return self
 def request(self,path,method='GET',body=None,content_type='application/json'):
  data=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
  req=urllib.request.Request(self.origin+path,data=data,method=method,headers={'Content-Type':content_type})
  try:
   with self.opener.open(req,timeout=180) as r:return json.load(r)
  except urllib.error.HTTPError as e:raise RuntimeError(f'HTTP {e.code} on controlled DeepTutor endpoint') from None
 def __exit__(self,*args):
  self.server.shutdown();self.server.server_close();self.ssh.close()

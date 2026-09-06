import http.server,threading,subprocess,pathlib,json,re,html,tempfile
root=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.mjs':'application/javascript'}
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/probes/browser-renderer.html'
try:
    with tempfile.TemporaryDirectory(prefix='atlas-audit-browser-') as profile:
        cmd=['chromium','--headless=new','--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync',f'--user-data-dir={profile}','--virtual-time-budget=5000','--dump-dom',url]
        result=subprocess.run(cmd,text=True,capture_output=True,timeout=25)
    (root/'results/browser-renderer.html').write_text(result.stdout)
    (root/'results/browser-renderer.stderr').write_text(result.stderr)
    match=re.search(r'<pre id="result">(.*?)</pre>',result.stdout,re.S)
    if not match:raise RuntimeError('No browser result: '+result.stderr[-1000:])
    data=json.loads(html.unescape(match.group(1)))
    (root/'results/browser-renderer.json').write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps(data,indent=2))
finally:server.shutdown();server.server_close()

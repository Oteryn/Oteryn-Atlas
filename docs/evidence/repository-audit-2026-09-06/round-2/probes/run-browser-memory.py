"""Execute original renderer functions in a local blank browser page; no HTTP navigation.
Only import/export wrappers are transformed. This is a module integration probe,
not the application's E2E, pinned Playwright CI, or real-hardware acceptance.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
fb=(root/'sources/src/browser/framebuffer-probe.mjs').read_text()
wg=(root/'sources/src/browser/fullworld-webgl.mjs').read_text()
wg=wg.replace("import { sampleVisibleFramebufferRecords } from './framebuffer-probe.mjs';\n",'')
fb=re.sub(r'^export ', '', fb, flags=re.M);wg=re.sub(r'^export ', '', wg, flags=re.M)
html=(root/'probes/browser-renderer.html').read_text();script=re.search(r'<script type="module">(.*?)</script>',html,re.S).group(1)
script=re.sub(r'^import .*?;\n','',script,flags=re.M)
wrapped='async () => {const {sampleVisibleFramebufferRecords}=(()=>{'+fb+';return {sampleVisibleFramebufferRecords};})();const {createFullWorldWebGLRenderer}=(()=>{'+wg+';return {createFullWorldWebGLRenderer};})();'+script+';return JSON.parse(document.querySelector("#result").textContent);}'
(root/'probes/browser-memory-evaluated.js').write_text(wrapped)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,timeout=12000,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 try:
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(re.sub(r'<script type="module">.*?</script>','',html,flags=re.S))
  data=page.evaluate(wrapped);data['pageErrors']=errors;data['execution']='in-memory module integration; network-free; native Chromium 144 SwiftShader'
  (root/'results/browser-renderer.json').write_text(json.dumps(data,indent=2)+'\n')
  (root/'results/browser-renderer.html').write_text(page.content())
  page.screenshot(path=str(root/'results/browser-renderer.png'),full_page=True)
  print(json.dumps(data,indent=2))
 finally:browser.close()

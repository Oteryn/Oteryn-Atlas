import fs from 'node:fs';
import {sampleVisibleFramebufferRecords} from '../sources/src/browser/framebuffer-probe.mjs';
const records=[{floor:-7,x:0,y:0,tileRecordId:'tile:synthetic-audit',primitive:{widthUnits:32,heightUnits:32,displacement:{dxUnits:0,dyUnits:0}}}];
const view={floor:-7,x:0,y:0,zoom:1},canvas={width:128,height:128};
const results=[];
for(const [id,rgba] of [['clear-success',[7,11,17,255]],['colored-success',[200,20,40,255]],['read-failure-unchanged-buffer',null]]) {
 let calls=0;const injectedFailure=rgba===null;
 const gl={RGBA:6408,UNSIGNED_BYTE:5121,NO_ERROR:0,INVALID_OPERATION:1282,CONTEXT_LOST_WEBGL:37442,isContextLost:()=>false,getError:()=>injectedFailure?1282:0,readPixels(_x,_y,_w,_h,_format,_type,out){calls++;if(rgba)out.set(rgba);}};
 let result=null,error=null;
 try{result=sampleVisibleFramebufferRecords(gl,records,view,canvas,1);}catch(e){error=e.message;}
 const invalidResult=!!error||result===null||result.valid===false||result.status==='INVALID';
 const satisfied=injectedFailure?invalidResult:!error&&(id==='clear-success'?result?.blank===true:result?.blank===false);
 results.push({id,readCalls:calls,simulatedGLError:gl.getError(),result,error,expected:injectedFailure?'classify failed/unknown read as invalid, not evidence of nonblank frame':id==='clear-success'?'blank':'nonblank',satisfied});
}
const report={scope:'CPU function with explicit fake GL readPixels/getError; NO actual WebGL/context-loss experiment succeeded.',results};
fs.writeFileSync(new URL('../results/framebuffer-fault.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

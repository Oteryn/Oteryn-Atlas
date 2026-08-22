export class FullWorldWebGLRendererError extends Error {}

const PAGE_SIZE = 1024;
const PAGE_TEXELS = PAGE_SIZE * PAGE_SIZE;
const PAGE_BYTES = PAGE_TEXELS * 4;
const FLOATS_PER_INSTANCE = 8;

function requireValue(condition, message) { if (!condition) throw new FullWorldWebGLRendererError(message); }
function compileShader(gl, type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message=gl.getShaderInfoLog(shader)||'shader compile failed'; gl.deleteShader(shader); throw new FullWorldWebGLRendererError(message); }
  return shader;
}
function createProgram(gl) {
  const vertex=compileShader(gl,gl.VERTEX_SHADER,`#version 300 es
    in vec2 a_corner; in vec4 a_geometry; in vec4 a_pixel;
    uniform vec2 u_center_world; uniform vec2 u_viewport; uniform float u_scale;
    out vec2 v_local; flat out vec4 v_meta;
    void main(){
      vec2 world=a_geometry.xy+a_corner*a_geometry.zw;
      vec2 screen=vec2(u_viewport.x*.5+(world.x-u_center_world.x)*u_scale,u_viewport.y*.5+(world.y-u_center_world.y)*u_scale);
      gl_Position=vec4(screen.x/u_viewport.x*2.0-1.0,1.0-screen.y/u_viewport.y*2.0,0.0,1.0);
      v_local=a_corner*a_pixel.yz; v_meta=a_pixel;
    }`);
  const fragment=compileShader(gl,gl.FRAGMENT_SHADER,`#version 300 es
    precision highp float; precision highp int;
    uniform highp sampler2DArray u_pixels; uniform highp sampler2DArray u_animation_pixels;
    in vec2 v_local; flat in vec4 v_meta; out vec4 out_color;
    const int PAGE_SIZE=${PAGE_SIZE}; const int PAGE_TEXELS=${PAGE_TEXELS};
    void main(){
      int base=int(v_meta.x+.5), width=int(v_meta.y+.5), height=int(v_meta.z+.5);
      int px=clamp(int(floor(v_local.x)),0,width-1), py=clamp(int(floor(v_local.y)),0,height-1);
      int linear=base+py*width+px; int layer=linear/PAGE_TEXELS; int offset=linear-layer*PAGE_TEXELS;
      ivec3 address=ivec3(offset%PAGE_SIZE,offset/PAGE_SIZE,layer);
      out_color=v_meta.w>.5?texelFetch(u_animation_pixels,address,0):texelFetch(u_pixels,address,0);
    }`);
  const program=gl.createProgram(); gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program)||'program link failed';gl.deleteProgram(program);throw new FullWorldWebGLRendererError(message);} return program;
}
function resizeCanvas(canvas){const rect=canvas.getBoundingClientRect();const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));const width=Math.max(1,Math.round(rect.width*dpr));const height=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}return dpr;}
function countVisible(records,view,canvas,dpr){const scale=view.zoom*dpr,cx=view.x*32,cy=view.y*32,hw=canvas.width/2,hh=canvas.height/2;let visible=0;for(const record of records){if(record.floor!==view.floor)continue;const p=record.primitive;const wx=record.x*32-(p.widthUnits-32)+p.displacement.dxUnits;const wy=record.y*32-(p.heightUnits-32)+p.displacement.dyUnits;const x0=hw+(wx-cx)*scale,y0=hh+(wy-cy)*scale,x1=x0+p.widthUnits*scale,y1=y0+p.heightUnits*scale;if(x1>0&&y1>0&&x0<canvas.width&&y0<canvas.height)visible+=1;}return visible;}

export function createFullWorldWebGLRenderer(canvas,pixelCatalog,runtimePixelCatalog,options={}){
  requireValue(runtimePixelCatalog?.manifest?.identityAuthority===false,'runtime pixel bucket catalog required');
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,premultipliedAlpha:false,preserveDrawingBuffer:options.capture===true,stencil:false}); requireValue(gl,'WebGL2 unavailable');
  const maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE),maxArrayLayers=gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS); requireValue(maxTextureSize>=PAGE_SIZE,`WebGL2 texture size ${maxTextureSize} below ${PAGE_SIZE}`);
  const baseLayers=Math.ceil(runtimePixelCatalog.manifest.counts.bytes/PAGE_BYTES); requireValue(baseLayers>=1&&baseLayers<=maxArrayLayers,`runtime pixel set requires ${baseLayers} layers; GPU exposes ${maxArrayLayers}`);
  const baseTextureBytes=baseLayers*PAGE_BYTES; if(Number.isFinite(options.gpuTextureBudgetBytes)) requireValue(baseTextureBytes<=options.gpuTextureBudgetBytes,`runtime pixel texture allocation ${baseTextureBytes} exceeds profile budget ${options.gpuTextureBudgetBytes}`);
  const remainingBudget=Number.isFinite(options.gpuTextureBudgetBytes)?Math.max(0,options.gpuTextureBudgetBytes-baseTextureBytes):64*1024*1024;
  const animationLayers=Math.min(16,maxArrayLayers,Math.floor(remainingBudget/PAGE_BYTES));
  const program=createProgram(gl),quadBuffer=gl.createBuffer(),instanceBuffer=gl.createBuffer();
  const cornerLocation=gl.getAttribLocation(program,'a_corner'),geometryLocation=gl.getAttribLocation(program,'a_geometry'),pixelLocation=gl.getAttribLocation(program,'a_pixel');
  const centerLocation=gl.getUniformLocation(program,'u_center_world'),viewportLocation=gl.getUniformLocation(program,'u_viewport'),scaleLocation=gl.getUniformLocation(program,'u_scale');
  gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW); gl.enableVertexAttribArray(cornerLocation);gl.vertexAttribPointer(cornerLocation,2,gl.FLOAT,false,8,0);gl.vertexAttribDivisor(cornerLocation,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);const stride=FLOATS_PER_INSTANCE*4;gl.enableVertexAttribArray(geometryLocation);gl.vertexAttribPointer(geometryLocation,4,gl.FLOAT,false,stride,0);gl.vertexAttribDivisor(geometryLocation,1);gl.enableVertexAttribArray(pixelLocation);gl.vertexAttribPointer(pixelLocation,4,gl.FLOAT,false,stride,16);gl.vertexAttribDivisor(pixelLocation,1);
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.RGBA8,PAGE_SIZE,PAGE_SIZE,baseLayers);gl.uniform1i(gl.getUniformLocation(program,'u_pixels'),0);gl.uniform1i(gl.getUniformLocation(program,'u_animation_pixels'),1);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.027,.043,.067,1);
  const gpuPlacements=new Map(),uploadedBuckets=new Map(),animationPlacementIds=new Set(); const staticRegionTexels=baseLayers*PAGE_TEXELS;
  let animationTexture=null,nextTexel=0,nextAnimationTexel=0,records=[],instanceData=new Float32Array(0),instanceCount=0,instanceBufferBytes=0,residentPixelBytes=0,animationResidentPixelBytes=0,totalUploadMs=0,latestGpuRenderMs=null;
  const timerExtension=options.gpuTiming===false?null:gl.getExtension('EXT_disjoint_timer_query_webgl2');const pendingQueries=[];

  function uploadLinear(target,capacityLayers,startTexel,bytes){
    requireValue(bytes.byteLength%4===0,'runtime pixel RGBA alignment invalid');
    let cursor=startTexel,byteOffset=0,remaining=bytes.byteLength/4;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY,target);
    while(remaining>0){
      const layer=Math.floor(cursor/PAGE_TEXELS),inside=cursor-layer*PAGE_TEXELS,x=inside%PAGE_SIZE,y=Math.floor(inside/PAGE_SIZE);
      requireValue(layer<capacityLayers,'runtime pixel texture capacity exceeded');
      if(x===0){const rows=Math.min(Math.floor(remaining/PAGE_SIZE),PAGE_SIZE-y);if(rows>0){const texels=rows*PAGE_SIZE,part=bytes.subarray(byteOffset,byteOffset+texels*4);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,y,layer,PAGE_SIZE,rows,1,gl.RGBA,gl.UNSIGNED_BYTE,part);cursor+=texels;byteOffset+=texels*4;remaining-=texels;continue;}}
      const run=Math.min(remaining,PAGE_SIZE-x),part=bytes.subarray(byteOffset,byteOffset+run*4);gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,x,y,layer,run,1,1,gl.RGBA,gl.UNSIGNED_BYTE,part);cursor+=run;byteOffset+=run*4;remaining-=run;
    }
  }
  function uploadBucket(bucketId,bytes){
    if(uploadedBuckets.has(bucketId))return uploadedBuckets.get(bucketId);
    const descriptor=runtimePixelCatalog.buckets.get(bucketId);requireValue(descriptor&&bytes.byteLength===descriptor.bytes,`runtime pixel bucket ${bucketId} upload mismatch`);
    const baseTexel=nextTexel,started=performance.now();requireValue(baseTexel+bytes.byteLength/4<=staticRegionTexels,'runtime static pixel region exceeded');uploadLinear(texture,baseLayers,baseTexel,bytes);
    for(const blob of runtimePixelCatalog.blobsByBucket.get(bucketId)||[]){requireValue(blob.offset%4===0,'runtime pixel blob offset not RGBA aligned');gpuPlacements.set(blob.contentId,Object.freeze({baseTexel:baseTexel+blob.offset/4,width:blob.width,height:blob.height,textureSlot:0}));}
    nextTexel+=bytes.byteLength/4;const state=Object.freeze({baseTexel,bytes:bytes.byteLength,uploadMs:performance.now()-started});uploadedBuckets.set(bucketId,state);residentPixelBytes+=bytes.byteLength;totalUploadMs+=state.uploadMs;return state;
  }
  function uploadBundle(bytes){
    const descriptor=runtimePixelCatalog.manifest.localMaxBundle;requireValue(descriptor&&bytes.byteLength===descriptor.bytes,'runtime local-max pixel bundle upload mismatch');requireValue(uploadedBuckets.size===0&&nextTexel===0,'runtime local-max pixel bundle must initialize an empty GPU atlas');requireValue(bytes.byteLength/4<=staticRegionTexels,'runtime local-max bundle exceeds static pixel region');
    const started=performance.now();uploadLinear(texture,baseLayers,0,bytes);
    for(const span of descriptor.bucketOffsets){const bucketId=span.bucket,baseTexel=span.offset/4;for(const blob of runtimePixelCatalog.blobsByBucket.get(bucketId)||[])gpuPlacements.set(blob.contentId,Object.freeze({baseTexel:baseTexel+blob.offset/4,width:blob.width,height:blob.height,textureSlot:0}));uploadedBuckets.set(bucketId,Object.freeze({baseTexel,bytes:span.bytes,uploadMs:0}));}
    nextTexel=bytes.byteLength/4;residentPixelBytes=bytes.byteLength;const uploadMs=performance.now()-started;totalUploadMs+=uploadMs;return Object.freeze({bytes:bytes.byteLength,uploadMs,buckets:uploadedBuckets.size});
  }
  function staticContentId(primitive){const sourceBlob=pixelCatalog.sprites.get(primitive.spriteSourceId);requireValue(sourceBlob,`missing published pixel mapping for sprite ${primitive.spriteSourceId}`);return sourceBlob.contentId;}
  function placementFor(primitive,contentId=null){const id=contentId??primitive.pixelContentId??staticContentId(primitive);const placement=gpuPlacements.get(id);requireValue(placement,`runtime pixel placement not resident for ${id}`);return placement;}
  function setRecords(nextRecords){records=[...nextRecords];instanceData=new Float32Array(records.length*FLOATS_PER_INSTANCE);let cursor=0;for(const record of records){const p=record.primitive,placement=placementFor(p);instanceData[cursor++]=record.x*32-(p.widthUnits-32)+p.displacement.dxUnits;instanceData[cursor++]=record.y*32-(p.heightUnits-32)+p.displacement.dyUnits;instanceData[cursor++]=p.widthUnits;instanceData[cursor++]=p.heightUnits;instanceData[cursor++]=placement.baseTexel;instanceData[cursor++]=placement.width;instanceData[cursor++]=placement.height;instanceData[cursor++]=placement.textureSlot??0;}gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,instanceData,gl.DYNAMIC_DRAW);instanceCount=records.length;instanceBufferBytes=instanceData.byteLength;}
  function ensureAnimationTexture(){
    requireValue(animationLayers>=1,'animation GPU budget unavailable');if(animationTexture)return animationTexture;
    animationTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D_ARRAY,animationTexture);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,1,gl.RGBA8,PAGE_SIZE,PAGE_SIZE,animationLayers);gl.activeTexture(gl.TEXTURE0);return animationTexture;
  }
  function uploadRuntimePixel(contentId,width,height,bytes){const existing=gpuPlacements.get(contentId);if(existing)return existing;requireValue(/^sha256:[0-9a-f]{64}$/.test(contentId),'animation pixel content id invalid');requireValue(Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&bytes.byteLength===width*height*4,'animation pixel geometry invalid');const texels=bytes.byteLength/4;requireValue(nextAnimationTexel+texels<=animationLayers*PAGE_TEXELS,'bounded animation GPU region exhausted');const target=ensureAnimationTexture(),started=performance.now(),baseTexel=nextAnimationTexel;uploadLinear(target,animationLayers,baseTexel,bytes);const placement=Object.freeze({baseTexel,width,height,textureSlot:1});gpuPlacements.set(contentId,placement);animationPlacementIds.add(contentId);nextAnimationTexel+=texels;residentPixelBytes+=bytes.byteLength;animationResidentPixelBytes+=bytes.byteLength;totalUploadMs+=performance.now()-started;return placement;}
  function resetAnimationPixels(){for(const id of animationPlacementIds)gpuPlacements.delete(id);animationPlacementIds.clear();residentPixelBytes-=animationResidentPixelBytes;animationResidentPixelBytes=0;nextAnimationTexel=0;if(animationTexture){gl.deleteTexture(animationTexture);animationTexture=null;}gl.activeTexture(gl.TEXTURE0);}
  function updateRecordPixels(updates){if(!updates?.length)return 0;gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);let changed=0;for(const update of updates){const index=Number(update.index);requireValue(Number.isSafeInteger(index)&&index>=0&&index<records.length,'animation record index invalid');const primitive=records[index].primitive,placement=placementFor(primitive,update.contentId??staticContentId(primitive)),offset=index*FLOATS_PER_INSTANCE+4,slot=placement.textureSlot??0;if(instanceData[offset]===placement.baseTexel&&instanceData[offset+1]===placement.width&&instanceData[offset+2]===placement.height&&instanceData[offset+3]===slot)continue;instanceData[offset]=placement.baseTexel;instanceData[offset+1]=placement.width;instanceData[offset+2]=placement.height;instanceData[offset+3]=slot;gl.bufferSubData(gl.ARRAY_BUFFER,offset*4,instanceData.subarray(offset,offset+4));changed+=1;}return changed;}

  function pollGpuTimers(){if(!timerExtension)return;while(pendingQueries.length){const q=pendingQueries[0],available=gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE),disjoint=gl.getParameter(timerExtension.GPU_DISJOINT_EXT);if(!available)break;pendingQueries.shift();if(!disjoint)latestGpuRenderMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}}
  function render(view){const started=performance.now(),dpr=resizeCanvas(canvas);pollGpuTimers();gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,texture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D_ARRAY,animationTexture??texture);gl.activeTexture(gl.TEXTURE0);gl.uniform2f(centerLocation,view.x*32,view.y*32);gl.uniform2f(viewportLocation,canvas.width,canvas.height);gl.uniform1f(scaleLocation,view.zoom*dpr);let query=null;if(timerExtension){query=gl.createQuery();gl.beginQuery(timerExtension.TIME_ELAPSED_EXT,query);}const drawCalls=instanceCount>0?1:0;if(drawCalls)gl.drawArraysInstanced(gl.TRIANGLES,0,6,instanceCount);if(query){gl.endQuery(timerExtension.TIME_ELAPSED_EXT);pendingQueries.push(query);}if(options.synchronousEvidence===true)gl.finish();const animationTextureAllocatedBytes=animationTexture?animationLayers*PAGE_BYTES:0,gpuTextureBytes=baseTextureBytes+animationTextureAllocatedBytes;return Object.freeze({backend:'WebGL2-instanced-buckets',drawCalls,gpuRenderMs:latestGpuRenderMs,gpuTimerSupported:Boolean(timerExtension),gpuTextureBytes,baseTextureBytes,animationTextureAllocatedBytes,instanceBufferBytes,maxArrayLayers,maxTextureSize,preserveDrawingBuffer:options.capture===true,renderMs:performance.now()-started,residentPixelBytes,animationResidentPixelBytes,uploadedAnimationPixels:animationPlacementIds.size,submittedPrimitives:instanceCount,textureUploadMs:totalUploadMs,uploadedBuckets:uploadedBuckets.size,visiblePrimitives:options.measureVisibility===false?null:countVisible(records,view,canvas,dpr),viewportHeight:canvas.height,viewportWidth:canvas.width});}
  function uploadedBucketIds(){return [...uploadedBuckets.keys()].sort();}
  return Object.freeze({gl,render,resetAnimationPixels,setRecords,updateRecordPixels,uploadBucket,uploadBundle,uploadRuntimePixel,uploadedBucketIds});
}

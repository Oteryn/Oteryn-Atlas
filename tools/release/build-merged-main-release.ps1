[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AtlasRevision,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [string]$GameRevision = '0161b80c351b644b47c28b290a6f54b44f775de7',
  [string]$LegacyRevision = 'e417c5e7c22986bf4acef0495eb47f7b72c97cce'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if ($AtlasRevision -notmatch '^[a-f0-9]{40}$') { throw 'AtlasRevision must be an exact SHA.' }
if ((git -C $repo rev-parse HEAD).Trim() -ne $AtlasRevision) { throw 'Release builder checkout does not match AtlasRevision.' }
if (@(git -C $repo status --porcelain).Count -ne 0) { throw 'Release builder refuses a dirty checkout.' }

$pythonImage = 'docker.io/library/python@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a'
$assetUrl = 'https://drive.usercontent.google.com/download?id=1Dlo3bS4K1nS3mw4BhPZdlHT7lX5zRAvv&export=download&confirm=t'
$assetSha = '1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f'
$root = Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) "work-$AtlasRevision"
$payload = Join-Path $root 'payload'
$artifact = Join-Path $root "atlas-release-$AtlasRevision.tar"
$manifest = Join-Path $root 'release-manifest.json'
$productRootsFile = Join-Path $root 'product-roots.json'
$container = "atlas-release-build-$PID-$($AtlasRevision.Substring(0,7))"

function Invoke-Git([string[]]$Arguments) {
  & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw "git failed: $($Arguments -join ' ')" }
}
function Assert-TreeEqual([string]$Left,[string]$Right) {
  $leftRoot=(Resolve-Path $Left).Path; $rightRoot=(Resolve-Path $Right).Path
  $left=@(Get-ChildItem $leftRoot -Recurse -File | ForEach-Object { [pscustomobject]@{ Path=$_.FullName.Substring($leftRoot.Length).TrimStart('\').Replace('\','/'); Hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash } } | Sort-Object Path)
  $right=@(Get-ChildItem $rightRoot -Recurse -File | ForEach-Object { [pscustomobject]@{ Path=$_.FullName.Substring($rightRoot.Length).TrimStart('\').Replace('\','/'); Hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash } } | Sort-Object Path)
  if (($left | ConvertTo-Json -Compress) -ne ($right | ConvertTo-Json -Compress)) { throw "Reproducibility mismatch: $Left vs $Right" }
}

Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $root,$payload | Out-Null
try {
  $atlasSource=Join-Path $root 'atlas-source'; $gameSource=Join-Path $root 'game-source'; $legacySource=Join-Path $root 'legacy-source'
  Invoke-Git @('clone','--no-checkout','https://github.com/Oteryn/Oteryn-Atlas.git',$atlasSource)
  Invoke-Git @('-C',$atlasSource,'fetch','--depth=1','origin',$AtlasRevision)
  Invoke-Git @('-C',$atlasSource,'checkout','--detach','FETCH_HEAD')
  if ((git -C $atlasSource rev-parse HEAD).Trim() -ne $AtlasRevision) { throw 'Atlas source revision mismatch.' }
  Invoke-Git @('clone','--no-checkout','https://github.com/Oteryn/Oteryn-Game.git',$gameSource)
  Invoke-Git @('-C',$gameSource,'fetch','--depth=1','origin',$GameRevision)
  Invoke-Git @('-C',$gameSource,'checkout','--detach','FETCH_HEAD')
  if ((git -C $gameSource rev-parse HEAD).Trim() -ne $GameRevision) { throw 'Game source revision mismatch.' }
  Invoke-Git @('init',$legacySource)
  Invoke-Git @('-C',$legacySource,'remote','add','origin','https://github.com/blakinio/Otheryn.git')
  Invoke-Git @('-C',$legacySource,'sparse-checkout','init','--cone')
  Invoke-Git @('-C',$legacySource,'fetch','--depth=1','--filter=blob:none','origin',$LegacyRevision)
  Invoke-Git @('-C',$legacySource,'checkout','--detach','FETCH_HEAD')
  Invoke-Git @('-C',$legacySource,'sparse-checkout','set','vendor/map-analysis/crystalserver/data-global/world','vendor/map-analysis/crystalserver/data-global/npc','vendor/map-analysis/crystalserver/data-global/monster')
  if ((git -C $legacySource rev-parse HEAD).Trim() -ne $LegacyRevision) { throw 'Legacy source revision mismatch.' }
  Remove-Item (Join-Path $atlasSource '.git'),(Join-Path $gameSource '.git'),(Join-Path $legacySource '.git') -Recurse -Force
  if (Get-ChildItem $atlasSource -Recurse -File | Where-Object { $_.Extension -in @('.otbm','.otb','.spr','.dat') } | Select-Object -First 1) { throw 'Forbidden raw runtime input in Atlas checkout.' }

  $asset=Join-Path $root 'asset-15.32.zip'
  Invoke-WebRequest -UseBasicParsing -Uri $assetUrl -OutFile $asset
  if ((Get-FileHash $asset -Algorithm SHA256).Hash.ToLowerInvariant() -ne $assetSha) { throw 'Asset archive digest mismatch.' }

  docker rm -f $container 2>$null | Out-Null
  docker create --name $container --network none --entrypoint python3 $pythonImage -c 'import time; time.sleep(2700)' | Out-Null
  foreach($pair in @(@($atlasSource,'/atlas-source'),@($gameSource,'/game-source'),@($legacySource,'/legacy-source'),@($asset,'/asset-15.32.zip'))){ docker cp $pair[0] "$container`:$($pair[1])"; if($LASTEXITCODE -ne 0){throw 'docker cp build input failed'} }
  docker start $container | Out-Null
  foreach($suffix in @('a','b')){
    $commands=@(
      @('/game-source/tools/game-atlas-appearances/export.py','/asset-15.32.zip',"/appearance-$suffix"),
      @('/game-source/tools/game-atlas-appearances/verify.py',"/appearance-$suffix"),
      @('/game-source/tools/game-atlas-outfit-spatial/export.py','/asset-15.32.zip',"/spatial-$suffix"),
      @('/game-source/tools/game-atlas-creatures/animated.py','/legacy-source/vendor/map-analysis/crystalserver/data-global/world','/legacy-source/vendor/map-analysis/crystalserver/data-global/npc','/legacy-source/vendor/map-analysis/crystalserver/data-global/monster',"/appearance-$suffix", "/spatial-$suffix", "/animated-creatures-$suffix.json"),
      @('/atlas-source/tools/build-creature-index.py',"/animated-creatures-$suffix.json", "/creature-index-$suffix"),
      @('/atlas-source/tools/animation-runtime/build.py','/asset-15.32.zip',"/appearance-$suffix", "/animated-creatures-$suffix.json", "/animation-runtime-$suffix")
    )
    foreach($args in $commands){ docker exec $container python3 @args; if($LASTEXITCODE -ne 0){throw "release product command failed: $($args[0])"} }
  }
  foreach($name in @('appearance-a','appearance-b','spatial-a','spatial-b','creature-index-a','creature-index-b','animation-runtime-a','animation-runtime-b')){ $dest=Join-Path $root $name; New-Item -ItemType Directory -Force $dest|Out-Null; docker cp "$container`:\$name/." "$dest/"; if($LASTEXITCODE -ne 0){throw "copy output failed: $name"} }
  foreach($name in @('animated-creatures-a.json','animated-creatures-b.json')){ docker cp "$container`:/\$name" (Join-Path $root $name); if($LASTEXITCODE -ne 0){throw "copy output failed: $name"} }
  Assert-TreeEqual (Join-Path $root 'appearance-a') (Join-Path $root 'appearance-b')
  Assert-TreeEqual (Join-Path $root 'spatial-a') (Join-Path $root 'spatial-b')
  Assert-TreeEqual (Join-Path $root 'creature-index-a') (Join-Path $root 'creature-index-b')
  Assert-TreeEqual (Join-Path $root 'animation-runtime-a') (Join-Path $root 'animation-runtime-b')
  if ((Get-FileHash (Join-Path $root 'animated-creatures-a.json') -Algorithm SHA256).Hash -ne (Get-FileHash (Join-Path $root 'animated-creatures-b.json') -Algorithm SHA256).Hash) { throw 'Animated creature reproducibility mismatch.' }

  $oracle=@'
import json
from pathlib import Path
creatures=json.loads(Path('/animated-creatures-a.json').read_text())
index=json.loads(Path('/creature-index-a/index.json').read_text())
animation=json.loads(Path('/animation-runtime-a/manifest.json').read_text())
programs=json.loads(Path('/animation-runtime-a/programs.json').read_text())
assert creatures['capability']=='animated-creatures-v1'
assert creatures['npc_role_schema_version']==1
assert creatures['semantic_digest']=='sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8'
assert index['source']['capability']=='animated-creatures-v1'
assert index['counts']=={'records':88633,'chunks':5746,'search_records':1945}
assert animation['rootContentId']=='sha256:413de22b245288da68153e2c0e9d4efe4ee011421b56a09532c8119829079540'
assert animation['counts']['object_programs']==5190 and animation['counts']['creature_programs']==1377 and animation['counts']['buckets']==43
search=json.loads(Path('/creature-index-a/search.json').read_text())['records']; by_id={r['record_id']:r for r in search}
role_counts={role:sum(role in r.get('roles',[]) for r in creatures['npcs']) for role in ('bank','travel','shop','quest','blessing','trainer')}
assert role_counts=={'bank':25,'travel':51,'shop':313,'quest':432,'blessing':26,'trainer':54}
assert sum(bool(r.get('roles')) for r in creatures['npcs'])==705
assert sum(r.get('role_resolution_state')=='AMBIGUOUS' for r in creatures['npcs'])==10
dynamic={p['outfit_presentation_id'] for p in programs['creature_programs'] if p['phase_count']>1 and len(set(p['phase_content_ids']))>1}; assert len(dynamic)==100
def pid(r): return (r.get('outfit_presentation') or {}).get('outfit_presentation_id')
npc=next(r for r in creatures['npcs'] if 'shop' in r.get('roles',[]) and r.get('presentation_resolution_state')=='RESOLVED' and pid(r) in dynamic)
monster=next(r for r in creatures['monster_spawns'] if r.get('presentation_resolution_state')=='RESOLVED' and pid(r) in dynamic)
ni=by_id[npc['record_id']]; mi=by_id[monster['record_id']]
targets={'npc':{'kind':'npc','label':ni['label'],'record_id':ni['record_id'],'position':ni['position'],'roles':ni['roles']},'monster':{'kind':'monster','label':mi['label'],'record_id':mi['record_id'],'position':mi['position']}}
Path('/e2e-targets.json').write_text(json.dumps(targets,indent=2,sort_keys=True)+'\n')
Path('/first-chunk.txt').write_text(index['chunks'][0]['path']+'\n'); Path('/first-bucket.txt').write_text(animation['buckets'][0]['path']+'\n')
'@
  $oraclePath=Join-Path $root 'oracle.py'; [IO.File]::WriteAllText($oraclePath,$oracle,(New-Object Text.UTF8Encoding($false))); docker cp $oraclePath "$container`:/oracle.py"; docker exec $container python3 /oracle.py; if($LASTEXITCODE -ne 0){throw 'release semantic oracle failed'}
  foreach($name in @('e2e-targets.json','first-chunk.txt','first-bucket.txt')){ docker cp "$container`:/\$name" (Join-Path $root $name); if($LASTEXITCODE -ne 0){throw "copy evidence failed: $name"} }

  $repoOut=Join-Path $payload 'repo'; Copy-Item $atlasSource $repoOut -Recurse
  New-Item -ItemType Directory -Force (Join-Path $repoOut 'data'),(Join-Path $repoOut 'fullworld'),(Join-Path $payload 'evidence') | Out-Null
  Copy-Item (Join-Path $root 'creature-index-a') (Join-Path $repoOut 'data\creatures') -Recurse
  Copy-Item (Join-Path $root 'animation-runtime-a') (Join-Path $repoOut 'fullworld\animation') -Recurse
  Copy-Item (Join-Path $root 'creature-index-a') (Join-Path $payload 'evidence\creature-index') -Recurse
  Copy-Item (Join-Path $root 'animation-runtime-a') (Join-Path $payload 'evidence\animation-runtime') -Recurse
  foreach($name in @('e2e-targets.json','first-chunk.txt','first-bucket.txt')){ Copy-Item (Join-Path $root $name) (Join-Path $payload 'evidence' $name) }
  [ordered]@{ creatureSemantic='sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8'; animation='sha256:413de22b245288da68153e2c0e9d4efe4ee011421b56a09532c8119829079540' } | ConvertTo-Json | Set-Content -Encoding utf8 $productRootsFile

  $packContainer="$container-pack"; docker rm -f $packContainer 2>$null|Out-Null
  docker create --name $packContainer --network none --entrypoint sh $pythonImage -c 'sleep 600' | Out-Null
  docker cp "$payload/." "$packContainer`:/payload/"; docker start $packContainer|Out-Null
  docker exec $packContainer sh -c "cd /payload && tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -cf /release.tar ."; if($LASTEXITCODE -ne 0){throw 'deterministic release tar failed'}
  docker cp "$packContainer`:/release.tar" $artifact; docker rm -f $packContainer|Out-Null
  node (Join-Path $repo 'tools\verification\release-artifact-manifest.mjs') --atlas-revision $AtlasRevision --artifact $artifact --source-tree $repoOut --product-roots $productRootsFile --output $manifest
  if($LASTEXITCODE -ne 0){throw 'release manifest generation failed'}
  $m=Get-Content $manifest -Raw|ConvertFrom-Json
  if($m.atlasRevision -ne $AtlasRevision){throw 'release manifest revision mismatch'}
  [pscustomobject]@{ Artifact=$artifact; Manifest=$manifest; ArtifactSha256=$m.artifactSha256; SourceTreeSha256=$m.sourceTreeSha256 }
} finally {
  docker rm -f $container "$container-pack" 2>$null | Out-Null
}

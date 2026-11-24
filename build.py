# 혼자 하기 게임(index.html)에 공용 엔진(engine.js)과 온라인 부분(client/online.js)을 붙여 public/index.html을 만든다
import pathlib
here=pathlib.Path(__file__).parent
game=(here/'..'/'공부하는탱크'/'index.html').read_text(encoding='utf-8')
import re as _re
_fn=(here/'maps_extra.js').read_text(encoding='utf-8')
_blk='/*EXTRA_MAPS_BEGIN — maps_extra.js에서 복사됨 (build.py가 맞춰 줌)*/\n'+_fn+'/*EXTRA_MAPS_END*/'
for _p in [here/'engine.js', here.parent/'공부하는탱크'/'index.html']:
    _t=_p.read_text(encoding='utf-8'); _n=_re.sub(r'/\*EXTRA_MAPS_BEGIN.*?/\*EXTRA_MAPS_END\*/', lambda m:_blk, _t, flags=_re.S)
    if _n!=_t: _p.write_text(_n,encoding='utf-8')
game=(here/'..'/'공부하는탱크'/'index.html').read_text(encoding='utf-8')
online=(here/'client'/'online.js').read_text(encoding='utf-8')
engine=(here/'engine.js').read_text(encoding='utf-8')
assert '</body>' in game
out=game.replace('</body>','<script>\n'+engine+'\n</script>\n<script>\n'+online+'\n</script>\n</body>',1)
(here/'public'/'index.html').write_text(out,encoding='utf-8')
print('public/index.html', len(out))

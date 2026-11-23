# 혼자 하기 게임(index.html)에 온라인 부분(client/online.js)을 붙여 public/index.html을 만든다
import pathlib
here=pathlib.Path(__file__).parent
game=(here/'..'/'공부하는탱크'/'index.html').read_text(encoding='utf-8')
online=(here/'client'/'online.js').read_text(encoding='utf-8')
assert '</body>' in game
out=game.replace('</body>','<script>\n'+online+'\n</script>\n</body>',1)
(here/'public'/'index.html').write_text(out,encoding='utf-8')
print('public/index.html', len(out))

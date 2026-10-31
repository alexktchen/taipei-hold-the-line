#!/usr/bin/env python3
"""從教育部資料產生學習森林用的資料檔（只抽出用得到的字，檔案小）。

用法：
  python3 -I build-data.py <dict-revised.json 路徑>

  dict-revised.json：教育部《重編國語辭典修訂本》，g0v/moedict-data 轉成的 JSON
    （https://raw.githubusercontent.com/g0v/moedict-data/master/dict-revised.json.xz，解壓縮後使用）
    授權：創用 CC 姓名標示－禁止改作 3.0 臺灣；依教育部解釋，格式轉換與再利用不受禁止改作限制。
  筆順：教育部《常用國字標準字體筆順學習網》，經 g0v/zh-stroke-data 整理的 JSON，執行時直接下載。

產生：
  （要用哪些字：content.js 的字庫，加上 data/graph.json 裡 lesson.chars 用到的字）
  ../data/moe.json        每個字的讀音（含多音）、部首、總筆畫、部首外筆畫；詞語讀音；注音符號的示範字
  ../data/strokes/XXXX.json  每個字（與注音符號）的筆畫輪廓與運筆軌跡（座標 0～2150）
"""
import json, os, re, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data')
STROKE_URL = 'https://raw.githubusercontent.com/g0v/zh-stroke-data/master/json/{:04x}.json'


def need():
    js = ("import fs from 'fs'; const m = await import('" + os.path.join(HERE, '..', 'content.js') + "'); const g = JSON.parse(fs.readFileSync('" + os.path.join(HERE, '..', 'data', 'graph.json') + "', 'utf8'));"
          " console.log(JSON.stringify({ NEED: m.needFor(g), S: m.SHENGMU, Y: m.YUNMU }))")
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], text=True))


def clean(b):
    b = re.sub(r'（[^）]*）', '', b)  # 去掉（讀音）（語音）（又音）這類標記
    b = b.split('　')[0]  # 全形空白後面是另一種讀法，只取第一種
    return ' '.join(b.split())


def main(path):
    info = need(); N = info['NEED']
    d = json.load(open(path, encoding='utf-8'))
    idx = {}
    for e in d:
        idx.setdefault(e['title'], e)
    out = {'c': {}, 'w': {}, 'sym': {}}
    for c in N['chars']:
        e = idx.get(c)
        if not e:
            print('缺字', c); continue
        rs = []
        for h in e.get('heteronyms', []):
            b = clean(h.get('bopomofo', ''))
            if b and ' ' not in b and b not in rs:
                rs.append(b)
        out['c'][c] = [rs, (e.get('radical') or '').strip(), e.get('stroke_count', 0), e.get('non_radical_stroke_count', 0)]
    for w in N['words']:
        e = idx.get(w)
        if not e:
            print('缺詞', w); continue
        out['w'][w] = clean(e['heteronyms'][0]['bopomofo'])
    # 注音符號的示範字：檢查給定的字；沒給的，找一個讀音剛好是這個符號（任何聲調）的字，筆畫越少越好
    single = {}
    for e in d:
        t = e['title']
        if len(t) != 1: continue
        for h in e.get('heteronyms', []):
            b = clean(h.get('bopomofo', ''))
            base = re.sub('[ˊˇˋ˙]', '', b)
            single.setdefault(base, []).append((e.get('stroke_count', 99), t, b))
    for s, c, w, _ in info['S']:
        r = out['c'][c][0]
        assert any(x.startswith(s) for x in r), ('聲母例字讀音不對', s, c, r)
        assert out['w'][w].startswith(s), ('聲母例詞開頭不對', s, w, out['w'][w])
        out['sym'][s] = c
    for s, c, w, _ in info['Y']:
        if c is None:
            cand = sorted(single.get(s, []))
            assert cand, ('找不到韻母例字', s)
            c = cand[0][1]
            if c not in out['c']:
                e = idx[c]; out['c'][c] = [[clean(h['bopomofo']) for h in e['heteronyms']], (e.get('radical') or '').strip(), e.get('stroke_count', 0), e.get('non_radical_stroke_count', 0)]
            print('韻母', s, '例字', c, cand[0][2])
        r = out['c'][c][0]
        assert any(re.sub('[ˊˇˋ˙]', '', x) == s for x in r), ('韻母例字讀音不對', s, c, r)
        assert s in out['w'][w], ('韻母例詞不含', s, w, out['w'][w])
        out['sym'][s] = c
    os.makedirs(os.path.join(OUT, 'strokes'), exist_ok=True)
    json.dump(out, open(os.path.join(OUT, 'moe.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('moe.json', len(out['c']), '字', len(out['w']), '詞')
    # 筆順
    todo = list(dict.fromkeys(N['strokes'] + ''.join(N['symbols'])))
    got = 0
    for c in todo:
        fn = os.path.join(OUT, 'strokes', '{:04x}.json'.format(ord(c)))
        if os.path.exists(fn):
            got += 1; continue
        try:
            raw = json.loads(urllib.request.urlopen(STROKE_URL.format(ord(c)), timeout=30).read())
        except Exception as ex:
            print('沒有筆順', c, ex); continue
        strokes = []
        for s in raw:
            dpath = []
            for o in s['outline']:
                if o['type'] in ('M', 'L'):
                    dpath.append('{}{} {}'.format(o['type'], round(o['x']), round(o['y'])))
                elif o['type'] == 'Q':
                    dpath.append('Q{} {} {} {}'.format(round(o['begin']['x']), round(o['begin']['y']), round(o['end']['x']), round(o['end']['y'])))
                elif o['type'] == 'C':
                    dpath.append('C{} {} {} {} {} {}'.format(round(o['begin']['x']), round(o['begin']['y']), round(o['mid']['x']), round(o['mid']['y']), round(o['end']['x']), round(o['end']['y'])))
            track = [[round(p['x']), round(p['y']), round(p.get('size', 0))] for p in s['track']]
            strokes.append([''.join(dpath) + 'Z', track])
        json.dump(strokes, open(fn, 'w'), separators=(',', ':'))
        got += 1
    print('筆順', got, '/', len(todo))


if __name__ == '__main__':
    main(sys.argv[1])

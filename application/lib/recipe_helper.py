#!/usr/bin/env python3
# -*- coding:utf-8 -*-
import os, re, textwrap, time, zipfile
import xml.etree.ElementTree as ET

def py3_repr(x):
    ans = repr(x)
    if isinstance(x, bytes) and not ans.startswith('b'):
        ans = 'b' + ans
    if isinstance(x, str) and ans.startswith('u'):
        ans = ans[1:]
    return ans

#根据输入的一些信息，自动创建一个recipe的源码
def GenerateRecipeSource(title, feeds, user, isfulltext=False, language=None, max_articles=30, 
    cover_url=None, base='AutomaticNewsRecipe'):
    className = f'UserRecipe{int(time.time())}'
    title = py3_repr(str(title).strip() or className)
    indent = ' ' * 8
    feedTitles = []
    feedsStr = []
    if feeds and isinstance(feeds[0], (tuple, list)):
        for t, url in feeds:
            feedsStr.append(f'{indent}({py3_repr(t)}, {py3_repr(url)}),')
            feedTitles.append(t)
    else:
        feedsStr = [f'{indent}{py3_repr(url)},' for url in feeds]
    
    feeds = 'feeds          = [\n{}\n    ]'.format('\n'.join(feedsStr)) if feedsStr else ''
    desc = 'News from {}'.format(', '.join(feedTitles)) if feedTitles else 'Deliver from KindleEar'
    desc = desc[:100]
    oldest_article = user.oldest_article
    isfulltext = 'True' if isfulltext else 'None'
    language = language or user.book_language
    timefmt = user.time_fmt
    cover_url = f"'{cover_url}'" if isinstance(cover_url, str) else cover_url
    src = textwrap.dedent(f'''\
    #!/usr/bin/env python3
    # -*- coding:utf-8 -*-
    from calibre.web.feeds.news import {base}
    class {className}({base}):
        title          = {title}
        description    = '{desc}'
        language       = '{language}'
        max_articles_per_feed = {max_articles}
        oldest_article = {oldest_article}
        use_embedded_content  = {isfulltext}
        timefmt               = '{timefmt}'
        cover_url             = {cover_url}
        {feeds}''')
    #with open('d:/reci.py', 'w', encoding='utf-8') as f:
    #    f.write(src)
    return src

#能使用点号访问的字典
class DotDict(dict):
    #__setattr__ = dict.__setitem__
    #__getattr__ = dict.__getitem__
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    def __getattr__(self, key):
        try:
            return self[key]
        except:
            return None
        #if isinstance(value, dict):
        #    value = DotDict(value)
        #return value

#根据ID查询内置Recipe基本信息，返回一个字典
#{title:, author:, language:, needs_subscription:, description:, id:}
def GetBuiltinRecipeInfo(id_: str):
    if not id_:
        return None

    try:
        tree = ET.parse(os.path.join(appDir, 'application', 'recipes', 'builtin_recipes.xml'))
        root = tree.getroot()
    except Exception as e:
        default_log.warning('Cannot open builtin_recipes.xml: {}'.format(e))
        return None

    id_ = id_ if id_.startswith('builtin:') else f'builtin:{id_}'
    for child in root:
        attrs = child.attrib
        if attrs.get('id', '') == id_:
            return DotDict(attrs) #方便上层使用点号访问
    return None

#返回特定ID的内置Recipe源码字符串
def GetBuiltinRecipeSource(id_: str):
    if not id_:
        return None

    id_ = id_[8:] if id_.startswith('builtin:') else id_
    filename = f'{id_}.recipe'
    recipesZip = os.path.join(appDir, 'application', 'recipes', 'builtin_recipes.zip')
    try:
        with zipfile.ZipFile(recipesZip, 'r') as zf:
            return zf.read(filename).decode('utf-8')
    except Exception as e:
        default_log.warning('Read {} failed: {}'.format(filename, str(e)))
        return None
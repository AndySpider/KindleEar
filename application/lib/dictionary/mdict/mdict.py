#!/usr/bin/env python3
# -*- coding:utf-8 -*-
#mdx离线词典接口
#!/usr/bin/env python3
# -*- coding:utf-8 -*-
#stardict离线词典支持
import os, re, zlib, json
from bs4 import BeautifulSoup
from .readmdict import MDX
try:
    import marisa_trie
except:
    marisa_trie = None

#获取本地的mdx文件列表，只有列表，没有校验是否有效
def getMDictFileList():
    dictDir = os.environ.get('DICTIONARY_DIR')
    if not dictDir or not os.path.exists(dictDir):
        return {}

    ret = {}
    for dirPath, _, fileNames in os.walk(dictDir):
        for fileName in fileNames:
            if fileName.endswith('.mdx'):
                dictName = os.path.splitext(fileName)[0]
                #为了界面显示和其他dict的一致，键为词典路径，值为词典名字（和惯例相反~）
                ret[os.path.join(dirPath, fileName)] = dictName
    return ret

class MDict:
    name = "mdict"
    #词典列表，键为词典缩写，值为词典描述
    databases = getMDictFileList()

    #更新词典列表
    @classmethod
    def refresh(cls):
        cls.databases = getMDictFileList()

    def __init__(self, database='', host=None):
        self.database = database
        self.dictionary = None
        if database in self.databases:
            try:
                self.dictionary = IndexedMdx(database)
            except Exception as e:
                default_log.warning(f'Instantiate mdict failed: {self.databases[database]}: {e}')
        else:
            default_log.warning(f'dict not found: {self.databases[database]}')

    #返回当前使用的词典名字
    def __repr__(self):
        return 'mdict [{}]'.format(self.databases.get(self.database, ''))
        
    def definition(self, word, language=''):
        return self.dictionary.get(word) if self.dictionary else ''

#经过词典树缓存的Mdx
class IndexedMdx:
    TRIE_FMT = '>LLLLLL'

    #fname: mdx文件全路径名
    def __init__(self, fname, encoding="", substyle=False, passcode=None):
        self.mdxFilename = fname
        prefix = os.path.splitext(fname)[0]
        dictName = os.path.basename(prefix)
        trieName = f'{prefix}.trie'
        self.trie = None
        self.mdx = MDX(fname, encoding, substyle, passcode)
        if os.path.exists(trieName):
            try:
                self.trie = marisa_trie.RecordTrie(self.TRIE_FMT) #type:ignore
                self.trie.load(trieName)
            except Exception as e:
                self.trie = None
                default_log.warning(f'Failed to load mdict trie data: {dictName}: {e}')

        if self.trie:
            return

        #重建索引
        default_log.info(f"Building trie for {dictName}")
        #为了能制作大词典，mdx中这些数据都是64bit的，但是为了节省空间，这里只使用32bit保存(>LLLLLL)
        self.trie = marisa_trie.RecordTrie(self.TRIE_FMT, self.mdx.get_index()) #type:ignore
        self.trie.save(trieName)
        
        del self.trie
        self.trie = marisa_trie.RecordTrie(self.TRIE_FMT) #type:ignore
        self.trie.load(trieName)
        import gc
        gc.collect()

    #获取单词释义，不存在则返回空串
    def get(self, word):
        if not self.trie:
            return ''
        word = word.lower().strip()
        indexes = self.trie[word] if word in self.trie else None
        ret = self.get_content_by_Index(indexes)
        if ret.startswith('@@@LINK='):
            word = ret[8:].strip()
            if word:
                indexes = self.trie[word] if word in self.trie else None
                ret = self.get_content_by_Index(indexes)
        return ret
        
    def __contains__(self, word) -> bool:
        return word.lower() in self.trie

    #通过单词的索引数据，直接读取文件对应的数据块返回释义
    #indexes是列表，因为可能有多个单词条目
    def get_content_by_Index(self, indexes):
        return self.post_process(self.mdx.get_content_by_Index(indexes))
        
    #对查词结果进行后处理
    def post_process(self, content):
        if not content:
            return ''

        soup = BeautifulSoup(content, 'html.parser') #html.parser不会自动添加html/body

        #删除图像
        for tag in soup.find_all('img'):
            tag.extract()

        self.adjust_css(soup)
        #self.inline_css(soup) #碰到稍微复杂一些的CSS文件性能就比较低下，暂时屏蔽对CSS文件的支持
        self.remove_empty_tags(soup)

        body = soup.body
        if body:
            body.name = 'div'

        return str(soup)

    #调整一些CSS
    def adjust_css(self, soup):
        #删除 height 属性
        for element in soup.find_all():
            if element.has_attr('height'):
                del element['height']
            if element.has_attr('style'):
                existing = element.get('style', '')
                newStyle = dict(item.split(":") for item in existing.split(";") if item)
                if 'height' in newStyle:
                    del newStyle['height']
                element['style'] = "; ".join(f"{k}: {v}" for k, v in newStyle.items())

    #将外部单独css文件的样式内联到html标签中
    def inline_css(self, soup):
        link = soup.find('link', attrs={'rel': 'stylesheet', 'href': True})
        if not link:
            return

        link.extract()
        css = ''
        link = os.path.join(os.path.dirname(self.mdxFilename), link['href']) #type:ignore
        if os.path.exists(link):
            with open(link, 'r', encoding='utf-8') as f:
                css = f.read().strip()

        if not css:
            return

        parsed = {} #css文件的样式字典
        cssRules = []

        import css_parser
        parser = css_parser.CSSParser()
        try:
            stylesheet = parser.parseString(css)
            cssRules = list(stylesheet.cssRules)
        except Exception as e:
            default_log.warning(f'parse css failed: {self.mdxFilename}: {e}')
            return
        
        for rule in cssRules:
            if rule.type == rule.STYLE_RULE:
                selector = rule.selectorText
                if ':' in selector: #伪元素
                    continue
                styles = {}
                for style in rule.style:
                    if style.name != 'height':
                        styles[style.name] = style.value
                parsed[selector] = styles

        #内联样式
        for selector, styles in parsed.items():
            try:
                elements = soup.select(selector)
            except NotImplementedError as e:
                default_log.debug(f"Skipping unsupported selector: {selector}")
                continue
            for element in elements:
                existing = element.get('style', '')
                newStyle = dict(item.split(":") for item in existing.split(";") if item)
                newStyle.update(styles)
                element['style'] = "; ".join(f"{k}: {v}" for k, v in newStyle.items())

    #删除空白元素
    def remove_empty_tags(self, soup, preserve_tags=None):
        if preserve_tags is None:
            preserve_tags = {"img", "hr"}

        empty_tags = []
        for tag in soup.find_all():
            if tag.name not in preserve_tags and not tag.get_text().strip():
                empty_tags.append(tag)
            else:
                self.remove_empty_tags(tag, preserve_tags)
        for tag in empty_tags:
            tag.decompose()
import json
import pandas as pd
from pathlib import Path
from bs4 import BeautifulSoup as bs

# Читаем файл
with open("raw_output.json", "r") as r:
    raw = json.load(r)

# Не всегда парсинг удается, проходим таким образом
# чтобы сформировать нормальные словари
comments = []
for key in raw.keys():
    for item in raw[key]:
        comments.append(item)

# все что не словарь - удаляем
comments = [c for c in comments if isinstance(c, dict)]

# Узнаем имя паблика для каждого комментария
prev_dialogue_start = 0
prev_dialogue_index = 0
author_name = None
total_dialogue_count = 0
for i in range(len(comments)):
    dialogue_index = comments[i]["dialogue_index"]

    # Немного чиним текст, который может содержать слишком много HTML кода
    if "<div id=\"wpt" in comments[i]["text"]:
        text = bs(comments[i]["text"], features="lxml")
        link = text.find("a", {"class": "mem_link"})
        if link is not None:
            replies_to_href = link['href']
            replies_to_mention_id = link['mention_id']
            comments[i]["replies_to_href"] = replies_to_href
            comments[i]["replies_to_mention_id"] = replies_to_mention_id
            comments[i]["replies_to_name"] = link.text
        # убираем HTML из текста
        comments[i]['text'] = text.text
    else:
        comments[i]["replies_to_href"] = None
        comments[i]["replies_to_mention_id"] = None
        comments[i]["replies_to_name"] = None
    
    if dialogue_index < prev_dialogue_index:
        # конец прошлой ветки
        for b in range(prev_dialogue_start, i):
            comments[b]["group_author_name"] = author_name
            comments[b]["total_dialogue_index"] = total_dialogue_count
        total_dialogue_count += 1
        print(f"\t::set page admin name as {author_name} for the above::")
        author_name = None
        prev_dialogue_start = i
    
    if dialogue_index == 0 and i != 0:
        print("\t<branch end>")
        print(f"{comments[i]['author_name']} (is_page_admin={comments[i]['is_page_admin']})", end=" ")
    else:
        print(f"\t{comments[i]['author_name']}", end=" ")

    if author_name is None and comments[i]["is_page_admin"]:
        author_name = comments[i]["author_name"]
        print("[set as page admin]")
    elif comments[i]["is_page_admin"]:
        assert author_name == comments[i]["author_name"]
        print("[page admin already found]")
    else:
        print("[not page author]")

    prev_dialogue_index = dialogue_index

for b in range(prev_dialogue_start, len(comments)):
    comments[b]["group_author_name"] = author_name
    comments[b]["total_dialogue_index"] = total_dialogue_count

out = pd.DataFrame(comments)
out["like_count"] = out["like_count"].apply(lambda x: x if len(x) > 0 else 0)

order = [
    "group_author_name",
    "author_name",
    "replies_to_href",
    "replies_to_mention_id",
    "replies_to_name",
    "is_page_admin",
    "page_url",
    "text",
    "text_date",
    "like_count"    
]
mapping = {
    "group_author_name": "Название группы",
    "author_name": "Имя автора",
    "is_page_admin": "Администратор группы",
    "page_url": "Адрес публикации",
    "text": "Текст сообщения",
    "text_date": "Дата сообщения",
    "like_count": "Количество лайков",
    "replies_to_href": "Кому отвечает (ссылка)",
    "replies_to_mention_id": "Кому отвечает (vk id)",
    "replies_to_name": "Кому отвечает (имя пользователя)",
}

outdir = Path("out")
outdir.mkdir(exist_ok=True)

for i, frame in out.groupby("group_author_name"):
    outpath = outdir / i
    outpath.mkdir(exist_ok=True)

    for b, subframe in frame.groupby("total_dialogue_index"):
        print(subframe)
        res = subframe.copy(deep=True)
        res = res[order].rename(columns=mapping)
        res.to_excel(outpath / f"{b}.xlsx", index=False)
        print("\n\n")

# print(out)

exit(0)
out.to_csv("output.csv", index=False)
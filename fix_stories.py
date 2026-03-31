import json
import os

def fix_bible_stories():
    filename = 'bible_story.json'
    if not os.path.exists(filename):
        print(f"File {filename} not found")
        return
        
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    genesis_titles = ["새로운 시작", "노아와 그의 아들들", "나라들이 흩어지다", "야벳의 자손", "함의 자손", "셈의 자손", "언어가 뒤섞이다"]
    
    for item in data:
        t = item.get('title', '')
        b = item.get('book', '')
        
        if b == "아가":
            if any(gt in t for gt in genesis_titles):
                item['book'] = "창세기"
            elif any(k in t for k in ["율법", "제사", "성결", "속죄", "안식일", "유월절", "초실절", "레위기", "음식", "제사장"]):
                item['book'] = "레위기"
            elif any(k in t for k in ["민수기", "인구", "진을 옮기는", "고핫", "게르손", "므라리", "나실인", "축복", "가데스", "정탐꾼"]):
                item['book'] = "민수기"
            elif any(k in t for k in ["신명기", "모세의 고별", "전파"]):
                item['book'] = "신명기"
            elif any(k in t for k in ["등잔대", "성막"]):
                item['book'] = "민수기" 
    
    # Add Mark 1 stories (New Testament)
    nt_mark = [
        {"book": "마가복음", "title": "서론: 세례 요한의 전파", "text": "하나님의 아들 예수 그리스도의 복음의 시작은 이러합니다. 예언자 이사야의 글에 이렇게 적혀 있습니다. “보라, 내가 네 앞에 내 사자를 보낸다. 그가 네 길을 준비할 것이다.” “광야에서 외치는 이의 목소리가 들린다. ‘주님의 길을 준비하여라. 그분의 길을 곧게 펴라.’”"},
        {"book": "마가복음", "title": "예수께서 세례를 받으심", "text": "그 무렵에 예수께서 갈릴리 나사렛으로부터 오셔서, 요단 강에서 요한에게 세례를 받으셨습니다. 예수께서 물에서 올라오실 때, 바로 하늘이 갈라지고 성령이 비둘기처럼 자기에게 내려오시는 것을 보셨습니다."},
        {"book": "마가복음", "title": "예수께서 시험을 받으심", "text": "곧 성령이 예수를 광야로 보내셨습니다. 예수께서는 광야에서 사십 일 동안 계시면서 사탄에게 시험을 받으셨습니다. 거기서 들짐승들과 함께 계셨는데, 천사들이 예수의 시중을 들었습니다."},
        {"book": "마가복음", "title": "네 제자를 부르심", "text": "예수께서 갈릴리 호숫가를 걸어가시다가, 시몬과 그의 동생 안드레가 호수에 그물을 던지는 것을 보셨습니다. 그들은 어부였습니다. 예수께서 그들에게 말씀하셨습니다. “나를 따라오너라. 내가 너희를 사람 낚는 어부가 되게 하겠다.” 그들은 곧 그물을 버려 두고 예수를 따랐습니다."}
    ]
    
    # Add if not already there
    existing_mark = [s for s in data if s.get('book') == "마가복음"]
    if not existing_mark:
        data.extend(nt_mark)

    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Fixed and added NT stories")

if __name__ == "__main__":
    fix_bible_stories()

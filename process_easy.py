import json
import os
import re

# Mapping of book names to list of possible abbreviations
BOOK_TO_ABBRS = {
    '창세기': ['창'], '출애굽기': ['출'], '레위기': ['레'], '민수기': ['민'], '신명기': ['신'],
    '여호수아': ['여호수아', '수'], '사사기': ['삿'], '룻기': ['룻'], 
    '사무엘상': ['삼상'], '사무엘하': ['삼하'],
    '열왕기상': ['왕상'], '열왕기하': ['왕하'], '역대상': ['대상'], '역대하': ['대하'],
    '에스라': ['에스라', '라', '스'], '느헤미야': ['느'], '에스더': ['에'], 
    '욥기': ['욥'], '시편': ['시'], '잠언': ['잠'], '전도서': ['전'], '아가': ['아'], 
    '이사야': ['사'], '예레미야': ['렘'], '예레미야애가': ['애'], 
    '에스겔': ['겔'], '다니엘': ['단'], '호세아': ['호'], '요엘': ['욜'],
    '아모스': ['암'], '오바댜': ['옵'], '요나': ['욘'], '미가': ['미'], '나훔': ['나'], 
    '하박국': ['합'], '스바냐': ['습'], '학개': ['학'], '스가랴': ['슥'], '말라기': ['말'], 
    '마태복음': ['마'], '마가복음': ['막'], '누가복음': ['눅'], '요한복음': ['요'], 
    '사도행전': ['행'], '로마서': ['롬'], '고린도전서': ['고전'], '고린도후서': ['고후'], 
    '갈라디아서': ['갈'], '에베소서': ['엡'], '빌립보서': ['빌'], '골로새서': ['골'], 
    '데살로니가전서': ['살전'], '데살로니가후서': ['살후'], '디모데전서': ['딤전'], 
    '디모데후서': ['딤후'], '디도서': ['딛'], '빌레몬서': ['몬'],
    '히브리서': ['히'], '야고보서': ['약'], '베드로전서': ['벧전'], '베드로후서': ['벧후'],
    '요한일서': ['요일'], '요한이서': ['요이'], '요한삼서': ['요삼'], '유다서': ['유'],
    '요한계시록': ['계']
}

def parse_chapter_file(file_path):
    """쉬운성경 장 파일을 파싱해서 절 리스트 반환"""
    # Try different encodings
    content = ""
    for enc in ['utf-8', 'cp949', 'euc-kr']:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                content = f.read()
            break
        except:
            continue
    
    if not content:
        return []

    verses = {}
    current_verse = None
    current_text = []

    for line in content.split('\n'):
        line = line.strip()
        if not line:
            continue

        # 절 번호로 시작하는 줄 감지 (예: "1 태초에...")
        m = re.match(r'^(\d+)\s+(.+)$', line)
        if m:
            # 이전 절 저장
            if current_verse is not None:
                verses[current_verse] = ' '.join(current_text).strip()
            current_verse = int(m.group(1))
            current_text = [m.group(2)]
        else:
            # 이전 절의 연속 텍스트
            if current_verse is not None:
                current_text.append(line)

    # 마지막 절 저장
    if current_verse is not None:
        verses[current_verse] = ' '.join(current_text).strip()

    if not verses:
        return []

    # 절 번호 순서대로 리스트 생성
    max_verse = max(verses.keys())
    result = []
    for i in range(1, max_verse + 1):
        text = verses.get(i, '')
        if text:
            result.append(f"{i} {text}")
        else:
            result.append('')

    return result

def process_easy():
    # Use workspace folder for file paths
    base_dir = r"g:\내 드라이브\안티그래피티\성경노트어플"
    with open(os.path.join(base_dir, 'bible_books.json'), 'r', encoding='utf-8') as f:
        books = json.load(f)

    easy_data = {}
    source_dir = os.path.join(base_dir, '쉬운성경')
    
    total_missing = 0
    missing_files = []

    for book_info in books:
        book_name = book_info['name']
        abbrs = BOOK_TO_ABBRS.get(book_name, [])
        
        for ch in range(1, book_info['chapters'] + 1):
            found_file = False
            for abbr in abbrs:
                file_name = f"쉬운성경_{abbr}{ch}.txt"
                file_path = os.path.join(source_dir, file_name)
                
                if os.path.exists(file_path):
                    verses = parse_chapter_file(file_path)
                    if verses:
                        key = f"{book_name}-{ch}"
                        easy_data[key] = verses
                        found_file = True
                        break
            
            if not found_file:
                total_missing += 1
                missing_files.append(f"{book_name} {ch}")

    print(f"완료! {len(easy_data)}개 장 처리됨")
    if total_missing > 0:
        print(f"누락된 장 ({total_missing}개): {', '.join(missing_files[:20])}...")

    with open(os.path.join(base_dir, 'bible_verses_easy.json'), 'w', encoding='utf-8') as f:
        json.dump(easy_data, f, ensure_ascii=False, indent=2)
    print("bible_verses_easy.json 저장 완료")

if __name__ == "__main__":
    process_easy()

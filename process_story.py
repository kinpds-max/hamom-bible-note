import re
import json

def process_story():
    try:
        with open('쉬운성경 이야기버전.txt', 'r', encoding='cp949') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Split by <Title> but keep the titles
    # Using regex with capture group to keep the delimiter
    parts = re.split(r'(<[^>]+>)', content)
    
    stories = []
    # parts: [0]='', [1]='<title1>', [2]='text1', [3]='<title2>', [4]='text2'...
    for i in range(1, len(parts), 2):
        title = parts[i].strip('<>')
        text = parts[i+1].strip() if i+1 < len(parts) else ''
        if title:
            stories.append({
                "title": title,
                "text": text
            })
            
    with open('bible_story.json', 'w', encoding='utf-8') as f:
        json.dump(stories, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully processed {len(stories)} stories into bible_story.json")

if __name__ == "__main__":
    process_story()

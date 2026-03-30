import json
import os
import re

def process_niv():
    with open('bible_books.json', 'r', encoding='utf-8') as f:
        books = json.load(f)
    
    niv_data = {}
    
    # List of NIV file names in order (01 to 66)
    niv_files = sorted([f for f in os.listdir('.') if re.match(r'^\d{2}-.*\.txt$', f)])
    
    if len(niv_files) != 66:
        print(f"Warning: Found {len(niv_files)} NIV files instead of 66.")
    
    for i, book_info in enumerate(books):
        book_name_kr = book_info['name']
        file_name = niv_files[i]
        
        print(f"Processing {file_name} -> {book_name_kr}")
        
        with open(file_name, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        current_chapter = -1
        chapter_verses = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Match 1:1, 10:15, etc.
            match = re.match(r'^(\d+):(\d+)\s+(.*)$', line)
            if match:
                ch = int(match.group(1))
                vs = int(match.group(2))
                text = match.group(3)
                
                if ch != current_chapter:
                    if current_chapter != -1:
                        niv_data[f"{book_name_kr}-{current_chapter}"] = chapter_verses
                    current_chapter = ch
                    chapter_verses = []
                
                # Check for skipped verses or multi-line verses if needed
                # But looking at the file, it's one line per verse mostly.
                # If the verse number doesn't match the list index + 1, we might have gaps or multi-verse lines.
                while len(chapter_verses) < vs - 1:
                    chapter_verses.append("") # Placeholder for missing verses
                
                if len(chapter_verses) == vs - 1:
                    chapter_verses.append(f"{vs} {text}")
                else:
                    # Append to previous if it's a continuation? 
                    # Actually, the file format seems to have verse number at start of each line.
                    pass
        
        # Save last chapter of book
        if current_chapter != -1:
            niv_data[f"{book_name_kr}-{current_chapter}"] = chapter_verses
            
    with open('bible_verses_niv.json', 'w', encoding='utf-8') as f:
        json.dump(niv_data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    process_niv()

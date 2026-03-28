import { BIBLE_BOOKS, SAMPLE_DATA } from './bible_data.js';

class BibleApp {
    constructor() {
        this.db = null;
        this.currentBook = BIBLE_BOOKS[0];
        this.currentChapter = 1;
        this.selectedVerses = [];
        this.notes = JSON.parse(localStorage.getItem('bibleNotes') || '[]');
        this.currentNoteId = null;
        this.isBibleLoaded = false;

        this.init();
    }

    init() {
        this.initDB();
        this.currentCalendarDate = new Date();
        this.setupEventListeners();
        this.renderBookList();
        this.checkInitialData();
        this.updateChapterSelect();
        this.loadChapters();
        this.renderNotesList();
        this.renderCalendar();
        this.loadMemo();
        this.updateDateDisplay();
        this.switchTheme(localStorage.getItem('bibleTheme') || 'dark');
        
        // Load default view
        this.switchBook(this.currentBook.id);
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BibleDB', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('verses')) {
                    db.createObjectStore('verses', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    updateDateDisplay() {
        const now = new Date();
        const display = document.getElementById('noteDateDisplay');
        if (display) {
            display.textContent = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${String(now.getDate()).padStart(2, '0')}`;
        }
    }

    setupEventListeners() {
        document.getElementById('oldTestament').addEventListener('click', (e) => this.handleBookClick(e));
        document.getElementById('newTestament').addEventListener('click', (e) => this.handleBookClick(e));

        document.getElementById('chapterSelect').addEventListener('change', (e) => this.switchChapter(parseInt(e.target.value)));
        document.getElementById('prevChapter').addEventListener('click', () => this.currentChapter > 1 && this.switchChapter(this.currentChapter - 1));
        document.getElementById('nextChapter').addEventListener('click', () => this.currentChapter < this.currentBook.chapters && this.switchChapter(this.currentChapter + 1));

        document.getElementById('verseList').addEventListener('click', (e) => this.handleVerseClick(e));
        document.getElementById('addSelectedToNote').addEventListener('click', () => this.addSelectedToNote());

        document.getElementById('saveNote').addEventListener('click', () => this.saveCurrentNote());
        document.getElementById('newNote').addEventListener('click', () => this.createNewNote());
        
        document.getElementById('bibleSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchBible(e.target.value);
        });

        document.getElementById('generalMemo').addEventListener('input', (e) => {
            localStorage.setItem('bibleMemo', e.target.value);
        });

        document.getElementById('darkThemeBtn').onclick = () => this.switchTheme('dark');
        document.getElementById('silverThemeBtn').onclick = () => this.switchTheme('silver');
    }

    switchTheme(theme) {
        if (theme === 'silver') {
            document.body.classList.add('silver-mode');
            document.getElementById('silverThemeBtn').classList.add('active');
            document.getElementById('darkThemeBtn').classList.remove('active');
        } else {
            document.body.classList.remove('silver-mode');
            document.getElementById('darkThemeBtn').classList.add('active');
            document.getElementById('silverThemeBtn').classList.remove('active');
        }
        localStorage.setItem('bibleTheme', theme);
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        grid.innerHTML = '';
        
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        ['일', '월', '화', '수', '목', '금', '토'].forEach(d => {
            const div = document.createElement('div');
            div.className = 'calendar-day-header';
            div.textContent = d;
            grid.appendChild(div);
        });
        
        for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
        
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.textContent = day;
            
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                div.classList.add('today');
            }
            
            const hasNote = this.notes.some(n => {
                const noteDate = new Date(n.date);
                return noteDate.getFullYear() === year && noteDate.getMonth() === month && noteDate.getDate() === day;
            });
            if (hasNote) div.classList.add('has-note');
            
            grid.appendChild(div);
        }
    }

    loadMemo() {
        document.getElementById('generalMemo').value = localStorage.getItem('bibleMemo') || '';
    }

    renderBookList() {
        const oldGrid = document.getElementById('oldTestament');
        const newGrid = document.getElementById('newTestament');
        if (!oldGrid || !newGrid) return;
        
        BIBLE_BOOKS.forEach(book => {
            const el = document.createElement('div');
            el.className = 'book-item';
            el.dataset.id = book.id;
            el.textContent = book.short;
            el.title = book.name;
            
            if (book.test === 'old') oldGrid.appendChild(el);
            else newGrid.appendChild(el);
        });
    }

    handleBookClick(e) {
        const bookItem = e.target.closest('.book-item');
        if (!bookItem) return;
        this.switchBook(bookItem.dataset.id);
    }

    switchBook(bookId) {
        this.currentBook = BIBLE_BOOKS.find(b => b.id === bookId);
        this.currentChapter = 1;
        document.querySelectorAll('.book-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.book-item[data-id="${bookId}"]`);
        if (activeItem) activeItem.classList.add('active');
        this.updateChapterSelect();
        this.loadChapters();
        this.updateHeader();
    }

    switchChapter(chapterNum) {
        this.currentChapter = chapterNum;
        document.getElementById('chapterSelect').value = chapterNum;
        this.loadChapters();
        this.updateHeader();
    }

    updateChapterSelect() {
        const select = document.getElementById('chapterSelect');
        if (!select) return;
        select.innerHTML = '';
        for (let i = 1; i <= this.currentBook.chapters; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i}장`;
            select.appendChild(opt);
        }
    }

    updateHeader() {
        const h2 = document.getElementById('currentLocation');
        if (h2) h2.textContent = `${this.currentBook.name} ${this.currentChapter}장`;
        const list = document.getElementById('verseList');
        if (list) list.scrollTop = 0;
    }

    async loadChapters() {
        const verseContainer = document.getElementById('verseList');
        if (!verseContainer) return;
        verseContainer.innerHTML = '<p class="loading">불러오는 중...</p>';
        this.selectedVerses = [];
        this.updateSelectionToolbar();

        const storedVerses = await this.getVersesFromDB(this.currentBook.id, this.currentChapter);
        
        if (storedVerses.length > 0) {
            this.renderVerses(storedVerses);
        } else if (SAMPLE_DATA[this.currentBook.id] && SAMPLE_DATA[this.currentBook.id][this.currentChapter]) {
            this.renderVerses(SAMPLE_DATA[this.currentBook.id][this.currentChapter].map((v, i) => ({
                id: `${this.currentBook.id}:${this.currentChapter}:${i+1}`,
                text: v
            })));
        } else {
            verseContainer.innerHTML = `
                <div class="empty-state">
                    <p>데이터가 없습니다.</p>
                    <button id="importBtnInline" class="btn secondary">성경 파일 업로드</button>
                </div>
            `;
            const btn = document.getElementById('importBtnInline');
            if (btn) btn.onclick = () => document.getElementById('fileInput').click();
        }
    }

    renderVerses(verses) {
        const container = document.getElementById('verseList');
        if (!container) return;
        container.innerHTML = '';
        verses.forEach(v => {
            const div = document.createElement('div');
            div.className = 'verse-item';
            div.dataset.id = v.id;
            
            const match = v.text.match(/.*?\d+?:(\d+)\s(.*)/);
            if (match) {
                const num = match[1];
                let content = match[2];
                content = content.replace(/<(.*?)>/, '<span class="section-title">[$1]</span>');
                div.innerHTML = `<span class="verse-num">${num}</span> <span class="verse-text">${content}</span>`;
            } else {
                div.textContent = v.text;
            }
            container.appendChild(div);
        });
    }

    handleVerseClick(e) {
        const verseEl = e.target.closest('.verse-item');
        if (!verseEl) return;
        const verseId = verseEl.dataset.id;
        const index = this.selectedVerses.indexOf(verseId);
        if (index > -1) {
            this.selectedVerses.splice(index, 1);
            verseEl.classList.remove('selected');
        } else {
            this.selectedVerses.push(verseId);
            verseEl.classList.add('selected');
        }
        this.updateSelectionToolbar();
    }

    updateSelectionToolbar() {
        const toolbar = document.getElementById('selectionToolbar');
        const countEl = document.getElementById('selectedCount');
        if (!toolbar) return;
        if (this.selectedVerses.length > 0) {
            toolbar.classList.remove('hidden');
            if (countEl) countEl.textContent = `${this.selectedVerses.length}개 구절 선택됨`;
        } else {
            toolbar.classList.add('hidden');
        }
    }

    async addSelectedToNote() {
        const quotesContainer = document.getElementById('quotedVerses');
        if (!quotesContainer) return;
        const placeholder = quotesContainer.querySelector('.quoted-verses-placeholder');
        if (placeholder) placeholder.remove();
        
        for (const verseId of this.selectedVerses) {
            const verseData = await this.getVerseById(verseId);
            if (!verseData) continue;

            const parts = verseId.split(':');
            const book = BIBLE_BOOKS.find(b => b.id === parts[0]);
            const label = `${book.name} ${parts[1]}:${parts[2]}`;

            const quoteDiv = document.createElement('div');
            quoteDiv.className = 'quoted-verse';
            quoteDiv.dataset.id = verseId;
            
            let cleanText = verseData.text;
            const match = verseData.text.match(/.*?\d+?:(\d+)\s(.*)/);
            if (match) cleanText = match[2];

            quoteDiv.innerHTML = `
                <strong>${label}</strong>
                <p>${cleanText}</p>
                <span class="remove-quote">&times;</span>
            `;
            quoteDiv.querySelector('.remove-quote').onclick = () => {
                quoteDiv.remove();
                if (quotesContainer.children.length === 0) {
                    quotesContainer.innerHTML = '<div class="quoted-verses-placeholder">성경 구절을 선택해 이곳으로 보내세요</div>';
                }
            };
            quotesContainer.appendChild(quoteDiv);
        }

        this.selectedVerses = [];
        document.querySelectorAll('.verse-item.selected').forEach(el => el.classList.remove('selected'));
        this.updateSelectionToolbar();
        document.getElementById('noteContent').focus();
    }

    async handleFileImport(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        const transaction = this.db.transaction(['verses'], 'readwrite');
        const store = transaction.objectStore('verses');
        for (const file of files) {
            const text = await file.text();
            const lines = text.split('\n');
            const bookPrefix = file.name.split('.')[0].substring(2); 
            const book = BIBLE_BOOKS.find(b => b.name === bookPrefix || file.name.includes(b.id));
            if (!book) continue;
            lines.forEach(line => {
                if (!line.trim()) return;
                const match = line.match(/(.*?)\s*(\d+):(\d+)\s+(.*)/);
                if (match) {
                    const chapter = parseInt(match[2]);
                    const verseNum = parseInt(match[3]);
                    const id = `${book.id}:${chapter}:${verseNum}`;
                    store.put({ id, bookId: book.id, chapter, verse: verseNum, text: line.trim() });
                }
            });
        }
        transaction.oncomplete = () => {
            alert('성경 파일을 성공적으로 불러왔습니다!');
            this.loadChapters();
        };
    }

    getVersesFromDB(bookId, chapter) {
        return new Promise((resolve) => {
            if (!this.db) { resolve([]); return; }
            const transaction = this.db.transaction(['verses'], 'readonly');
            const store = transaction.objectStore('verses');
            const request = store.openCursor();
            const results = [];
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.bookId === bookId && cursor.value.chapter === chapter) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results.sort((a,b) => a.verse - b.verse));
                }
            };
        });
    }

    getVerseById(id) {
        return new Promise((resolve) => {
            if (!this.db) { resolve(null); return; }
            const transaction = this.db.transaction(['verses'], 'readonly');
            const store = transaction.objectStore('verses');
            const request = store.get(id);
            request.onsuccess = () => {
                if (request.result) resolve(request.result);
                else {
                    const parts = id.split(':');
                    if (SAMPLE_DATA[parts[0]] && SAMPLE_DATA[parts[0]][parts[1]]) {
                        const line = SAMPLE_DATA[parts[0]][parts[1]][parseInt(parts[2])-1];
                        resolve({ text: line });
                    } else { resolve(null); }
                }
            };
        });
    }

    saveCurrentNote() {
        const title = document.getElementById('noteTitle').value || '제목 없는 노트';
        const content = document.getElementById('noteContent').value;
        const quotes = Array.from(document.querySelectorAll('.quoted-verse')).map(el => el.dataset.id);
        const note = {
            id: this.currentNoteId || Date.now(),
            title, content, quotes,
            date: new Date().toISOString()
        };
        if (this.currentNoteId) {
            const idx = this.notes.findIndex(n => n.id === this.currentNoteId);
            if (idx > -1) this.notes[idx] = note;
        } else {
            this.notes.unshift(note);
            this.currentNoteId = note.id;
        }
        localStorage.setItem('bibleNotes', JSON.stringify(this.notes));
        this.renderNotesList();
        this.renderCalendar();
        alert('노트가 저장되었습니다.');
    }

    createNewNote() {
        this.currentNoteId = null;
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
        const quotes = document.getElementById('quotedVerses');
        if (quotes) quotes.innerHTML = '<div class="quoted-verses-placeholder">성경 구절을 선택해 이곳으로 보내세요</div>';
        this.updateDateDisplay();
    }

    renderNotesList() {
        const list = document.getElementById('savedNotesList');
        if (!list) return;
        list.innerHTML = '';
        this.notes.slice(0, 10).forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-mini-item';
            div.innerHTML = `<span>${note.title}</span><small>${new Date(note.date).toLocaleDateString()}</small>`;
            div.onclick = () => this.loadNote(note.id);
            list.appendChild(div);
        });
    }

    async loadNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        this.currentNoteId = note.id;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').value = note.content;
        const d = new Date(note.date);
        document.getElementById('noteDateDisplay').textContent = `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}`;
        const quotesContainer = document.getElementById('quotedVerses');
        if (!quotesContainer) return;
        quotesContainer.innerHTML = '';
        if (note.quotes && note.quotes.length > 0) {
            for (const verseId of note.quotes) {
                const verseData = await this.getVerseById(verseId);
                if (!verseData) continue;
                const parts = verseId.split(':');
                const book = BIBLE_BOOKS.find(b => b.id === parts[0]);
                const quoteDiv = document.createElement('div');
                quoteDiv.className = 'quoted-verse';
                quoteDiv.dataset.id = verseId;
                let cleanText = verseData.text;
                const match = verseData.text.match(/.*?\d+?:(\d+)\s(.*)/);
                if (match) cleanText = match[2];
                quoteDiv.innerHTML = `
                    <strong>${book.name} ${parts[1]}:${parts[2]}</strong>
                    <p>${cleanText}</p>
                    <span class="remove-quote">&times;</span>
                `;
                quoteDiv.querySelector('.remove-quote').onclick = () => {
                    quoteDiv.remove();
                    if (quotesContainer.children.length === 0) {
                        quotesContainer.innerHTML = '<div class="quoted-verses-placeholder">성경 구절을 선택해 이곳으로 보내세요</div>';
                    }
                };
                quotesContainer.appendChild(quoteDiv);
            }
        } else {
            quotesContainer.innerHTML = '<div class="quoted-verses-placeholder">성경 구절을 선택해 이곳으로 보내세요</div>';
        }
    }

    searchBible(query) {
        const match = query.match(/(\D+)\s*(\d+)(?::(\d+))?/);
        if (match) {
            const bookName = match[1].trim();
            const chapter = parseInt(match[2]);
            const verse = match[3] ? parseInt(match[3]) : null;
            const book = BIBLE_BOOKS.find(b => b.name === bookName || b.short === bookName);
            if (book) {
                this.switchBook(book.id);
                this.switchChapter(chapter);
                if (verse) {
                    setTimeout(() => {
                        const vEl = document.querySelector(`.verse-item[data-id="${book.id}:${chapter}:${verse}"]`);
                        if (vEl) {
                            vEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            vEl.classList.add('selected');
                            this.selectedVerses.push(vEl.dataset.id);
                            this.updateSelectionToolbar();
                        }
                    }, 500);
                }
            }
        }
    }

    checkInitialData() {
        if (!this.db) return;
        const transaction = this.db.transaction(['verses'], 'readonly');
        const store = transaction.objectStore('verses');
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result === 0) {
                document.getElementById('importOverlay').classList.remove('hidden');
            }
        };
        document.getElementById('autoImportBtn').onclick = () => {
            document.getElementById('importOverlay').classList.add('hidden');
            this.autoImportBible();
        };
        document.getElementById('modalSelectFiles').onclick = () => {
            document.getElementById('importOverlay').classList.add('hidden');
            document.getElementById('fileInput').click();
        };
        document.getElementById('closeModal').onclick = () => {
            document.getElementById('importOverlay').classList.add('hidden');
        };
    }

    async autoImportBible() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const progress = document.getElementById('importProgress');
        loadingOverlay.classList.remove('hidden');
        try {
            const response = await fetch('bible_verses.json');
            if (!response.ok) throw new Error('데이터 없음');
            const data = await response.json();
            const keys = Object.keys(data);
            const total = keys.length;
            const transaction = this.db.transaction(['verses'], 'readwrite');
            const store = transaction.objectStore('verses');
            let count = 0;
            for (const key of keys) {
                const [bookName, chapter] = key.split('-');
                const book = BIBLE_BOOKS.find(b => b.name === bookName);
                if (!book) continue;
                data[key].forEach(line => {
                    const match = line.match(/^(\d+)\s+(.*)/);
                    if (match) {
                        const verseNum = parseInt(match[1]);
                        const id = `${book.id}:${chapter}:${verseNum}`;
                        store.put({ id, bookId: book.id, chapter: parseInt(chapter), verse: verseNum, text: `${book.short}${chapter}:${verseNum} ${match[2]}` });
                    }
                });
                count++;
                if (count % 20 === 0) progress.style.width = `${(count / total) * 100}%`;
            }
            transaction.oncomplete = () => {
                progress.style.width = '100%';
                setTimeout(() => {
                    loadingOverlay.classList.add('hidden');
                    alert('성경 데이터 설치 완료!');
                    this.loadChapters();
                }, 500);
            };
        } catch (error) {
            loadingOverlay.classList.add('hidden');
            alert('오류 발생: ' + error.message);
        }
    }
}

new BibleApp();

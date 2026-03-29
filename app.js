/**
 * 하맘 성경노트 Pro — Core Application Logic
 * Apple-inspired mobile-first Bible note-taking experience
 * 
 * "Design is not just what it looks like and feels like. 
 *  Design is how it works." — Steve Jobs
 */

// --- Bible Data State ---
let BIBLE_BOOKS = [];
let ALL_VERSES = {};
let IS_LOADING = true;

// --- Note Engine ---
class NoteApp {
    constructor() {
        this.notes = JSON.parse(localStorage.getItem('bible_notes') || '{}');
        this.currentNote = {
            id: null,
            date: new Date().toISOString().split('T')[0],
            theme: '',
            category: 'sermon',
            verses: [],
            memo: '',
            isBookmarked: false
        };
        this.isRecording = false;
        this.recognition = null;
        this.activeTab = 'tab-bible';
        this.versesAccordionOpen = true;

        this.init();
    }

    async init() {
        this.initDOM();
        this.registerEvents();
        this.initTabBar();
        this.initAccordion();
        this.initMenuSheet();

        try {
            await this.loadBibleData();
            this.renderCalendar();
            this.loadNoteByDate(this.currentNote.date);
        } catch (error) {
            console.error('Failed to load bible data:', error);
            this.dom.verseList.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="warning-outline" class="empty-icon"></ion-icon>
                    <p>성경 데이터를 불러오는 데 실패했습니다</p>
                </div>`;
        }
    }

    async loadBibleData() {
        this.dom.verseList.innerHTML = `
            <div class="empty-state">
                <ion-icon name="sync-outline" class="empty-icon spin"></ion-icon>
                <p>성경 데이터를 불러오는 중...</p>
            </div>`;

        const [booksRes, versesRes] = await Promise.all([
            fetch('bible_books.json'),
            fetch('bible_verses.json')
        ]);

        BIBLE_BOOKS = await booksRes.json();
        ALL_VERSES = await versesRes.json();
        IS_LOADING = false;

        this.dom.bookSelect.innerHTML = '<option value="">성경 선택</option>';
        BIBLE_BOOKS.forEach(book => {
            const opt = document.createElement('option');
            opt.value = book.name;
            opt.textContent = book.name;
            this.dom.bookSelect.appendChild(opt);
        });

        this.dom.verseList.innerHTML = `
            <div class="empty-state">
                <ion-icon name="book-outline" class="empty-icon"></ion-icon>
                <p>성경 책과 장을 선택하거나<br>검색어를 입력하세요</p>
            </div>`;

        console.log('✦ Bible data loaded successfully.');
    }

    initDOM() {
        this.dom = {
            // Meta
            dateInput: document.getElementById('note-date'),
            themeInput: document.getElementById('note-theme'),
            categorySelect: document.getElementById('note-category'),
            autoSaveIndicator: document.getElementById('auto-save-indicator'),

            // Bible Search
            bibleSearch: document.getElementById('bible-search'),
            searchBtn: document.getElementById('search-btn'),
            bookSelect: document.getElementById('book-select'),
            chapterSelect: document.getElementById('chapter-select'),
            verseList: document.getElementById('verse-list'),
            pushToNoteBtn: document.getElementById('push-to-note-btn'),
            pushCount: document.getElementById('push-count'),

            // Note Editor
            selectedVerses: document.getElementById('selected-verses'),
            noteMemo: document.getElementById('note-memo'),
            saveBtn: document.getElementById('save-btn'),
            recordBtn: document.getElementById('record-btn'),
            bookmarkBtn: document.getElementById('bookmark-btn'),
            highlightBtn: document.getElementById('highlight-btn'),
            aiSummaryBtn: document.getElementById('ai-summary-btn'),
            versesToggle: document.getElementById('verses-toggle'),
            versesAccordion: document.querySelector('.verses-accordion'),
            verseCountBadge: document.getElementById('verse-count-badge'),

            // Calendar
            calendarWidget: document.getElementById('calendar-widget'),
            notesOnDate: document.getElementById('notes-on-date'),

            // Modal
            aiModal: document.getElementById('ai-modal'),
            closeModal: document.getElementById('close-modal'),
            summaryResult: document.getElementById('summary-result'),
            copySummaryBtn: document.getElementById('copy-summary-btn'),

            // Menu
            menuBtn: document.getElementById('menu-btn'),
            menuOverlay: document.getElementById('menu-overlay'),
            menuCloseBtn: document.getElementById('menu-close-btn'),
            shareNoteBtn: document.getElementById('share-note-btn'),
            exportNotebookBtn: document.getElementById('export-notebook-btn'),

            // Tab Bar
            tabBar: document.getElementById('tab-bar'),
            contentArea: document.getElementById('content-area')
        };

        this.dom.dateInput.value = this.currentNote.date;
    }

    registerEvents() {
        // Bible Selection
        this.dom.bookSelect.onchange = () => this.handleBookChange();
        this.dom.chapterSelect.onchange = () => this.renderVerses();
        this.dom.searchBtn.onclick = () => this.handleSearch();
        this.dom.bibleSearch.onkeypress = (e) => (e.key === 'Enter') && this.handleSearch();

        // Note Metadata
        ['dateInput', 'themeInput', 'categorySelect'].forEach(el => {
            this.dom[el].oninput = () => this.triggerAutoSave();
        });

        this.dom.noteMemo.oninput = () => this.triggerAutoSave();

        this.dom.dateInput.onchange = () => {
            this.loadNoteByDate(this.dom.dateInput.value);
            this.triggerAutoSave();
        };

        // Save
        this.dom.saveBtn.onclick = () => this.saveNote(true);
        this.dom.pushToNoteBtn.onclick = () => this.handlePushToNote();

        // Tools
        this.dom.recordBtn.onclick = () => this.toggleRecording();
        this.dom.bookmarkBtn.onclick = () => this.toggleBookmark();
        this.dom.highlightBtn.onclick = () => this.applyHighlight();

        // AI
        this.dom.aiSummaryBtn.onclick = () => this.handleAISummary();

        // Modal
        this.dom.closeModal.onclick = () => this.dom.aiModal.classList.remove('active');
        this.dom.copySummaryBtn.onclick = () => this.copyToClipboard(this.dom.summaryResult.innerText, '요약 내용이 복사되었습니다.');

        // Menu actions
        if (this.dom.shareNoteBtn) this.dom.shareNoteBtn.onclick = () => { this.closeMenu(); this.handleShare(); };
        if (this.dom.exportNotebookBtn) this.dom.exportNotebookBtn.onclick = () => { this.closeMenu(); this.handleExportToLM(); };
    }

    // ─── Tab Bar Navigation ───

    initTabBar() {
        const tabs = this.dom.tabBar.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.onclick = () => {
                const targetId = tab.dataset.tab;
                this.switchTab(targetId);
            };
        });
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        this.dom.tabBar.querySelectorAll('.tab-item').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });

        // Update panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === tabId);
        });

        // Haptic-like visual feedback
        if (navigator.vibrate) navigator.vibrate(10);
    }

    // ─── Accordion ───

    initAccordion() {
        this.dom.versesToggle.onclick = () => {
            this.versesAccordionOpen = !this.versesAccordionOpen;
            this.dom.versesAccordion.classList.toggle('open', this.versesAccordionOpen);
        };
        // Start open
        this.dom.versesAccordion.classList.add('open');
    }

    // ─── Menu Sheet ───

    initMenuSheet() {
        this.dom.menuBtn.onclick = () => this.openMenu();
        this.dom.menuCloseBtn.onclick = () => this.closeMenu();
        this.dom.menuOverlay.onclick = (e) => {
            if (e.target === this.dom.menuOverlay) this.closeMenu();
        };
    }

    openMenu() {
        this.dom.menuOverlay.classList.add('active');
    }

    closeMenu() {
        this.dom.menuOverlay.classList.remove('active');
    }

    // ─── Bible Book/Chapter Selection ───

    handleBookChange() {
        const bookName = this.dom.bookSelect.value;
        const book = BIBLE_BOOKS.find(b => b.name === bookName);
        this.dom.chapterSelect.innerHTML = '<option value="">장</option>';
        if (book) {
            for (let i = 1; i <= book.chapters; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = i + '장';
                this.dom.chapterSelect.appendChild(opt);
            }
        }
    }

    // ─── Search ───

    handleSearch() {
        const query = this.dom.bibleSearch.value.trim();
        if (!query) return;

        const parts = query.split(' ');
        const bookAbbr = parts[0];
        const ref = parts[1] || '';
        const book = BIBLE_BOOKS.find(b => b.abbr === bookAbbr || b.name.includes(bookAbbr));

        if (book) {
            this.dom.bookSelect.value = book.name;
            this.handleBookChange();
            if (ref.includes(':')) {
                const [chap] = ref.split(':');
                this.dom.chapterSelect.value = chap;
            } else if (ref) {
                this.dom.chapterSelect.value = ref;
            } else {
                this.dom.chapterSelect.value = 1;
            }
            this.renderVerses();
            return;
        }

        this.renderWordSearchResults(query);
    }

    renderWordSearchResults(query) {
        this.dom.verseList.innerHTML = `
            <div class="empty-state">
                <ion-icon name="sync-outline" class="empty-icon spin"></ion-icon>
                <p>'${query}' 검색 중...</p>
            </div>`;

        setTimeout(() => {
            const results = [];
            let count = 0;
            const MAX_RESULTS = 100;

            for (const [key, verses] of Object.entries(ALL_VERSES)) {
                if (count >= MAX_RESULTS) break;
                const [bookName, chapter] = key.split('-');
                verses.forEach((text, idx) => {
                    if (count >= MAX_RESULTS) return;
                    if (text.includes(query)) {
                        results.push({ book: bookName, chapter, verse: idx + 1, text });
                        count++;
                    }
                });
            }

            if (results.length === 0) {
                this.dom.verseList.innerHTML = `
                    <div class="empty-state">
                        <ion-icon name="search-outline" class="empty-icon"></ion-icon>
                        <p>'${query}'에 대한 검색 결과가 없습니다</p>
                    </div>`;
                return;
            }

            this.dom.verseList.innerHTML = `
                <div class="search-info">'${query}' — ${results.length}건 발견</div>
                ${results.map(res => `
                    <div class="verse-item">
                        <input type="checkbox" class="verse-item-check"
                               data-text="${this.escapeHtml(res.text)}"
                               data-ref="${res.book} ${res.chapter}:${res.verse}"
                               ${this.isVerseSelected(res.book, res.chapter, res.verse) ? 'checked' : ''}
                               onchange="window.app.toggleVerseSelection(this)">
                        <div class="verse-item-content">
                            <span class="verse-ref">${res.book} ${res.chapter}:${res.verse}</span>
                            <p class="verse-text">${res.text}</p>
                        </div>
                    </div>
                `).join('')}`;
        }, 50);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    renderVerses() {
        const book = this.dom.bookSelect.value;
        const chap = this.dom.chapterSelect.value;
        const key = `${book}-${chap}`;
        const verses = ALL_VERSES[key];

        if (!verses) {
            this.dom.verseList.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="book-outline" class="empty-icon"></ion-icon>
                    <p>준비 중인 성경 구절입니다</p>
                </div>`;
            return;
        }

        this.dom.verseList.innerHTML = verses.map((text, idx) => `
            <div class="verse-item">
                <input type="checkbox" class="verse-item-check"
                       data-text="${this.escapeHtml(text)}"
                       data-ref="${book} ${chap}:${idx + 1}"
                       ${this.isVerseSelected(book, chap, idx + 1) ? 'checked' : ''}
                       onchange="window.app.toggleVerseSelection(this)">
                <div class="verse-item-content">
                    <span class="verse-ref">${book} ${chap}:${idx + 1}</span>
                    <p class="verse-text">${text}</p>
                </div>
            </div>
        `).join('');
    }

    isVerseSelected(book, chap, num) {
        return this.currentNote.verses.some(v => v.ref === `${book} ${chap}:${num}`);
    }

    toggleVerseSelection(checkbox) {
        const ref = checkbox.dataset.ref;
        const text = checkbox.dataset.text;

        if (checkbox.checked) {
            if (!this.currentNote.verses.find(v => v.ref === ref)) {
                this.currentNote.verses.push({ ref, text });
            }
        } else {
            this.currentNote.verses = this.currentNote.verses.filter(v => v.ref !== ref);
        }

        this.updatePushButton();
        this.updateIntegratedVerses();
        this.triggerAutoSave();
    }

    updatePushButton() {
        const count = this.currentNote.verses.length;
        if (count > 0) {
            this.dom.pushToNoteBtn.style.display = 'flex';
            this.dom.pushCount.textContent = count;
        } else {
            this.dom.pushToNoteBtn.style.display = 'none';
        }
    }

    handlePushToNote() {
        if (this.currentNote.verses.length === 0) {
            alert('먼저 성경 구절을 체크해주세요.');
            return;
        }

        const verseText = this.currentNote.verses.map(v =>
            `<p><strong>[${v.ref}]</strong> ${v.text}</p>`
        ).join('');

        const editor = this.dom.noteMemo;
        editor.innerHTML = editor.innerHTML + verseText;

        // Switch to note tab
        this.switchTab('tab-note');

        this.triggerAutoSave();
        editor.scrollTop = editor.scrollHeight;
        editor.focus();
    }

    // ─── Recording ───

    toggleRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome/Edge 권장)');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
            this.dom.recordBtn.classList.remove('recording-active');
            this.dom.recordBtn.innerHTML = '<ion-icon name="mic-outline"></ion-icon>';
        } else {
            if (!this.recognition) {
                this.recognition = new SpeechRecognition();
                this.recognition.lang = 'ko-KR';
                this.recognition.continuous = true;
                this.recognition.interimResults = true;

                this.recognition.onresult = (event) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        const p = document.createElement('div');
                        p.textContent = finalTranscript;
                        this.dom.noteMemo.appendChild(p);
                        this.dom.noteMemo.scrollTop = this.dom.noteMemo.scrollHeight;
                        this.triggerAutoSave();
                    }
                };

                this.recognition.onerror = () => {
                    this.stopRecordingUI();
                };
            }

            this.recognition.start();
            this.isRecording = true;
            this.dom.recordBtn.classList.add('recording-active');
            this.dom.recordBtn.innerHTML = '<ion-icon name="mic"></ion-icon>';
        }
    }

    stopRecordingUI() {
        this.isRecording = false;
        this.dom.recordBtn.classList.remove('recording-active');
        this.dom.recordBtn.innerHTML = '<ion-icon name="mic-outline"></ion-icon>';
    }

    // ─── Bookmark & Highlight ───

    toggleBookmark() {
        this.currentNote.isBookmarked = !this.currentNote.isBookmarked;
        this.applyBookmarkUI();
        this.triggerAutoSave();
    }

    applyBookmarkUI() {
        if (this.currentNote.isBookmarked) {
            this.dom.bookmarkBtn.classList.add('active');
            this.dom.bookmarkBtn.innerHTML = '<ion-icon name="bookmark"></ion-icon>';
            this.dom.bookmarkBtn.style.background = '#fff3cd';
            this.dom.bookmarkBtn.style.color = '#d4a617';
        } else {
            this.dom.bookmarkBtn.classList.remove('active');
            this.dom.bookmarkBtn.innerHTML = '<ion-icon name="bookmark-outline"></ion-icon>';
            this.dom.bookmarkBtn.style.background = '';
            this.dom.bookmarkBtn.style.color = '';
        }
    }

    applyHighlight() {
        document.execCommand('backColor', false, '#fff59d');
        this.triggerAutoSave();
    }

    // ─── AI Summary ───

    handleAISummary() {
        const content = this.dom.noteMemo.innerText;
        if (content.length < 10) {
            alert('요약할 내용이 부족합니다. 좀 더 메모를 작성해주세요.');
            return;
        }

        this.dom.aiSummaryBtn.disabled = true;
        this.dom.aiSummaryBtn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon>';

        setTimeout(() => {
            const summary = this.generateAISummary(content);
            this.dom.summaryResult.innerHTML = summary;
            this.dom.aiModal.classList.add('active');

            this.dom.aiSummaryBtn.disabled = false;
            this.dom.aiSummaryBtn.innerHTML = '<ion-icon name="sparkles-outline"></ion-icon><span>AI</span>';
        }, 1500);
    }

    generateAISummary(text) {
        const theme = this.dom.themeInput.value || '오늘의 말씀';
        const lines = text.split('\n').filter(l => l.trim());
        const verses = lines.filter(l => l.startsWith('['));
        const thoughts = lines.filter(l => !l.startsWith('['));

        return `
            <h4>📖 주제: ${theme}</h4>
            <p><strong>[핵심 요약]</strong><br>본 설교/묵상은 <em>${theme}</em>에 관한 깊은 통찰을 다루고 있습니다.</p>
            
            <h4>📜 주요 말씀</h4>
            <ul>
                ${verses.map(v => `<li>${v}</li>`).join('') || '<li>선택된 말씀이 없습니다.</li>'}
            </ul>

            <h4>💡 묵상 포인트</h4>
            <p>${thoughts.slice(0, 3).join('<br>') || '작성된 메모가 없습니다.'}</p>
            
            <h4>🙏 실천 과제</h4>
            <p>${theme}의 은혜를 기억하며 일주일간 실천할 구체적인 계획을 세워보세요.</p>
        `;
    }

    // ─── Share & Export ───

    handleExportToLM() {
        const fullContent = `
날짜: ${this.dom.dateInput.value}
주제: ${this.dom.themeInput.value}
카테고리: ${this.dom.categorySelect.value}

[성경 말씀 및 메모]
${this.dom.noteMemo.innerText}

---
Generated by 하맘 성경노트 Pro
        `.trim();

        this.copyToClipboard(fullContent, 'NotebookLM 연동용 내용이 복사되었습니다.');
    }

    handleShare() {
        const theme = this.dom.themeInput.value || '성경노트';
        const content = `[${theme}]\n\n${this.dom.noteMemo.innerText}\n\n— 하맘 성경노트 Pro`;

        if (navigator.share) {
            navigator.share({
                title: '하맘 성경노트 Pro',
                text: content
            }).catch(console.error);
        } else {
            this.copyToClipboard(content, '내용이 복사되었습니다.');
        }
    }

    copyToClipboard(text, msg) {
        navigator.clipboard.writeText(text).then(() => alert(msg));
    }

    // ─── Integrated Verses Display ───

    updateIntegratedVerses() {
        const container = this.dom.selectedVerses;
        const count = this.currentNote.verses.length;
        this.dom.verseCountBadge.textContent = count;

        if (count === 0) {
            container.innerHTML = '<p class="empty-hint">성경에서 체크한 구절이 여기에 추가됩니다</p>';
            return;
        }

        container.innerHTML = this.currentNote.verses.map(v => `
            <div class="selected-verse-chip">
                <div>
                    <strong>${v.ref}</strong>
                    <p>${v.text}</p>
                </div>
                <button onclick="window.app.removeVerse('${v.ref}')">
                    <ion-icon name="close-circle"></ion-icon>
                </button>
            </div>
        `).join('');
    }

    removeVerse(ref) {
        this.currentNote.verses = this.currentNote.verses.filter(v => v.ref !== ref);
        this.updateIntegratedVerses();
        this.updatePushButton();
        this.renderVerses();
        this.triggerAutoSave();
    }

    // ─── Data Persistence ───

    loadNoteByDate(date) {
        this.editingDate = date;
        const key = `note_${date}`;

        if (this.notes[key]) {
            this.currentNote = { ...this.notes[key] };
        } else {
            this.currentNote = {
                id: Date.now(),
                date: date,
                theme: '',
                category: 'sermon',
                verses: [],
                memo: '',
                isBookmarked: false
            };
        }

        this.applyCurrentNoteToUI();
        this.applyBookmarkUI();
        this.updatePushButton();
        this.renderNotesSummary(date);
    }

    applyCurrentNoteToUI() {
        this.dom.dateInput.value = this.currentNote.date;
        this.dom.themeInput.value = this.currentNote.theme;
        this.dom.categorySelect.value = this.currentNote.category;
        this.dom.noteMemo.innerHTML = this.currentNote.memo;
        this.updateIntegratedVerses();
        this.renderVerses();
    }

    triggerAutoSave() {
        this.dom.autoSaveIndicator.classList.add('active');

        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveNote();
        }, 1500);
    }

    saveNote(manual = false) {
        this.currentNote.date = this.dom.dateInput.value;
        this.currentNote.theme = this.dom.themeInput.value;
        this.currentNote.category = this.dom.categorySelect.value;
        this.currentNote.memo = this.dom.noteMemo.innerHTML;

        const key = `note_${this.currentNote.date}`;
        this.notes[key] = { ...this.currentNote };
        localStorage.setItem('bible_notes', JSON.stringify(this.notes));

        this.dom.autoSaveIndicator.classList.remove('active');

        this.renderCalendar();
        this.renderNotesSummary(this.currentNote.date);

        if (manual) {
            // Subtle save confirmation
            this.dom.saveBtn.innerHTML = '<ion-icon name="checkmark-done"></ion-icon>';
            this.dom.saveBtn.style.background = '#34c759';
            setTimeout(() => {
                this.dom.saveBtn.innerHTML = '<ion-icon name="checkmark-circle"></ion-icon>';
                this.dom.saveBtn.style.background = '';
            }, 1500);
        }
    }

    // ─── Calendar UI ───

    renderCalendar() {
        const today = new Date(this.editingDate || this.currentNote.date);
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = '<div class="cal-grid">';
        ['일', '월', '화', '수', '목', '금', '토'].forEach(d => {
            html += `<div class="cal-day-header">${d}</div>`;
        });

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-cell empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isActive = dateStr === this.editingDate;

            const noteKey = `note_${dateStr}`;
            const note = this.notes[noteKey];

            html += `
                <div class="cal-cell ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}"
                     onclick="window.app.selectCalendarDate('${dateStr}')">
                    <span>${day}</span>
                    ${note ? `<div class="cal-notes-indicator"><span class="dot-sm ${note.category}"></span></div>` : ''}
                </div>`;
        }

        html += '</div>';

        this.dom.calendarWidget.innerHTML = `
            <div class="cal-month-title">${year}년 ${month + 1}월</div>
            ${html}
        `;
    }

    selectCalendarDate(dateStr) {
        this.dom.dateInput.value = dateStr;
        this.loadNoteByDate(dateStr);
        this.renderCalendar();
    }

    renderNotesSummary(date) {
        const key = `note_${date}`;
        const note = this.notes[key];

        if (!note || (note.theme === '' && note.memo === '' && note.verses.length === 0)) {
            this.dom.notesOnDate.innerHTML = `
                <div class="empty-state small">
                    <ion-icon name="document-text-outline"></ion-icon>
                    <p>해당 날짜에 기록된 내용이 없습니다</p>
                </div>`;
            return;
        }

        const catLabels = { sermon: '설교', faith: '신앙', prayer: '기도' };
        const memoPreview = note.memo.replace(/<[^>]*>/g, '').substring(0, 60);

        this.dom.notesOnDate.innerHTML = `
            <div class="note-summary-item ${note.category}" onclick="window.app.openNoteFromCalendar('${date}')">
                <h4>
                    ${note.isBookmarked ? '🔖 ' : ''}
                    [${catLabels[note.category]}] ${note.theme || '주제 없음'}
                </h4>
                <p>${memoPreview}${memoPreview.length >= 60 ? '...' : ''}</p>
                <small>${note.verses.length}개의 말씀 인용</small>
            </div>
        `;
    }

    openNoteFromCalendar(date) {
        this.loadNoteByDate(date);
        this.switchTab('tab-note');
    }
}

// ─── Global Hook ───
window.app = new NoteApp();

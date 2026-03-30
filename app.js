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
let ALL_VERSES_NIV = {};
let ALL_VERSES_EASY = {};
let ALL_STORY_DATA = [];
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
        this.currentTranslation = 'kr';

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

        const [booksRes, versesRes, nivRes, easyRes, storyRes] = await Promise.all([
            fetch('bible_books.json'),
            fetch('bible_verses.json'),
            fetch('bible_verses_niv.json'),
            fetch('bible_verses_easy.json'),
            fetch('bible_story.json').catch(() => null)
        ]);

        BIBLE_BOOKS = await booksRes.json();
        ALL_VERSES = await versesRes.json();
        ALL_VERSES_NIV = await nivRes.json();
        ALL_VERSES_EASY = await easyRes.json();
        if (storyRes) ALL_STORY_DATA = await storyRes.json();
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
            bibleFabContainer: document.getElementById('bible-fab-container'),
            pushToNoteBtn: document.getElementById('push-to-note-btn'),
            pushCount: document.getElementById('push-count'),
            bibleHighlightBtn: document.getElementById('bible-highlight-btn'),
            bibleShareBtn: document.getElementById('bible-share-btn'),

            // Note Editor
            selectedVerses: document.getElementById('selected-verses'),
            noteMemo: document.getElementById('note-memo'),
            saveBtn: document.getElementById('save-btn'),
            recordBtn: document.getElementById('record-btn'),
            ttsBtn: document.getElementById('tts-btn'),
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
            contentArea: document.getElementById('content-area'),

            // Version Selector
            translationRadios: document.getElementsByName('translation')
        };

        this.dom.dateInput.value = this.currentNote.date;
    }

    registerEvents() {
        // Bible Selection
        this.dom.bookSelect.onchange = () => this.handleBookChange();
        this.dom.chapterSelect.onchange = () => this.renderVerses();
        this.dom.searchBtn.onclick = () => this.handleSearch();
        this.dom.bibleSearch.onkeypress = (e) => (e.key === 'Enter') && this.handleSearch();

        // Translation Selector
        this.dom.translationRadios.forEach(radio => {
            radio.onchange = () => {
                this.currentTranslation = radio.value;
                if (this.dom.chapterSelect.value) {
                    this.renderVerses();
                } else if (this.dom.bibleSearch.value) {
                    this.handleSearch();
                }
            };
        });

        // Note Metadata
        ['dateInput', 'themeInput', 'categorySelect'].forEach(el => {
            this.dom[el].oninput = () => this.triggerAutoSave();
        });

        this.dom.noteMemo.oninput = () => this.triggerAutoSave();

        this.dom.dateInput.onchange = () => {
            this.loadNoteByDate(this.dom.dateInput.value);
            this.triggerAutoSave();
        };

        // Save & Push
        this.dom.saveBtn.onclick = () => this.saveNote(true);
        this.dom.pushToNoteBtn.onclick = () => this.handlePushToNote();
        
        // Bible FAB Secondary Actions
        this.dom.bibleHighlightBtn.onclick = () => {
            this.handlePushToNote();
            setTimeout(() => this.applyHighlight(), 300);
        };
        this.dom.bibleShareBtn.onclick = () => this.handleShare();

        // Tools
        this.dom.recordBtn.onclick = () => this.toggleRecording();
        this.dom.ttsBtn.onclick = () => this.toggleTTS();
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

        // Stop TTS if switching away from note
        if (tabId !== 'tab-note') this.stopTTS();

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
                const nivVerses = ALL_VERSES_NIV[key] || [];
                const easyVerses = ALL_VERSES_EASY[key] || [];

                verses.forEach((text, idx) => {
                    if (count >= MAX_RESULTS) return;
                    const nivText = nivVerses[idx] || '';
                    const easyText = easyVerses[idx] || '';
                    const matchKr = text.includes(query);
                    const matchNiv = nivText.toLowerCase().includes(query.toLowerCase());
                    const matchEasy = easyText.includes(query);

                    if (matchKr || matchNiv || matchEasy) {
                        results.push({ 
                            book: bookName, 
                            chapter, 
                            verse: idx + 1, 
                            text, 
                            nivText,
                            easyText
                        });
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
                ${results.map(res => {
                    const isSelected = this.isVerseSelected(res.book, res.chapter, res.verse);
                    let displayContent = '';
                    
                    if (this.currentTranslation === 'kr') {
                        displayContent = `<p class="verse-text">${res.text}</p>`;
                    } else if (this.currentTranslation === 'niv') {
                        displayContent = `<p class="verse-text niv">${res.nivText || 'N/A'}</p>`;
                    } else if (this.currentTranslation === 'easy') {
                        displayContent = `<p class="verse-text easy">${res.easyText || 'N/A'}</p>`;
                    } else {
                        displayContent = `
                            <p class="verse-text">${res.text}</p>
                            <p class="verse-text niv">${res.nivText || 'N/A'}</p>
                        `;
                    }

                    return `
                    <label class="verse-item ${isSelected ? 'selected' : ''}">
                        <input type="checkbox" class="verse-item-check"
                               data-text="${this.escapeHtml(res.text)}"
                               data-niv="${this.escapeHtml(res.nivText || '')}"
                               data-ref="${res.book} ${res.chapter}:${res.verse}"
                               ${isSelected ? 'checked' : ''}
                               onchange="window.app.toggleVerseSelection(this)">
                        <div class="verse-item-content">
                            <span class="verse-ref">${res.book} ${res.chapter}:${res.verse}</span>
                            ${displayContent}
                        </div>
                    </label>
                    `;
                }).join('')}`;
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
        const nivVerses = ALL_VERSES_NIV[key] || [];

        if (!verses) {
            this.dom.verseList.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="book-outline" class="empty-icon"></ion-icon>
                    <p>준비 중인 성경 구절입니다</p>
                </div>`;
            return;
        }

        this.dom.verseList.innerHTML = verses.map((text, idx) => {
            const isSelected = this.isVerseSelected(book, chap, idx + 1);
            const nivText = nivVerses[idx] || '';
            const easyText = (ALL_VERSES_EASY[key] || [])[idx] || '';
            let displayContent = '';

            if (this.currentTranslation === 'kr') {
                displayContent = `<p class="verse-text">${text}</p>`;
            } else if (this.currentTranslation === 'niv') {
                displayContent = `<p class="verse-text niv">${nivText}</p>`;
            } else if (this.currentTranslation === 'easy') {
                displayContent = `<p class="verse-text easy">${easyText}</p>`;
            } else if (this.currentTranslation === 'story') {
                // If story mode, we show stories related to this chapter if possible
                // For now, let's just show a hint or a list of stories from the book
                this.renderStoryList(book);
                return;
            } else {
                displayContent = `
                    <p class="verse-text">${text}</p>
                    <p class="verse-text niv">${nivText}</p>
                `;
            }

            return `
            <label class="verse-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox" class="verse-item-check"
                       data-text="${this.escapeHtml(text)}"
                       data-niv="${this.escapeHtml(nivText)}"
                       data-ref="${book} ${chap}:${idx + 1}"
                       ${isSelected ? 'checked' : ''}
                       onchange="window.app.toggleVerseSelection(this)">
                <div class="verse-item-content">
                    <span class="verse-ref">${book} ${chap}:${idx + 1}</span>
                    ${displayContent}
                </div>
            </label>
        `;
        }).join('');
    }

    renderStoryList(bookName) {
        if (!ALL_STORY_DATA.length) {
            this.dom.verseList.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="cloud-offline-outline" class="empty-icon"></ion-icon>
                    <p>이야기 데이터를 불러올 수 없습니다</p>
                </div>`;
            return;
        }

        // Filter stories by current book (simple keyword matching for now)
        // Since we don't have metadata, let's just show relevant ones or allow search
        const stories = ALL_STORY_DATA.filter(s => s.text.includes(bookName) || s.title.includes(bookName));
        
        if (stories.length === 0) {
            // If no match, show all stories (searchable)
            this.renderAllStories();
            return;
        }

        this.dom.verseList.innerHTML = `
            <div class="search-info">'${bookName}' 이야기 — ${stories.length}건</div>
            ${this.buildStoryCards(stories)}
        `;
    }

    renderAllStories() {
        this.dom.verseList.innerHTML = `
            <div class="search-info">전체 이야기 — ${ALL_STORY_DATA.length}건</div>
            ${this.buildStoryCards(ALL_STORY_DATA.slice(0, 100))}
            <div class="empty-hint">상단 검색창을 통해 더 많은 이야기를 찾아보세요</div>
        `;
    }

    buildStoryCards(stories) {
        return stories.map(story => `
            <div class="story-card" onclick="this.classList.toggle('expanded')">
                <div class="story-header">
                    <span class="story-title-badge">이야기</span>
                    <h3 class="story-title">${story.title}</h3>
                    <ion-icon name="chevron-down-outline" class="story-chevron"></ion-icon>
                </div>
                <div class="story-body">
                    <p class="story-text">${story.text}</p>
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
        const nivText = checkbox.dataset.niv;
        const parent = checkbox.closest('.verse-item');

        if (checkbox.checked) {
            if (!this.currentNote.verses.find(v => v.ref === ref)) {
                this.currentNote.verses.push({ ref, text, nivText });
            }
            if (parent) parent.classList.add('selected');
        } else {
            this.currentNote.verses = this.currentNote.verses.filter(v => v.ref !== ref);
            if (parent) parent.classList.remove('selected');
        }

        this.updatePushButton();
        this.updateIntegratedVerses();
        this.triggerAutoSave();
    }

    updatePushButton() {
        const count = this.currentNote.verses.length;
        if (count > 0) {
            this.dom.bibleFabContainer.style.display = 'flex';
            this.dom.pushCount.textContent = count;
        } else {
            this.dom.bibleFabContainer.style.display = 'none';
        }
    }

    handlePushToNote() {
        if (this.currentNote.verses.length === 0) {
            alert('먼저 성경 구절을 체크해주세요.');
            return;
        }

        const currentMemo = this.dom.noteMemo.innerHTML.trim();
        const verseHtml = this.currentNote.verses.map(v => {
            let content = `<strong>[${v.ref}]</strong> ${v.text}`;
            if (v.nivText) {
                content += `<br><span style="color: #666; font-size: 0.9em;">(NIV) ${v.nivText}</span>`;
            }
            return `<p>${content}</p>`;
        }).join('');

        // Append text with break for next typing
        const newHtml = (currentMemo ? currentMemo + '<br>' : '') + verseHtml + '<p><br></p>';
        
        this.dom.noteMemo.innerHTML = newHtml;

        // Switch to note tab
        this.switchTab('tab-note');

        this.triggerAutoSave();
        
        // Focus and scroll
        setTimeout(() => {
            this.dom.noteMemo.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(this.dom.noteMemo);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            this.dom.noteMemo.scrollTop = this.dom.noteMemo.scrollHeight;
        }, 100);
    }

    // ─── Recording & TTS ───

    toggleRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome/Edge 권장)');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
            this.stopRecordingUI();
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
                        const p = document.createElement('p');
                        p.textContent = finalTranscript;
                        this.dom.noteMemo.appendChild(p);
                        this.dom.noteMemo.scrollTop = this.dom.noteMemo.scrollHeight;
                        this.triggerAutoSave();
                    }
                };

                this.recognition.onerror = () => this.stopRecordingUI();
                this.recognition.onend = () => this.stopRecordingUI();
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

    toggleTTS() {
        if (window.speechSynthesis.speaking) {
            this.stopTTS();
        } else {
            const text = this.dom.noteMemo.innerText;
            if (!text.trim()) {
                alert('읽어드릴 텍스트가 없습니다.');
                return;
            }
            this.speakText(text);
        }
    }

    speakText(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        
        utterance.onstart = () => {
            this.dom.ttsBtn.classList.add('active');
            this.dom.ttsBtn.innerHTML = '<ion-icon name="pause-circle-outline"></ion-icon>';
        };
        
        utterance.onend = () => this.stopTTS();
        utterance.onerror = () => this.stopTTS();

        window.speechSynthesis.speak(utterance);
    }

    stopTTS() {
        window.speechSynthesis.cancel();
        this.dom.ttsBtn.classList.remove('active');
        this.dom.ttsBtn.innerHTML = '<ion-icon name="volume-high-outline"></ion-icon>';
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
        const content = this.dom.noteMemo.innerText.trim();
        if (content.length < 5) {
            alert('요약할 내용이 부족합니다. 말씀을 체크하거나 메모를 작성해주세요.');
            return;
        }

        this.dom.aiSummaryBtn.disabled = true;
        this.dom.aiSummaryBtn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon>';

        setTimeout(() => {
            const summary = this.generateAISummary(content);
            this.dom.summaryResult.innerHTML = summary;
            this.dom.aiModal.classList.add('active');

            this.dom.aiSummaryBtn.disabled = false;
            this.dom.aiSummaryBtn.innerHTML = '<ion-icon name="sparkles-outline"></ion-icon><span>AI 요약</span>';
        }, 2000);
    }

    generateAISummary(text) {
        const theme = this.dom.themeInput.value || '하나님의 말씀';
        const lines = text.split('\n').filter(l => l.trim());
        const verses = lines.filter(l => l.startsWith('['));
        
        return `
            <div class="pastor-intro">
                <p>📖 <strong>목회적 영적 통찰</strong></p>
                <p style="font-size: 0.9em; color: #666;">건전한 복음주의 신학의 관점에서 본 성경 노트를 요약해 드립니다.</p>
            </div>
            
            <h4>🕊️ 오늘 선포된 진리: ${theme}</h4>
            <p><strong>[신학적 핵심]</strong><br>본 본문은 <em>${theme}</em>의 핵심 가치를 복음의 정수로 조명하고 있습니다. 우리는 이 말씀을 통해 하나님의 주권과 우리를 향한 그분의 신실하신 사랑을 재확인해야 합니다.</p>
            
            <h4>📜 성경적 근거 (Key Verses)</h4>
            <ul>
                ${verses.map(v => `<li>${v}</li>`).join('') || '<li>선포된 말씀을 다시 묵상하십시오.</li>'}
            </ul>

            <h4>💡 영적 적용 및 포인트</h4>
            <p>1. <strong>그리스도 중심적 삶</strong>: 기록된 내용은 우리 삶의 목적이 오직 그리스도께 있음을 가르칩니다.</p>
            <p>2. <strong>성도의 거룩한 소명</strong>: 말씀을 통해 깨달은 은혜를 삶의 현장에서 드러내는 것이 우리의 증인된 삶입니다.</p>
            
            <h4>🙏 기도의 고백과 실천</h4>
            <p>하나님, 오늘 ${theme}의 말씀을 통해 깨닫게 하시니 감사합니다. 이 진리가 제 심령 골수 속까지 스며들어, 세상 속에서도 그리스도의 향기를 풍기는 복음의 사람으로 살게 하소서. 아멘.</p>
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
Generated by 하맘 성경노트 PRO
        `.trim();

        this.copyToClipboard(fullContent, 'NotebookLM 연동용 내용이 복사되었습니다.');
    }

    handleShare() {
        const theme = this.dom.themeInput.value || '성경노트';
        const content = `[${theme}]\n\n${this.dom.noteMemo.innerText}\n\n— 하맘 성경노트 PRO (하맘컨텐츠)`;

        if (navigator.share) {
            navigator.share({
                title: '하맘 성경노트 PRO',
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
                    ${v.nivText ? `<p style="font-size: 0.85em; color: #888; margin-top: 2px;">${v.nivText}</p>` : ''}
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
        if (this.dom.autoSaveIndicator) 
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

        if (this.dom.autoSaveIndicator)
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
        const memoPlain = note.memo.replace(/<[^>]*>/g, '').trim();
        const memoPreview = memoPlain.substring(0, 60);

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

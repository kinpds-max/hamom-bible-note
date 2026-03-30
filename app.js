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
        this.highlights = JSON.parse(localStorage.getItem('bible_highlights') || '[]');
        this.recitations = JSON.parse(localStorage.getItem('bible_recitings') || '[]');

        this.init();
    }

    async init() {
        this.initDOM();
        this.registerEvents();
        this.initTabBar();
        this.initAccordion();
        this.initMenuSheet();
        this.initDragSelection();

        this.renderHighlights();
        this.renderRecitations();

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
        
        this.dom.bibleTTSBtn.onclick = () => this.speakSelectedVerses();
        this.dom.bibleShareBtn.onclick = () => this.shareSelectedVerses();
        this.dom.bibleHighlightBtn.onclick = () => this.highlightSelectedVerses();
        this.dom.bibleReciteBtn.onclick = () => this.markForRecitation();
        
        document.body.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        }, { once: true });
    }

    initDOM() {
        this.dom = {
            dateInput: document.getElementById('note-date'),
            themeInput: document.getElementById('note-theme'),
            preacherInput: document.getElementById('note-preacher'),
            categorySelect: document.getElementById('note-category'),
            autoSaveIndicator: document.getElementById('auto-save-indicator'),

            bibleSearch: document.getElementById('bible-search'),
            searchBtn: document.getElementById('search-btn'),
            bookSelect: document.getElementById('book-select'),
            chapterSelect: document.getElementById('chapter-select'),
            verseList: document.getElementById('verse-list'),
            bibleFabContainer: document.getElementById('bible-fab-container'),
            pushToNoteBtn: document.getElementById('push-to-note-btn'),
            pushCount: document.getElementById('push-count'),
            bibleTTSBtn: document.getElementById('bible-tts-btn'),
            bibleShareBtn: document.getElementById('bible-share-btn'),
            bibleHighlightBtn: document.getElementById('bible-highlight-btn'),
            bibleReciteBtn: document.getElementById('bible-recite-btn'),

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

            calendarWidget: document.getElementById('calendar-widget'),
            notesOnDate: document.getElementById('notes-on-date'),

            aiModal: document.getElementById('ai-modal'),
            closeModal: document.getElementById('close-modal'),
            summaryResult: document.getElementById('summary-result'),
            copySummaryBtn: document.getElementById('copy-summary-btn'),

            menuBtn: document.getElementById('menu-btn'),
            menuOverlay: document.getElementById('menu-overlay'),
            menuCloseBtn: document.getElementById('menu-close-btn'),
            shareNoteBtn: document.getElementById('share-note-btn'),
            exportNotebookBtn: document.getElementById('export-notebook-btn'),

            tabBar: document.getElementById('tab-bar'),
            contentArea: document.getElementById('content-area'),

            translationRadios: document.getElementsByName('translation')
        };

        this.dom.dateInput.value = this.currentNote.date;
    }

    registerEvents() {
        this.dom.bookSelect.onchange = () => this.handleBookChange();
        this.dom.chapterSelect.onchange = () => this.renderVerses();
        this.dom.searchBtn.onclick = () => this.handleSearch();
        this.dom.bibleSearch.onkeypress = (e) => (e.key === 'Enter') && this.handleSearch();

        this.dom.translationRadios.forEach(radio => {
            radio.onchange = () => {
                this.currentTranslation = radio.value;
                const togetherPanel = document.getElementById('together-settings');
                if (togetherPanel) {
                    togetherPanel.style.display = this.currentTranslation === 'both' ? 'flex' : 'none';
                }
                if (this.dom.bookSelect.value) this.handleBookChange();
                if (this.dom.chapterSelect.value) this.renderVerses();
                else if (this.dom.bibleSearch.value) this.handleSearch();
            };
        });

        document.querySelectorAll('#together-settings input[type="checkbox"]').forEach(ck => {
            ck.onchange = () => this.renderVerses();
        });

        ['dateInput', 'themeInput', 'preacherInput', 'categorySelect'].forEach(el => {
            if (this.dom[el]) this.dom[el].oninput = () => this.triggerAutoSave();
        });

        this.dom.noteMemo.oninput = () => this.triggerAutoSave();
        this.dom.dateInput.onchange = () => {
            this.loadNoteByDate(this.dom.dateInput.value);
            this.triggerAutoSave();
        };

        this.dom.saveBtn.onclick = () => this.saveNote(true);
        this.dom.pushToNoteBtn.onclick = () => this.handlePushToNote();
        
        this.dom.recordBtn.onclick = () => this.toggleRecording();
        this.dom.ttsBtn.onclick = () => this.toggleTTS();
        this.dom.bookmarkBtn.onclick = () => this.toggleBookmark();
        this.dom.highlightBtn.onclick = () => this.applyHighlight();
        this.dom.aiSummaryBtn.onclick = () => this.handleAISummary();

        this.dom.closeModal.onclick = () => this.dom.aiModal.classList.remove('active');
        this.dom.copySummaryBtn.onclick = () => this.copyToClipboard(this.dom.summaryResult.innerText, '요약 내용이 복사되었습니다.');

        if (this.dom.shareNoteBtn) this.dom.shareNoteBtn.onclick = () => { this.closeMenu(); this.handleShare(); };
        if (this.dom.exportNotebookBtn) this.dom.exportNotebookBtn.onclick = () => { this.closeMenu(); this.handleExportToLM(); };
    }

    initTabBar() {
        const tabs = this.dom.tabBar.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        this.dom.tabBar.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
        if (tabId !== 'tab-note') this.stopTTS();
        if (navigator.vibrate) navigator.vibrate(10);
    }

    initAccordion() {
        this.dom.versesToggle.onclick = () => {
            this.versesAccordionOpen = !this.versesAccordionOpen;
            this.dom.versesAccordion.classList.toggle('open', this.versesAccordionOpen);
        };
        this.dom.versesAccordion.classList.add('open');
    }

    initMenuSheet() {
        this.dom.menuBtn.onclick = () => this.openMenu();
        this.dom.menuCloseBtn.onclick = () => this.closeMenu();
        this.dom.menuOverlay.onclick = (e) => { if (e.target === this.dom.menuOverlay) this.closeMenu(); };
    }

    initDragSelection() {
        let isDragging = false;
        let dragMode = null;

        const container = this.dom.verseList;

        const onMove = (target) => {
            if (!isDragging) return;
            const verseItem = target?.closest('.verse-item');
            if (verseItem) {
                const cb = verseItem.querySelector('.verse-item-check');
                if (cb && cb.checked !== dragMode) {
                    cb.checked = dragMode;
                    this.toggleVerseSelection(cb);
                }
            }
        };

        container.addEventListener('mousedown', (e) => {
            const verseItem = e.target.closest('.verse-item');
            if (verseItem) {
                isDragging = true;
                const cb = verseItem.querySelector('.verse-item-check');
                dragMode = !cb.checked;
            }
        }, { passive: true });

        container.addEventListener('mouseover', (e) => onMove(e.target));
        document.addEventListener('mouseup', () => { isDragging = false; });

        container.addEventListener('touchstart', (e) => {
            const verseItem = e.target.closest('.verse-item');
            if (verseItem) {
                isDragging = true;
                const cb = verseItem.querySelector('.verse-item-check');
                dragMode = !cb.checked;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            onMove(el);
        }, { passive: true });

        document.addEventListener('touchend', () => { isDragging = false; });
    }

    openMenu() { this.dom.menuOverlay.classList.add('active'); }
    closeMenu() { this.dom.menuOverlay.classList.remove('active'); }

    handleBookChange() {
        const bookName = this.dom.bookSelect.value;
        const book = BIBLE_BOOKS.find(b => b.name === bookName);
        
        if (this.currentTranslation === 'story') {
            this.dom.chapterSelect.innerHTML = '<option value="">이야기 선택</option>';
            const stories = ALL_STORY_DATA.filter(s => s.book === bookName);
            stories.forEach((s, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `<${s.title}>`;
                this.dom.chapterSelect.appendChild(opt);
            });
        } else {
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
    }

    handleSearch() {
        const query = this.dom.bibleSearch.value.trim();
        if (query.length < 2) return;

        const results = [];
        for (const key in ALL_VERSES) {
            const verses = ALL_VERSES[key];
            const nivVerses = ALL_VERSES_NIV[key] || [];
            verses.forEach((v, idx) => {
                if (v.includes(query) || (nivVerses[idx] && nivVerses[idx].toLowerCase().includes(query.toLowerCase()))) {
                    results.push({
                        ref: key.replace('-', ' ') + ':' + (idx + 1),
                        text: this.highlightQuery(v, query),
                        niv: nivVerses[idx] ? this.highlightQuery(nivVerses[idx], query) : ''
                    });
                }
            });
        }
        this.renderWordSearchResults(results);
    }

    highlightQuery(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    renderWordSearchResults(results) {
        if (results.length === 0) {
            this.dom.verseList.innerHTML = `<div class="empty-state"><p>검색 결과가 없습니다</p></div>`;
            return;
        }
        this.dom.verseList.innerHTML = results.map(res => `
            <div class="verse-item">
                <div class="verse-item-content">
                    <span class="verse-ref">${res.ref}</span>
                    <p class="verse-text">${res.text}</p>
                    ${res.niv ? `<p class="verse-text niv">${res.niv}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    renderVerses() {
        const book = this.dom.bookSelect.value;
        const chapVal = this.dom.chapterSelect.value;
        const key = `${book}-${chapVal}`;
        
        if (this.currentTranslation === 'story') {
            const stories = ALL_STORY_DATA.filter(s => s.book === book);
            const story = stories[chapVal];
            if (story) {
                this.dom.verseList.innerHTML = `
                    <div class="search-info">📖 이야기: ${book} / ${story.title}</div>
                    <div class="story-card expanded">
                        <div class="story-body" style="max-height: none; opacity: 1; padding: 20px;">
                            <p class="story-text" style="font-size: 1.1rem;">${story.text}</p>
                        </div>
                    </div>`;
            }
            return;
        }

        const verses = ALL_VERSES[key];
        const nivVerses = ALL_VERSES_NIV[key] || [];
        const easyVerses = ALL_VERSES_EASY[key] || [];

        if (!verses) {
            this.dom.verseList.innerHTML = `
                <div class="empty-state">
                    <ion-icon name="book-outline" class="empty-icon"></ion-icon>
                    <p>준비 중인 성경 구절입니다</p>
                </div>`;
            return;
        }

        this.dom.verseList.innerHTML = verses.map((text, idx) => {
            const isSelected = this.isVerseSelected(book, chapVal, idx + 1);
            const nivText = nivVerses[idx] || '';
            const easyText = easyVerses[idx] || '';
            let displayContent = '';

            const selectedVers = Array.from(document.querySelectorAll('#together-settings input:checked')).map(i => i.value);

            if (this.currentTranslation === 'kr') {
                displayContent = `<p class="verse-text">${text}</p>`;
            } else if (this.currentTranslation === 'niv') {
                displayContent = `<p class="verse-text niv">${nivText}</p>`;
            } else if (this.currentTranslation === 'easy') {
                displayContent = `<p class="verse-text easy">${easyText}</p>`;
            } else if (this.currentTranslation === 'both') {
                displayContent = '';
                if (selectedVers.includes('kr')) displayContent += `<p class="verse-text">${text}</p>`;
                if (selectedVers.includes('easy')) displayContent += `<p class="verse-text easy">${easyText}</p>`;
                if (selectedVers.includes('niv')) displayContent += `<p class="verse-text niv">${nivText}</p>`;
            }

            return `
            <label class="verse-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox" class="verse-item-check"
                       data-text="${this.escapeHtml(text)}"
                       data-niv="${this.escapeHtml(nivText)}"
                       data-easy="${this.escapeHtml(easyText)}"
                       data-ref="${book} ${chapVal}:${idx + 1}"
                       ${isSelected ? 'checked' : ''}
                       onchange="window.app.toggleVerseSelection(this)">
                <div class="verse-item-content">
                    <span class="verse-ref">${book} / ${chapVal}:${idx + 1}</span>
                    ${displayContent}
                </div>
            </label>`;
        }).join('');
    }

    isVerseSelected(book, chap, num) {
        return this.currentNote.verses.some(v => v.ref === `${book} ${chap}:${num}`);
    }

    speakSelectedVerses() {
        if (!this.currentNote.verses.length) return;
        const text = this.currentNote.verses.map(v => `${v.ref}. ${v.text}`).join(' ');
        this.speakText(text);
    }

    speakText(text) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        
        utterance.onstart = () => {
            this.dom.ttsBtn.classList.add('active');
        };
        
        utterance.onend = () => this.stopTTS();
        utterance.onerror = () => this.stopTTS();

        window.speechSynthesis.speak(utterance);
    }

    stopTTS() {
        window.speechSynthesis.cancel();
        this.dom.ttsBtn.classList.remove('active');
    }

    shareSelectedVerses() {
        if (!navigator.share || !this.currentNote.verses.length) return;
        const text = this.currentNote.verses.map(v => `[${v.ref}] ${v.text}`).join('\n');
        navigator.share({ title: '오늘의 말씀', text: text }).catch(() => {});
    }

    highlightSelectedVerses() {
        if (!this.currentNote.verses.length) return;
        this.currentNote.verses.forEach(v => {
            if (!this.highlights.some(h => h.ref === v.ref)) {
                this.highlights.push(v);
            }
        });
        localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
        this.renderHighlights();
        alert('선택한 구절에 형광펜이 적용되었습니다.');
        this.currentNote.verses = [];
        this.updatePushButton();
        this.renderVerses();
    }

    markForRecitation() {
        if (!this.currentNote.verses.length) return;
        this.currentNote.verses.forEach(v => {
            if (!this.recitations.some(r => r.ref === v.ref)) {
                this.recitations.push(v);
            }
        });
        localStorage.setItem('bible_recitings', JSON.stringify(this.recitations));
        this.renderRecitations();
        alert('암송 구절로 등록되었습니다.');
        this.currentNote.verses = [];
        this.updatePushButton();
        this.renderVerses();
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

        this.dom.noteMemo.innerHTML = (currentMemo ? currentMemo + '<br>' : '') + verseHtml + '<p><br></p>';
        this.switchTab('tab-note');
        this.triggerAutoSave();
    }

    toggleRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
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
                        this.triggerAutoSave();
                    }
                };

                this.recognition.onerror = () => this.stopRecordingUI();
                this.recognition.onend = () => this.stopRecordingUI();
            }

            this.recognition.start();
            this.isRecording = true;
            this.dom.recordBtn.classList.add('recording-active');
        }
    }

    stopRecordingUI() {
        this.isRecording = false;
        this.dom.recordBtn.classList.remove('recording-active');
    }

    toggleTTS() {
        if (window.speechSynthesis.speaking) {
            this.stopTTS();
        } else {
            const text = this.dom.noteMemo.textContent;
            if (!text.trim()) {
                alert('읽어드릴 텍스트가 없습니다.');
                return;
            }
            this.speakText(text);
        }
    }

    toggleBookmark() {
        this.currentNote.isBookmarked = !this.currentNote.isBookmarked;
        this.applyBookmarkUI();
        this.triggerAutoSave();
    }

    applyBookmarkUI() {
        const icon = this.dom.bookmarkBtn.querySelector('ion-icon');
        if (this.currentNote.isBookmarked) {
            this.dom.bookmarkBtn.classList.add('active');
            if (icon) icon.setAttribute('name', 'bookmark');
        } else {
            this.dom.bookmarkBtn.classList.remove('active');
            if (icon) icon.setAttribute('name', 'bookmark-outline');
        }
    }

    applyHighlight() {
        document.execCommand('backColor', false, '#fff59d');
        this.triggerAutoSave();
    }

    handleAISummary() {
        const content = this.dom.noteMemo.textContent.trim();
        if (content.length < 5) {
            alert('요약할 내용이 부족합니다.');
            return;
        }
        
        this.dom.aiSummaryBtn.disabled = true;
        this.dom.summaryResult.innerHTML = '<div class="empty-state"><ion-icon name="sync-outline" class="spin"></ion-icon><p>AI가 기도하는 마음으로 약을 작성 중입니다...</p></div>';
        this.dom.aiModal.classList.add('active');

        this.generateAISummary(content).then(res => {
            this.dom.summaryResult.innerHTML = `<div style="line-height:1.6; font-size:0.95rem;">${res}</div>`;
            this.dom.aiSummaryBtn.disabled = false;
        }).catch(err => {
            this.dom.summaryResult.innerHTML = `<p style="color:red; padding:20px;">오류 발생: ${err.message}</p>`;
            this.dom.aiSummaryBtn.disabled = false;
        });
    }

    async generateAISummary(text) {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            const key = prompt('Gemini API 키를 입력해주세요 (무료 키 발급 필요, 기기에 저장됩니다):');
            if (key) {
                localStorage.setItem('gemini_api_key', key);
                return this.generateAISummary(text);
            }
            return '<p>API 키가 입력되지 않았습니다.</p>';
        }

        const promptText = `다음 신앙 노트(설교 혹은 묵상)를 바탕으로, 건강한 복음주의 목회자 및 신학자의 관점에서 아래 구조에 맞춰 자세하게 정리해주세요:\n\n1. 핵심 요약 (짧게)\n2. 성경 본문의 문맥과 신학적 의미 (풍성하게)\n3. 오늘날의 실천적 적용 (구체적으로)\n4. 마무리 기도\n\n내용:\n${text}`;
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            let resultText = data.candidates[0].content.parts[0].text;
            resultText = resultText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            resultText = resultText.replace(/\*(.*?)\*/g, '<em>$1</em>');
            return resultText.replace(/\n/g, '<br>');
        } catch (e) {
            if (e.message.includes('API_KEY_INVALID') || e.message.includes('key not valid')) {
                localStorage.removeItem('gemini_api_key');
            }
            throw e;
        }
    }

    handleExportToLM() {
        const fullContent = `날짜: ${this.dom.dateInput.value}\n주제: ${this.dom.themeInput.value}\n설교자: ${this.dom.preacherInput.value}\n\n${this.dom.noteMemo.innerText}`;
        this.copyToClipboard(fullContent, 'NotebookLM 연동용 내용이 복사되었습니다.');
    }

    handleShare() {
        const content = `[${this.dom.themeInput.value}]\n\n${this.dom.noteMemo.innerText}`;
        if (navigator.share) navigator.share({ title: '하맘 성경노트', text: content }).catch(console.error);
        else this.copyToClipboard(content, '내용이 복사되었습니다.');
    }

    copyToClipboard(text, msg) {
        navigator.clipboard.writeText(text).then(() => alert(msg));
    }

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
                <div><strong>${v.ref}</strong><p>${v.text}</p></div>
                <button onclick="window.app.removeVerse('${v.ref}')"><ion-icon name="close-circle"></ion-icon></button>
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

    renderHighlights() {
        const container = document.getElementById('highlight-list');
        if (!container) return;
        if (this.highlights.length === 0) {
            container.innerHTML = `<div class="empty-state small"><ion-icon name="color-palette-outline"></ion-icon><p>형광펜으로 표시한 구절이 없습니다.</p></div>`;
            return;
        }
        container.innerHTML = this.highlights.map(v => `
            <div class="note-summary-item faith" style="border-left-color: #ffd700;">
                <h4>✨ ${v.ref}</h4>
                <p>${v.text}</p>
                <button onclick="window.app.removeHighlight('${v.ref}')" style="margin-top: 10px; background:none; border:none; color: #ff3b30; font-size: 0.9em; padding: 0; cursor:pointer;">삭제</button>
            </div>
        `).join('');
    }

    removeHighlight(ref) {
        this.highlights = this.highlights.filter(h => h.ref !== ref);
        localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
        this.renderHighlights();
    }

    renderRecitations() {
        const container = document.getElementById('memory-list');
        if (!container) return;
        if (this.recitations.length === 0) {
            container.innerHTML = `<div class="empty-state small"><ion-icon name="journal-outline"></ion-icon><p>암송 구절로 등록된 말씀이 없습니다.</p></div>`;
            return;
        }
        container.innerHTML = this.recitations.map(v => `
            <div class="note-summary-item prayer" style="border-left-color: #34c759;">
                <h4>📖 ${v.ref}</h4>
                <p>${v.text}</p>
                <button onclick="window.app.removeRecitation('${v.ref}')" style="margin-top: 10px; background:none; border:none; color: #ff3b30; font-size: 0.9em; padding: 0; cursor:pointer;">삭제</button>
            </div>
        `).join('');
    }

    removeRecitation(ref) {
        this.recitations = this.recitations.filter(r => r.ref !== ref);
        localStorage.setItem('bible_recitings', JSON.stringify(this.recitations));
        this.renderRecitations();
    }

    loadNoteByDate(date) {
        const key = `note_${date}`;
        if (this.notes[key]) {
            this.currentNote = { ...this.notes[key] };
        } else {
            this.currentNote = {
                id: Date.now(),
                date: date,
                theme: '',
                preacher: '',
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
        this.dom.preacherInput.value = this.currentNote.preacher || '';
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

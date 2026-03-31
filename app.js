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
        this.englishWords = JSON.parse(localStorage.getItem('bible_english_words') || '[]');

        this.init();
    }

    async init() {
        this.initDOM();
        this.registerEvents();
        this.initTabBar();
        this.initAccordion();
        this.initMenuSheet();
        this.initDragSelection();
        this.initSwipeNavigation();

        this.renderHighlights();
        this.renderRecitations();

        try {
            await this.loadBibleData();
            this.renderCalendar();
            this.loadNoteByDate(this.currentNote.date);
            this.renderWordStudyList();
            
            const savedFs = localStorage.getItem('bible_font_size') || 'default';
            this.setFontSize(savedFs);
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
        this.dom.bibleHighlightBtn.onclick = () => {
            const picker = document.getElementById('highlight-color-picker');
            if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
        };
        this.dom.bibleReciteBtn.onclick = () => this.markForRecitation();
        const requestFS = () => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().then(() => {
                    if (screen.orientation && screen.orientation.lock) {
                        try { screen.orientation.lock('portrait').catch(() => {}); } catch(e) {}
                    }
                }).catch(() => {});
            }
        };

        document.body.addEventListener('click', requestFS, { once: true });
        document.body.addEventListener('touchstart', requestFS, { once: true });
    }

    initDOM() {
        this.dom = {
            dateInput: document.getElementById('note-date'),
            themeInput: document.getElementById('note-theme'),
            preacherInput: document.getElementById('note-preacher'),
            categorySelect: document.getElementById('note-category'),
            autoSaveIndicator: document.getElementById('auto-save-indicator'),
            exitFullscreenBtn: document.getElementById('exit-fullscreen-btn'),

            bibleSearch: document.getElementById('bible-search'),
            searchBtn: document.getElementById('search-btn'),
            bookSelect: document.getElementById('book-select'),
            chapterSelect: document.getElementById('chapter-select'),
            verseList: document.getElementById('verse-list'),
            bibleFabContainer: document.getElementById('bible-fab-container'),
            pushToNoteBtn: document.getElementById('push-to-note-btn'),
            bibleMemoBtn: document.getElementById('bible-memo-btn'),
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

            translationRadios: document.getElementsByName('translation'),
            wordStudyToggle: document.getElementById('word-study-toggle'),
            wordStudyList: document.getElementById('word-study-list'),
            wordInfoContent: document.getElementById('word-info-content'),
            detailWordTitle: document.getElementById('detail-word-title'),
            addToMemoBtn: document.getElementById('add-to-memo-btn'),
            wordCountBadge: document.getElementById('word-count-badge'),
            bibleEngBtn: document.getElementById('bible-eng-btn')
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
                const prevTranslation = this.currentTranslation;
                this.currentTranslation = radio.value;
                const togetherPanel = document.getElementById('together-settings');
                if (togetherPanel) {
                    togetherPanel.style.display = this.currentTranslation === 'both' ? 'flex' : 'none';
                }
                
                // When switching to Story mode, clear chapter selection to show list
                if (this.currentTranslation === 'story') {
                    this.dom.chapterSelect.value = '';
                }

                if (this.dom.bookSelect.value) this.handleBookChange();
                if (this.dom.chapterSelect.value || this.currentTranslation === 'story') this.renderVerses();
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
        if (this.dom.bibleMemoBtn) this.dom.bibleMemoBtn.onclick = () => this.handlePushToNote();
        
        this.dom.recordBtn.onclick = () => this.toggleRecording();
        this.dom.ttsBtn.onclick = () => this.speakNoteTTS();
        this.dom.bookmarkBtn.onclick = () => this.toggleBookmark();
        this.dom.highlightBtn.onclick = () => this.applyHighlight();
        this.dom.aiSummaryBtn.onclick = () => this.handleAISummary();

        this.dom.closeModal.onclick = () => this.dom.aiModal.classList.remove('active');
        this.dom.copySummaryBtn.onclick = () => this.copyToClipboard(this.dom.summaryResult.innerText, '요약 내용이 복사되었습니다.');

        if (this.dom.shareNoteBtn) this.dom.shareNoteBtn.onclick = () => { this.closeMenu(); this.handleShare(); };
        if (this.dom.exportNotebookBtn) this.dom.exportNotebookBtn.onclick = () => { this.closeMenu(); this.handleExportToLM(); };

        // Word Study Events
        if (this.dom.wordStudyToggle) {
            this.dom.wordStudyToggle.onclick = () => {
                this.dom.wordStudyList.classList.toggle('active');
                this.dom.wordStudyToggle.classList.toggle('open');
            };
        }

        if (this.dom.addToMemoBtn) {
            this.dom.addToMemoBtn.onclick = () => {
                const word = this.dom.detailWordTitle.textContent;
                this.addWordToStudy(word);
            };
        }

        if (this.dom.bibleEngBtn) {
            this.dom.bibleEngBtn.onclick = () => {
                this.switchTab('tab-note');
                if (this.dom.wordStudyList && !this.dom.wordStudyList.classList.contains('active')) {
                    this.dom.wordStudyToggle.click();
                }
                setTimeout(() => {
                    if (this.dom.wordStudyToggle) this.dom.wordStudyToggle.scrollIntoView({ behavior: 'smooth' });
                }, 300);
            };
        }

        // Gemini API Setup
        const apiSetupBtn = document.getElementById('api-setup-btn');
        if (apiSetupBtn) {
            apiSetupBtn.onclick = () => document.getElementById('api-setup-panel').classList.toggle('hidden');
        }
        const saveKeyBtn = document.getElementById('save-key-btn');
        if (saveKeyBtn) {
            saveKeyBtn.onclick = () => {
                const key = document.getElementById('gemini-key-input').value.trim();
                if (key) {
                    localStorage.setItem('gemini_api_key', key);
                    alert('API 키가 저장되었습니다.');
                    document.getElementById('api-setup-panel').classList.add('hidden');
                }
            };
        }
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            const keyInput = document.getElementById('gemini-key-input');
            if (keyInput) keyInput.value = savedKey;
        }

        // TTS Player Controls
        const playBtn = document.getElementById('tts-play-btn');
        if (playBtn) {
            playBtn.onclick = () => {
                const icon = playBtn.querySelector('ion-icon');
                if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                    window.speechSynthesis.pause();
                    if (icon) icon.name = 'play';
                } else if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                    if (icon) icon.name = 'pause';
                } else {
                    this.playCurrentTTS();
                }
            };
        }
        document.getElementById('tts-stop-btn').onclick = () => this.stopTTS();
        document.getElementById('tts-next-btn').onclick = () => this.nextTTS();
        document.getElementById('tts-prev-btn').onclick = () => this.prevTTS();
        document.getElementById('close-tts-modal').onclick = () => {
            this.stopTTS();
            document.getElementById('tts-player-modal').classList.remove('active');
        };

        if (this.dom.exitFullscreenBtn) {
            this.dom.exitFullscreenBtn.onclick = () => {
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            };
        }

        document.addEventListener('fullscreenchange', () => {
            if (this.dom.exitFullscreenBtn) {
                this.dom.exitFullscreenBtn.style.display = document.fullscreenElement ? 'inline-flex' : 'none';
            }
        });
    }

    initTabBar() {
        const tabs = this.dom.tabBar.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });
    }

    initSwipeNavigation() {
        let touchstartX = 0;
        let touchstartY = 0;

        const mainArea = this.dom.contentArea;
        
        mainArea.addEventListener('touchstart', (e) => {
            touchstartX = e.changedTouches[0].screenX;
            touchstartY = e.changedTouches[0].screenY;
        }, {passive: true});
        
        mainArea.addEventListener('touchend', (e) => {
            const touchendX = e.changedTouches[0].screenX;
            const touchendY = e.changedTouches[0].screenY;
            
            const diffX = touchstartX - touchendX;
            const diffY = touchstartY - touchendY;
            
            // Allow swipe if X movement is significant and Y movement is small (not scrolling)
            if (Math.abs(diffX) > 80 && Math.abs(diffY) < 100) {
                if (diffX > 0) this.navigateTab(1); // Swipe Left -> Next Tab
                else this.navigateTab(-1); // Swipe Right -> Prev Tab
            }
        }, {passive: true});
    }

    navigateTab(direction) {
        const tabs = Array.from(this.dom.tabBar.querySelectorAll('.tab-item'));
        const currentIndex = tabs.findIndex(t => t.classList.contains('active'));
        if (currentIndex === -1) return;
        let nextIndex = currentIndex + direction;
        if (nextIndex < 0) nextIndex = 0;
        if (nextIndex >= tabs.length) nextIndex = tabs.length - 1;
        if (nextIndex !== currentIndex) {
            this.switchTab(tabs[nextIndex].dataset.tab);
        }
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
        let longPressTimer = null;

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

        // --- Mouse Events ---
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

        // --- Touch Events (with Long Press for scrolling protection) ---
        container.addEventListener('touchstart', (e) => {
            const verseItem = e.target.closest('.verse-item');
            if (verseItem) {
                // Wait 400ms before starting drag selection
                longPressTimer = setTimeout(() => {
                    isDragging = true;
                    if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback indicating drag is ready
                    const cb = verseItem.querySelector('.verse-item-check');
                    dragMode = !cb.checked; // Decide whether we are checking or unchecking
                    
                    // Immediately apply to the first item
                    cb.checked = dragMode;
                    this.toggleVerseSelection(cb);
                }, 400);
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging && longPressTimer) {
                // If they moved their finger before the long press triggered, it's a scroll. Cancel long press.
                clearTimeout(longPressTimer);
                longPressTimer = null;
                return;
            }
            if (!isDragging) return;
            
            // Prevent scrolling ONLY when drag selection is active
            if (e.cancelable) e.preventDefault();

            const touch = e.touches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            onMove(el);
        }, { passive: false }); // Needs false to use preventDefault

        container.addEventListener('touchend', () => { 
            clearTimeout(longPressTimer);
            isDragging = false; 
        });
        container.addEventListener('touchcancel', () => { 
            clearTimeout(longPressTimer);
            isDragging = false; 
        });
    }

    openMenu() { this.dom.menuOverlay.classList.add('active'); }
    closeMenu() { this.dom.menuOverlay.classList.remove('active'); }

    handleBookChange() {
        const bookName = this.dom.bookSelect.value;
        const book = BIBLE_BOOKS.find(b => b.name === bookName);
        const prevChapterVal = this.dom.chapterSelect.value;
        
        if (this.currentTranslation === 'story') {
            this.dom.chapterSelect.innerHTML = '<option value="">이야기 선택</option>';
            const stories = ALL_STORY_DATA.filter(s => s.book === bookName);
            stories.forEach((s, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `<${s.title}>`;
                this.dom.chapterSelect.appendChild(opt);
            });
            // Try to match story index with chapter number if available
            if (prevChapterVal && !isNaN(prevChapterVal)) {
                // If chapter was 1, it might map to story index 0
                const targetIdx = parseInt(prevChapterVal) - 1;
                if (this.dom.chapterSelect.querySelector(`option[value="${targetIdx}"]`)) {
                    this.dom.chapterSelect.value = targetIdx;
                }
            }
        } else {
            this.dom.chapterSelect.innerHTML = '<option value="">장</option>';
            if (book) {
                for (let i = 1; i <= book.chapters; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = i + '장';
                    this.dom.chapterSelect.appendChild(opt);
                }
                // Try to restore previous value
                if (prevChapterVal) {
                    let targetVal = prevChapterVal;
                    // If switching from story (0-based) to chapters (1-based)
                    if (this.currentTranslation !== 'story' && !isNaN(prevChapterVal) && this.dom.chapterSelect.innerHTML.includes('이야기')) { 
                       // handle specifically if needed, but let's just try to re-apply
                    }
                    this.dom.chapterSelect.value = targetVal;
                }
            }
        }
    }

    handleSearch() {
        const query = this.dom.bibleSearch.value.trim();
        if (query.length < 2) return;

        const results = [];
        const mode = this.currentTranslation; // 'kr', 'easy', 'niv', 'both', 'story'
        const togetherSettings = Array.from(document.querySelectorAll('#together-settings input:checked')).map(i => i.value);

        if (mode === 'story') {
            ALL_STORY_DATA.forEach((s, idx) => {
                if (s.text.includes(query) || s.title.includes(query)) {
                    results.push({
                        ref: s.title,
                        text: this.highlightQuery(s.text, query)
                    });
                }
            });
        } else {
            for (const key in ALL_VERSES) {
                const krVerses = ALL_VERSES[key];
                const nivVerses = ALL_VERSES_NIV[key] || [];
                const easyVerses = ALL_VERSES_EASY[key] || [];

                krVerses.forEach((v, idx) => {
                    const kr = v;
                    const niv = nivVerses[idx] || '';
                    const easy = easyVerses[idx] || '';

                    let match = false;
                    if (mode === 'kr' && kr.includes(query)) match = true;
                    else if (mode === 'niv' && niv.toLowerCase().includes(query.toLowerCase())) match = true;
                    else if (mode === 'easy' && easy.includes(query)) match = true;
                    else if (mode === 'both') {
                        if (togetherSettings.includes('kr') && kr.includes(query)) match = true;
                        if (togetherSettings.includes('niv') && niv.toLowerCase().includes(query.toLowerCase())) match = true;
                        if (togetherSettings.includes('easy') && easy.includes(query)) match = true;
                    }

                    if (match) {
                        let displayText = '';
                        if (mode === 'kr') displayText = kr;
                        else if (mode === 'niv') displayText = niv;
                        else if (mode === 'easy') displayText = easy;
                        else if (mode === 'both') {
                            if (togetherSettings.includes('kr')) displayText += `<p>${kr}</p>`;
                            if (togetherSettings.includes('easy')) displayText += `<p class="easy">${easy}</p>`;
                            if (togetherSettings.includes('niv')) displayText += `<p class="niv">${niv}</p>`;
                        }

                        results.push({
                            ref: key.replace('-', ' ') + ':' + (idx + 1),
                            text: this.highlightQuery(displayText, query)
                        });
                    }
                });
            }
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
                    <div class="verse-text">${res.text}</div>
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
            if (!book) {
                this.dom.verseList.innerHTML = `<div class="empty-state"><ion-icon name="book-outline" class="empty-icon"></ion-icon><p>가이드 성경책을 선택하세요</p></div>`;
                return;
            }
            
            const stories = ALL_STORY_DATA.filter(s => s.book === book);
            
            if (!chapVal || chapVal === "") {
                const storyHtml = stories.map((s, idx) => `
                    <div class="story-choice-card" onclick="window.app.selectStory('${idx}')">
                        <div class="story-choice-num">${idx + 1}</div>
                        <div class="story-choice-title">${s.title}</div>
                    </div>
                `).join('');
                this.dom.verseList.innerHTML = `
                    <div class="search-info">📖 ${book} 이야기 목록</div>
                    <div class="story-menu-grid">
                        ${storyHtml}
                    </div>`;
                return;
            }

            const story = stories[chapVal];
            if (story) {
                const ref = `${book} 이야기:${parseInt(chapVal)+1}`;
                const text = story.text;
                const isSelected = this.isVerseSelected(book, '이야기', parseInt(chapVal)+1);
                
                this.dom.verseList.innerHTML = `
                    <div class="search-info">📖 이야기: ${book} / ${story.title}</div>
                    <label class="verse-item ${isSelected ? 'selected' : ''}" style="display: flex; padding: 15px; margin-bottom: 10px; align-items: flex-start;">
                        <input type="checkbox" class="verse-item-check"
                               data-text="${this.escapeHtml(text)}"
                               data-niv=""
                               data-easy=""
                               data-ref="${this.escapeHtml(ref)}"
                               ${isSelected ? 'checked' : ''}
                               onchange="window.app.toggleVerseSelection(this)"
                               style="margin-right: 15px; margin-top: 5px;">
                        <div class="story-card expanded" style="margin: 0; box-shadow: none; flex: 1;">
                            <div class="story-body" style="max-height: none; opacity: 1; padding: 0;">
                                <p class="story-text" style="font-size: 1.1rem; line-height: 1.6;">${text}</p>
                            </div>
                        </div>
                    </label>
                    <div class="story-nav-row">
                        <button onclick="window.app.toPrevChapter()" class="nav-chapter-btn"><ion-icon name="chevron-back"></ion-icon> 이전 이야기</button>
                        <button onclick="window.app.toNextChapter()" class="nav-chapter-btn">다음 이야기 <ion-icon name="chevron-forward"></ion-icon></button>
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
                displayContent = `<p class="verse-text niv">${this.splitNivWords(nivText)}</p>`;
            } else if (this.currentTranslation === 'easy') {
                displayContent = `<p class="verse-text easy">${easyText}</p>`;
            } else if (this.currentTranslation === 'both') {
                displayContent = '';
                if (selectedVers.includes('kr')) displayContent += `<p class="verse-text">${text}</p>`;
                if (selectedVers.includes('easy')) displayContent += `<p class="verse-text easy">${easyText}</p>`;
                if (selectedVers.includes('niv')) displayContent += `<p class="verse-text niv">${this.splitNivWords(nivText)}</p>`;
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

        this.dom.verseList.innerHTML += `
            <div class="chapter-nav-row">
                <button onclick="window.app.toPrevChapter()" class="nav-chapter-btn"><ion-icon name="chevron-back"></ion-icon> 이전 장</button>
                <button onclick="window.app.toNextChapter()" class="nav-chapter-btn">다음 장 <ion-icon name="chevron-forward"></ion-icon></button>
            </div>`;
    }

    isVerseSelected(book, chap, num) {
        return this.currentNote.verses.some(v => v.ref === `${book} ${chap}:${num}`);
    }

    speakSelectedVerses() {
        const selected = document.querySelectorAll('.verse-item-check:checked');
        if (selected.length === 0) {
            alert('읽어줄 구절을 선택해주세요.');
            return;
        }
        this.ttsQueue = Array.from(selected).map(cb => ({
            ref: cb.dataset.ref,
            text: cb.dataset.text.replace(/<[^>]*>/g, '').trim()
        }));
        this.currentTTSIndex = 0;
        this.openTTSPlayer();
    }

    speakNoteTTS() {
        this.ttsQueue = [{
            ref: '노트 메모',
            text: this.dom.noteMemo.innerText.trim()
        }];
        this.currentTTSIndex = 0;
        this.openTTSPlayer();
    }

    openTTSPlayer() {
        const modal = document.getElementById('tts-player-modal');
        if (modal) modal.classList.add('active');
        this.updateTTSPlayerUI();
        this.playCurrentTTS();
    }

    updateTTSPlayerUI() {
        const item = this.ttsQueue[this.currentTTSIndex];
        if (!item) return;
        const refEl = document.getElementById('tts-reading-ref');
        const textEl = document.getElementById('tts-reading-text');
        if (refEl) refEl.textContent = item.ref;
        if (textEl) textEl.textContent = item.text;
    }

    playCurrentTTS() {
        window.speechSynthesis.cancel();
        const item = this.ttsQueue[this.currentTTSIndex];
        if (!item) return;

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const gender = document.querySelector('input[name="tts-voice"]:checked')?.value || 'female';
        
        // Find Korean voices by common name hints
        let voice = voices.find(v => v.lang.includes('ko') && (
            gender === 'male' ? (v.name.includes('Jihun') || v.name.includes('Male')) : 
            (v.name.includes('Yuna') || v.name.includes('Female'))
        ));
        
        if (!voice) voice = voices.find(v => v.lang.includes('ko'));
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
            const playBtn = document.getElementById('tts-play-btn');
            if (playBtn) playBtn.innerHTML = '<ion-icon name="pause"></ion-icon>';
        };

        utterance.onend = () => {
            const playBtn = document.getElementById('tts-play-btn');
            if (playBtn) playBtn.innerHTML = '<ion-icon name="play"></ion-icon>';
            
            const loopMode = document.querySelector('input[name="tts-loop"]:checked')?.value || 'once';
            if (loopMode === 'repeat') {
                this.playCurrentTTS();
            } else if (loopMode === 'continuous') {
                this.nextTTS();
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    stopTTS() {
        window.speechSynthesis.cancel();
        const playBtn = document.getElementById('tts-play-btn');
        if (playBtn) playBtn.innerHTML = '<ion-icon name="play"></ion-icon>';
    }

    nextTTS() {
        if (this.currentTTSIndex < this.ttsQueue.length - 1) {
            this.currentTTSIndex++;
            this.updateTTSPlayerUI();
            this.playCurrentTTS();
        }
    }

    prevTTS() {
        if (this.currentTTSIndex > 0) {
            this.currentTTSIndex--;
            this.updateTTSPlayerUI();
            this.playCurrentTTS();
        }
    }

    setFontSize(size) {
        let fs = '16px';
        if (size === 'small') fs = '14px';
        else if (size === 'large') fs = '20px';
        
        document.documentElement.style.setProperty('--app-font-size', fs);
        document.querySelectorAll('.fs-btn').forEach(btn => {
            btn.classList.toggle('active', btn.classList.contains(size));
        });
        localStorage.setItem('bible_font_size', size);
    }

    toPrevChapter() {
        const bookName = this.dom.bookSelect.value;
        const currentChap = parseInt(this.dom.chapterSelect.value);
        if (isNaN(currentChap)) return;

        if (currentChap > (this.currentTranslation === 'story' ? 0 : 1)) {
            this.dom.chapterSelect.value = currentChap - 1;
            this.renderVerses();
            document.querySelector('.tab-panel.active').scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    toNextChapter() {
        const bookName = this.dom.bookSelect.value;
        const currentChap = parseInt(this.dom.chapterSelect.value);
        if (isNaN(currentChap)) return;

        if (this.currentTranslation === 'story') {
            const stories = ALL_STORY_DATA.filter(s => s.book === bookName);
            if (currentChap < stories.length - 1) {
                this.dom.chapterSelect.value = currentChap + 1;
                this.renderVerses();
                document.querySelector('.tab-panel.active').scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            const book = BIBLE_BOOKS.find(b => b.name === bookName);
            if (book && currentChap < book.chapters) {
                this.dom.chapterSelect.value = currentChap + 1;
                this.renderVerses();
                document.querySelector('.tab-panel.active').scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    shareSelectedVerses() {
        if (!navigator.share || !this.currentNote.verses.length) return;
        const text = this.currentNote.verses.map(v => `[${v.ref}] ${v.text}`).join('\n');
        navigator.share({ title: '오늘의 말씀', text: text }).catch(() => {});
    }

    applyHighlightColor(color) {
        if (!this.currentNote.verses.length) {
            alert('먼저 성경 구절을 체크해주세요.');
            return;
        }
        this.currentNote.verses.forEach(v => {
            const existingIdx = this.highlights.findIndex(h => h.ref === v.ref);
            if (existingIdx >= 0) {
                this.highlights[existingIdx].color = color;
            } else {
                this.highlights.push({ ...v, color: color });
            }
        });
        localStorage.setItem('bible_highlights', JSON.stringify(this.highlights));
        this.renderHighlights();
        
        const picker = document.getElementById('highlight-color-picker');
        if (picker) picker.style.display = 'none';
        
        alert('선택한 색상으로 형광펜이 적용되었습니다.');
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
        const krText = checkbox.dataset.text;
        const nivText = checkbox.dataset.niv;
        const easyText = checkbox.dataset.easy;
        const parent = checkbox.closest('.verse-item');

        let actualText = krText;
        if (this.currentTranslation === 'easy') actualText = easyText || krText;
        else if (this.currentTranslation === 'niv') actualText = nivText || krText;
        else if (this.currentTranslation === 'story') actualText = krText; // story usually only has one text
        else if (this.currentTranslation === 'both') {
            const selectedVers = Array.from(document.querySelectorAll('#together-settings input:checked')).map(i => i.value);
            actualText = '';
            if (selectedVers.includes('kr') && krText) actualText += krText + '<br>';
            if (selectedVers.includes('easy') && easyText) actualText += (easyText + '<br>');
            if (selectedVers.includes('niv') && nivText) actualText += (nivText + '<br>');
            actualText = actualText.trim() || krText;
        }

        // Clean up any double br or trailing br for the note
        actualText = actualText.replace(/<br>\s*$/g, '').trim();

        if (checkbox.checked) {
            // Remove existing to replace with new text
            this.currentNote.verses = this.currentNote.verses.filter(v => v.ref !== ref);
            this.currentNote.verses.push({ ref, text: actualText, nivText: '' });
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
            return `
            <div style="background-color: #f7f7f8; border-left: 4px solid #007aff; padding: 12px; border-radius: 8px; margin: 15px 0;">
                <div style="font-weight: bold; color: #007aff; margin-bottom: 5px;">[${v.ref}]</div>
                <div style="line-height: 1.5;">${v.text}</div>
            </div>`;
        }).join('');

        this.dom.noteMemo.innerHTML = (currentMemo ? currentMemo + '<br>' : '') + verseHtml + '<p><br></p>';
        this.switchTab('tab-note');
        
        // Remove from selection to reset
        this.currentNote.verses = [];
        this.updatePushButton();
        this.renderVerses();
        
        this.triggerAutoSave();
        
        // Focus for immediate typing
        setTimeout(() => {
            if (this.dom.noteMemo) {
                this.dom.noteMemo.focus();
                try {
                    const range = document.createRange();
                    range.selectNodeContents(this.dom.noteMemo);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(e) {}
            }
        }, 300);
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

    stopRecordingUI() {
        this.isRecording = false;
        this.dom.recordBtn.classList.remove('recording-active');
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
            const key = prompt('Gemini API 키를 입력해주세요 (Google AI Studio에서 발급 가능):');
            if (key) {
                localStorage.setItem('gemini_api_key', key);
                return this.generateAISummary(text);
            }
            return '<p>API 키가 입력되지 않았습니다.</p>';
        }

        const promptText = `다음 신앙 노트(설교 혹은 묵상)를 바탕으로, 건강한 복음주의 목회자 및 신학자의 관점에서 아래 구조에 맞춰 자세하게 정리해주세요:\n\n1. 핵심 요약 (짧게)\n2. 성경 본문의 문맥과 신학적 의미 (풍성하게)\n3. 오늘날의 실천적 적용 (구체적으로)\n4. 마무리 기도\n\n내용:\n${text}`;
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
            <div class="note-summary-item faith" style="border-left-color: ${v.color || '#ffd700'};">
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

    selectStory(idx) {
        this.dom.chapterSelect.value = idx;
        this.renderVerses();
    }

    // ─── English Word Study ───

    splitNivWords(text) {
        if (!text) return '';
        // Split by spaces and punctuation, but wrap words only
        return text.split(/(\s+)/).map(part => {
            if (/^[a-zA-Z']+$/.test(part)) {
                return `<span onclick="window.app.onWordClick('${part.replace(/'/g, "\\'")}'); event.stopPropagation();">${part}</span>`;
            }
            return part;
        }).join('');
    }

    async onWordClick(word) {
        const cleanWord = word.replace(/[^a-zA-Z']/g, '').toLowerCase();
        this.openModal('modal-word-detail');
        this.dom.detailWordTitle.textContent = cleanWord;
        this.dom.wordInfoContent.innerHTML = '<div class="loading-spinner"></div>';
        
        try {
            const info = await this.getGeminiWordInfo(cleanWord);
            if (info) {
                this.dom.wordInfoContent.innerHTML = `
                    <div class="word-info-group">
                        <div class="word-info-label">발음</div>
                        <div class="word-info-value" style="font-family: monospace;">${info.phonetic || 'N/A'}</div>
                    </div>
                    <div class="word-info-group">
                        <div class="word-info-label">뜻</div>
                        <div class="word-info-value" style="font-size: 1.1rem; color: var(--apple-blue);">${info.meaning || 'N/A'}</div>
                    </div>
                    <div class="word-info-group">
                        <div class="word-info-label">예문</div>
                        <div class="word-info-value" style="font-style: italic; color: #666;">${info.example || 'Example not found.'}</div>
                    </div>
                `;
            }
        } catch (e) {
            this.dom.wordInfoContent.innerHTML = '<p>단어 정보를 가져오지 못했습니다.</p>';
        }
    }

    async getGeminiWordInfo(word) {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            return { meaning: 'API 키가 필요합니다.', phonetic: '', example: '설정에서 Gemini API 키를 저장해주세요.' };
        }

        const prompt = `영단어 "${word}"의 뜻, 발음기호, 간단한 예문을 한글로 설명해줘.
포맷: {"meaning": "뜻", "phonetic": "발음기호", "example": "한글 해석이 포함된 예문"}
응답은 반드시 JSON 형식으로만 해줘.`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            return JSON.parse(text);
        } catch (e) {
            console.error('Word info fetch failed:', e);
            return null;
        }
    }

    addWordToStudy(word) {
        const cleanWord = word.toLowerCase();
        if (this.englishWords.some(w => w.word === cleanWord)) {
            alert('이미 단어장에 있는 단어입니다.');
            return;
        }

        const infoText = this.dom.wordInfoContent.innerText;
        // Basic parsing from UI if we don't want to re-fetch
        const lines = infoText.split('\n');
        const phonetic = lines.find(l => l.includes('발음'))?.nextElementSibling?.textContent || '';
        const meaning = lines.find(l => l.includes('뜻'))?.nextElementSibling?.textContent || '';

        this.englishWords.unshift({
            word: cleanWord,
            phonetic: phonetic || '',
            meaning: meaning || '정보 없음'
        });

        localStorage.setItem('bible_english_words', JSON.stringify(this.englishWords));
        this.renderWordStudyList();
        this.closeModal('modal-word-detail');
        alert('단어장에 저장되었습니다.');
    }

    renderWordStudyList() {
        if (!this.dom.wordStudyList) return;
        
        this.dom.wordCountBadge.textContent = this.englishWords.length;
        
        if (this.englishWords.length === 0) {
            this.dom.wordStudyList.innerHTML = '<p class="empty-hint">NIV 말씀의 단어를 클릭하면 여기에 추가됩니다</p>';
            return;
        }

        this.dom.wordStudyList.innerHTML = this.englishWords.map((item, idx) => `
            <div class="word-item" onclick="this.classList.toggle('show-meaning')">
                <div class="word-header">
                    <span class="word-text">${item.word}</span>
                    <span class="word-pronounce">${item.phonetic}</span>
                    <button onclick="window.app.removeWord(${idx}); event.stopPropagation();" 
                            style="background:none; border:none; color:#ff3b30; font-size:1.2rem; cursor:pointer;">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </div>
                <div class="word-meaning">${item.meaning}</div>
            </div>
        `).join('');
    }

    removeWord(idx) {
        if (confirm('이 단어를 삭제하시겠습니까?')) {
            this.englishWords.splice(idx, 1);
            localStorage.setItem('bible_english_words', JSON.stringify(this.englishWords));
            this.renderWordStudyList();
        }
    }

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('active');
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    }
}

// ─── Global Hook ───
window.app = new NoteApp();

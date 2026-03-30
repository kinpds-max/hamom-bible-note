const fs = require('fs');
const lines = fs.readFileSync('마태복음_utf8.txt', 'utf8').split('\n');
const stories = [];
let currentChapter = 0;
let currentText = [];

for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const match = line.match(/^(\d+)\s(.*)/);
    if (match) {
        const verseNum = parseInt(match[1]);
        let text = match[2];
        if (verseNum === 1) {
            if (currentChapter > 0) {
                stories.push({
                    book: '마태복음',
                    title: `마태복음 ${currentChapter}장`,
                    text: currentText.join(' ')
                });
            }
            currentChapter++;
            currentText = [];
            // Handle cases where the text following the verse number "1" contains actual text, 
            // e.g. "1 아브라함의 자손이며...".
            if (!text) continue;
        }
        currentText.push(text);
    } else {
        currentText.push(line);
    }
}
if (currentChapter > 0) {
    stories.push({
        book: '마태복음',
        title: `마태복음 ${currentChapter}장`,
        text: currentText.join(' ')
    });
}

const existingData = JSON.parse(fs.readFileSync('../bible_story.json', 'utf8'));
const finalData = existingData.filter(d => d.book !== '마태복음').concat(stories);
fs.writeFileSync('../bible_story.json', JSON.stringify(finalData, null, 2), 'utf8');
console.log('Appended Matthew stories. Total Matthew chapters:', stories.length);

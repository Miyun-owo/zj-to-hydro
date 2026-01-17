const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const yaml = require('js-yaml');

async function convert() {
    // 1. 讀取本地的 zjson 檔案
    const filePath = path.join(__dirname, 'problem.zjson');
    if (!fs.existsSync(filePath)) {
        console.error("Error: Can't find problem.zjson file！");
        return;
    }
    
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);

    // 檢查 problemid 格式
    const pidRegex = /^[a-zA-Z]\d{3}$/;
    if (!pidRegex.test(data.problemid)) {
        console.error(`Error: Invalid problemid format "${data.problemid}".`);
        console.error("Expected format: One letter followed by three digits (e.g., b432).");
        return;
    }
    const zip = new JSZip();
    console.log(`Processing problem: ${data.title} (ID: ${data.problemid})...`);

    // 建立目錄結構
    const problemFolder = zip.folder(data.problemid);

    // 2. 產生 problem_zh.md
    const cleanHtml = (str) => (str ? str.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') : '');
    const mdContent = `
## 內容
${cleanHtml(data.content)}

## 輸入說明
${cleanHtml(data.theinput)}

## 輸出說明
${cleanHtml(data.theoutput)}

## 範例輸入
\`\`\`
${data.sampleinput}
\`\`\`

## 範例輸出
\`\`\`
${data.sampleoutput}
\`\`\`

### 提示
${cleanHtml(data.hint)}
`.trim();
    problemFolder.file("problem_zh.md", mdContent);

    // 3. 產生 problem.yaml
    const probYaml = {
        pid: data.problemid,
        owner: data.author,
        title: data.title,
        tag: data.keywords ? (typeof data.keywords === 'string' ? JSON.parse(data.keywords) : data.keywords) : [],
        nSubmit: 0,
        nAccept: 0
    };
    problemFolder.file("problem.yaml", yaml.dump(probYaml));

    // 4. 處理 testdata 子目錄
    const testdataFolder = problemFolder.folder("testdata");
    for (let i = 0; i < data.testfilelength; i++) {
        const num = i + 1;
        testdataFolder.file(`${num}.in`, data.testinfiles[i]);
        testdataFolder.file(`${num}.out`, data.testoutfiles[i]);
    }

    // 5. 產生 testdata/config.yaml
    const configYaml = {
        time: Array.isArray(data.timelimits) ? `${data.timelimits[0]}s` : `${data.timelimits}s`,
        memory: `${data.memorylimit}mb`
    };
    testdataFolder.file("config.yaml", yaml.dump(configYaml));

    // 6. 寫出 ZIP 檔案
    const content = await zip.generateAsync({ type: "nodebuffer" });
    const outputName = `${data.problemid}_export.zip`;
    fs.writeFileSync(outputName, content);

    console.log(`Success! File saved as: ${outputName}`);
}

convert();
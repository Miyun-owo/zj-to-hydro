import json
import os
import zipfile
from pathlib import Path
from bs4 import BeautifulSoup

# -------------------------------
# 參數設定
# -------------------------------
JSON_FILE = "a_oj_problems.json"   # A OJ 輸出 JSON
OUTPUT_ZIP_PREFIX = "Export"       # 最終 Export.zip 前綴
QUESTIONS_PER_ZIP = 10             # 每包多少題

OWNER_ID = 3                       # B OJ owner ID
START_SERIAL = 1                    # B OJ 資料夾流水號起點

# -------------------------------
# HTML → Markdown 轉換
# -------------------------------
def html_to_md(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    text = soup.get_text("\n")  # <p><br> 轉換為換行
    return text.strip()

# -------------------------------
# 生成 problem.md
# -------------------------------
def generate_problem_md(problem):
    title = problem["title"]
    content = html_to_md(problem.get("content", ""))
    theinput = html_to_md(problem.get("theinput", ""))
    theoutput = html_to_md(problem.get("theoutput", ""))
    hint = html_to_md(problem.get("hint", ""))
    sampleinput = html_to_md(problem.get("sampleinput", ""))
    sampleoutput = html_to_md(problem.get("sampleoutput", ""))
    
    md = f"""# {title}

## 題目敘述
{content}

## 輸入說明
{theinput}

## 輸出說明
{theoutput}

## 測試執行資料說明
本題共有 {len(problem['testinfiles'])} 筆測資。
請依照輸入格式處理，不依賴隱性假設。
可能包含邊界情況。

### 範例輸入
{sampleinput}

### 範例輸出
{sampleoutput}

## 限制
時限：{problem['timelimits'][0]} 秒
記憶體限制：{problem['memorylimit']} MB

> 範例僅供格式參考，實際測資可能包含更多筆資料與邊界情況。

## 提示
{hint}
"""
    return md

# -------------------------------
# 生成 problem.yaml
# -------------------------------
def generate_problem_yaml(problem):
    pid = problem["problemid"]
    title = problem["title"]
    tags = problem.get("keywords", [])
    tags_list = "[" + ",".join(tags) + "]"
    
    yaml_content = f"""pid: {pid}
owner: {OWNER_ID}
title: {title}
tag: {tags_list}
nSubmit: 1
nAccept: 1
"""
    return yaml_content

# -------------------------------
# 生成 testdata/config.yml
# -------------------------------
def generate_config_yaml(problem):
    time = problem["timelimits"][0]
    memory = problem["memorylimit"]
    return f"time: {time}s\nmemory: {memory}m\n"

# -------------------------------
# 寫入測資檔案
# -------------------------------
def write_testdata(testdata_dir, problem):
    for idx, (infile, outfile) in enumerate(zip(problem["testinfiles"], problem["testoutfiles"])):
        in_path = testdata_dir / f"{idx+1}.in"
        out_path = testdata_dir / f"{idx+1}.out"
        in_path.write_text(infile, encoding="utf-8")
        out_path.write_text(outfile, encoding="utf-8")
    # config.yml
    config_path = testdata_dir / "config.yml"
    config_path.write_text(generate_config_yaml(problem), encoding="utf-8")

# -------------------------------
# 封裝題目資料夾
# -------------------------------
def create_problem_folder(base_dir, serial, problem):
    folder_name = f"{serial:04d}"
    folder_path = base_dir / folder_name
    folder_path.mkdir(parents=True, exist_ok=True)
    
    # problem.md
    (folder_path / "problem.md").write_text(generate_problem_md(problem), encoding="utf-8")
    # problem.yaml
    (folder_path / "problem.yaml").write_text(generate_problem_yaml(problem), encoding="utf-8")
    # testdata/
    testdata_dir = folder_path / "testdata"
    testdata_dir.mkdir(exist_ok=True)
    write_testdata(testdata_dir, problem)

# -------------------------------
# 生成 Export.zip
# -------------------------------
def create_export_zip(problems, start_serial=START_SERIAL):
    total = len(problems)
    batch_num = (total + QUESTIONS_PER_ZIP - 1) // QUESTIONS_PER_ZIP
    
    for b in range(batch_num):
        batch_dir = Path(f"tmp_batch_{b+1}")
        batch_dir.mkdir(exist_ok=True)
        
        start = b * QUESTIONS_PER_ZIP
        end = min(start + QUESTIONS_PER_ZIP, total)
        
        for i, problem in enumerate(problems[start:end], start=start_serial + b * QUESTIONS_PER_ZIP):
            create_problem_folder(batch_dir, i, problem)
        
        # zip
        zip_path = Path(f"{OUTPUT_ZIP_PREFIX}_{b+1}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in batch_dir.rglob("*"):
                zf.write(file_path, file_path.relative_to(batch_dir))
        # 清理臨時資料夾
        for file_path in batch_dir.rglob("*"):
            file_path.unlink()
        batch_dir.rmdir()

# -------------------------------
# 主程式
# -------------------------------
def main():
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        problems = json.load(f)
    
    create_export_zip(problems)

if __name__ == "__main__":
    main()
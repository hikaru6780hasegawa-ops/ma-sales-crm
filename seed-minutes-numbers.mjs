/**
 * 議事録No.管理リストの初期データ投入スクリプト
 * No.1～No.353のお客様名データをDBに投入
 */
import fs from 'fs';

// Pasted_content_01.txtからNo.管理リストをパース
const raw = fs.readFileSync('/home/ubuntu/upload/Pasted_content_01.txt', 'utf-8');

const entries = [];
// パターン: No.数字 名前様 or No,数字 名前様
const regex = /No[.,](\d+)\s*([^\n]*?)(?=No[.,]\d+|$)/g;
let match;
while ((match = regex.exec(raw)) !== null) {
  const num = parseInt(match[1], 10);
  let nameRaw = match[2].trim();
  
  // 末尾の更新情報を除去（例: "2025/12/21長谷川更新"）
  nameRaw = nameRaw.replace(/\d{4}\/\d{1,2}\/\d{1,2}.*$/, '').trim();
  nameRaw = nameRaw.replace(/最新$/, '').trim();
  
  // 備考を抽出（括弧内: 買増し、現金案件等）
  let note = '';
  const noteMatch = nameRaw.match(/[（(]([^）)]+)[）)]/);
  if (noteMatch) {
    note = noteMatch[1];
  }
  
  // 名前から備考部分を除去
  let name = nameRaw.replace(/[（(][^）)]*[）)]/g, '').trim();
  // 「様」を除去
  name = name.replace(/様$/g, '').trim();
  // 余分な空白を正規化（全角スペースは保持）
  name = name.replace(/\s+/g, (m) => m.includes('　') ? '　' : ' ').trim();
  // ⚠️マーク等を除去
  name = name.replace(/⚠️[^⚠️]*⚠️/g, '').trim();
  // 「2nd」等を除去
  name = name.replace(/2nd/gi, '').trim();
  // 「買増し」「買増」を備考に
  if (name.includes('買増')) {
    if (!note) note = '買増し';
    name = name.replace(/（?買増し?）?/g, '').trim();
  }
  
  if (name && num > 0) {
    entries.push({ number: num, customerName: name, note: note || null });
  }
}

console.log(`Parsed ${entries.length} entries`);
// 最初の5件と最後の5件を表示
entries.slice(0, 5).forEach(e => console.log(`  No.${e.number} ${e.customerName} ${e.note ? `(${e.note})` : ''}`));
console.log('  ...');
entries.slice(-5).forEach(e => console.log(`  No.${e.number} ${e.customerName} ${e.note ? `(${e.note})` : ''}`));

// SQL INSERT文を生成
const sqlLines = entries.map(e => {
  const name = e.customerName.replace(/'/g, "''");
  const note = e.note ? `'${e.note.replace(/'/g, "''")}'` : 'NULL';
  return `(${e.number}, '${name}', ${note})`;
});

const sql = `INSERT IGNORE INTO minutes_numbers (\`number\`, customerName, note) VALUES\n${sqlLines.join(',\n')};\n`;

fs.writeFileSync('/home/ubuntu/sales-crm/seed-minutes-numbers.sql', sql);
console.log(`\nSQL file written: seed-minutes-numbers.sql (${entries.length} rows)`);

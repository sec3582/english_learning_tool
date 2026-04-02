// js/wordRelations.js — 純邏輯，無 DOM、無 fetch

/**
 * 把逗號分隔的同/反義字串解析成小寫陣列，過濾「無」和空字串
 * @param {string} str
 * @returns {string[]}
 */
export function parseRelationString(str) {
  if (!str || str.trim() === '無') return [];
  return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * 從全部單字清單中，找出 wordObj.synonyms / wordObj.antonyms 裡哪些已被收藏
 *
 * @param {Object} wordObj  - 有 .synonyms, .antonyms 欄位（皆為逗號字串，可為空或未定義）
 * @param {Array}  allWords - getAllWords() 回傳的陣列
 * @returns {{ synonyms: Object[], antonyms: Object[] }}
 *   synonyms / antonyms：在 allWords 中找到的 word 物件陣列（不含 wordObj 本身）
 */
export function getMatchedRelations(wordObj, allWords) {
  const selfKey = (wordObj.word || '').toLowerCase().trim();
  const lookup = new Map(
    allWords.map(w => [(w.word || '').toLowerCase().trim(), w])
  );
  const synKeys = parseRelationString(wordObj.synonyms);
  const antKeys = parseRelationString(wordObj.antonyms);
  return {
    synonyms: synKeys
      .filter(k => k !== selfKey)
      .map(k => lookup.get(k))
      .filter(Boolean),
    antonyms: antKeys
      .filter(k => k !== selfKey)
      .map(k => lookup.get(k))
      .filter(Boolean),
  };
}

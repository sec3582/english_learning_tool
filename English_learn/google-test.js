const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

let tokenClient = null;
let gapiReady = false;
let gisReady = false;

function setStatus(msg) {
  console.log("[GoogleTest]", msg);
}

async function initGapi() {
  // 等 gapi 可用
  if (!window.gapi) return;
  await new Promise((resolve) => gapi.load("client", resolve));

  await gapi.client.init({
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });

  gapiReady = true;
  setStatus("gapi ready");
  enableButtonsIfReady();
}

function initGis() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) return;

 tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: CLIENT_ID,
  scope: SCOPES,
  callback: (resp) => {
    if (resp && resp.access_token) {
      // ✅ 這行最重要：把 token 交給 gapi
      gapi.client.setToken(resp);

      document.getElementById("testWriteBtn").disabled = false;
      alert("登入成功，可以測試寫入了");
    } else {
      alert("登入失敗，請看 console");
      console.error(resp);
    }
  },
});


  gisReady = true;
  setStatus("gis ready");
  enableButtonsIfReady();
}

function enableButtonsIfReady() {
  const signInBtn = document.getElementById("googleSignInBtn");
  if (!signInBtn) return;

  // 兩個都 ready 才能真的用
  signInBtn.disabled = !(gapiReady && gisReady);
}

function wireUI() {
  const signInBtn = document.getElementById("googleSignInBtn");
  const writeBtn = document.getElementById("testWriteBtn");

  signInBtn.disabled = true;
  writeBtn.disabled = true;

  signInBtn.addEventListener("click", () => {
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  writeBtn.addEventListener("click", async () => {
    try {
      const res = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "AddedLogs!A:B",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [[new Date().toISOString(), "test-word"]],
        },
      });
      console.log("append result:", res);
      alert("已成功寫入 AddedLogs！");
    } catch (err) {
      console.error("append error raw:", err);

      // 這三種訊息，至少會有一個有內容
      const msg =
        err?.result?.error?.message ||
        err?.message ||
        JSON.stringify(err);

      alert("寫入失敗原因：\n" + msg);
  }
});

}

// 等 DOM 好了再接線，並輪詢等 Google SDK 真的載入
window.addEventListener("DOMContentLoaded", () => {
  wireUI();

  const t = setInterval(() => {
    // 兩個 SDK 都到齊才初始化
    if (window.gapi && window.google) {
      clearInterval(t);
      initGapi();
      initGis();
    }
  }, 100);
});

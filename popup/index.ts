const sendCommand = (type: string) => {
  console.log(`📨 Sending command: ${type}`);
  console.log('DOES THIS EVEN FIRE ANYMORE?? popup/index.ts');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      console.log(`➡️ Sending to tab ID: ${tabs[0].id}`);
      chrome.tabs.sendMessage(tabs[0].id, { type });
    } else {
      console.error("❌ No active tab found");
    }
  });
};
  
  document.getElementById("play")?.addEventListener("click", () => sendCommand("play"));
  document.getElementById("pause")?.addEventListener("click", () => sendCommand("pause"));
  document.getElementById("skip")?.addEventListener("click", () => sendCommand("skip"));
const form = document.getElementById("lookup-form");
const nameInput = document.getElementById("guest-name");
const feedback = document.getElementById("feedback");
const adminDialog = document.getElementById("admin-dialog");
const adminLoginForm = document.getElementById("admin-login-form");
const adminFeedback = document.getElementById("admin-feedback");
const lookupOwner = new URLSearchParams(window.location.search).get("owner")?.trim();
const inviteSlug = new URLSearchParams(window.location.search).get("invite")?.trim();

let audioContext = null;

function syncAdminDialogState() {
  document.documentElement.classList.toggle("admin-dialog-open", adminDialog?.open === true);
}

function setFeedback(element, message) {
  element.textContent = message;
}

function getAudioContext() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playLookupSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(context.destination);

  const oscA = context.createOscillator();
  oscA.type = "triangle";
  oscA.frequency.setValueAtTime(440, now);
  oscA.frequency.exponentialRampToValueAtTime(740, now + 0.18);
  oscA.connect(gain);
  oscA.start(now);
  oscA.stop(now + 0.35);

  const oscB = context.createOscillator();
  oscB.type = "sine";
  oscB.frequency.setValueAtTime(660, now + 0.04);
  oscB.frequency.exponentialRampToValueAtTime(990, now + 0.28);
  oscB.connect(gain);
  oscB.start(now + 0.04);
  oscB.stop(now + 0.32);
}

async function loginAdmin(username, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Dang nhap that bai");
  }

  localStorage.setItem("adminToken", payload.data.token);
  localStorage.setItem("adminUser", JSON.stringify(payload.data.user));
  window.location.href = "/admin/";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();

  if (!name) {
    setFeedback(feedback, "Vui long nhap ten.");
    return;
  }

  if (name.toLowerCase() === "admin") {
    adminDialog.showModal();
    syncAdminDialogState();
    return;
  }

  setFeedback(feedback, "Dang tim thiep...");
  playLookupSound();

  try {
    if (inviteSlug) {
      window.location.href = `/card.html?slug=${encodeURIComponent(inviteSlug)}`;
      return;
    }

    const query = lookupOwner
      ? `name=${encodeURIComponent(name)}&owner=${encodeURIComponent(lookupOwner)}`
      : `name=${encodeURIComponent(name)}`;
    const response = await fetch(`/api/invitation?${query}`);
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Khong tim thay thiep.");
    }

    window.location.href = payload.data.publicUrl || `/card.html?name=${encodeURIComponent(payload.data.name)}`;
  } catch (error) {
    setFeedback(feedback, error.message);
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  const action = event.submitter?.value;

  if (action === "cancel") {
    adminDialog.close();
    syncAdminDialogState();
    setFeedback(adminFeedback, "");
    return;
  }

  event.preventDefault();
  const username = document.getElementById("admin-username").value.trim();
  const password = document.getElementById("admin-password").value;
  setFeedback(adminFeedback, "Dang xac thuc...");

  try {
    await loginAdmin(username, password);
  } catch (error) {
    setFeedback(adminFeedback, error.message);
  }
});

adminDialog?.addEventListener("close", syncAdminDialogState);
adminDialog?.addEventListener("cancel", () => {
  window.requestAnimationFrame(syncAdminDialogState);
});

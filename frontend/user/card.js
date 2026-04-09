const params = new URLSearchParams(window.location.search);
const guestName = params.get("name");
const invitationSlug = params.get("slug");
const cardContainer = document.getElementById("card-container");
const cardCover = document.getElementById("card-cover");
const coverImage = document.getElementById("cover-image");
const coverFallback = document.getElementById("cover-fallback");
const insideName = document.getElementById("inside-name");
const insideNote = document.getElementById("inside-note");
const cardImage = document.getElementById("card-image");
const cardFeedback = document.getElementById("card-feedback");
const downloadCardButton = document.getElementById("download-card-button");
const wishForm = document.getElementById("wish-form");
const wishSenderNameInput = document.getElementById("wish-sender-name");
const wishMessageInput = document.getElementById("wish-message");
const wishVideoInput = document.getElementById("wish-video-input");
const wishFeedback = document.getElementById("wish-feedback");
const wishCameraFeedback = document.getElementById("wish-camera-feedback");
const wishCameraPreview = document.getElementById("wish-camera-preview");
const wishImagePreview = document.getElementById("wish-image-preview");
const startCameraButton = document.getElementById("start-camera-button");
const capturePhotoButton = document.getElementById("capture-photo-button");
const recordVideoButton = document.getElementById("record-video-button");
const stopRecordingButton = document.getElementById("stop-recording-button");
const clearCaptureButton = document.getElementById("clear-capture-button");
const scareOverlay = document.getElementById("scare-overlay");
const scareVideo = document.getElementById("scare-video");
const skipScareButton = document.getElementById("skip-scare-button");

let invitationData = null;
let isOpening = false;
let scareSequenceCompleted = false;
let audioContext = null;
let wishCameraStream = null;
let wishMediaRecorder = null;
let wishRecordedChunks = [];
let capturedWishVideoFile = null;
let capturedWishImageFile = null;
let invitationAssetsReady = false;

function setFeedback(message) {
  cardFeedback.textContent = message;
}

function setInvitationReadyState(isReady) {
  invitationAssetsReady = isReady;
  cardContainer.classList.toggle("is-loading", !isReady);
  cardCover.classList.toggle("card-cover--disabled", !isReady);
  downloadCardButton.disabled = !isReady;
}

function setWishFeedback(message) {
  wishFeedback.textContent = message;
}

function setWishCameraFeedback(message) {
  wishCameraFeedback.textContent = message;
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

function playCardOpenSound() {
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
  gain.connect(context.destination);

  const osc = context.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(520, now + 0.28);
  osc.frequency.exponentialRampToValueAtTime(310, now + 0.62);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.65);

  const shimmer = context.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(780, now + 0.06);
  shimmer.frequency.exponentialRampToValueAtTime(1180, now + 0.32);
  shimmer.connect(gain);
  shimmer.start(now + 0.06);
  shimmer.stop(now + 0.38);
}

function finalizeCardOpen() {
  cardContainer.classList.add("is-open");
  isOpening = false;
}

function endScareSequence() {
  scareVideo.pause();
  scareVideo.currentTime = 0;
  scareVideo.removeAttribute("src");
  scareVideo.load();
  scareVideo.classList.remove("is-visible");
  scareOverlay.classList.remove("is-visible");
  skipScareButton.classList.remove("is-visible");
  document.body.classList.remove("scare-active", "scare-pending");
  scareSequenceCompleted = true;
  if (!cardContainer.classList.contains("is-open")) {
    setFeedback("Chạm vào thiệp để mở.");
  }
  window.appAudio?.resumeMusicAfterPriorityAudio?.();
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateWishCaptureButtons() {
  const hasStream = Boolean(wishCameraStream);
  const isRecording = wishMediaRecorder?.state === "recording";
  const hasCapture = Boolean(capturedWishVideoFile || capturedWishImageFile);

  capturePhotoButton.disabled = !hasStream || isRecording;
  recordVideoButton.disabled = !hasStream || isRecording;
  stopRecordingButton.disabled = !isRecording;
  clearCaptureButton.disabled = !hasCapture && !hasStream;
}

function clearCapturedWishMedia({ keepCamera = true } = {}) {
  capturedWishVideoFile = null;
  capturedWishImageFile = null;
  wishRecordedChunks = [];
  wishVideoInput.value = "";
  wishImagePreview.hidden = true;
  wishImagePreview.removeAttribute("src");

  if (!keepCamera) {
    stopWishCamera();
  }

  updateWishCaptureButtons();
}

function stopWishCamera() {
  if (wishCameraStream) {
    wishCameraStream.getTracks().forEach((track) => track.stop());
  }

  wishCameraStream = null;
  wishCameraPreview.srcObject = null;
  wishCameraPreview.hidden = true;
  if (wishMediaRecorder?.state === "recording") {
    wishMediaRecorder.stop();
  }
  wishMediaRecorder = null;
  updateWishCaptureButtons();
}

async function startWishCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trinh duyet khong ho tro camera.");
    }

    stopWishCamera();
    clearCapturedWishMedia();

    wishCameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });

    wishCameraPreview.srcObject = wishCameraStream;
    wishCameraPreview.hidden = false;
    await wishCameraPreview.play();
    setWishCameraFeedback("Camera da san sang.");
    updateWishCaptureButtons();
  } catch (error) {
    setWishCameraFeedback(error.message || "Khong mo duoc camera.");
  }
}

function dataUrlToFile(dataUrl, fileName) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    array[index] = binary.charCodeAt(index);
  }
  return new File([array], fileName, { type: mime });
}

function captureWishPhoto() {
  if (!wishCameraStream) {
    setWishCameraFeedback("Hay mo camera truoc khi chup hinh.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = wishCameraPreview.videoWidth || 1280;
  canvas.height = wishCameraPreview.videoHeight || 720;
  const context = canvas.getContext("2d");
  context.drawImage(wishCameraPreview, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  capturedWishImageFile = dataUrlToFile(dataUrl, `wish-photo-${Date.now()}.jpg`);
  capturedWishVideoFile = null;
  wishImagePreview.src = dataUrl;
  wishImagePreview.hidden = false;
  setWishCameraFeedback("Da chup hinh. Ban co the gui ngay bay gio.");
  updateWishCaptureButtons();
}

function getSupportedWishVideoMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
}

function startWishRecording() {
  if (!wishCameraStream) {
    setWishCameraFeedback("Hay mo camera truoc khi quay video.");
    return;
  }

  if (!window.MediaRecorder) {
    setWishCameraFeedback("Trinh duyet khong ho tro quay video truc tiep.");
    return;
  }

  capturedWishImageFile = null;
  wishImagePreview.hidden = true;
  wishImagePreview.removeAttribute("src");
  wishRecordedChunks = [];

  const mimeType = getSupportedWishVideoMimeType();
  wishMediaRecorder = mimeType
    ? new MediaRecorder(wishCameraStream, { mimeType })
    : new MediaRecorder(wishCameraStream);

  wishMediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      wishRecordedChunks.push(event.data);
    }
  });

  wishMediaRecorder.addEventListener("stop", () => {
    if (!wishRecordedChunks.length) {
      setWishCameraFeedback("Khong ghi duoc video.");
      updateWishCaptureButtons();
      return;
    }

    const type = wishRecordedChunks[0].type || mimeType || "video/webm";
    const extension = type.includes("mp4") ? "mp4" : "webm";
    capturedWishVideoFile = new File(wishRecordedChunks, `wish-video-${Date.now()}.${extension}`, { type });
    setWishCameraFeedback("Da quay video xong. Ban co the gui ngay bay gio.");
    updateWishCaptureButtons();
  });

  capturedWishVideoFile = null;
  wishMediaRecorder.start();
  setWishCameraFeedback("Dang quay video...");
  updateWishCaptureButtons();
}

function stopWishRecording() {
  if (wishMediaRecorder?.state === "recording") {
    wishMediaRecorder.stop();
  }
  updateWishCaptureButtons();
}

async function playScareSequence() {
  if (!invitationData?.videoUrl || scareSequenceCompleted) {
    document.body.classList.remove("scare-pending");
    scareSequenceCompleted = true;
    return;
  }

  document.body.classList.add("scare-pending");
  scareOverlay.classList.add("is-visible");

  await wait(2000);

  if (!invitationData?.videoUrl || scareSequenceCompleted) {
    document.body.classList.remove("scare-pending");
    scareOverlay.classList.remove("is-visible");
    return;
  }

  scareVideo.src = invitationData.videoUrl;
  scareVideo.currentTime = 0;
  scareVideo.muted = false;
  scareVideo.classList.add("is-visible");
  skipScareButton.classList.add("is-visible");
  document.body.classList.remove("scare-pending");
  document.body.classList.add("scare-active");
  window.appAudio?.pauseMusicForPriorityAudio?.();

  try {
    await scareVideo.play();
  } catch (error) {
    setFeedback("Trình duyệt chặn phát video tự động. Bạn vẫn có thể mở thiệp.");
    endScareSequence();
  }
}

async function openCard() {
  if (
    !invitationData ||
    !invitationAssetsReady ||
    cardContainer.classList.contains("is-open") ||
    isOpening ||
    !scareSequenceCompleted
  ) {
    if (!invitationAssetsReady) {
      setFeedback("Thiệp đang được chuẩn bị, vui lòng chờ một chút.");
    } else if (!scareSequenceCompleted) {
      setFeedback("Đang phát hiệu ứng mở đầu, vui lòng chờ trong giây lát.");
    }
    return;
  }

  isOpening = true;
  playCardOpenSound();
  finalizeCardOpen();
  setFeedback("Thiệp đã mở. Bạn có thể tải thiệp hoặc gửi lời chúc bên dưới.");
}

function downloadInvitationCard() {
  if (!invitationData?.cardImage) {
    setFeedback("Không có tệp thiệp để tải.");
    return;
  }

  const link = document.createElement("a");
  link.href = invitationData.cardImage;
  link.download = `${(invitationData.name || "thiep").replace(/\s+/g, "-").toLowerCase()}-invitation`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setFeedback("Đang tải thiệp về máy.");
}

function preloadImage(src) {
  if (!src) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => reject(new Error("Không tải được ảnh thiệp."));
    image.src = src;
  });
}

async function submitWish(event) {
  event.preventDefault();

  if (!invitationData?.publicSlug) {
    setWishFeedback("Khong tim thay ma thiep de gui loi chuc.");
    return;
  }

  const formData = new FormData();
  formData.append("slug", invitationData.publicSlug);
  formData.append("senderName", wishSenderNameInput.value.trim());
  formData.append("message", wishMessageInput.value.trim());

  const wishVideoFile = capturedWishVideoFile || wishVideoInput.files?.[0];
  const wishImageFile = capturedWishImageFile;
  if (wishVideoFile) {
    formData.append("wishVideo", wishVideoFile);
  }
  if (wishImageFile) {
    formData.append("wishImage", wishImageFile);
  }

  setWishFeedback("Dang gui loi chuc...");

  try {
    const response = await fetch("/api/wishes", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Gui loi chuc that bai.");
    }

    wishForm.reset();
    clearCapturedWishMedia({ keepCamera: true });
    setWishFeedback("Da gui loi chuc thanh cong.");
  } catch (error) {
    setWishFeedback(error.message);
  }
}

scareVideo.addEventListener("ended", endScareSequence);
skipScareButton.addEventListener("click", endScareSequence);
downloadCardButton.addEventListener("click", downloadInvitationCard);
wishForm.addEventListener("submit", submitWish);
startCameraButton.addEventListener("click", startWishCamera);
capturePhotoButton.addEventListener("click", captureWishPhoto);
recordVideoButton.addEventListener("click", startWishRecording);
stopRecordingButton.addEventListener("click", stopWishRecording);
clearCaptureButton.addEventListener("click", () => {
  clearCapturedWishMedia();
  setWishCameraFeedback("Da xoa ban ghi tam.");
});
wishVideoInput.addEventListener("change", () => {
  capturedWishVideoFile = null;
  capturedWishImageFile = null;
  setWishCameraFeedback(wishVideoInput.files?.length ? "Da chon video tu may." : "");
  updateWishCaptureButtons();
});
window.addEventListener("beforeunload", stopWishCamera);
updateWishCaptureButtons();

async function loadInvitation() {
  if (!guestName && !invitationSlug) {
    setFeedback("Thiếu thông tin để tải thiệp.");
    return;
  }

  setInvitationReadyState(false);
  setFeedback("Đang tải thiệp...");

  try {
    const query = invitationSlug
      ? `slug=${encodeURIComponent(invitationSlug)}`
      : `name=${encodeURIComponent(guestName)}`;
    const response = await fetch(`/api/invitation?${query}`);
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Khong tai duoc du lieu thiep.");
    }

    invitationData = payload.data;
    await Promise.all([
      preloadImage(invitationData.cardImage),
      preloadImage(invitationData.coverImage)
    ]);

    insideName.textContent = invitationData.name;
    insideNote.textContent =
      invitationData.note ||
      "Cảm ơn bạn đã đồng hành trong chặng đường tốt nghiệp. Sự hiện diện của bạn sẽ là niềm vui rất lớn trong ngày đặc biệt này.";
    cardImage.src = invitationData.cardImage;

    if (invitationData.coverImage) {
      coverImage.src = invitationData.coverImage;
      coverImage.hidden = false;
      coverFallback.hidden = true;
    } else {
      coverImage.removeAttribute("src");
      coverImage.hidden = true;
      coverFallback.hidden = false;
    }

    setInvitationReadyState(true);
    setFeedback(invitationData.videoUrl ? "Đang chuẩn bị hiệu ứng mở đầu..." : "Chạm vào thiệp để mở.");

    if (invitationData.videoUrl) {
      await playScareSequence();
      if (scareSequenceCompleted) {
        setFeedback("Chạm vào thiệp để mở.");
      }
    } else {
      scareSequenceCompleted = true;
    }
  } catch (error) {
    setInvitationReadyState(false);
    setFeedback(error.message);
  }
}

cardContainer.addEventListener("click", openCard);
loadInvitation();

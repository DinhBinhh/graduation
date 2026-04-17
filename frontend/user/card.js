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
const wishFileInput = document.getElementById("wish-file-input");
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

async function readJsonSafely(response) {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return {
      success: false,
      message: response.ok
        ? "May chu tra ve du lieu khong hop le."
        : `May chu dang loi (${response.status}). Vui long thu lai sau.`
    };
  }
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
  wishFileInput.value = "";
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
      throw new Error("Trình duyệt không hỗ trợ camera.");
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
    setWishCameraFeedback("Camera đã sẵn sàng.");
    updateWishCaptureButtons();
  } catch (error) {
    setWishCameraFeedback(error.message || "Không mở được camera.");
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
    setWishCameraFeedback("Hãy mở camera trước khi chụp hình.");
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
  setWishCameraFeedback("Đã chụp hình. Bạn có thể gửi ngay bây giờ.");
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
    setWishCameraFeedback("Hãy mở camera trước khi quay video.");
    return;
  }

  if (!window.MediaRecorder) {
    setWishCameraFeedback("Trình duyệt không hỗ trợ quay video trực tiếp.");
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
      setWishCameraFeedback("Không ghi được video.");
      updateWishCaptureButtons();
      return;
    }

    const type = wishRecordedChunks[0].type || mimeType || "video/webm";
    const extension = type.includes("mp4") ? "mp4" : "webm";
    capturedWishVideoFile = new File(wishRecordedChunks, `wish-video-${Date.now()}.${extension}`, { type });
    setWishCameraFeedback("Đã quay video xong. Bạn có thể gửi ngay bây giờ.");
    updateWishCaptureButtons();
  });

  capturedWishVideoFile = null;
  wishMediaRecorder.start();
  setWishCameraFeedback("Đang quay video...");
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

async function downloadInvitationCard() {
  if (!invitationData?.cardImage) {
    setFeedback("Không có tệp thiệp để tải.");
    return;
  }

  const safeName = `${(invitationData.name || "thiep").replace(/\s+/g, "-").toLowerCase()}-invitation.jpg`;

  try {
    setFeedback("Đang chuẩn bị tệp tải về...");
    const response = await fetch(invitationData.cardImage, { mode: "cors" });

    if (!response.ok) {
      throw new Error("Không tải được tệp thiệp.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setFeedback("Đã bắt đầu tải thiệp về máy.");
  } catch (error) {
    const fallbackLink = document.createElement("a");
    fallbackLink.href = invitationData.cardImage;
    fallbackLink.target = "_blank";
    fallbackLink.rel = "noreferrer";
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    fallbackLink.remove();
    setFeedback(error.message || "Không tải trực tiếp được, mình đã mở ảnh ở tab mới để bạn lưu.");
  }
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

function detectSelectedMediaKind(file) {
  if (!file) return null;

  const mimeType = file.type?.toLowerCase() || "";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";

  const fileName = file.name?.toLowerCase() || "";
  if (/\.(mp4|mov|webm|m4v|3gp|ogg)$/i.test(fileName)) return "video";
  if (/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(fileName)) return "image";

  return null;
}

async function submitWish(event) {
  event.preventDefault();

  if (!invitationData?.publicSlug) {
    setWishFeedback("Không tìm thấy mã thiệp để gửi lời chúc.");
    return;
  }

  const formData = new FormData();
  formData.append("slug", invitationData.publicSlug);
  formData.append("senderName", wishSenderNameInput.value.trim());
  formData.append("message", wishMessageInput.value.trim());

  const selectedFile = wishFileInput.files?.[0] || null;
  const selectedMediaKind = detectSelectedMediaKind(selectedFile);
  const wishVideoFile =
    capturedWishVideoFile ||
    (selectedMediaKind === "video" ? selectedFile : null);
  const wishImageFile =
    capturedWishImageFile ||
    (selectedMediaKind === "image" ? selectedFile : null);

  if (wishVideoFile) {
    formData.append("wishVideo", wishVideoFile);
  }
  if (wishImageFile) {
    formData.append("wishImage", wishImageFile);
  }

  if (!wishVideoFile && !wishImageFile && !wishMessageInput.value.trim()) {
    setWishFeedback("Vui lòng chọn ảnh, video hoặc nhập lời chúc.");
    return;
  }

  setWishFeedback("Đang gửi lời chúc...");

  try {
    const response = await fetch("/api/wishes", {
      method: "POST",
      body: formData
    });
    const payload = await readJsonSafely(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Gửi lời chúc thất bại.");
    }

    wishForm.reset();
    clearCapturedWishMedia({ keepCamera: true });
    setWishFeedback("Đã gửi lời chúc thành công.");
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
  setWishCameraFeedback("Đã xóa bản ghi tạm.");
});

wishFileInput.addEventListener("change", () => {
  capturedWishVideoFile = null;
  capturedWishImageFile = null;
  const selectedFile = wishFileInput.files?.[0];
  const selectedMediaKind = detectSelectedMediaKind(selectedFile);

  if (!selectedFile) {
    wishImagePreview.hidden = true;
    wishImagePreview.removeAttribute("src");
    setWishCameraFeedback("");
    updateWishCaptureButtons();
    return;
  }

  if (selectedMediaKind === "image") {
    wishImagePreview.src = URL.createObjectURL(selectedFile);
    wishImagePreview.hidden = false;
    setWishCameraFeedback("Đã chọn ảnh từ máy.");
  } else if (selectedMediaKind === "video") {
    wishImagePreview.hidden = true;
    wishImagePreview.removeAttribute("src");
    setWishCameraFeedback("Đã chọn video từ máy.");
  } else {
    wishImagePreview.hidden = true;
    wishImagePreview.removeAttribute("src");
    setWishCameraFeedback("Không nhận diện được định dạng file. Hãy chọn ảnh hoặc video phổ biến.");
  }

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
    const payload = await readJsonSafely(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Không tải được dữ liệu thiệp.");
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

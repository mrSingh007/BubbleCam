const videoElement = document.getElementById("video");
const statusElement = document.getElementById("camera-status");
let cameraStream;
let disposed = false;

function stopStream(stream) {
  for (const track of stream.getTracks()) track.stop();
}

window.addEventListener("pagehide", () => {
  disposed = true;
  if (cameraStream) stopStream(cameraStream);
  cameraStream = undefined;
  videoElement.srcObject = null;
}, { once: true });

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    // Permission can be granted after the window has already closed.
    if (disposed) {
      stopStream(stream);
      return;
    }
    cameraStream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();
    if (!disposed) statusElement.hidden = true;
  } catch (error) {
    if (cameraStream) stopStream(cameraStream);
    cameraStream = undefined;
    videoElement.srcObject = null;
    if (disposed) return;
    const messages = {
      NotAllowedError: "Camera access denied. Allow camera access in system settings, then reopen the app.",
      NotFoundError: "No camera found. Connect a camera, then reopen the app.",
      NotReadableError: "Camera unavailable. Close other camera apps, then reopen this app.",
    };
    statusElement.textContent = messages[error.name] || "Unable to start the camera. Check your camera and reopen the app.";
    statusElement.hidden = false;
    console.error("Error accessing the camera:", error);
  }
}

startCamera();

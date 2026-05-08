const form = document.querySelector("#card-form");
const message = document.querySelector("#form-message");
const emptyState = document.querySelector("#empty-state");
const result = document.querySelector("#result");
const qrImage = document.querySelector("#qr-image");
const cardLink = document.querySelector("#card-link");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button");
  const payload = Object.fromEntries(new FormData(form).entries());

  message.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Generating...";

  try {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error((data.errors || ["Unable to generate card."]).join(" "));
    }

    qrImage.src = data.qrCode;
    cardLink.href = data.cardUrl;
    cardLink.textContent = data.cardUrl;
    emptyState.classList.add("is-hidden");
    result.classList.remove("is-hidden");
    message.textContent = "Card generated.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Generate QR Card";
  }
});

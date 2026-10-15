"use strict";

const EMAIL = "contact@demir.software";
const IDENTITIES = ["FURKAN DEMIR", "DEMIR.SOFTWARE"];
const GLYPHS = "▓▒░█▄▀■□▪▫▲►▼◄/|\\@#$%&*";

class DedSecScrambler {
  constructor(element, { glyphs = GLYPHS, reducedMotion = false } = {}) {
    this.element = element;
    this.glyphs = Array.from(glyphs);
    this.reducedMotion = reducedMotion;
    this.frame = 0;
    this.run = 0;
    this.finishPending = null;
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
  }

  setText(value) {
    this.element.textContent = value;
    this.element.dataset.text = value;
  }

  cancel() {
    this.run += 1;
    cancelAnimationFrame(this.frame);
    if (this.finishPending) {
      this.finishPending();
      this.finishPending = null;
    }
  }

  async to(target, { duration = 350 } = {}) {
    this.cancel();
    const run = this.run;

    if (this.reducedMotion) {
      this.element.classList.add("is-crossfading");
      await DedSecScrambler.delay(90);
      if (run !== this.run) return;
      this.setText(target);
      this.element.classList.remove("is-crossfading");
      return;
    }

    const targetChars = Array.from(target);
    const sourceChars = Array.from(this.element.textContent || "");
    const length = Math.max(sourceChars.length, targetChars.length);
    const locks = Array.from({ length }, (_, index) => {
      if (targetChars[index] === " ") return 0;
      return 0.2 + Math.random() * 0.8;
    });
    const startedAt = performance.now();

    return new Promise((resolve) => {
      this.finishPending = resolve;

      const tick = (now) => {
        if (run !== this.run) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        let output = "";

        for (let index = 0; index < length; index += 1) {
          const finalCharacter = targetChars[index] ?? "";
          if (!finalCharacter) continue;
          if (finalCharacter === " " || progress >= locks[index]) {
            output += finalCharacter;
          } else {
            output += this.glyphs[Math.floor(Math.random() * this.glyphs.length)];
          }
        }

        this.setText(output);

        if (progress < 1) {
          this.frame = requestAnimationFrame(tick);
          return;
        }

        this.setText(target);
        this.finishPending = null;
        resolve();
      };

      this.frame = requestAnimationFrame(tick);
    });
  }

  static delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
}

class NoiseField {
  constructor(canvas, reducedMotion) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.reducedMotion = reducedMotion;
    this.frame = 0;
    this.previous = 0;
    this.interval = 120;
    this.image = this.context?.createImageData(canvas.width, canvas.height) ?? null;
  }

  setReducedMotion(value) {
    this.reducedMotion = value;
    if (value) cancelAnimationFrame(this.frame);
    else this.start();
  }

  draw() {
    if (!this.context || !this.image) return;
    const { data } = this.image;
    for (let index = 0; index < data.length; index += 4) {
      const shade = Math.random() > 0.5 ? 255 : 0;
      data[index] = shade;
      data[index + 1] = shade;
      data[index + 2] = shade;
      data[index + 3] = 44;
    }
    this.context.putImageData(this.image, 0, 0);
  }

  start() {
    cancelAnimationFrame(this.frame);
    this.draw();
    if (this.reducedMotion) return;

    const animate = (time) => {
      if (time - this.previous >= this.interval) {
        this.draw();
        this.previous = time;
      }
      this.frame = requestAnimationFrame(animate);
    };
    this.frame = requestAnimationFrame(animate);
  }
}

class DedSecInterface {
  constructor() {
    this.viewport = document.querySelector("#viewport");
    this.identityTrigger = document.querySelector("#identity-trigger");
    this.identityText = document.querySelector("#identity-text");
    this.contactLink = document.querySelector("#contact-link");
    this.contactText = document.querySelector("#contact-text");
    this.copyStatus = document.querySelector("#copy-status");
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.identityIndex = 0;
    this.identityBusy = false;
    this.contactBusy = false;
    this.morphTimer = 0;
    this.microTimer = 0;
    this.lastHoverToggle = 0;
    this.identityScrambler = new DedSecScrambler(this.identityText, { reducedMotion: this.reducedMotion });
    this.contactScrambler = new DedSecScrambler(this.contactText, { reducedMotion: this.reducedMotion });
    this.noise = new NoiseField(document.querySelector("#noise"), this.reducedMotion);
  }

  async init() {
    this.bindEvents();
    this.noise.start();
    await this.boot();
    this.scheduleMorph();
    this.scheduleMicroGlitch();
  }

  bindEvents() {
    this.identityTrigger.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      this.lastHoverToggle = performance.now();
      this.toggleIdentity(true);
    });

    this.identityTrigger.addEventListener("click", (event) => {
      if (event.detail > 0 && performance.now() - this.lastHoverToggle < 600) return;
      this.toggleIdentity(true);
    });

    this.contactLink.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") this.activateContact();
    });
    this.contactLink.addEventListener("pointerleave", () => this.deactivateContact());
    this.contactLink.addEventListener("focus", () => this.activateContact());
    this.contactLink.addEventListener("blur", () => this.deactivateContact());
    this.contactLink.addEventListener("click", (event) => this.copyAndEmail(event));

    const handleMotionChange = (event) => {
      this.reducedMotion = event.matches;
      this.identityScrambler.setReducedMotion(event.matches);
      this.contactScrambler.setReducedMotion(event.matches);
      this.noise.setReducedMotion(event.matches);
      if (event.matches) {
        clearTimeout(this.microTimer);
        this.viewport.classList.remove("is-heavy-glitch", "is-micro-glitch");
      } else {
        this.scheduleMicroGlitch();
      }
    };

    if (typeof this.motionQuery.addEventListener === "function") {
      this.motionQuery.addEventListener("change", handleMotionChange);
    } else {
      this.motionQuery.addListener(handleMotionChange);
    }
  }

  async boot() {
    this.identityScrambler.setText("█");
    this.contactScrambler.setText("");
    await this.identityScrambler.to(IDENTITIES[0], { duration: 1100 });
    this.setAccessibleIdentity();
    this.heavyBurst();
    document.body.classList.remove("is-booting");
    await this.contactScrambler.to(EMAIL, { duration: 620 });
  }

  heavyBurst() {
    if (this.reducedMotion) return;
    this.viewport.classList.remove("is-heavy-glitch");
    void this.viewport.offsetWidth;
    this.viewport.classList.add("is-heavy-glitch");
    window.setTimeout(() => this.viewport.classList.remove("is-heavy-glitch"), 350);
  }

  async toggleIdentity(fromInteraction = false) {
    if (this.identityBusy) return;
    this.identityBusy = true;
    clearTimeout(this.morphTimer);
    this.identityIndex = (this.identityIndex + 1) % IDENTITIES.length;
    this.heavyBurst();
    await this.identityScrambler.to(IDENTITIES[this.identityIndex], { duration: 350 });
    this.setAccessibleIdentity();
    this.identityBusy = false;
    this.scheduleMorph(fromInteraction ? 5600 : undefined);
  }

  setAccessibleIdentity() {
    const current = IDENTITIES[this.identityIndex] === IDENTITIES[0] ? "Furkan Demir" : "Demir Software";
    const next = this.identityIndex === 0 ? "Demir Software" : "Furkan Demir";
    this.identityTrigger.setAttribute("aria-label", `${current}. Activate to switch identity to ${next}.`);
  }

  scheduleMorph(delay) {
    clearTimeout(this.morphTimer);
    const milliseconds = delay ?? (5000 + Math.random() * 3000);
    this.morphTimer = window.setTimeout(() => this.toggleIdentity(false), milliseconds);
  }

  scheduleMicroGlitch() {
    clearTimeout(this.microTimer);
    if (this.reducedMotion) return;
    this.microTimer = window.setTimeout(() => {
      this.microGlitch();
      this.scheduleMicroGlitch();
    }, 3000 + Math.random() * 1000);
  }

  microGlitch() {
    if (this.identityBusy || this.reducedMotion) return;
    const stable = IDENTITIES[this.identityIndex];
    const chars = Array.from(stable);
    const available = chars.map((char, index) => (char === " " ? -1 : index)).filter((index) => index >= 0);
    const changes = 1 + Math.floor(Math.random() * 2);
    for (let count = 0; count < changes && available.length; count += 1) {
      const slot = Math.floor(Math.random() * available.length);
      const index = available.splice(slot, 1)[0];
      chars[index] = ["▓", "░", "#"][Math.floor(Math.random() * 3)];
    }
    this.identityScrambler.setText(chars.join(""));
    this.viewport.classList.add("is-micro-glitch");
    window.setTimeout(() => {
      if (!this.identityBusy) this.identityScrambler.setText(stable);
      this.viewport.classList.remove("is-micro-glitch");
    }, 100);
  }

  async activateContact() {
    if (this.contactBusy || this.contactLink.classList.contains("is-copied")) return;
    this.contactBusy = true;
    await this.contactScrambler.to(EMAIL, { duration: 240 });
    this.contactLink.classList.add("is-inverted");
    this.contactBusy = false;
  }

  deactivateContact() {
    if (!this.contactLink.classList.contains("is-copied")) {
      this.contactLink.classList.remove("is-inverted");
    }
  }

  async copyAndEmail(event) {
    event.preventDefault();
    if (this.contactBusy) return;

    const mailto = this.contactLink.href;
    this.contactBusy = true;
    this.contactLink.classList.remove("is-inverted");
    this.contactLink.classList.add("is-copied");
    this.contactScrambler.setText("[ COPIED_TO_CLIPBOARD ]");

    const copyPromise = this.copyEmail();

    // Preserve the click's user-activation window for the mail application.
    window.location.href = mailto;

    const copied = await copyPromise;
    this.contactLink.setAttribute("aria-label", copied ? `${EMAIL} copied. Opening your email application.` : `Opening your email application for ${EMAIL}.`);
    this.copyStatus.textContent = copied ? `${EMAIL} copied to clipboard.` : "Clipboard access was unavailable.";

    await DedSecScrambler.delay(1500);
    this.contactLink.classList.remove("is-copied");
    await this.contactScrambler.to(EMAIL, { duration: 320 });
    this.contactLink.setAttribute("aria-label", `Email Furkan Demir at ${EMAIL}`);
    this.copyStatus.textContent = "";
    this.contactBusy = false;
  }

  async copyEmail() {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(EMAIL);
        return true;
      } catch {
        return this.fallbackCopy();
      }
    }
    return this.fallbackCopy();
  }

  fallbackCopy() {
    const field = document.createElement("textarea");
    field.value = EMAIL;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    field.style.pointerEvents = "none";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
    return copied;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const interfaceController = new DedSecInterface();
  interfaceController.init();
});

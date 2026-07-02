import { soundManager } from '../utils/soundManager';

export class DialogueSystem {
	constructor() {
		this.container = document.getElementById('dialogue-container');
		this.textElem = document.getElementById('dialogue-text');
		this.dialogues = [
			"Welcome, Pilot. I am Commander Dimar Tarmizi. I will be your flight instructor today.",
			"You are currently piloting the F-15 Eaglehawk, an advanced air superiority fighter.",
			"Check your HUD. The left box shows your SPEED in knots, and the right box shows your ALTITUDE.",
			"The compass at the top shows your heading, and the crosshair in the center helps you level your flight.",
			"Your weapons are armed. You have the M61A1 Vulcan Cannon and AIM-9 Sidewinder missiles.",
			"Use 'W' and 'S' to control your throttle. Keep an eye on your energy state.",
			"Control your pitch and roll with the ARROW keys. Use 'A' and 'D' for rudder control.",
			"Engage afterburners with SPACE for maximum thrust, but watch your fuel consumption.",
			"Cycle your weapons with '1', '2', or 'Q'. Press 'F' or ENTER to engage your targets.",
			"If you detect an incoming threat, press 'V' to release flares and break the lock.",
			"The tactical minimap at the bottom right shows your radar contacts and current region.",
			"Good luck out there, Pilot. Commander Tarmizi, out."
		];
		this.currentIndex = 0;
		this.isActive = false;
		this.isPaused = false;
		this.currentCharIndex = 0;
		this.isWaitingForNext = false;
		this.lastSoundIndex = -1;
		this.glitchSounds = [
			'glitch-1',
			'glitch-2',
			'glitch-3',
			'glitch-4'
		];
	}

	start() {
		if (localStorage.getItem('tutorialCompleted')) return;

		this.stop();

		this.currentIndex = 0;
		this.currentCharIndex = 0;
		this.isActive = true;
		this.isPaused = false;
		this.isWaitingForNext = false;

		this.startTimeout = setTimeout(() => {
			if (!this.isActive || this.isPaused) return;
			this.container.classList.remove('hidden');
			this.showNext();
		}, 7000);
	}

	pause() {
		if (!this.isActive) return;
		this.isPaused = true;
		this.container.classList.add('hidden');
		if (this.startTimeout) clearTimeout(this.startTimeout);
		if (this.typewriterTimeout) clearTimeout(this.typewriterTimeout);
		if (this.nextTimeout) clearTimeout(this.nextTimeout);
	}

	resume() {
		if (!this.isActive || !this.isPaused) return;
		this.isPaused = false;
		this.container.classList.remove('hidden');

		if (this.isWaitingForNext) {
			this.nextTimeout = setTimeout(() => {
				this.currentIndex++;
				this.currentCharIndex = 0;
				this.showNext();
			}, 2000);
		} else {
			this.typeWriter();
		}
	}

	stop() {
		this.isActive = false;
		this.isPaused = false;
		this.container.classList.add('hidden');
		if (this.startTimeout) clearTimeout(this.startTimeout);
		if (this.typewriterTimeout) clearTimeout(this.typewriterTimeout);
		if (this.nextTimeout) clearTimeout(this.nextTimeout);
	}

	showNext() {
		if (!this.isActive || this.isPaused) return;

		if (this.currentIndex >= this.dialogues.length) {
			this.finish();
			return;
		}

		this.textElem.textContent = '';
		this.currentCharIndex = 0;
		this.isWaitingForNext = false;

		this.playRandomGlitch();
		this.typeWriter();
	}

	typeWriter() {
		if (!this.isActive || this.isPaused) return;

		const text = this.dialogues[this.currentIndex];
		if (this.currentCharIndex < text.length) {
			this.textElem.textContent = text.substring(0, this.currentCharIndex + 1);
			this.currentCharIndex++;
			this.typewriterTimeout = setTimeout(() => this.typeWriter(), 30);
		} else {
			this.isWaitingForNext = true;
			this.nextTimeout = setTimeout(() => {
				this.currentIndex++;
				this.currentCharIndex = 0;
				this.showNext();
			}, 4000);
		}
	}

	playRandomGlitch() {
		let index;
		do {
			index = Math.floor(Math.random() * this.glitchSounds.length);
		} while (index === this.lastSoundIndex);

		this.lastSoundIndex = index;
		soundManager.play(this.glitchSounds[index]);
	}

	skip() {
		if (!this.isActive || this.isPaused) return;

		const text = this.dialogues[this.currentIndex];
		if (!text) return;

		if (!this.isWaitingForNext) {
			if (this.typewriterTimeout) clearTimeout(this.typewriterTimeout);
			this.textElem.textContent = text;
			this.currentCharIndex = text.length;
			this.isWaitingForNext = true;

			if (this.nextTimeout) clearTimeout(this.nextTimeout);
			this.nextTimeout = setTimeout(() => {
				this.currentIndex++;
				this.currentCharIndex = 0;
				this.showNext();
			}, 4000);
		} else {
			if (this.nextTimeout) clearTimeout(this.nextTimeout);
			this.currentIndex++;
			this.currentCharIndex = 0;
			this.showNext();
		}
	}

	finish() {
		this.isActive = false;
		this.container.classList.add('hidden');
		localStorage.setItem('tutorialCompleted', 'true');
	}
}

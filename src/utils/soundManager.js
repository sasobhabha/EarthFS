import * as THREE from 'three';

class SoundManager {
	constructor() {
		this.listener = new THREE.AudioListener();
		this.sounds = new Map();
		this.loader = new THREE.AudioLoader();
		this._voicePool = [];
		this._activeOneShots = new Set();
		this._lastRandom = {};
	}

	init(camera) {
		camera.add(this.listener);
	}

	async loadSound(name, url, loop = false, volume = 0.5) {
		return new Promise((resolve, reject) => {
			this.loader.load(url, (buffer) => {
				const sound = new THREE.Audio(this.listener);
				sound.setBuffer(buffer);
				sound.setLoop(loop);
				sound.setVolume(volume);
				sound._baseVolume = volume;
				sound._isLooping = loop;
				this.sounds.set(name, sound);
				resolve(sound);
			}, undefined, reject);
		});
	}

	_getVoice() {
		return this._voicePool.pop() || new THREE.Audio(this.listener);
	}

	_releaseVoice(voice) {
		if (voice.isPlaying) voice.stop();
		this._activeOneShots.delete(voice);
		this._voicePool.push(voice);
	}

	play(name, fadeInDuration = 0) {
		const originalName = name;

		if (name.endsWith('-random')) {
			const prefix = name.replace('-random', '-');
			const variants = Array.from(this.sounds.keys()).filter(k => k.startsWith(prefix));

			if (variants.length > 0) {
				const lastIdx = this._lastRandom[name] ?? -1;
				let idx = Math.floor(Math.random() * variants.length);

				if (variants.length > 1 && idx === lastIdx) {
					idx = (idx + 1) % variants.length;
				}

				this._lastRandom[name] = idx;
				name = variants[idx];
			}
		}

		const sound = this.sounds.get(name);
		if (!sound) return;

		const { context } = sound;
		if (context.state === 'suspended') context.resume();

		const targetVolume = sound._baseVolume ?? 0.5;

		if (!sound._isLooping) {
			const voice = this._getVoice();
			voice.setBuffer(sound.buffer);
			voice.setVolume(targetVolume);
			voice.play();

			voice._parentName = originalName || name;
			this._activeOneShots.add(voice);

			voice.source.onended = () => {
				if (!voice._isPaused) {
					this._releaseVoice(voice);
				}
			};
			return;
		}

		if (!sound.isPlaying) {
			sound.play();
			if (fadeInDuration > 0) {
				sound.setVolume(0);
				const now = context.currentTime;
				sound.gain.gain.cancelScheduledValues(now);
				sound.gain.gain.setValueAtTime(0, now);
				sound.gain.gain.linearRampToValueAtTime(targetVolume, now + fadeInDuration);
			} else {
				sound.setVolume(targetVolume);
			}
		}
	}

	stop(name, fadeOutDuration = 0) {
		const sound = this.sounds.get(name);
		if (!sound) return;

		if (sound.isPlaying) {
			if (fadeOutDuration > 0) {
				const now = sound.context.currentTime;
				sound.gain.gain.cancelScheduledValues(now);
				sound.gain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
				setTimeout(() => {
					if (sound.isPlaying) {
						sound.stop();
						sound.setVolume(sound._baseVolume ?? 0.5);
					}
				}, fadeOutDuration * 1000 + 50);
			} else {
				sound.stop();
			}
		}

		this._activeOneShots.forEach(voice => {
			if (voice._parentName === name) {
				voice.source.onended = null;
				this._releaseVoice(voice);
			}
		});
	}

	setVolume(name, volume) {
		const sound = this.sounds.get(name);
		if (sound) {
			sound.gain.gain.setValueAtTime(volume, sound.context.currentTime);
		}
	}

	isPlaying(name) {
		const sound = this.sounds.get(name);
		if (!sound) return false;
		if (sound.isPlaying) return true;

		for (const voice of this._activeOneShots) {
			if (voice._parentName === name && (voice.isPlaying || voice._isPaused)) return true;
		}
		return false;
	}

	pauseAll() {
		this.sounds.forEach(sound => {
			if (sound.isPlaying) {
				sound.pause();
				sound._wasPlaying = true;
			}
		});

		this._activeOneShots.forEach(voice => {
			if (voice.isPlaying) {
				voice.pause();
				voice._isPaused = true;
			}
		});
	}

	resumeAll() {
		this.sounds.forEach(sound => {
			if (sound._wasPlaying) {
				sound.play();
				sound._wasPlaying = false;
			}
		});

		this._activeOneShots.forEach(voice => {
			if (voice._isPaused) {
				voice.play();
				voice._isPaused = false;
			}
		});
	}

	stopAll(fadeOutDuration = 0) {
		this.sounds.forEach((_, name) => this.stop(name, fadeOutDuration));
	}
}

export const soundManager = new SoundManager();

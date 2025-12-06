// Game State
let player;
let audioLoaded = false;
let isPlaying = false;
let particles = [];
let beats = [];
let lastBeatTime = 0;
let score = 0;
let totalHits = 0;
let successfulHits = 0;

// Audio Analysis
let analyzer;
let meydaAnalyzer;

// Score Calculation
function calculateScore(accuracy) {
    if (accuracy >= 95) return 'SSS';
    if (accuracy >= 90) return 'SS';
    if (accuracy >= 85) return 'S';
    if (accuracy >= 80) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    if (accuracy >= 50) return 'D';
    return 'E';
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

function initializeGame() {
    // Audio Setup
    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        const fileType = file.type;
        if (!fileType.includes('audio/mpeg') && !fileType.includes('audio/wav') && 
            !fileType.includes('audio/mp3') && !fileType.includes('audio/wave')) {
            document.getElementById('status').textContent = 'Please upload MP3 or WAV only';
            return;
        }

        document.getElementById('status').textContent = 'Loading...';

        // Handle async operations separately
        loadAudioFile(file);
    });

    // Play Btn
    document.getElementById('playBtn').addEventListener('click', async () => {
        if (!audioLoaded) return;
        
        await Tone.start();
        player.start();
        
        isPlaying = true;
        document.getElementById('status').textContent = 'Playing';
        document.getElementById('playBtn').disabled = true;
        document.getElementById('resetBtn').disabled = false;
    });

    // Reset Btn
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (player) {
            player.stop();
        }
        
        isPlaying = false;
        
        // Reset all game state
        score = 0;
        totalHits = 0;
        successfulHits = 0;
        lastBeatTime = 0;
        particles = [];
        beats = [];
        
        // Reset beat times for BPM
        if (typeof beatTimes !== 'undefined') {
            beatTimes = [];
        }
        
        // Reset UI
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('accuracy').textContent = '0%';
        document.getElementById('score').textContent = '--';
        document.getElementById('bpm').textContent = '--';
        document.getElementById('energy').textContent = '--';
        document.getElementById('playBtn').disabled = false;
        document.getElementById('resetBtn').disabled = true;
        
        // Clear the persistent background layer
        if (typeof backgroundLayer !== 'undefined') {
            backgroundLayer.background(10, 20, 5);
        }
    });
}

async function loadAudioFile(file) {
    try {
        // Clean up existing player
        if (player) {
            player.dispose();
        }
        
        if (meydaAnalyzer) {
            meydaAnalyzer.stop();
        }

        // Load audio into Tone.js
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);

        // Create Tone.js player
        player = new Tone.Player(audioBuffer).toDestination();

        // Create analyzer that connects to Tone's context
        analyzer = new Tone.Analyser('waveform', 256);
        player.connect(analyzer);
        
        // Create frequency analyzer for bass/percussion detection
        const fft = new Tone.FFT(512);
        player.connect(fft);
        window.fftAnalyzer = fft; // Make it globally accessible

        audioLoaded = true;
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('playBtn').disabled = false;
    } catch (error) {
        console.error('Error loading audio: ', error);
        document.getElementById('status').textContent = 'Error loading audio!';
    }
}

// Key Inputs
const validKeys = ['D', 'F', 'J', 'K'];

document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();

    if (validKeys.includes(key) && isPlaying) {
        totalHits++;

        const rune = document.querySelector(`[data-key="${key}"]`);
        if (rune) {
            rune.classList.add('active');
        }

        const timeSinceLastBeat = Date.now() - lastBeatTime;
        const isOnBeat = timeSinceLastBeat < 200;

        if (isOnBeat) {
            successfulHits++;
            score += 100;
        } else {
            score += 10;
        }

        const accuracy = (successfulHits / totalHits * 100).toFixed(1);
        const scoreRank = calculateScore(parseFloat(accuracy));

        document.getElementById('accuracy').textContent = accuracy + '%';
        document.getElementById('score').textContent = scoreRank;

        if (typeof createSpellParticles === 'function') {
            createSpellParticles(key);
        }

        setTimeout(() => {
            if (rune) {
                rune.classList.remove('active');
            }
        }, 100);
    }
});

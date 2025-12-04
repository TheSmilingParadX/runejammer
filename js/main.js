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
let audioContent;
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

// Audio Setup
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('status').textContent = 'Loading...';

    try {
        if (player) {
            player.dispose();
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);

        player = new Tone.Player(audioBuffer).toDestination();

        if (!audioContext) {
            audioContext = Tone.context.rawContext;
        }

        if (meydaAnalyzer) {
            meydaAnalyzer.stop();
        }

        meydaAnalyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: player._buffer._buffer,
            bufferSize: 512,
            featureExtractors: ['energy', 'rms', 'zcr'],
            callback: (features) => {

            }
        });

        audioLoaded = true;
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('playBtn').disabled = false;
    } catch (error) {
        console.error('Error loading audio: ', error);
        document.getElementById('status').textContent = 'Error loading audio!';
    }
});

// Play Btn
document.getElementById('playBtn').addEventListener('click', async () => {
    if (!audioLoaded) return;
    
    await Tone.start();
    player.start();
    
    if (meydaAnalyzer) {
        meydaAnalyzer.start();
    }
    
    isPlaying = true;
    document.getElementById('status').textContent = 'Playing';
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
});

// Pause Btn
document.getElementById('pauseBtn').addEventListener('click', () => {
    if (player) {
        player.stop();
    }
    
    if (meydaAnalyzer) {
        meydaAnalyzer.stop();
    }
    
    isPlaying = false;
    document.getElementById('status').textContent = 'Paused';
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
});

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

        createSpellParticles(key);

        setTimeout(() => {
            if (rune) {
                rune.classList.remove('active');
            }
        }, 100);
    }
});
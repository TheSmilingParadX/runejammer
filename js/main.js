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
let missedNotes = 0;

// Audio Analysis
let analyzer;
let meydaAnalyzer;

// Beatmap System
let beatmap;
let beatmapRenderer;
let detectedBeats = []; // Store beat times during detection phase
let currentBPM = 120;
let lastMissCheckTime = 0;

// Countdown and delay
let countdownActive = false;
let countdownStartTime = 0;
let countdownDuration = 0; // No visual countdown needed anymore

// Screenshot feature
let finalScreenshot = null;
let songEnded = false;

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
        
        // Generate beatmap from pre-analyzed beats
        if (beatmap && beatmap.notes.length === 0) {
            document.getElementById('status').textContent = 'Generating beatmap...';
            beatmap.generateFromAudio(null, currentBPM, detectedBeats);
            document.getElementById('status').textContent = 'Ready to play!';
        }
        
        // Start audio immediately - notes already have approach time built in
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
        countdownActive = false;
        songEnded = false;
        finalScreenshot = null;
        
        // Hide screenshot UI if visible
        const screenshotUI = document.getElementById('screenshotUI');
        if (screenshotUI) {
            screenshotUI.style.display = 'none';
        }
        
        // Reset all game state
        score = 0;
        totalHits = 0;
        successfulHits = 0;
        missedNotes = 0;
        lastBeatTime = 0;
        lastMissCheckTime = 0;
        particles = [];
        beats = [];
        
        // Clear bubbles
        if (typeof bubbles !== 'undefined') {
            bubbles = [];
        }
        
        // Reset beatmap
        if (beatmap) {
            beatmap.reset();
        }
        
        // Reset beat times for BPM
        if (typeof beatTimes !== 'undefined') {
            beatTimes = [];
        }
        
        // Reset UI
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('accuracy').textContent = '0%';
        document.getElementById('score').textContent = '--';
        document.getElementById('bpm').textContent = currentBPM;
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

        // Reset beat detection arrays
        detectedBeats = [];
        beatTimes = [];

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

        // Initialize beatmap system
        beatmap = new Beatmap();
        beatmapRenderer = new BeatmapRenderer(beatmap, window);

        // Pre-analyze audio for beat detection
        document.getElementById('status').textContent = 'Analyzing audio...';
        await preAnalyzeAudio(audioBuffer);

        audioLoaded = true;
        document.getElementById('status').textContent = 'Ready! Found ' + detectedBeats.length + ' beats';
        document.getElementById('playBtn').disabled = false;
    } catch (error) {
        console.error('Error loading audio: ', error);
        document.getElementById('status').textContent = 'Error loading audio!';
    }
}

// Pre-analyze audio to detect beats before playback
async function preAnalyzeAudio(audioBuffer) {
    return new Promise((resolve) => {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const windowSize = 1024; // Smaller window for better time resolution
        const hopSize = 256; // Smaller hop for more frequent checks
        
        let energyHistory = [];
        let lastBeatTime = -1000; // Start negative to allow early beats
        const minBeatInterval = 200; // Reduced from 300ms - allow faster beats
        
        // Calculate energy for each window
        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            let energy = 0;
            
            // Calculate RMS energy for this window
            for (let j = 0; j < windowSize; j++) {
                energy += channelData[i + j] * channelData[i + j];
            }
            energy = Math.sqrt(energy / windowSize);
            
            const timeMs = (i / sampleRate) * 1000;
            
            // Keep a history of recent energy values for adaptive threshold
            energyHistory.push(energy);
            if (energyHistory.length > 86) { // About 1 second of history at new hop size
                energyHistory.shift();
            }
            
            // Calculate adaptive threshold - more sensitive now
            const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
            const threshold = avgEnergy * 1.3; // Reduced from 1.5 to 1.3 for more sensitivity
            
            // Detect beat if energy spike above threshold and enough time has passed
            if (energy > threshold && energy > 0.05 && (timeMs - lastBeatTime) > minBeatInterval) {
                detectedBeats.push(timeMs);
                lastBeatTime = timeMs;
                
                // Update BPM calculation
                beatTimes.push(timeMs);
                if (beatTimes.length > 10) {
                    beatTimes.shift();
                }
                
                if (beatTimes.length >= 2) {
                    let intervals = [];
                    for (let k = 1; k < beatTimes.length; k++) {
                        intervals.push(beatTimes[k] - beatTimes[k-1]);
                    }
                    let avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
                    currentBPM = Math.round(60000 / avgInterval);
                }
            }
        }
        
        // Update BPM display
        document.getElementById('bpm').textContent = currentBPM;
        
        resolve();
    });
}

// Key Inputs
const validKeys = ['D', 'F', 'J', 'K'];

document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();

    if (validKeys.includes(key) && isPlaying) {
        const rune = document.querySelector(`[data-key="${key}"]`);
        if (rune) {
            rune.classList.add('active');
        }

        // Check beatmap hit
        const currentTime = player.now() * 1000; // Convert to milliseconds
        const hitResult = beatmap ? beatmap.checkHit(key, currentTime) : { success: false };

        if (hitResult.success) {
            totalHits++;
            successfulHits++;
            
            // Score based on timing accuracy
            const accuracyScore = Math.floor(hitResult.accuracy * 100);
            score += accuracyScore;
            
            // Visual feedback - only on successful hits
            if (typeof createSpellParticles === 'function') {
                createSpellParticles(key);
            }
            
            // Show timing feedback briefly
            const timingElement = document.getElementById('status');
            const originalText = timingElement.textContent;
            timingElement.textContent = hitResult.timing + '!';
            setTimeout(() => {
                timingElement.textContent = originalText;
            }, 200);
        } else {
            totalHits++;
            // No score added for misses
            // No particles created
        }

        // Update accuracy display
        const totalNotes = totalHits + missedNotes;
        const accuracy = totalNotes > 0 ? (successfulHits / totalNotes * 100).toFixed(1) : 0;
        const scoreRank = calculateScore(parseFloat(accuracy));

        document.getElementById('accuracy').textContent = accuracy + '%';
        document.getElementById('score').textContent = scoreRank;

        setTimeout(() => {
            if (rune) {
                rune.classList.remove('active');
            }
        }, 100);
    }
});

// Function to check for missed notes
function checkMissedNotes() {
    if (!isPlaying || !beatmap || !player) return;
    
    const currentTime = player.now() * 1000;
    
    // Check if song has ended
    if (player.state === 'stopped' && !songEnded) {
        songEnded = true;
        captureScreenshot();
    }
    
    // Only check every 50ms to avoid excessive processing
    if (currentTime - lastMissCheckTime < 50) return;
    lastMissCheckTime = currentTime;
    
    // Find notes that have passed the hit window without being hit
    beatmap.notes.forEach(note => {
        if (!note.hit && !note.missed) {
            const timePassed = currentTime - note.time;
            
            // If note is more than 150ms past its hit time, it's a miss
            if (timePassed > 150) {
                note.missed = true;
                missedNotes++;
                
                // Update accuracy immediately
                const totalNotes = totalHits + missedNotes;
                const accuracy = totalNotes > 0 ? (successfulHits / totalNotes * 100).toFixed(1) : 0;
                const scoreRank = calculateScore(parseFloat(accuracy));
                
                document.getElementById('accuracy').textContent = accuracy + '%';
                document.getElementById('score').textContent = scoreRank;
            }
        }
    });
}

// Capture screenshot when song ends
function captureScreenshot() {
    if (typeof p5Canvas !== 'undefined' && p5Canvas) {
        // Wait a brief moment for final particles to settle
        setTimeout(() => {
            finalScreenshot = p5Canvas.canvas.toDataURL('image/png');
            showScreenshotUI();
        }, 500);
    }
}

// Show screenshot save UI
function showScreenshotUI() {
    let screenshotUI = document.getElementById('screenshotUI');
    
    if (!screenshotUI) {
        // Create screenshot UI if it doesn't exist
        screenshotUI = document.createElement('div');
        screenshotUI.id = 'screenshotUI';
        screenshotUI.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 30px;
            border-radius: 20px;
            border: 3px solid #6a0dad;
            z-index: 100;
            text-align: center;
        `;
        
        screenshotUI.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #fff;">Song Complete!</h2>
            <img id="screenshotPreview" style="max-width: 400px; max-height: 300px; border: 2px solid #fff; border-radius: 10px; margin-bottom: 20px;">
            <div>
                <button id="saveScreenshotBtn" style="margin: 5px;">Save Screenshot</button>
                <button id="closeScreenshotBtn" style="margin: 5px;">Close</button>
            </div>
        `;
        
        document.body.appendChild(screenshotUI);
        
        // Add event listeners
        document.getElementById('saveScreenshotBtn').addEventListener('click', () => {
            downloadScreenshot();
        });
        
        document.getElementById('closeScreenshotBtn').addEventListener('click', () => {
            screenshotUI.style.display = 'none';
        });
    }
    
    // Set the screenshot preview
    document.getElementById('screenshotPreview').src = finalScreenshot;
    screenshotUI.style.display = 'block';
}

// Download the screenshot
function downloadScreenshot() {
    if (finalScreenshot) {
        const link = document.createElement('a');
        link.download = 'runejammer-' + Date.now() + '.png';
        link.href = finalScreenshot;
        link.click();
    }
}
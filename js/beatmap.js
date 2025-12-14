class Beatmap {
    constructor() {
        this.notes = []; // Array of note objects {time, lane, type}
        this.lanes = ['D', 'F', 'J', 'K'];
        this.difficulty = 'normal';
        this.noteSpeed = 300; // pixels per second
        this.hitZoneY = null; // Will be set based on window height
        this.spawnY = 0;
        this.approachTime = 2000; // ms - how long notes take to reach hit zone
        
        // Rune characters to display on notes
        this.runes = ['ᛗ', 'ᛞ', 'ᛚ', 'ᛒ', 'ᚲ', 'ᚨ', 'ᚷ', 'ᛃ', 'ᛈ', 'ᚹ', 'ᚺ', 'ᛁ', 'ᛋ', 'ᚢ', 'ᚾ', 'ᛟ', 'ᚱ', 'ᚠ', 'ᚦ', 'ᛏ', 'ᛜ', 'ᛖ', 'ᛇ', 'ᛉ'];
    }

    // Generate beatmap from audio analysis
    generateFromAudio(audioBuffer, bpm, beats) {
        this.notes = [];
        
        // Use detected beats to create note patterns
        beats.forEach((beatTime, index) => {
            // Add approach time to each beat so notes spawn above and travel down
            const adjustedBeatTime = beatTime + this.approachTime;
            
            // Determine pattern complexity based on energy and position in song
            const pattern = this.generatePattern(adjustedBeatTime, index, bpm);
            this.notes.push(...pattern);
        });

        // Sort notes by time
        this.notes.sort((a, b) => a.time - b.time);
        
        return this.notes;
    }

    // Generate note patterns based on beat characteristics
    generatePattern(beatTime, beatIndex, bpm) {
        const pattern = [];
        const beatInterval = 60000 / bpm; // ms per beat
        
        // Determine pattern type based on position in measure
        const positionInMeasure = beatIndex % 4;
        
        if (positionInMeasure === 0) {
            // Downbeat - single strong note
            pattern.push({
                time: beatTime,
                lane: this.lanes[Math.floor(Math.random() * 4)],
                type: 'normal',
                strength: 1.0,
                rune: this.runes[Math.floor(Math.random() * this.runes.length)]
            });
        } else if (positionInMeasure === 2) {
            // Backbeat - possible double note
            if (Math.random() > 0.3) {
                const lane1 = Math.floor(Math.random() * 4);
                let lane2 = lane1;
                while (lane2 === lane1) {
                    lane2 = Math.floor(Math.random() * 4);
                }
                pattern.push({
                    time: beatTime,
                    lane: this.lanes[lane1],
                    type: 'normal',
                    strength: 0.8,
                    rune: this.runes[Math.floor(Math.random() * this.runes.length)]
                });
                pattern.push({
                    time: beatTime,
                    lane: this.lanes[lane2],
                    type: 'normal',
                    strength: 0.8,
                    rune: this.runes[Math.floor(Math.random() * this.runes.length)]
                });
            } else {
                pattern.push({
                    time: beatTime,
                    lane: this.lanes[Math.floor(Math.random() * 4)],
                    type: 'normal',
                    strength: 0.8,
                    rune: this.runes[Math.floor(Math.random() * this.runes.length)]
                });
            }
        } else {
            // Offbeats - lighter, more varied
            if (Math.random() > 0.5) {
                pattern.push({
                    time: beatTime,
                    lane: this.lanes[Math.floor(Math.random() * 4)],
                    type: 'normal',
                    strength: 0.6,
                    rune: this.runes[Math.floor(Math.random() * this.runes.length)]
                });
            }
        }
        
        return pattern;
    }

    // Get notes that should be visible at current time
    getActiveNotes(currentTime) {
        return this.notes.filter(note => {
            const timeUntilHit = note.time - currentTime;
            return timeUntilHit > -500 && timeUntilHit < this.approachTime;
        });
    }

    // Calculate note Y position based on timing
    getNoteY(note, currentTime) {
        const timeUntilHit = note.time - currentTime;
        const progress = 1 - (timeUntilHit / this.approachTime);
        return this.spawnY + (this.hitZoneY - this.spawnY) * progress;
    }

    // Check if a key press hits a note
    checkHit(lane, currentTime, tolerance = 150) {
        const notesInLane = this.notes.filter(n => 
            n.lane === lane && !n.hit && Math.abs(n.time - currentTime) < tolerance
        );

        if (notesInLane.length > 0) {
            // Find closest note
            const closest = notesInLane.reduce((prev, curr) => {
                return Math.abs(curr.time - currentTime) < Math.abs(prev.time - currentTime) ? curr : prev;
            });

            const timingDiff = Math.abs(closest.time - currentTime);
            const accuracy = 1 - (timingDiff / tolerance);
            
            closest.hit = true;
            
            return {
                success: true,
                note: closest,
                accuracy: accuracy,
                timing: this.getTimingRank(timingDiff)
            };
        }

        return { success: false };
    }

    getTimingRank(diff) {
        if (diff < 30) return 'PERFECT';
        if (diff < 60) return 'GREAT';
        if (diff < 100) return 'GOOD';
        return 'OK';
    }

    reset() {
        this.notes.forEach(note => {
            note.hit = false;
            note.missed = false;
        });
    }
}

// Visual representation of beatmap
class BeatmapRenderer {
    constructor(beatmap, p5Instance) {
        this.beatmap = beatmap;
        this.p5 = p5Instance;
        this.laneWidth = 80;
        this.laneSpacing = 20;
        this.totalWidth = (this.laneWidth * 4) + (this.laneSpacing * 3);
        this.centerX = null;
        this.laneXPositions = [];
        
        // Colors for each lane
        this.laneColors = {
            'D': 280,   // purple
            'F': 180,   // cyan
            'J': 60,    // yellow
            'K': 0      // red
        };
    }

    setup() {
        // Calculate center position
        this.centerX = this.p5.width / 2 - this.totalWidth / 2;
        
        // Calculate X position for each lane
        for (let i = 0; i < 4; i++) {
            this.laneXPositions[i] = this.centerX + (i * (this.laneWidth + this.laneSpacing)) + this.laneWidth / 2;
        }
        
        // Set hit zone and spawn positions
        this.beatmap.hitZoneY = this.p5.height - 100;
        this.beatmap.spawnY = 50;
    }

    draw(currentTime) {
        if (!this.centerX) this.setup();

        // Draw lane guides
        this.drawLanes();

        // Draw hit zone
        this.drawHitZone();

        // Draw notes
        const activeNotes = this.beatmap.getActiveNotes(currentTime);
        activeNotes.forEach(note => {
            if (!note.hit && !note.missed) {
                this.drawNote(note, currentTime);
            }
        });

        // Draw approach lines
        this.drawApproachLines();
    }

    drawLanes() {
        this.p5.push();
        this.p5.strokeWeight(2);
        
        for (let i = 0; i < 4; i++) {
            const x = this.laneXPositions[i];
            const lane = this.beatmap.lanes[i];
            const hue = this.laneColors[lane];
            
            this.p5.stroke(hue, 30, 80, 20);
            this.p5.line(x, this.beatmap.spawnY, x, this.beatmap.hitZoneY);
        }
        
        this.p5.pop();
    }

    drawHitZone() {
        this.p5.push();
        this.p5.noFill();
        this.p5.strokeWeight(3);
        
        for (let i = 0; i < 4; i++) {
            const x = this.laneXPositions[i];
            const lane = this.beatmap.lanes[i];
            const hue = this.laneColors[lane];
            
            this.p5.stroke(hue, 80, 100, 60);
            this.p5.circle(x, this.beatmap.hitZoneY, this.laneWidth);
        }
        
        this.p5.pop();
    }

    drawNote(note, currentTime) {
        const laneIndex = this.beatmap.lanes.indexOf(note.lane);
        const x = this.laneXPositions[laneIndex];
        const y = this.beatmap.getNoteY(note, currentTime);
        const hue = this.laneColors[note.lane];
        
        this.p5.push();
        
        // Note glow
        this.p5.noStroke();
        this.p5.fill(hue, 80, 100, 20);
        this.p5.circle(x, y, this.laneWidth * 1.2);
        
        // Note body
        this.p5.fill(hue, 80, 100, 80);
        this.p5.stroke(hue, 100, 100);
        this.p5.strokeWeight(2);
        this.p5.circle(x, y, this.laneWidth * 0.6);
        
        // Draw rune character on note
        this.p5.noStroke();
        this.p5.fill(0, 0, 100); // White text
        this.p5.textAlign(this.p5.CENTER, this.p5.CENTER);
        this.p5.textSize(24);
        this.p5.text(note.rune, x, y);
        
        // Approach circle
        const timeUntilHit = note.time - currentTime;
        const approachProgress = timeUntilHit / this.beatmap.approachTime;
        const approachSize = this.p5.lerp(this.laneWidth * 0.6, this.laneWidth * 1.5, approachProgress);
        
        this.p5.noFill();
        this.p5.stroke(hue, 100, 100, 40);
        this.p5.strokeWeight(2);
        this.p5.circle(x, y, approachSize);
        
        this.p5.pop();
    }

    drawApproachLines() {
        this.p5.push();
        this.p5.stroke(280, 50, 80, 10);
        this.p5.strokeWeight(1);
        
        // Draw reference lines every beat
        for (let i = 0; i < 10; i++) {
            const y = this.p5.map(i, 0, 10, this.beatmap.spawnY, this.beatmap.hitZoneY);
            this.p5.line(this.centerX, y, this.centerX + this.totalWidth, y);
        }
        
        this.p5.pop();
    }

    resize() {
        this.setup();
    }
}

// Make globally accessible
window.Beatmap = Beatmap;
window.BeatmapRenderer = BeatmapRenderer;

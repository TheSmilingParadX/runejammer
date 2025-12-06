let p5Canvas;
let backgroundLayer;
let beatTimes = []; // Track beat timestamps for BPM calculation

function setup() {
    p5Canvas = createCanvas(windowWidth, windowHeight);
    p5Canvas.parent('p5Canvas');
    colorMode(HSB, 360, 100, 100, 100);
    
    // Create persistent background layer
    backgroundLayer = createGraphics(windowWidth, windowHeight);
    backgroundLayer.colorMode(HSB, 360, 100, 100, 100);
    backgroundLayer.background(10, 20, 5); // Dark purple background
}

function draw() {
    // Display the persistent background
    image(backgroundLayer, 0, 0);
    
    // Update & Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].display();

        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }

    // Draw Beats - using Tone.js analyzer
    if (isPlaying && analyzer) {
        const waveform = analyzer.getValue();
        
        // Calculate energy from waveform
        let energy = 0;
        for (let i = 0; i < waveform.length; i++) {
            energy += Math.abs(waveform[i]);
        }
        energy = energy / waveform.length;
        
        document.getElementById('energy').textContent = energy.toFixed(2);

        // Detect beats based on energy threshold
        if (energy > 0.3 && Date.now() - lastBeatTime > 300) {
            lastBeatTime = Date.now();
            let beatX = random(width);
            let beatY = random(height);
            beats.push({ time: Date.now(), x: beatX, y: beatY });

            // Track beat times for BPM calculation
            beatTimes.push(Date.now());
            // Keep only last 10 beats for average
            if (beatTimes.length > 10) {
                beatTimes.shift();
            }
            
            // Calculate BPM if we have enough beats
            if (beatTimes.length >= 2) {
                let intervals = [];
                for (let i = 1; i < beatTimes.length; i++) {
                    intervals.push(beatTimes[i] - beatTimes[i-1]);
                }
                let avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
                let bpm = Math.round(60000 / avgInterval); // Convert ms to BPM
                document.getElementById('bpm').textContent = bpm;
            }

            // Create beat particles at a DIFFERENT random position
            createBeatParticles(random(width), random(height));
            
            // Draw beat ring to persistent background layer
            backgroundLayer.noFill();
            backgroundLayer.stroke(280, 80, 100, 30);
            backgroundLayer.strokeWeight(3);
            backgroundLayer.circle(beatX, beatY, 50);
        }
    }

    // Clean Old Beats
    beats = beats.filter(b => Date.now() - b.time < 500);

    // Draw Beat Indicators
    beats.forEach(beat => {
        const age = Date.now() - beat.time;
        const alpha = map(age, 0, 500, 100, 0);
        const size = map(age, 0, 500, 10, 50);

        noFill();
        stroke(280, 80, 100, alpha);
        strokeWeight(3);
        circle(beat.x, beat.y, size);
    });
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    // Recreate background layer at new size
    let oldLayer = backgroundLayer.get();
    backgroundLayer = createGraphics(windowWidth, windowHeight);
    backgroundLayer.colorMode(HSB, 360, 100, 100, 100);
    backgroundLayer.background(10, 20, 5);
    backgroundLayer.image(oldLayer, 0, 0);
}

class Particle {
    constructor(x, y, hue) {
        this.x = x;
        this.y = y;
        this.vx = random(-3, 3);
        this.vy = random(-3, 3);
        this.life = 100;
        this.hue = hue;
        this.size = random(3, 8);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life -= 1.5;
        this.vx *= 0.98;
        this.vy *= 0.98;
        
        // Bounce off walls
        if (this.x <= 0 || this.x >= windowWidth) {
            this.vx *= -0.8;
            this.x = constrain(this.x, 0, windowWidth);
        }
        if (this.y <= 0 || this.y >= windowHeight) {
            this.vy *= -0.8;
            this.y = constrain(this.y, 0, windowHeight);
        }
    }

    display() {
        noStroke();
        // Keep particles colored at full saturation
        fill(this.hue, 80, 100, this.life);
        circle(this.x, this.y, this.size);
        
        // Draw to persistent background layer
        backgroundLayer.noStroke();
        backgroundLayer.fill(this.hue, 80, 100, 15); // Lower opacity for trail
        backgroundLayer.circle(this.x, this.y, this.size);
    }

    isDead() {
        return this.life <= 0;
    }
}

function createSpellParticles(key) {
    const keyPositions = {
        'D': { x: random(windowWidth * 0.1, windowWidth * 0.3), y: windowHeight - 50 },
        'F': { x: random(windowWidth * 0.3, windowWidth * 0.5), y: windowHeight - 50 },
        'J': { x: random(windowWidth * 0.5, windowWidth * 0.7), y: windowHeight - 50 },
        'K': { x: random(windowWidth * 0.7, windowWidth * 0.9), y: windowHeight - 50 }
    };

    const keyColors = {
        'D': 280,   // purple
        'F': 180,   // cyan
        'J': 60,    // yellow
        'K': 0      // red
    };

    const pos = keyPositions[key];
    const hue = keyColors[key];

    // Create geyser effect
    createGeyser(pos.x, pos.y, hue);
}

function createGeyser(startX, startY, hue) {
    // Create a geyser that shoots upward
    let x = startX;
    let y = startY;
    let segments = 15;
    let segmentLength = 30;
    
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < 5; j++) {
            let p = new Particle(x + random(-10, 10), y, hue);
            p.vx = random(-1, 1);
            p.vy = random(-8, -3); // Shoot upward
            p.size = random(2, 6);
            particles.push(p);
        }
        
        x += random(-20, 20);
        y -= segmentLength;
        
        if (y < 0) break;
    }
}

function createBeatParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, 200));
    }
}
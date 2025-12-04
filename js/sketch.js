let p5Canvas;

function setup() {
    p5Canvas = createCanvas(windowWidth, windowHeight);
    p5Canvas.parent('p5Canvas');
    colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
    background(0, 0, 5, 15);
    
    // Update & Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].display();

        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }

    // Draw Beats
    if (isPlaying && meydaAnalyzer) {
        const features = meydaAnalyzer.get();

        if (features && features.energy) {
            document.getElementById('energy').textContent = features.energy.toFixed(2);

            if (features.energy > 0.7 && Date.now() - lastBeatTime > 300) {
                lastBeatTime = Date.now();
                beats.push({ time: Date.now(), x: random(width), y: random(height) });

                createBeatParticles(random(width), random(height));
            }
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
        this.vy += 0.1; // gravity.
        this.life -= 1.5;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    display() {
        noStroke();
        fill(this.hue, 80, 100, this.life);
        circle(this.x, this.y, this.size);
    }

    isDead() {
        return this.life <= 0;
    }
}

function createSpellParticles(key) {
    const keyPositions = {
        'D': { x: windowWidth / 2 - 90, y: windowHeight - 50 },
        'F': { x: windowWidth / 2 - 30, y: windowHeight - 50 },
        'J': { x: windowWidth / 2 + 30, y: windowHeight - 50 },
        'K': { x: windowWidth / 2 + 90, y: windowHeight - 50 }
    };

    const keyColors = {
        'D': 280,   // purple.
        'F': 180,   // cyan.
        'J': 60,    // yellow.
        'K': 0      // red.
    };

    const pos = keyPositions[key];
    const hue = keyColors[key];

    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(pos.x, pos.y, hue));
    }
}

function createBeatParticles(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, 200));
    }
}
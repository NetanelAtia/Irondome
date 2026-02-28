// קובץ game.js המלא והמעודכן – כולל ירי אויב בצבע שחור, ללא פיצוצים על פגיעות, וגודל שחקן מותאם

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let isGameRunning = false; // מציין אם המשחק פעיל


// === טעינת תמונות ===
const runImages = [new Image(), new Image()];
runImages[0].src = "pic/run1.png";
runImages[1].src = "pic/run2.png";

const backgroundImg = new Image(); backgroundImg.src = "pic/tlv.png";
const groundImg = new Image(); groundImg.src = "pic/ground.png";
const balisticImgs = [new Image(), new Image()];
balisticImgs[0].src = "pic/balisti.png";
balisticImgs[1].src = "pic/balisti2.png";
const boomImg = new Image(); boomImg.src = "pic/boom.png";
const ironDomeImg = new Image(); ironDomeImg.src = "pic/irondome.png";
const pcImg = new Image(); pcImg.src = "pic/pc.png";
const pcGreenImg = new Image(); pcGreenImg.src = "pic/pcgreen.png";
const rocketImgs = [new Image(), new Image()];
rocketImgs[0].src = "pic/rocket.png";
rocketImgs[1].src = "pic/rocket2.png";
const enemyImages = [new Image(), new Image()];
enemyImages[0].src = "pic/enemy1.png";
enemyImages[1].src = "pic/enemy2.png";
const tentImg = new Image();
tentImg.src = "pic/tent.png";
const bigBoomImg = new Image();
bigBoomImg.src = "pic/boom2.png";
const bossHitImg = new Image();
bossHitImg.src = "pic/bigenemyred.png";
const balisticRedImg = new Image();
balisticRedImg.src = "pic/balistired.png";
const b2MissileImg = new Image();
b2MissileImg.src = "pic/bobmb2.png";
const boomBossImg = new Image();
boomBossImg.src = "pic/boomboss.png";

const b2BonusImg = new Image();
b2BonusImg.src = "pic/b2bonus.png";


const flagImgs = [new Image(), new Image()];
flagImgs[0].src = "pic/flag.png";
flagImgs[1].src = "pic/flag2.png";
const heartImg = new Image();
heartImg.src = "pic/heart.png";
const bossImg = new Image();
bossImg.src = "pic/bigenemy.png";
const bossBombImg = new Image();
bossBombImg.src = "pic/bobmred.png";

const ammoImg = new Image();
ammoImg.src = "pic/ammo.png";

const boomSound = new Audio("sound/boom.mp3");
const rocketSound = new Audio("sound/rocket.mp3");
const shootSound = new Audio("sound/shoot.wav");
const enemyShootSound = new Audio("sound/shoot2.wav");

let playerName = ""; // שם השחקן שמוזן בהתחלה

let highScores = [];
let __scoreSubmitted = false;
let __finalScore = null;

// ===== High Scores (Firebase Realtime DB with local fallback) =====
const HS_PATH = (window.HS_PATH || "highScores");

function __loadHighScoresFallback() {
  try {
    const scores = JSON.parse(localStorage.getItem("highScores") || "[]");
    if (Array.isArray(scores)) {
      highScores = scores;
      highScores.sort((a, b) => (b.score || 0) - (a.score || 0));
      highScores = highScores.slice(0, 10);
    }
  } catch (e) {
    highScores = [];
  }
}

function __syncHighScoresFromFirebase() {
  if (!window.database) {
    __loadHighScoresFallback();
    return;
  }
  window.database.ref(HS_PATH).orderByChild("score").limitToLast(10).on("value", (snapshot) => {
    const list = [];
    snapshot.forEach((child) => list.push(child.val()));
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    highScores = list.slice(0, 10);
    // keep local cache as backup
    try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_) {}
}, (err) => {
    console.error("HighScores listener error:", err);
    __loadHighScoresFallback();
  });
}

function saveHighScore(name, score) {
  const s = Number(score || 0);
  if (!Number.isFinite(s) || s <= 0) return;
  const entry = { name: String(name || "Player").slice(0, 20), score: Math.round(s), timestamp: Date.now() };

  // Update local cache immediately (so UI that relies on localStorage still shows something)
  highScores.push({ name: entry.name, score: entry.score, timestamp: entry.timestamp });
  highScores.sort((a, b) => (b.score || 0) - (a.score || 0));
  highScores = highScores.slice(0, 10);
  try { localStorage.setItem("highScores", JSON.stringify(highScores)); } catch(_) {}

  // Push to Firebase if available
  if (window.database) {
    window.database.ref(HS_PATH).push(entry).catch((err) => {
      console.error("Failed to save score to Firebase:", err);
    });
  }
}

// Start syncing as soon as possible
setTimeout(__syncHighScoresFromFirebase, 0);
// ================================================================

const isIphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
const isMobile = isIphone || isAndroid;


let playerX = 100, playerY = 500, velocityY = 0, gravity = isIphone ? 0.35 : isAndroid ? 0.3 : 0.2, isJumping = false;
 isJumping = false;
let frame = 0, frameCounter = 0, isMovingRight = false, isMovingLeft = false, facingRight = true;
let balisticMissiles = [], balisticInterval = 2000, lastBalisticTime = Date.now();
let explosions = [], playerBullets = [], bulletSpeed = 3;
let ironDomeAmmo = 20, ironDomeRockets = [], rocketAnimFrame = 0;
let balisticAnimFrame = 0;
let balisticAnimCounter = 0;
let lives = 10, cityDamage = 0, score = 0;
let hearts = [];
let ammos = [];
let b2Bonuses = [];
let boss = null;
let bossActive = false;
let bossDirection = 1;
let bossHealth = 30;
let lastBossScore = -5000;
let scorePopups = [];
let paused = false;
let gameStartTime = Date.now();
let bossBombs = [];
let lastBombTime = 0;
let bombInterval = getRandomBombInterval();
let interceptedMissiles = 0; // טילים שיורטו
let killedEnemies = 0;       // אויבים שחוסלו
let bossHitCount = 0;        // כמה פעמים פגענו בבוס
let b2Plane = null;
let b2PlaneFlightCount = 0;
let b2PlaneIsWaiting = false;
let b2Missiles = [];
let nextBonusHitCount = 10 + Math.floor(Math.random() * 6); // 10 עד 15
let b2BonusFlashVisible = true;
let b2BonusFlashLastTime = Date.now();
let b2BonusGiven = false;
let bossExplosionTime = null; // זמן שבו הבוס התפוצץ
let bossIsDying = false;
let playerInvincibleUntil = 0; // זמן שבו מסתיים מצב בלתי פגיע

let groundEnemies = [], enemySpawnTimer = Date.now(), enemyInterval = 5000 + Math.random() * 3000, enemyAnimFrame = 0;
// כלומר: בין 5000ms (5 שניות) ל־8000ms (8 שניות)
let enemyBullets = [], enemyBulletSpeed = 4;
let enemyFrameCounter = 0;
let flagAnimCounter = 0;
let gameOver = false;
let gameWon = false;

let restartButton = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.7,
  width: 200,
  height: 50
};



function getRandomBombInterval() {
  return 1500 + Math.random() * 3000; // בין 1.5 ל־4.5 שניות
}


const pcX = 230 - 50;
const pcY = canvas.height - 200 - 80 + 40 - 15 - 20;

const ironDomeX = 320 - 50;
const ironDomeY = canvas.height - 200 - 100 + 40 - 15 - 50;

const tentPositions = [
  { x: ironDomeX + 150, y: canvas.height - 200 - 140 + 30 },
  { x: ironDomeX + 400, y: canvas.height - 200 - 140 + 30 },
  { x: ironDomeX + 650, y: canvas.height - 200 - 140 + 30 }
];


const flagX = tentPositions[2].x + 180;
const flagY = canvas.height - 200 - 240 + 30;


let flagAnimIndex = 0;

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ✅ Safety: reset score-submission lock only during an active run (not on menus)
  if (isGameRunning && !gameOver && (__scoreSubmitted || __finalScore !== null)) {
    __scoreSubmitted = false;
    __finalScore = null;
  }

  if (document.getElementById("startScreen").style.display !== "none") {
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(gameLoop);
    return;
}

  const now = Date.now();

// הבהוב של בונוס B2 – כל 500ms מחליף מצב
if (now - b2BonusFlashLastTime > 500) {
  b2BonusFlashVisible = !b2BonusFlashVisible;
  b2BonusFlashLastTime = now;
}


// מחיקת בונוסים (לבבות ותחמושת) שעברו 15 שניות
const BONUS_LIFESPAN = 15000; // 15 שניות במילישניות

hearts = hearts.filter(h => !h.collected && now - h.spawnTime <= BONUS_LIFESPAN);
ammos = ammos.filter(a => !a.collected && now - a.spawnTime <= BONUS_LIFESPAN);
b2Bonuses = b2Bonuses.filter(b => !b.collected && now - b.spawnTime <= 7000); // 🧨 7 שניות


  if (paused) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "yellow";
  ctx.font = "80px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);

  requestAnimationFrame(gameLoop);
  return;
}


  ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(groundImg, 0, canvas.height - 200, canvas.width, 200);

const nearPC = Math.abs(playerX - pcX) < 150;
  ctx.drawImage(nearPC ? pcGreenImg : pcImg, pcX, pcY, 100, 120);
ctx.drawImage(ironDomeImg, ironDomeX, ironDomeY, 140, 160);

if (gameOver) {
  // Lock final score the moment the game ends so UI + DB always match
  if (!__scoreSubmitted) {
    __scoreSubmitted = true;
    __finalScore = Math.round(Number(score || 0));
    // Freeze the score used everywhere after game end
    score = __finalScore;
    try { saveHighScore(playerName, __finalScore); } catch (e) { console.error("saveHighScore failed:", e); }
  } else if (typeof __finalScore === "number") {
    // Keep score stable on subsequent frames
    score = __finalScore;
  }

  if (gameWon) {
    const timeSinceBossExplosion = Date.now() - bossExplosionTime;

    if (timeSinceBossExplosion < 1000) {
      // ⏱️ הצגת תמונת פיצוץ מיוחדת במקום מסך YOU WIN
      ctx.drawImage(boomBossImg, boss.x, boss.y, 160, 160);
      requestAnimationFrame(gameLoop);
      return;
    }

const startY = 130; // 80 + 50


  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  // כותרת
  ctx.fillStyle = "lime";
ctx.font = "50px Arial"; // במקום 70px
ctx.fillText("YOU WIN!", canvas.width / 2, startY);

ctx.fillStyle = "white";
ctx.font = "22px Arial"; // במקום 28px

ctx.fillText(`Score: ${score}`, canvas.width / 2, startY + 50);
ctx.fillText(`City Damage: ${cityDamage}%`, canvas.width / 2, startY + 80);
ctx.fillText(`Boss Hits: ${bossHitCount}`, canvas.width / 2, startY + 110);
ctx.fillText(`Missiles Intercepted: ${interceptedMissiles}`, canvas.width / 2, startY + 140);
ctx.fillText(`Ground Enemies Killed: ${killedEnemies}`, canvas.width / 2, startY + 170);

ctx.font = "20px Arial"; // גם את זה נקטין
ctx.fillText("🏆 High Scores:", canvas.width / 2, startY + 210);


 for (let i = 0; i < highScores.length; i++) {
  const entry = highScores[i];
  ctx.fillText(`${i + 1}. ${entry.name} - ${entry.score}`, canvas.width / 2, startY + 240 + i * 25);
}



  // כפתור ריסטארט
restartButton.y = startY + 240 + highScores.length * 25 + 40;
  restartButton.x = canvas.width / 2 - restartButton.width / 2;

  ctx.fillStyle = "gray";
  ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);

  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.fillText("Restart", restartButton.x + restartButton.width / 2, restartButton.y + 33);

  ctx.textAlign = "start";

  requestAnimationFrame(gameLoop);
  return;
}


  // רקע שחור
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // טקסט "Game Over"
  ctx.fillStyle = "red";
  ctx.font = "60px Arial";
  ctx.fillText("GAME OVER", canvas.width / 2 - 180, canvas.height / 2 - 30);

  // כפתור Restart
  ctx.fillStyle = "gray";
  ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);

  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.fillText("Restart", restartButton.x + 50, restartButton.y + 35);

  requestAnimationFrame(gameLoop);
  return;
}





// ציור האוהלים
tentPositions.forEach(pos => {
ctx.drawImage(tentImg, pos.x, pos.y, 210, 140);
});

// ציור הדגל (אנימציה)
// 🎌 קוד לציור הדגל עם אנימציה איטית יותר וגודל מוקטן
flagAnimCounter++; // כל פריים סופר
if (flagAnimCounter >= 30) { // אחרי 30 פריימים (בערך חצי שנייה)
  flagAnimIndex = (flagAnimIndex + 1) % 2; // מחליף בין flag.png ל־flag2.png
  flagAnimCounter = 0; // מאפס את המונה
}

const currentFlagImg = flagImgs[flagAnimIndex]; // בוחר את התמונה הנוכחית של הדגל

// מצייר את הדגל בגודל מוקטן (160×240)
ctx.drawImage(currentFlagImg, flagX, flagY, 160, 240);

// ✈️ ציור מטוס B2 אם קיים
if (b2Plane) {
  b2Plane.x += b2Plane.speed;


  // ברגע שהמטוס יוצא מהמסך – מפסיקים לצייר אותו
  if (b2Plane.x > canvas.width + 100) {
    b2Plane = null;
  }
}


if (score >= lastBossScore + 10000 && !bossActive) {
boss = { x: canvas.width / 2 - 100, y: 80, flashUntil: 0 };
 
  bossActive = true;
  bossHealth = 30;

  bossHealth = 30;
  bossDirection = 1;
  lastBossScore = score;  // 🔁 מעדכן את הפעם האחרונה שהבוס הופיע
}


if (bossActive && boss) {
  // תנועה של הבוס ימינה ושמאלה
boss.x += bossDirection * 1;
  if (boss.x <= 0 || boss.x + 200 >= canvas.width) {
    bossDirection *= -1;
  }
boss.x += bossDirection * 1;
if (boss.x <= 0 || boss.x + 200 >= canvas.width) {
  bossDirection *= -1;
}

// זריקת פצצה מהבוס
if (now - lastBombTime > bombInterval) {
  bossBombs.push({
    x: boss.x + 70,
    y: boss.y + 100,
    vy: 3,
    exploded: false,
    explodeTime: 0
  });

  lastBombTime = now;
  bombInterval = getRandomBombInterval(); // מחשב זמן רנדומלי לזריקה הבאה
}


  // ציור הבוס
const bossImageToDraw = now < boss.flashUntil ? bossHitImg : bossImg;
ctx.drawImage(bossImageToDraw, boss.x, boss.y, 140, 140);

// === ציור פס חיים דינמי לפי מצב חיים ===
ctx.fillStyle = "red";
ctx.fillRect(boss.x, boss.y - 20, 200, 10); // רקע אדום מלא
ctx.fillStyle = "green";
ctx.fillRect(boss.x, boss.y - 20, 200 * (bossHealth / 30), 10); // קו ירוק פרופורציונלי
ctx.strokeStyle = "black";
ctx.strokeRect(boss.x, boss.y - 20, 200, 10); // מסגרת

// ✈️ ציור מטוס B2 – עף עד שליש המסך ועוצר
// ✈️ מטוס B2 – טס, עוצר, מסתובב וחוזר קצת אחורה




ctx.fillStyle = "white";
ctx.font = "12px Arial";
ctx.textAlign = "center";
ctx.fillText(`${bossHealth} hit${bossHealth === 1 ? '' : 's'} left`, boss.x + 100, boss.y - 12);
ctx.textAlign = "start";


  // ציור פס חיים
ctx.fillStyle = "red";
ctx.fillRect(boss.x, boss.y - 20, 200, 10);
ctx.fillStyle = "green";
ctx.fillRect(boss.x, boss.y - 20, 200 * (bossHealth / 30), 10);
ctx.strokeStyle = "black";
ctx.strokeRect(boss.x, boss.y - 20, 200, 10);

ctx.fillStyle = "white";
ctx.font = "12px Arial";
ctx.textAlign = "center";
ctx.fillText(`${bossHealth} hit${bossHealth === 1 ? '' : 's'} left`, boss.x + 100, boss.y - 12);
ctx.textAlign = "start"; // מחזיר למצב רגיל כדי שלא ישפיע על ציורים אחרים


  // בדיקת פגיעות מהשחקן
  for (let b = playerBullets.length - 1; b >= 0; b--) {
    const bullet = playerBullets[b];
    const hit = bullet.x < boss.x + 200 && bullet.x + 10 > boss.x &&
                bullet.y < boss.y + 120 && bullet.y + 4 > boss.y;
    if (hit) {
      bossHitCount++;
      bossHealth--;
      playerBullets.splice(b, 1);

if (bossHealth <= 0) {
  bossActive = false;
  bossIsDying = true;
  bossExplosionTime = Date.now();
scorePopups.push({
  text: "+1000",
  x: boss.x,
  y: boss.y,
  startTime: Date.now()
});


boomSound.currentTime = 0;
boomSound.play();

        break;
      }
    }
  }
}


  
  if (now - lastBalisticTime > balisticInterval) {
  lastBalisticTime = now;

const missilesInWave = 1 + Math.floor(Math.random() * 2); // בין 1 ל־2 טילים בלבד
  for (let i = 0; i < missilesInWave; i++) {
const baseDelay = 7000 + Math.random() * 2000;
const explodeDelay = isMobile ? baseDelay + 11000 : baseDelay;

   balisticMissiles.push({
  x: canvas.width + 50 + i * 50,
  y: Math.random() * 200 + 50,
  spawnTime: now,
  explodeAfter: explodeDelay,
  flash: false,
  lastFlash: 0,
  flashVisible: true
});

  }

  // לפעמים נמתין טיפה יותר עד לגל הבא
balisticInterval = 5000 + Math.random() * 2000; // הפסקה של 5–7 שניות בין גלים
}


for (let i = balisticMissiles.length - 1; i >= 0; i--) {
  const missile = balisticMissiles[i];
  missile.x -= 1; // תנועה איטית יותר
const timeLeft = missile.explodeAfter - (now - missile.spawnTime);

// אם נשארו פחות מ־3 שניות לפיצוץ – מתחילים להבהב
if (timeLeft <= 3000) {
  missile.flash = true;
}

// כל 200 מילישניות – נחליף מצב הבהוב
if (missile.flash) {
  if (now - missile.lastFlash >= 200) {
    missile.flashVisible = !missile.flashVisible;
    missile.lastFlash = now;
  }
}

// בחר איזו תמונה לצייר: רגילה או אדומה
let missileImage;
if (missile.flash && missile.flashVisible) {
  missileImage = balisticRedImg;
} else {
  missileImage = balisticImgs[balisticAnimFrame];
}


// צייר את הטיל
ctx.drawImage(missileImage, missile.x, missile.y, 160, 100);

  // אם הטיל הגיע לקצה שמאל
  if (missile.x < -150 || now - missile.spawnTime > missile.explodeAfter || missile.reachedEnd) {
    explosions.push({ x: missile.x, y: missile.y, time: now });
    boomSound.currentTime = 0;
    boomSound.play();
    cityDamage += 5;
    if (cityDamage >= 100) gameOver = true;
    balisticMissiles.splice(i, 1);
  } else if (missile.x < 0) {
    missile.reachedEnd = true; // פעם אחת בלבד
    missile.spawnTime = now;
    missile.explodeAfter = 500; // יתפוצץ תוך חצי שנייה
  }
}


if (now - enemySpawnTimer > enemyInterval) {
  enemySpawnTimer = now;
  enemyInterval = 5000 + Math.random() * 3000; // בין 5 ל־8 שניות
  groundEnemies.push({ x: canvas.width + 50, y: canvas.height - 200 - 120 + 35, lastShot: now, alive: true });
}



enemyFrameCounter++;
if (enemyFrameCounter >= 20) {
  enemyAnimFrame = (enemyAnimFrame + 1) % enemyImages.length;
  enemyFrameCounter = 0;
}

// 🧨 אנימציית טיל בליסטי
balisticAnimCounter++;
if (balisticAnimCounter >= 30) {
  balisticAnimFrame = (balisticAnimFrame + 1) % 2;
  balisticAnimCounter = 0;
}


  for (let i = groundEnemies.length - 1; i >= 0; i--) {
  const enemy = groundEnemies[i];
  if (!enemy.alive) continue;

  enemy.x -= 1.5;
  ctx.drawImage(enemyImages[enemyAnimFrame], enemy.x, enemy.y, 80, 120);

  if (now - enemy.lastShot > 2000) {
enemyBullets.push({ x: enemy.x, y: enemy.y + 50, vx: -enemyBulletSpeed });
  enemy.lastShot = now;

  // הפעלת הסאונד של ירי אויב
  enemyShootSound.currentTime = 0;
  enemyShootSound.play();
}


  for (let b = playerBullets.length - 1; b >= 0; b--) {
    const bullet = playerBullets[b];
    const hit = bullet.x < enemy.x + 80 && bullet.x + 10 > enemy.x &&
                bullet.y < enemy.y + 120 && bullet.y + 4 > enemy.y;

    if (hit) {
      playerBullets.splice(b, 1);
      groundEnemies.splice(i, 1);
      killedEnemies++;
      score += 100;
scorePopups.push({
  text: "+100",
  x: enemy.x,
  y: enemy.y,
  startTime: Date.now()
});

const rand = Math.random();
if (rand < 0.3) {  // רק ב־30% מהמקרים בכלל יופיע בונוס
  // סיכוי של 70% לתחמושת, 30% ללב
  if (Math.random() < 0.7) {
    ammos.push({
      x: enemy.x,
      y: enemy.y,
      collected: false,
      spawnTime: now
    });
  } else {
    hearts.push({
      x: enemy.x,
      y: enemy.y,
      collected: false,
      spawnTime: now
    });
  }
}




      break;
    }
  }
}


  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    bullet.x += bullet.vx;
    ctx.fillStyle = "black";
    ctx.fillRect(bullet.x, bullet.y, 10, 4);

    const hitPlayer = (
      bullet.x < playerX + 80 && bullet.x + 10 > playerX &&
      bullet.y < playerY + 120 && bullet.y + 4 > playerY
    );
  if (hitPlayer) {
  if (Date.now() > playerInvincibleUntil) {
    lives--;
  }
  enemyBullets.splice(i, 1);
  continue;
}

if (lives <= 0) {
  gameOver = true;
}

    if (bullet.x < -30) enemyBullets.splice(i, 1);
  }

  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const bullet = playerBullets[i];
    bullet.x += bullet.vx;
    ctx.fillStyle = "black";
    ctx.fillRect(bullet.x, bullet.y, 10, 4);
    if (bullet.x < -20 || bullet.x > canvas.width + 20) playerBullets.splice(i, 1);
  }

  for (let i = ironDomeRockets.length - 1; i >= 0; i--) {
    const rocket = ironDomeRockets[i];
    if (rocket.target) {
      const dx = (rocket.target.x + 30) - rocket.x; // מרכז לרוחב
const dy = (rocket.target.y + 30) - rocket.y; // מרכז לגובה

      const dist = Math.hypot(dx, dy);
      rocket.facingLeft = dx < 0;

      if (dist > 5) {
       rocket.x += dx / dist * 3;
      rocket.y += dy / dist * 3;

      } else {
        explosions.push({ x: rocket.x, y: rocket.y, time: now });
        boomSound.currentTime = 0; boomSound.play();
if (rocket.target?.isBoss) {
boss.flashUntil = Date.now() + 300;
bossHitCount++;
  bossHealth--;
if (!b2BonusGiven && boss && bossHitCount >= nextBonusHitCount && bossHealth > 0) {
    console.log("נוצר בונוס מהבוס!");

  b2Bonuses.push({
    x: boss.x + 70,
    y: boss.y + 100,
    vy: 2,
    collected: false,
    spawnTime: Date.now()
  });

  b2BonusGiven = true; // ✅ רק פעם אחת!
}



if (bossHealth <= 0) {
  bossActive = false;
  bossIsDying = true;
  bossExplosionTime = Date.now();
  scorePopups.push({
    text: "+1000",
    x: boss.x,
    y: boss.y,
    startTime: Date.now()
  });

explosions.push({ x: boss.x + 100, y: boss.y + 60, time: now });
  boomSound.currentTime = 0;
  boomSound.play();
}

} else if (balisticMissiles.includes(rocket.target)) {
  interceptedMissiles++; // סופרים טיל שיירטנו

  balisticMissiles.splice(balisticMissiles.indexOf(rocket.target), 1);
  score += 300;

  scorePopups.push({
  text: "+300",
  x: rocket.target.x,
  y: rocket.target.y,
  startTime: Date.now()
});

}

        ironDomeRockets.splice(i, 1);
        continue;
      }
  } else {
  rocket.x += rocket.vx;
  rocket.y += rocket.vy;
  if (rocket.y < -150 || rocket.x > canvas.width + 100) {
    ironDomeRockets.splice(i, 1);
  }
}

    rocketAnimFrame = (rocketAnimFrame + 1) % rocketImgs.length;
if (rocket.vx < 0) {
  // טס שמאלה – תהפוך את התמונה
  ctx.save();
  ctx.scale(-1, 1);
ctx.drawImage(rocketImgs[rocketAnimFrame], -rocket.x - 80, rocket.y, 80, 60);
  ctx.restore();
} else {
  // טס ימינה (או ישר למעלה) – ציור רגיל
if (rocket.facingLeft) {
  ctx.save();
  ctx.scale(-1, 1);
ctx.drawImage(rocketImgs[rocketAnimFrame], -rocket.x - 80, rocket.y, 80, 60);
  ctx.restore();
} else {
ctx.drawImage(rocketImgs[rocketAnimFrame], rocket.x, rocket.y, 80, 60);
}
}
  }

// 🚀 טילים של מטוס B2
for (let i = b2Missiles.length - 1; i >= 0; i--) {
  const missile = b2Missiles[i];

  // תנועה
  missile.x += missile.vx;
  missile.y += missile.vy;

  // ציור טיל – מלבן אדום קטן
  ctx.fillStyle = "red";
ctx.drawImage(b2MissileImg, missile.x, missile.y, 100, 30);

  // בדיקת פגיעה בבוס
if (
  bossActive &&
  missile.x > boss.x &&
  missile.x < boss.x + 140 &&
  missile.y > boss.y &&
  missile.y < boss.y + 140
) {
    bossHitCount++;
    bossHealth -= 10;

   if (bossHealth <= 0) {
  bossActive = false;
  bossIsDying = true;
  bossExplosionTime = Date.now();

      score += 1000;
      scorePopups.push({
        text: "+1000",
        x: boss.x,
        y: boss.y,
        startTime: Date.now()
      });

      boomSound.currentTime = 0;
      boomSound.play();
    }

    b2Missiles.splice(i, 1);

}


  // אם יוצא מהמסך
  else if (
    missile.x < -50 || missile.x > canvas.width + 50 ||
    missile.y < -50 || missile.y > canvas.height + 50
  ) {
    b2Missiles.splice(i, 1);
  }
}


  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
if (ex.big) {
  ctx.drawImage(bigBoomImg, ex.x - 100, ex.y - 100, 250, 250);
} else {
  ctx.drawImage(boomImg, ex.x - 50, ex.y - 50, 150, 150);
}
    if (now - ex.time > 1000) explosions.splice(i, 1);
  }

  playerY += velocityY; velocityY += gravity;
  if (playerY >= canvas.height - 200 - 120 + 35) {
    playerY = canvas.height - 200 - 120 + 35; velocityY = 0; isJumping = false;
  }
  if (isMovingRight) { playerX += 3; facingRight = true; }
if (isMovingLeft) { playerX -= 3; facingRight = false; }


  if (isMovingRight || isMovingLeft) {
    frameCounter++;
    if (frameCounter >= 10) {
      frame = (frame + 1) % runImages.length; frameCounter = 0;
    }
  } else frame = 0;

for (let i = bossBombs.length - 1; i >= 0; i--) {
  const bomb = bossBombs[i];

  if (!bomb.exploded) {
    bomb.y += bomb.vy;

    ctx.drawImage(bossBombImg, bomb.x, bomb.y, 50, 50);

    if (bomb.y >= canvas.height - 200 - 50) {
      bomb.exploded = true;
      bomb.explodeTime = now;
    }

    const hitPlayer = (
      bomb.x < playerX + 80 && bomb.x + 50 > playerX &&
      bomb.y < playerY + 120 && bomb.y + 50 > playerY
    );

   if (hitPlayer) {
  bomb.exploded = true;
  bomb.explodeTime = now;
  if (Date.now() > playerInvincibleUntil) {
    lives--;
    if (lives <= 0) gameOver = true;
  }
}


  } else {
    // ציור אפקט פיצוץ זמני
    ctx.drawImage(bigBoomImg, bomb.x - 60, bomb.y - 60, 140, 140);


    if (now - bomb.explodeTime > 600) {
      bossBombs.splice(i, 1);
    }
  }
}


  const imgToDraw = runImages[frame];
// ציור לבבות ותחמושות אם לא נאספו
hearts.forEach(h => {
  if (!h.collected) {
    ctx.drawImage(heartImg, h.x, h.y, 65, 65);
  }
});
ammos.forEach(a => {
  if (!a.collected) {
ctx.drawImage(ammoImg, a.x, a.y, 80, 80);
  }
});


// 🎁 ציור בונוס B2
const groundY = canvas.height - 200 - 60; // גובה הקרקע לבונוס

b2Bonuses.forEach(b => {
 playerInvincibleUntil = Date.now() + 10000; // 10 שניות בלתי פגיע

  if (!b.collected) {
    // תזוזה של הבונוס
    if (b.y + 60 < groundY) {
      b.y += b.vy;
    } else {
      b.y = groundY;
    }

    // בדיקה אם התמונה נטענה לפני ציור
    if (b2BonusImg.complete) {
      try {
        ctx.save();

        // הבהוב עם זוהר צהוב
        if (b2BonusFlashVisible) {
          ctx.shadowColor = "rgba(255, 255, 0, 1)";
          ctx.shadowBlur = 50;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.drawImage(b2BonusImg, b.x, b.y, 60, 60);
        ctx.restore();
      } catch (err) {
        console.error("שגיאה בציור בונוס:", err);
      }
    } else {
      console.warn("⚠️ התמונה של הבונוס עדיין לא נטענה");
    }
  }
});



// ציור השחקן
if (facingRight) {
  ctx.drawImage(imgToDraw, playerX, playerY, 80, 120);
} else {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(imgToDraw, -playerX - 80, playerY, 80, 120);
  ctx.restore();
}

if (bossIsDying && boss) {
  const timeSinceExplosion = Date.now() - bossExplosionTime;
  const explosionSize = 300;

  // מצייר את תמונת הפיצוץ על הבוס בגודל מוגדל ומרוכז
  ctx.drawImage(
    boomBossImg,
    boss.x - (explosionSize - 160) / 2,
    boss.y - (explosionSize - 160) / 2,
    explosionSize,
    explosionSize
  );

  if (timeSinceExplosion >= 1000) {
    bossIsDying = false;
    gameWon = true;
    gameOver = true;
  }
}


// === Show popup above the player for 5 seconds ===
let popupDuration = 5000; // 5 seconds
let elapsed = Date.now() - gameStartTime;

if (elapsed < popupDuration) {
  ctx.font = "24px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText("Use F and G to shoot", playerX + 40, playerY - 30);
  ctx.textAlign = "start"; // מחזיר את היישור הרגיל כדי שלא יפגע בטקסטים הבאים

}



const offsetY = isIphone ? 50 : 0;  // מזיז למטה רק באייפון

ctx.fillStyle = "black";
ctx.font = "20px Arial";
ctx.fillText(`Lives: ${lives}`, 20, 40 + offsetY);
ctx.fillText(`Score: ${score}`, 20, 70 + offsetY);
ctx.fillText(`Iron Dome Ammo: ${ironDomeAmmo}`, 20, 100 + offsetY);

ctx.fillStyle = "red";
ctx.fillText(`City Damage: ${cityDamage}%`, 20, 130 + offsetY);



// בדיקת איסוף בונוסים
const playerRect = { x: playerX, y: playerY, width: 80, height: 120 };

// לב – מוסיף חיים
hearts.forEach(h => {
  if (!h.collected &&
      playerX < h.x + 50 && playerX + 80 > h.x &&
      playerY < h.y + 50 && playerY + 120 > h.y) {
    h.collected = true;
    lives++;  // לא מגביל ל־10
  }
});


// תחמושת – מוסיף 10 טילים
ammos.forEach(a => {
  if (!a.collected &&
      playerX < a.x + 50 && playerX + 80 > a.x &&
      playerY < a.y + 50 && playerY + 120 > a.y) {
    a.collected = true;
    ironDomeAmmo += 10;
  }
});



// 🎁 איסוף בונוס B2 – יוצר מטוס פעם אחת בלבד
b2Bonuses.forEach(b => {
  if (!b.collected &&
      playerX < b.x + 50 && playerX + 80 > b.x &&
      playerY < b.y + 50 && playerY + 120 > b.y) {

    b.collected = true;

    // ✈️ יצירת מטוס רק אם לא קיים כבר
    if (!b2Plane) {
     if (!b2Plane) {
  b2Plane = {
    x: -100,
    y: boss ? boss.y : 100,
    speed: 3,
    stopX: canvas.width - 250, // עוצר לפני סוף המסך
    direction: "right",        // מתחיל ימינה
    stage: "fly",              // שלב ראשון
    turnedBack: false          // עוד לא הסתובב
  };
}

    }

    console.log("אספת את בונוס ה־B2!");
  }
});




const currentTime = Date.now();
scorePopups = scorePopups.filter(p => currentTime - p.startTime < 1000); // תצוגה לשנייה

scorePopups.forEach(p => {
  const elapsed = currentTime - p.startTime;
  const riseY = p.y - (elapsed / 10); // יעלה בהדרגה
  ctx.fillStyle = "yellow";
  ctx.font = "30px Arial";
  ctx.fillText(p.text, p.x, riseY);
});

if (b2Plane) {
  if (b2Plane.stage === "fly") {
    // טיסה רגילה ימינה
    b2Plane.x += b2Plane.speed;

    // כשהוא מגיע לנקודת העצירה – עובר לשלב הבא
if (b2Plane.x >= b2Plane.stopX) {
  b2Plane.x = b2Plane.stopX;
  b2Plane.speed = -2;
  b2Plane.direction = "left";
  b2Plane.stage = "return";

  // ✅ המתנה של 3 שניות לפני הירי
// פונקציה חדשה שמחכה עד שהבוס יגיע לצד שמאל ואז יורה
function waitAndShootB2Missiles() {
  const checkInterval = setInterval(() => {
    if (bossActive && boss && boss.x < canvas.width / 2) {
      clearInterval(checkInterval); // מפסיק לבדוק

     // יורה 2 טילים בלבד בהפרש של 300ms
for (let i = 0; i < 2; i++) {
  setTimeout(() => {
    const speedFactor = 100; // שים לב: אפשר לשנות למהירות שאתה רוצה
    b2Missiles.push({
      x: b2Plane.x + 30,
      y: b2Plane.y + 60,
      vx: (boss.x + 100 - b2Plane.x - 100) / speedFactor,
      vy: (boss.y + 60 - b2Plane.y - 40) / speedFactor,
      target: boss,
      exploded: false,
      time: Date.now()
    });
  }, i * 300);
}

    }
  }, 100); // בודק כל 100ms
}

// קריאה לפונקציה החדשה אחרי 1 שנייה
setTimeout(waitAndShootB2Missiles, 1000);


}


  } else if (b2Plane.stage === "return") {
    // טיסה קצרה שמאלה (לא עד ההתחלה)
    b2Plane.x += b2Plane.speed;

    // אחרי שהלך קצת שמאלה – עוצר סופית
    if (b2Plane.x < b2Plane.stopX - 120) {
      b2Plane.speed = 0;
    }
  }

  // ציור המטוס – עם כיוון הפוך אם הוא חוזר שמאלה
  if (b2Plane.direction === "left") {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(b2BonusImg, -b2Plane.x - 200, b2Plane.y, 200, 140);
    ctx.restore();
  } else {
    ctx.drawImage(b2BonusImg, b2Plane.x, b2Plane.y, 200, 140);
  }
}

  requestAnimationFrame(gameLoop);
}



document.addEventListener("keydown", (e) => {
  if (paused && e.code === "Space") {
    paused = false;
    return; // מבטל קפיצה מיותרת
  }



  // Debug / cheat: F4 adds score (desktop)
  if (e.code === "F4") {
    score += 5000;

    scorePopups.push({
      text: "+5000",
      x: 100,
      y: 100,
      startTime: Date.now()
    });

    console.log("F4 נלחץ – ניקוד עלה ב־5000!");
    return;
  }
// אם במסך הפתיחה – Enter מתחיל את המשחק
if (e.code === "Enter" && document.getElementById("startScreen").style.display !== "none") {
  startGame();
  return;
}

// אם המשחק בעצירה – Enter או ESC ממשיך את המשחק
if ((e.code === "Enter" || e.code === "Escape") && paused && !gameOver) {
  paused = false;
  return;
}

// אם המשחק לא בפאוז – רק ESC עוצר אותו
if (e.code === "Escape" && !paused && !gameOver) {
  paused = true;
  return;
}


  // המשך פעולות רגילות רק אם לא בפאוז
  if (!paused) {
  if (e.code === "Space" && !isJumping) {
      velocityY = isIphone ? -9 : isAndroid ? -9 : -8;
  isJumping = true;
}



    if (e.code === "ArrowRight") isMovingRight = true;
    if (e.code === "ArrowLeft") isMovingLeft = true;

  if (e.code === "KeyG" && isGameRunning) {
  const vx = facingRight ? bulletSpeed : -bulletSpeed;
  const offsetX = facingRight ? 80 : 0;
playerBullets.push({ x: playerX + offsetX, y: playerY + 65, vx });

  shootSound.currentTime = 0;
  shootSound.play();
}


if (e.code === "KeyF" && isGameRunning) {
      if (Math.abs(playerX - pcX) < 150 && ironDomeAmmo > 0) {
        let target = null;
        const unassignedMissiles = balisticMissiles.filter(m => !m.assigned);

        if (bossActive && unassignedMissiles.length > 0) {
          if (Math.random() < 0.5) {
            target = boss;
            target.isBoss = true;
          } else {
            target = unassignedMissiles[0];
            target.assigned = true;
          }
        } else if (bossActive) {
          target = boss;
          target.isBoss = true;
        } else if (unassignedMissiles.length > 0) {
          target = unassignedMissiles[0];
          target.assigned = true;
        }

        const rocket = {
          x: ironDomeX + 30,
          y: ironDomeY,
          target: target,
          vx: 0,
          vy: -5
        };

        if (!target) {
          rocket.vx = 2;
          rocket.vy = -2;
        }

       ironDomeRockets.push(rocket);
ironDomeAmmo--;
rocketSound.currentTime = 0;
rocketSound.play();

      }
    }
  }
});


document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowRight") isMovingRight = false;
  if (e.code === "ArrowLeft") isMovingLeft = false;
});




function handleCanvasClick(e) {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();

  const isTouch = e.type === "touchstart";
  const clientX = isTouch ? e.touches[0].clientX : e.clientX;
  const clientY = isTouch ? e.touches[0].clientY : e.clientY;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const mx = (clientX - rect.left) * scaleX;
  const my = (clientY - rect.top) * scaleY;

  if (gameOver) {
    if (
      mx >= restartButton.x &&
      mx <= restartButton.x + restartButton.width &&
      my >= restartButton.y &&
      my <= restartButton.y + restartButton.height
    ) {
      // התחלת המשחק מחדש
      playerX = 100;
      playerY = 500;
      lives = 10;
      cityDamage = 0;
      score = 0;
      interceptedMissiles = 0;
      killedEnemies = 0;
      bossHitCount = 0;
      balisticMissiles = [];
      explosions = [];
      groundEnemies = [];
      enemyBullets = [];
      playerBullets = [];
      ironDomeRockets = [];
      ironDomeAmmo = 20;
      hearts = [];
      ammos = [];
      b2BonusGiven = false;
      b2Plane = null;
      b2PlaneFlightCount = 0;
      b2PlaneIsWaiting = false;
      b2Missiles = [];
      nextBonusHitCount = 10 + Math.floor(Math.random() * 6);
      b2BonusFlashVisible = true;
      b2BonusFlashLastTime = Date.now();
      b2Bonuses = [];

      lastBalisticTime = Date.now();
      enemySpawnTimer = Date.now();
      gameStartTime = Date.now();

      boss = null;
      bossActive = false;
      bossHealth = 30;
      lastBossScore = -5000;

      // ✅ חשוב: לאפשר שמירה מחדש של שיאים בכל משחק חדש
      __scoreSubmitted = false;
      __finalScore = null;

      // (מומלץ) כדי למנוע מצב שהמשחק נשאר "ניצחון" או "עצור" מהסיבוב הקודם
      gameWon = false;
      paused = false;

      gameOver = false;
    }
  }
}


// תמיכה גם בעכבר וגם בטאץ'
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("touchstart", handleCanvasClick, { passive: false });




function startGame() {
  isGameRunning = true;

  const input = document.getElementById("playerNameInput");
  const name = input.value.trim();

  // --- הוספת הצגת ההודעה שוב בתוך startGame ---
if (isIphone) {
  const notice = document.getElementById("rotateNotice");
  notice.style.display = "block";
  setTimeout(() => {
    notice.style.display = "none";
  }, 5000);
}


  // בדיקה אם השם באנגלית בלבד
  const isValid = /^[A-Za-z ]+$/.test(name);
  if (!isValid) {
    alert("נא להזין שם באנגלית בלבד");
    return;
  }


// שמירת שם השחקן עם אות ראשונה גדולה
const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
playerName = formattedName;


  // בדיקה אם זה טלפון נייד
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    // iOS Safari: fullscreen/orientation APIs are inconsistent. Never let it break START.
    try {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const container = document.getElementById("container");

      // Fullscreen: skip on iOS (often unsupported on arbitrary elements)
      if (!isIOS && container) {
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => {});
        } else if (container.webkitRequestFullscreen) {
          try { container.webkitRequestFullscreen(); } catch (_) {}
        }
      }

      // Orientation lock (only works in some browsers, and usually only in fullscreen)
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    } catch (e) {
      console.warn("Mobile fullscreen/orientation skipped:", e);
    }
  }

    // ✅ Always allow saving a new score for this run
  __scoreSubmitted = false;
  __finalScore = null;

// הסתרת מסך הפתיחה
  document.getElementById("startScreen").style.display = "none";

  // התחלת שעון המשחק
  gameStartTime = Date.now();

  // ✅ הצגת כפתורי טאץ' רק לאחר התחלת המשחק
  if (isMobile) {
    document.getElementById("touchControls").style.display = "block";

    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    const upBtn = document.getElementById("upBtn");
    const fireBtn = document.getElementById("fireBtn");
    const rocketBtn = document.getElementById("rocketBtn");

    const prevent = (e) => {
      // חשוב באייפון: מונע double-tap zoom / scroll
      e.preventDefault();
      e.stopPropagation();
    };

    const on = (el, type, handler) => el.addEventListener(type, handler, { passive: false });

    const bindHold = (el, onDown, onUp) => {
      on(el, "touchstart", (e) => { prevent(e); onDown(); });
      on(el, "touchend", (e) => { prevent(e); onUp(); });
      on(el, "touchcancel", (e) => { prevent(e); onUp(); });
    };

    bindHold(leftBtn, () => (isMovingLeft = true), () => (isMovingLeft = false));
    bindHold(rightBtn, () => (isMovingRight = true), () => (isMovingRight = false));

    on(upBtn, "touchstart", (e) => {
      prevent(e);
      if (!isJumping) {
        velocityY = isIphone ? -9 : isAndroid ? -9 : -8;
        isJumping = true;
      }
    });

    on(fireBtn, "touchstart", (e) => {
      prevent(e);
      const vx = facingRight ? bulletSpeed : -bulletSpeed;
      const offsetX = facingRight ? 80 : 0;
      playerBullets.push({ x: playerX + offsetX, y: playerY + 65, vx });

      shootSound.currentTime = 0;
      shootSound.play();
    });

    on(rocketBtn, "touchstart", (e) => {
      prevent(e);
      if (Math.abs(playerX - pcX) < 150 && ironDomeAmmo > 0) {
        let target = null;
        const unassignedMissiles = balisticMissiles.filter(m => !m.assigned);

        if (bossActive && unassignedMissiles.length > 0) {
          if (Math.random() < 0.5) {
            target = boss;
            target.isBoss = true;
          } else {
            target = unassignedMissiles[0];
            target.assigned = true;
          }
        } else if (bossActive) {
          target = boss;
          target.isBoss = true;
        } else if (unassignedMissiles.length > 0) {
          target = unassignedMissiles[0];
          target.assigned = true;
        }

        const rocket = {
          x: ironDomeX + 30,
          y: ironDomeY,
          target: target,
          vx: 0,
          vy: -5
        };

        if (!target) {
          rocket.vx = 2;
          rocket.vy = -2;
        }

        ironDomeRockets.push(rocket);
        ironDomeAmmo--;
        rocketSound.currentTime = 0;
        rocketSound.play();
      }
    });
  }
}




// 🎮 הפעלת המשחק
gameLoop();

// תמיכה בלחיצה על Enter בטלפון (ולא רק מהמקלדת במחשב)
const inputField = document.getElementById("playerNameInput");

inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault(); // מונע ריענון דף
    startGame(); // מפעיל את המשחק
  }
});

inputField.addEventListener("input", () => {
  const words = inputField.value.split(" ");
  const capitalized = words.map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");
  inputField.value = capitalized;
});


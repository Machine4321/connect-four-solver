const boardEl = document.getElementById('board');
const dropZones = document.querySelectorAll('.drop-zone');
const statusText = document.getElementById('status-text');
const turnIndicator = document.getElementById('turn-indicator');
const difficultySelect = document.getElementById('difficulty-select');
const btnPlayRed = document.getElementById('btn-play-red');
const btnPlayYellow = document.getElementById('btn-play-yellow');
const btnRestart = document.getElementById('btn-restart');
const btnPlayAgain = document.getElementById('btn-play-again');
const modal = document.getElementById('winner-modal');
const winnerText = document.getElementById('winner-text');

const evalEl = document.getElementById('ai-eval');
const nodesEl = document.getElementById('ai-nodes');
const timeEl = document.getElementById('ai-time');

let gameState = {
    board: new Board(),
    moves: [],
    humanPlayer: 1, // 1 for Red, 2 for Yellow
    currentPlayer: 1, // 1 for Red, 2 for Yellow
    isThinking: false,
    gameOver: false,
    depth: 100, // 100 means API Optimal
    apiScores: null
};

// 1 = Red, 2 = Yellow. The bitboard doesn't inherently care about colors, 
// just "current player". But we track colors in UI.
// Red always plays first in our UI logic.
// In bitboard, player who plays the first move is 1st.

const worker = new Worker('worker.js');
worker.onmessage = function(e) {
    const result = e.data;
    
    // Update stats
    evalEl.textContent = result.score;
    nodesEl.textContent = result.nodes;
    timeEl.textContent = result.timeMs + 'ms';
    
    // Make AI move
    if (result.move !== -1 && !gameState.gameOver) {
        makeMove(result.move);
    }
};

function initBoard() {
    boardEl.innerHTML = '';
    for (let row = 5; row >= 0; row--) {
        for (let col = 0; col < 7; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${col}-${row}`;
            boardEl.appendChild(cell);
        }
    }
    updateStatus();
}

function startNewGame() {
    gameState.board = new Board();
    gameState.moves = [];
    gameState.currentPlayer = 1;
    gameState.isThinking = false;
    gameState.gameOver = false;
    gameState.depth = parseInt(difficultySelect.value);
    gameState.apiScores = null;
    
    document.querySelectorAll('.piece').forEach(p => p.remove());
    document.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
    document.querySelectorAll('.score-badge').forEach(b => {
        b.classList.remove('visible');
        b.textContent = '';
    });
    modal.classList.add('hidden');
    
    evalEl.textContent = '0';
    nodesEl.textContent = '0';
    timeEl.textContent = '0ms';
    
    updateStatus();
    fetchOptimalScores();
    
    // If AI goes first
    if (gameState.humanPlayer === 2) {
        requestAIMove();
    }
}

function updateStatus() {
    document.getElementById('drop-zones').setAttribute('data-turn', gameState.currentPlayer);
    turnIndicator.className = 'player-indicator ' + (gameState.currentPlayer === 1 ? 'red' : 'yellow');
    
    if (gameState.gameOver) {
        statusText.textContent = "Game Over!";
    } else if (gameState.isThinking) {
        statusText.textContent = "AI is thinking...";
    } else if (gameState.currentPlayer === gameState.humanPlayer) {
        statusText.textContent = "Your Turn!";
    } else {
        statusText.textContent = "AI's Turn...";
    }
}

function makeMove(col) {
    if (gameState.gameOver || !gameState.board.canPlay(col)) return;
    
    // Find row
    let row = 0;
    for (let r = 0; r < 6; r++) {
        if (!document.querySelector(`#cell-${col}-${r} .piece`)) {
            row = r;
            break;
        }
    }
    
    const cell = document.getElementById(`cell-${col}-${row}`);
    const piece = document.createElement('div');
    piece.className = `piece drop ${gameState.currentPlayer === 1 ? 'red' : 'yellow'}`;
    cell.appendChild(piece);
    
    // Check win BEFORE making move in bitboard, because checkWin checks current player's pieces
    if (gameState.board.isWinningMove(col)) {
        gameState.board.play(col);
        gameState.moves.push(col);
        handleWin(gameState.currentPlayer);
        return;
    }
    
    gameState.board.play(col);
    gameState.moves.push(col);
    
    if (gameState.moves.length === 42) {
        handleDraw();
        return;
    }
    
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    updateStatus();
    fetchOptimalScores().then(() => {
        if (gameState.currentPlayer !== gameState.humanPlayer && !gameState.gameOver) {
            requestAIMove();
        }
    });
}

async function fetchOptimalScores() {
    if (gameState.gameOver) return;
    
    const posStr = gameState.moves.map(m => m + 1).join('');
    try {
        const res = await fetch('https://connect4.gamesolver.org/solve?pos=' + posStr);
        const data = await res.json();
        gameState.apiScores = data.score;
        updateScoreBadges();
    } catch (e) {
        console.error('API Fetch failed', e);
        gameState.apiScores = null;
    }
}

function updateScoreBadges() {
    const scores = gameState.apiScores;
    if (!scores) return;
    
    dropZones.forEach((zone, col) => {
        const badge = zone.querySelector('.score-badge');
        const score = scores[col];
        if (score === 100) {
            badge.classList.remove('visible');
            return;
        }
        
        badge.classList.add('visible');
        badge.classList.remove('positive', 'negative', 'zero');
        
        if (score > 0) {
            badge.textContent = '+' + score;
            badge.classList.add('positive');
        } else if (score < 0) {
            badge.textContent = score;
            badge.classList.add('negative');
        } else {
            badge.textContent = '0';
            badge.classList.add('zero');
        }
    });
}

function requestAIMove() {
    gameState.isThinking = true;
    updateStatus();
    
    // If we want Optimal API move
    if (gameState.depth === 100 && gameState.apiScores) {
        setTimeout(() => {
            const scores = gameState.apiScores;
            let bestScore = -1000;
            let bestMoves = [];
            
            for (let i = 0; i < 7; i++) {
                if (scores[i] !== 100 && scores[i] > bestScore) {
                    bestScore = scores[i];
                }
            }
            
            for (let i = 0; i < 7; i++) {
                if (scores[i] === bestScore) {
                    bestMoves.push(i);
                }
            }
            
            // Pick a move closest to the center
            bestMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
            const move = bestMoves[0];
            
            evalEl.textContent = (bestScore > 0 ? '+' : '') + bestScore + ' (API)';
            nodesEl.textContent = '0';
            timeEl.textContent = '<1ms';
            
            makeMove(move);
        }, 300);
        return;
    }
    
    // Fallback to offline worker
    setTimeout(() => {
        worker.postMessage({
            moves: gameState.moves,
            depth: gameState.depth
        });
    }, 50);
}

function handleWin(player) {
    gameState.gameOver = true;
    gameState.isThinking = false;
    updateStatus();
    
    setTimeout(() => {
        winnerText.textContent = player === gameState.humanPlayer ? "You Win!" : "AI Wins!";
        modal.classList.remove('hidden');
    }, 1000);
}

function handleDraw() {
    gameState.gameOver = true;
    gameState.isThinking = false;
    updateStatus();
    
    setTimeout(() => {
        winnerText.textContent = "It's a Draw!";
        modal.classList.remove('hidden');
    }, 1000);
}

// Event Listeners
dropZones.forEach(zone => {
    zone.addEventListener('click', () => {
        if (gameState.gameOver || gameState.isThinking || gameState.currentPlayer !== gameState.humanPlayer) return;
        const col = parseInt(zone.getAttribute('data-col'));
        if (gameState.board.canPlay(col)) {
            makeMove(col);
        }
    });
});

btnRestart.addEventListener('click', startNewGame);
btnPlayAgain.addEventListener('click', startNewGame);

difficultySelect.addEventListener('change', () => {
    gameState.depth = parseInt(difficultySelect.value);
});

btnPlayRed.addEventListener('click', () => {
    gameState.humanPlayer = 1;
    btnPlayRed.classList.add('active');
    btnPlayYellow.classList.remove('active');
    startNewGame();
});

btnPlayYellow.addEventListener('click', () => {
    gameState.humanPlayer = 2;
    btnPlayYellow.classList.add('active');
    btnPlayRed.classList.remove('active');
    startNewGame();
});

// Initialize
initBoard();
startNewGame();

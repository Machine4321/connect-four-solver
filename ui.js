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
    depth: 8
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
    
    document.querySelectorAll('.piece').forEach(p => p.remove());
    document.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
    modal.classList.add('hidden');
    
    evalEl.textContent = '0';
    nodesEl.textContent = '0';
    timeEl.textContent = '0ms';
    
    updateStatus();
    
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
    
    if (gameState.currentPlayer !== gameState.humanPlayer && !gameState.gameOver) {
        requestAIMove();
    }
}

function requestAIMove() {
    gameState.isThinking = true;
    updateStatus();
    
    // Small timeout to allow UI to update
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
